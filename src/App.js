import React, { useState, useRef, useEffect } from 'react';
import './output.css';

function App() {
    const [messages, setMessages] = useState([]);
    const [dynamicDivs, setDynamicDivs] = useState([]);
    const messageInputRef = useRef(null);

    const sendMessage = () => {
        const message = messageInputRef.current.value.trim();
        if (message) {
            setMessages(prevMessages => [
                ...prevMessages,
                { sender: 'User', text: message },
                { sender: 'AI Assistant', text: 'got it okay' }
            ]);

            const numDivs = parseInt(message, 10);
            if (!isNaN(numDivs) && numDivs > 0) {
                const newDivs = Array.from({ length: numDivs }, (_, i) => `Div ${i + 1}`);
                setDynamicDivs(newDivs);
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
                    {dynamicDivs.map((text, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow-md flex-grow">
                            {text}
                        </div>
                    ))}
                </div>
            </div>
            <div className="w-1/3 bg-gray-100 p-4 flex flex-col">
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
                    />
                    <button onClick={sendMessage} className="bg-blue-500 text-white p-2 rounded-r-lg">
                        Send
                    </button>
                </div>
            </div>
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