import React, { useState } from 'react';
import AIGuide from './AIGuide';

interface AIGuideModalProps {
  onClose: () => void;
  examType?: 'JEE' | 'NEET';
}

const AIGuideModal: React.FC<AIGuideModalProps> = ({ onClose, examType }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-4xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex-grow overflow-y-auto">
          <AIGuide examType={examType} />
        </div>
        <div className="flex-shrink-0 flex justify-end p-4 border-t border-gray-700/50">
          <button onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
        </div>
      </div>
    </div>
  );
};

export default AIGuideModal;