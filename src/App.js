import React, { useState, useRef, useEffect } from 'react';
import './output.css';

function App() {
    const [messages, setMessages] = useState([]);
    const [cells, setCells] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const messageInputRef = useRef(null);

    const sendMessage = async () => {
        const message = messageInputRef.current.value.trim();
        if (message) {
            const newUserMessage = { sender: 'User', text: message };
            setMessages(prevMessages => [...prevMessages, newUserMessage]);
            setError(null);
            setIsLoading(true);

            try {
                const response = await fetch('http://localhost:8000/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        message,
                        conversation_history: [] // We'll maintain this on the backend now
                    }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.detail}`);
                }
                
                const data = await response.json();
                
                setMessages(prevMessages => [
                    ...prevMessages,
                    { sender: 'AI Assistant', text: data.response }
                ]);

                if (data.action === 'create' || data.action === 'modify') {
                    setCells(data.cells);
                }
            } catch (error) {
                console.error('Error:', error);
                setError(error.message);
                setMessages(prevMessages => [
                    ...prevMessages,
                    { sender: 'AI Assistant', text: 'Sorry, there was an error processing your request.' }
                ]);
            } finally {
                setIsLoading(false);
            }

            messageInputRef.current.value = '';
        }
    };

    useEffect(() => {
        const messagesContainer = document.querySelector('#chat-box');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex h-screen">
            <div className="w-2/3 bg-gray-200 p-4">
                <div id="dynamic-container" className="flex flex-wrap gap-4">
                    {cells.map((cell, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow-md flex-grow">
                            {cell[`cell_${index}`].text && <p>{cell[`cell_${index}`].text}</p>}
                            {cell[`cell_${index}`].image && (
                                <div className="mt-2">
                                    {cell[`cell_${index}`].image.url && (
                                        <img 
                                            src={cell[`cell_${index}`].image.url} 
                                            alt={cell[`cell_${index}`].image.prompt}
                                            className="w-1/2 h-auto mt-2 rounded-lg"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="w-1/3 bg-gray-100 p-4 flex flex-col">
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">Error:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}
                <div id="chat-box" className="flex-grow overflow-y-auto bg-white p-4 rounded-lg mb-4">
                    {messages.map((message, index) => (
                        <Message key={index} sender={message.sender} text={message.text} />
                    ))}
                </div>
                <div className="flex">
                    <input
                        ref={messageInputRef}
                        type="text"
                        className="flex-grow p-2 border border-gray-300 rounded-l-lg"
                        placeholder="Type a message..."
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        disabled={isLoading}
                    />
                    <button 
                        onClick={sendMessage} 
                        className={`bg-blue-500 text-white p-2 rounded-r-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Loading...' : 'Send'}
                    </button>
                </div>
            </div>
            {isLoading && (
                <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}
        </div>
    );
}

function Message({ sender, text }) {
    const isUser = sender === 'User';
    const bgColor = isUser ? 'bg-blue-100' : 'bg-gray-100';

    return (
        <div className={`${bgColor} p-2 rounded-lg mb-2`}>
            <p className="font-bold">{sender}</p>
            <p>{text}</p>
        </div>
    );
}

export default App;