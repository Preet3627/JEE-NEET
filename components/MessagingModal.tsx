
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
            body: JSON.stringify({ recipient_sid: student.sid, content: newMessage }) // FIX: Added missing body to the fetch request.
        });
        if (!res.ok) throw new Error('Failed to send message');
        const sentMessage = await res.json();
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message.");
    } finally {
        setIsSending(false);
    }
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Messaging with {student.fullName}</h2>
        
        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {isLoading ? (
            <p className="text-center text-gray-400">Loading messages...</p>
          ) : (
            messages.length === 0 ? (
              <p className="text-center text-gray-400">No messages yet. Start the conversation!</p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`flex ${message.sender_sid === adminSid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-lg ${message.sender_sid === adminSid ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(message.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSendMessage} className="flex-shrink-0 flex items-center gap-2 pt-4 mt-4 border-t border-gray-700/50">
          <input 
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            className="flex-grow px-4 py-2 text-sm text-gray-200 bg-gray-900/50 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50"
            placeholder={isDemoMode ? "Messaging disabled in demo mode" : "Type your message..."}
            disabled={isDemoMode || isSending}
          />
          <button type="submit" disabled={isDemoMode || isSending || !newMessage.trim()} className="p-2 text-white bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors disabled:opacity-50">
            <Icon name="send" className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export { MessagingModal };