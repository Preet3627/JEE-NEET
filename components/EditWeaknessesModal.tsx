import React, { useState } from 'react';

interface EditWeaknessesModalProps {
  currentWeaknesses: string[];
  onClose: () => void;
  onSave: (weaknesses: string[]) => void;
}

const EditWeaknessesModal: React.FC<EditWeaknessesModalProps> = ({ currentWeaknesses, onClose, onSave }) => {
  const [weaknessesText, setWeaknessesText] = useState(currentWeaknesses.join('\n'));
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weaknessesArray = weaknessesText.split('\n').map(w => w.trim()).filter(Boolean);
    onSave(weaknessesArray);
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-2">Edit Priority Weaknesses</h2>
        <p className="text-sm text-gray-400 mb-4">List your main areas for improvement, one per line. These will be prioritized in your schedule.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={weaknessesText}
            onChange={(e) => setWeaknessesText(e.target.value)}
            className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="e.g., Integration by Parts&#10;Wave Optics&#10;Mole Concept"
          />
          <div className="flex justify-end gap-4 pt-2">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 transition-opacity">Save Weaknesses</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWeaknessesModal;
