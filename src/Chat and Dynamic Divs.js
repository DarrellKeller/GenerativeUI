<div class="flex flex-col md:flex-row h-screen">
  
  <div class="w-full md:w-2/3 bg-zinc-100 p-4">
    <div id="dynamic-container" class="flex flex-wrap gap-4"></div>
  </div>
  
  <div class="w-full md:w-1/3 bg-zinc-200 p-4 flex flex-col">
    <div id="chat-box" class="flex-grow overflow-y-auto bg-white p-4 rounded-lg mb-4">
      
    </div>
    <div class="flex">
      <input id="chat-input" type="text" class="flex-grow p-2 border border-zinc-300 rounded-l-lg" placeholder="Type a message...">
      <button id="send-button" class="bg-primary text-primary-foreground p-2 rounded-r-lg">Send</button>
    </div>
  </div>
</div>

<script>
  document.getElementById('send-button').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const dynamicContainer = document.getElementById('dynamic-container');
    
    const userMessage = chatInput.value.trim();
    if (userMessage) {
      // Add user message to chat
      const userMessageDiv = document.createElement('div');
      userMessageDiv.textContent = userMessage;
      userMessageDiv.className = 'bg-secondary text-secondary-foreground p-2 rounded-lg mb-2';
      chatBox.appendChild(userMessageDiv);
      
      // Add bot response to chat
      const botMessageDiv = document.createElement('div');
      botMessageDiv.textContent = 'got it okay';
      botMessageDiv.className = 'bg-accent text-accent-foreground p-2 rounded-lg mb-2';
      chatBox.appendChild(botMessageDiv);
      
      // Scroll chat to bottom
      chatBox.scrollTop = chatBox.scrollHeight;
      
      // Check if user message is a number
      const numDivs = parseInt(userMessage, 10);
      if (!isNaN(numDivs) && numDivs > 0) {
        // Clear existing divs
        dynamicContainer.innerHTML = '';
        
        // Create new divs
        for (let i = 0; i < numDivs; i++) {
          const newDiv = document.createElement('div');
          newDiv.className = 'bg-white p-4 rounded-lg shadow-md flex-grow';
          newDiv.textContent = `Div ${i + 1}`;
          dynamicContainer.appendChild(newDiv);
        }
      }
      
      // Clear chat input
      chatInput.value = '';
    }
  });
</script>
