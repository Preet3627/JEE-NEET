
import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { renderMarkdown } from '../utils/markdownParser';

type ChatPart = { text: string } | { [key: string]: any };

interface AIChatPopupProps {
  history: { role: string; parts: ChatPart[] }[];
  onSendMessage: (prompt: string, imageBase64?: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const ChatMessage: React.FC<{ message: { role: string, parts: ChatPart[] } }> = ({ message }) => {
    const { currentUser } = useAuth();
    const isUser = message.role === 'user';
    
    const textPart = message.parts.find(part => 'text' in part && typeof part.text === 'string') as { text: string } | undefined;
    const messageText = textPart?.text || '';

    return (
        <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <Icon name="gemini" className="w-6 h-6 text-cyan-400 self-start flex-shrink-0" />}
            <div 
                className={`max-w-[80%] px-3 py-2 rounded-xl prose prose-invert prose-sm break-words ${isUser ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(messageText) }}
            />
            {isUser && currentUser?.profilePhoto && <img src={currentUser.profilePhoto} className="w-6 h-6 rounded-full self-start flex-shrink-0" alt="user" />}
        </div>
    );
};

const AIChatPopup: React.FC<AIChatPopupProps> = ({ history, onSendMessage, onClose, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom whenever history updates or loading state changes
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [history, isLoading]);


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            onSendMessage(`Import this JSON data: ${text}`);
        };
        reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !imageBase64) return;
    onSendMessage(prompt, imageBase64 || undefined);
    setPrompt('');
    setImageBase64(null);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  };
  
  const fullScreenClasses = 'w-screen h-screen top-0 left-0 bottom-0 right-0 rounded-none';
  const popupClasses = 'w-[360px] h-[520px] bottom-24 md:bottom-6 right-6';

  return (
    <div 
      className={`fixed bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl flex flex-col z-50 transition-all duration-300 ${isFullScreen ? fullScreenClasses : popupClasses}`}
    >
      <header
        className="p-3 border-b border-[var(--glass-border)] flex-shrink-0 flex justify-between items-center"
      >
        <div className="flex items-center gap-2">
            <Icon name="gemini" className="w-6 h-6 text-cyan-400" />
            <h3 className="font-bold text-white">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 md:hidden">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1v4m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 1v-4m0 0h-4m4 0l-5 5"></path></svg>
            </button>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
      </header>
      
      <main ref={chatBodyRef} className="flex-grow p-3 overflow-y-auto space-y-4">
        <ChatMessage message={{ role: 'model', parts: [{ text: "Hello! I'm your AI assistant. You can ask me to create, update, or delete schedule items for you. How can I help?" }] }} />
        {history.map((msg, index) => <ChatMessage key={index} message={msg} />)}
        {isLoading && (
            <div className="flex items-end gap-2 justify-start">
                <Icon name="gemini" className="w-6 h-6 text-cyan-400 self-start flex-shrink-0" />
                <div className="max-w-[80%] px-3 py-2 rounded-xl bg-gray-700 text-gray-200 rounded-bl-none">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></span>
                    </div>
                </div>
            </div>
        )}
      </main>

      <footer className="p-3 border-t border-[var(--glass-border)] flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input type="file" accept="image/*" ref={imageFileInputRef} onChange={handleImageFileChange} className="hidden" />
            <input type="file" accept=".json,text/json" ref={jsonFileInputRef} onChange={handleJsonFileChange} className="hidden" />
            <button type="button" onClick={() => jsonFileInputRef.current?.click()} title="Import JSON data" className="p-2 text-gray-400 hover:text-cyan-400 rounded-full bg-gray-700/50 flex-shrink-0">
                <Icon name="upload" className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => imageFileInputRef.current?.click()} title="Upload Image" className="p-2 text-gray-400 hover:text-cyan-400 rounded-full bg-gray-700/50 flex-shrink-0">
              <Icon name="image" className="w-5 h-5" />
            </button>
            <div className="relative flex-grow">
                 <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full px-4 py-2 pr-10 text-sm text-gray-200 bg-gray-900/50 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                />
                {imageBase64 && <div className="absolute top-1/2 right-3 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>}
            </div>
            <button type="submit" disabled={isLoading || (!prompt.trim() && !imageBase64)} className="p-2 text-white bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                <Icon name="send" className="w-5 h-5" />
            </button>
        </form>
      </footer>
    </div>
  );
};

export default AIChatPopup;
