import React, { useState } from 'react';
import { ResultData } from '../types';

interface EditResultModalProps {
  result: ResultData;
  onClose: () => void;
  onSave: (result: ResultData) => void;
}

const EditResultModal: React.FC<EditResultModalProps> = ({ result, onClose, onSave }) => {
  const [score, setScore] = useState(result.SCORE);
  const [mistakesText, setMistakesText] = useState(result.MISTAKES.join('\n'));
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+\/\d+$/.test(score)) {
        alert('Please enter the score in the format "marks/total", e.g., "185/300".');
        return;
    }

    const mistakesArray = mistakesText.split(/[,;\n]/).map(m => m.trim()).filter(Boolean);
    if (mistakesArray.length === 0) {
        alert("Please list at least one mistake topic.");
        return;
    }
    
    const updatedResult: ResultData = {
        ...result,
        SCORE: score,
        MISTAKES: mistakesArray,
    };

    onSave(updatedResult);
    handleClose();
  };
  
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Edit Test Result</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400">Date</label>
            <input 
              disabled
              value={new Date(result.DATE).toLocaleDateString()} 
              className={`${inputClass} opacity-50`}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400">Score (e.g., 185/300)</label>
            <input 
              required 
              value={score} 
              onChange={e => setScore(e.target.value)} 
              className={inputClass}
              placeholder="185/300"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400">Mistake Topics</label>
            <textarea 
              required 
              value={mistakesText} 
              onChange={e => setMistakesText(e.target.value)} 
              className={`${inputClass} h-32`}
              placeholder="List each mistake topic on a new line, or separate with commas/semicolons..."
            ></textarea>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditResultModal;
