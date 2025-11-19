
import React, { useState } from 'react';
import Icon from './Icon';

interface MoveTasksModalProps {
  onClose: () => void;
  onConfirm: (newDate: string) => void;
  selectedCount: number;
}

const MoveTasksModal: React.FC<MoveTasksModalProps> = ({ onClose, onConfirm, selectedCount }) => {
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleConfirm = () => {
    onConfirm(newDate);
  };
  
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";


  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Move {selectedCount} Item(s)</h2>
        <p className="text-sm text-gray-400 mb-4">Select a new date for the selected tasks. This will update them to be one-off events on that date.</p>
        
        <div>
            <label className="text-sm font-bold text-gray-400">New Date</label>
            <input 
                type="date" 
                value={newDate} 
                onChange={e => setNewDate(e.target.value)} 
                className={inputClass} 
            />
        </div>

        <div className="flex justify-end gap-4 pt-6">
          <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
          <button onClick={handleConfirm} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Confirm Move</button>
        </div>
      </div>
    </div>
  );
};

export default MoveTasksModal;
