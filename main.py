from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv
import random
import json
from pydantic import BaseModel
import logging
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
import sys
import replicate

load_dotenv()
# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    message: str
    conversation_history: list = []  # This will be empty from the frontend

conversation_history = []  # Global variable to store conversation history

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")

logger.info(f"REPLICATE_API_TOKEN: {REPLICATE_API_TOKEN[:5]}...{REPLICATE_API_TOKEN[-5:]}")

async def classify_message(message: str):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                json={
                    "model": "gpt-4-0125-preview",
                    "messages": [
                        {
                            "role": "system",
                            "content": "Your job is to classify user requests into 1 of 4 categories. Note that the user is using this interface to create cells for a project. respond only with json.\n1 User is trying to start a new creation.\n2 User is trying to modify something they created\n3 User is asking a question about what they are creating or for advice\n4 User's request doesn't fit into any of the above\n{classification: X where X is the number of the category this request belongs to.}"
                        },
                        {
                            "role": "user",
                            "content": message
                        }
                    ],
                    "temperature": 0.3,
                    "max_tokens": 100,
                    "top_p": 1,
                    "frequency_penalty": 0,
                    "presence_penalty": 0,
                    "response_format": {
                        "type": "json_object"
                    }
                }
            )
        
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Error in classify_message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error classifying message: {str(e)}")

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def generate_cells(message: str, conversation_history: list):
    try:
        system_message = {
            "role": "system",
            "content": "Your job is to create cells in JSON. When you create multiple cells, as an array, they are for the purpose of displaying information in an easy to understand, and logical way. You can think of these cells as pages in a book, frames in a story, or slides in a deck. Keep in mind that you may only need one cell for simple tasks, and that some cases will require more consistent elements across cells.\nEach cell may contain text or image, and may use multiple instances of image or text per cell depending on use case.\n\"image\" must have strictly defined properties.\n\"image\": {\n\"type\": can be \"square_image\", \"landscape_image\" and \"portrait_image\" Use the same type of image consistently unless instructed differently.\n\"prompt\": must always have a prompt of what image to display.\n}\nText can contain any description of text. Whatever is fitting for the use case. \nWhatever the user asks for must be translated into visual cells. Each cell must start with cell_X starting with cell_0. Cells are wrapped in an array called \"cells\". Take a break and generate in JSON"
        }
        
        messages = [system_message] + conversation_history + [{"role": "user", "content": message}]
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                json={
                    "model": "gpt-4-0125-preview",
                    "messages": messages,
                    "temperature": 0.08,
                    "max_tokens": 4095,
                    "top_p": 1,
                    "frequency_penalty": 0,
                    "presence_penalty": 0,
                    "response_format": {
                        "type": "json_object"
                    }
                }
            )
        
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except httpx.ReadTimeout:
        logger.error("Timeout error when calling OpenAI API")
        raise HTTPException(status_code=504, detail="OpenAI API request timed out")
    except Exception as e:
        logger.error(f"Error in generate_cells: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating cells: {str(e)}")

async def generate_image(prompt, aspect_ratio="1:1"):
    try:
        # Convert aspect ratio to the format expected by the model
        aspect_ratio_mapping = {
            "square_image": "1:1",
            "landscape_image": "16:9",
            "portrait_image": "9:16"
        }
        
        # Use the mapping if it's one of our custom types, otherwise use the input directly
        model_aspect_ratio = aspect_ratio_mapping.get(aspect_ratio, aspect_ratio)

        # Run the Flux Schnell model
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": prompt,
                "go_fast": True,
                "num_outputs": 1,
                "aspect_ratio": model_aspect_ratio,
                "output_format": "webp",
                "output_quality": 80
            }
        )

        # The output is a list with one item (the image URL)
        if output and isinstance(output, list) and len(output) > 0:
            return output[0]
        else:
            raise Exception("No image URL returned from Replicate")

    except replicate.exceptions.ReplicateError as e:
        logger.error(f"Replicate API error in generate_image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in generate_image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")

@app.post("/chat")
async def chat(chat_message: ChatMessage):
    global conversation_history
    try:
        classification = await classify_message(chat_message.message)
        classification_json = json.loads(classification)
        
        if classification_json["classification"] == 4:
            responses = [
                "I'm not really made to do this, just to help you make things.",
                "My purpose is to assist with creation, not general tasks.",
                "I'm designed to help with creative processes, not everyday questions."
            ]
            response = random.choice(responses)
            conversation_history.append({"role": "user", "content": chat_message.message})
            conversation_history.append({"role": "assistant", "content": response})
            return {"response": response, "cells": None}
        
        if classification_json["classification"] == 3:
            # Advice mode
            system_message = {
                "role": "system",
                "content": "Your job is to give advice based on the conversation here. Respond as a kind tutor, knowledgeable in all topics in plain text. Do not try to fix things, only guide in the right direction with small examples."
            }
            
            messages = [system_message] + conversation_history + [{"role": "user", "content": chat_message.message}]
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {OPENAI_API_KEY}"
                    },
                    json={
                        "model": "gpt-4-0125-preview",
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 1000,
                        "top_p": 1,
                        "frequency_penalty": 0,
                        "presence_penalty": 0
                    }
                )
            
            response.raise_for_status()
            advice = response.json()["choices"][0]["message"]["content"]
            
            conversation_history.append({"role": "user", "content": chat_message.message})
            conversation_history.append({"role": "assistant", "content": advice})
            
            return {
                "response": advice,
                "cells": None,
                "action": "answer"
            }
        
        cells_json = await generate_cells(chat_message.message, conversation_history)
        cells = json.loads(cells_json)
        
        # Generate images for cells that require them
        for cell in cells["cells"]:
            cell_content = cell[f"cell_{list(cell.keys())[0].split('_')[1]}"]
            if "image" in cell_content:
                image_prompt = cell_content["image"]["prompt"]
                aspect_ratio = cell_content["image"].get("type", "square_image")
                
                image_url = await generate_image(image_prompt, aspect_ratio)
                cell_content["image"]["url"] = image_url

        if classification_json["classification"] == 1:
            response = "New cells have been generated."
            action = "create"
        elif classification_json["classification"] == 2:
            response = "Cells have been changed."
            action = "modify"
        
        conversation_history.append({"role": "user", "content": chat_message.message})
        conversation_history.append({"role": "assistant", "content": cells_json})
        
        return {
            "response": response,
            "cells": cells["cells"],
            "action": action
        }
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI!"}