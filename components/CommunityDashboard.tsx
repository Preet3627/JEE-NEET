import React, { useState, useRef } from 'react';
import { StudentData, DoubtData } from '../types';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/apiService';

interface CommunityDashboardProps {
  student: StudentData;
  allDoubts: DoubtData[];
  onPostDoubt: (question: string, image?: string) => void;
  onPostSolution: (doubtId: string, solution: string, image?: string) => void;
  onAskAi: () => void;
}

const CommunityDashboard: React.FC<CommunityDashboardProps> = ({ student, allDoubts, onPostDoubt, onPostSolution, onAskAi }) => {
  const { userRole, refreshUser } = useAuth();
  const [newDoubt, setNewDoubt] = useState('');
  const [doubtImage, setDoubtImage] = useState<string | null>(null);
  const [solutionTexts, setSolutionTexts] = useState<{[key: string]: string}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setDoubtImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostDoubt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoubt.trim()) return;
    onPostDoubt(newDoubt, doubtImage || undefined);
    setNewDoubt('');
    setDoubtImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePostSolution = (e: React.FormEvent, doubtId: string) => {
    e.preventDefault();
    const solutionText = solutionTexts[doubtId];
    if (!solutionText || !solutionText.trim()) return;
    onPostSolution(doubtId, solutionText);
    setSolutionTexts(prev => ({...prev, [doubtId]: ''}));
  };
  
  const handleUpdateDoubtStatus = async (doubtId: string, status: 'archived' | 'deleted') => {
      const confirmation = status === 'deleted'
        ? window.confirm("Are you sure you want to permanently delete this doubt?")
        : window.confirm("Are you sure you want to archive this doubt? It will be hidden from the main view.");
        
      if (confirmation) {
          try {
              await api.updateDoubtStatus(doubtId, status);
              refreshUser(); // This will re-fetch allDoubts from App.tsx
          } catch (error) {
              alert(`Failed to update doubt: ${error}`);
          }
      }
  };

  const filteredDoubts = userRole === 'admin'
    ? allDoubts.filter(d => d.status !== 'deleted')
    : allDoubts.filter(d => d.status === 'active' || !d.status);

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-6">Community Doubts Forum</h2>
      
      <form onSubmit={handlePostDoubt} className="mb-8">
        <textarea
          value={newDoubt}
          onChange={(e) => setNewDoubt(e.target.value)}
          className="w-full h-24 bg-gray-900/50 border border-gray-600 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          placeholder="Ask a question to the community..."
        />
        {doubtImage && (
            <div className="relative mt-2 w-fit">
                <img src={`data:image/jpeg;base64,${doubtImage}`} alt="Doubt preview" className="max-h-32 rounded-md border border-gray-600" />
                <button onClick={() => { setDoubtImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white">
                    <Icon name="trash" className="w-4 h-4" />
                </button>
            </div>
        )}
        <div className="flex items-center justify-end gap-4 mt-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600">
              <Icon name="image" /> {doubtImage ? 'Change Image' : 'Add Image'}
            </button>
            <button type="button" onClick={onAskAi} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600" title="Get an instant answer from the AI assistant">
              <Icon name="gemini" /> Ask AI
            </button>
            <button type="submit" disabled={!newDoubt.trim()} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
              Post Doubt
            </button>
        </div>
      </form>

      <div className="space-y-6">
        {filteredDoubts.length === 0 && <p className="text-gray-500 text-center py-8">No doubts have been posted yet. Be the first!</p>}
        
        {filteredDoubts.map(doubt => (
          <div key={doubt.id} className={`p-4 rounded-lg border ${doubt.status === 'archived' ? 'bg-gray-800/20 border-gray-700/50 opacity-70' : 'bg-gray-800/50 border-gray-700'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <img src={doubt.author_photo} alt={doubt.author_name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-white">{doubt.author_name} <span className="text-xs text-gray-400 font-normal">({doubt.user_sid})</span></p>
                  <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{doubt.question}</p>
                  {doubt.question_image && <img src={`data:image/jpeg;base64,${doubt.question_image}`} alt="Doubt attachment" className="mt-2 max-w-sm max-h-80 rounded-md" />}
                  <p className="text-xs text-gray-500 mt-2">{new Date(doubt.created_at).toLocaleString()}</p>
                </div>
              </div>
               {userRole === 'admin' && (
                    <div className="flex items-center gap-1">
                        {doubt.status === 'archived' && <span className="text-xs font-bold text-yellow-400">ARCHIVED</span>}
                        <button onClick={() => handleUpdateDoubtStatus(doubt.id, 'archived')} className="p-1.5 text-gray-400 hover:text-yellow-400"><Icon name="bell" className="w-4 h-4" /></button>
                        <button onClick={() => handleUpdateDoubtStatus(doubt.id, 'deleted')} className="p-1.5 text-gray-400 hover:text-red-400"><Icon name="trash" className="w-4 h-4" /></button>
                    </div>
                )}
            </div>
            
            <div className="mt-4 pl-12 space-y-3">
              {doubt.solutions.map(sol => (
                <div key={sol.id} className="flex items-start gap-3 border-t border-gray-700/50 pt-3">
                    <img src={sol.solver_photo} alt={sol.solver_name} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold text-cyan-400 text-sm">{sol.solver_name}</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{sol.solution}</p>
                       <p className="text-xs text-gray-500 mt-1">{new Date(sol.created_at).toLocaleString()}</p>
                    </div>
                </div>
              ))}
              <form onSubmit={(e) => handlePostSolution(e, doubt.id)} className="flex items-center gap-2 pt-2">
                <input 
                  type="text"
                  value={solutionTexts[doubt.id] || ''}
                  onChange={e => setSolutionTexts(prev => ({...prev, [doubt.id]: e.target.value}))}
                  className="flex-grow px-3 py-1.5 text-sm text-gray-200 bg-gray-900/50 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50"
                  placeholder="Write a solution..."
                />
                <button type="submit" disabled={!solutionTexts[doubt.id]?.trim()} className="p-2 text-white bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors disabled:opacity-50">
                  <Icon name="send" className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommunityDashboard;