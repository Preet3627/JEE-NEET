
import React, { useState, useEffect, useRef } from 'react';
import { StudentData, MessageData } from '../types';
import Icon from './Icon';

interface MessagingModalProps {
  student: StudentData;
  onClose: () => void;
  isDemoMode: boolean;
}

const API_URL = '/api';

const MessagingModal: React.FC<MessagingModalProps> = ({ student, onClose, isDemoMode }) => {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adminSid = localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])).sid : 'ADMIN';

  useEffect(() => {
    const fetchMessages = async () => {
      if (isDemoMode) {
        setIsLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/messages/${student.sid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch messages');
        const data = await res.json();
        setMessages(data);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [student.sid, isDemoMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isDemoMode) return;
    
    setIsSending(true);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ recipient_sid: student.sid, content: newMessage })
        });
        if (!res.ok) throw new Error('Failed to send message');
        const sentMessage = await res.json();
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
    } catch (error) {
        console.error("Error sending message:", error);
        alert('Failed to send message.');
    } finally {
        setIsSending(false);
    }
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg h-[70vh] flex flex-col bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-[var(--glass-border)] flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Message to {student.fullName}</h2>
          <p className="text-sm text-gray-400">{student.sid}</p>
        </header>

        <main className="flex-grow p-4 overflow-y-auto">
            {isLoading ? <p className="text-center text-gray-400">Loading messages...</p> : 
             messages.length === 0 ? <p className="text-center text-gray-500">No messages yet.</p> :
             <div className="space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.sender_sid === adminSid ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender_sid === adminSid ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            <p>{msg.content}</p>
                            <p className="text-xs opacity-60 mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                ))}
             </div>
            }
             <div ref={messagesEndRef} />
        </main>
        
        <footer className="p-4 border-t border-[var(--glass-border)] flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={isDemoMode ? "Messaging disabled in Demo Mode" : "Type a message..."}
                    disabled={isSending || isDemoMode}
                    className="flex-grow px-4 py-2 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                />
                <button type="submit" disabled={isSending || isDemoMode || !newMessage.trim()} className="p-3 text-white bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon name="send" className="w-5 h-5" />
                </button>
            </form>
        </footer>
      </div>
    </div>
  );
};

export default MessagingModal;
