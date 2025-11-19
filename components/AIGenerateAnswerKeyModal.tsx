import React, { useState } from 'react';
import Icon from './Icon';
import { api } from '../api/apiService';

interface AIGenerateAnswerKeyModalProps {
  onClose: () => void;
  onKeyGenerated: (keyText: string) => void;
}

const AIGenerateAnswerKeyModal: React.FC<AIGenerateAnswerKeyModalProps> = ({ onClose, onKeyGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a test name or description.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await api.generateAnswerKey(prompt);
      // The backend returns a JSON string in the 'answerKey' field
      const parsedKey = JSON.parse(result.answerKey);
      // Format it for the textarea
      const formattedKey = Object.entries(parsedKey)
        .map(([q, a]) => `${q}:${a}`)
        .join('\n');
      onKeyGenerated(formattedKey);
      handleClose();
    } catch (err: any) {
      setError(err.error || 'Failed to generate key. The AI may not have found it or an error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";

  return (
    <div className={`fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-gray-800/80 border border-gray-600 rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Generate Answer Key with AI</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400">Test Name</label>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className={inputClass}
              placeholder="e.g., JEE Mains 2023 Jan 29 Shift 1 answer key"
            />
            <p className="text-xs text-gray-500 mt-1">Be as specific as possible for the best results.</p>
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
            <button onClick={handleGenerate} disabled={isLoading} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
              {isLoading ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIGenerateAnswerKeyModal;
