
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
            