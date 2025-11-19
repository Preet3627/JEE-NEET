import React, { useState } from 'react';
import Icon from './Icon';

interface ExamTypeSelectionModalProps {
  onSelect: (examType: 'JEE' | 'NEET') => void;
}

const ExamTypeSelectionModal: React.FC<ExamTypeSelectionModalProps> = ({ onSelect }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleSelect = (examType: 'JEE' | 'NEET') => {
    setIsExiting(true);
    setTimeout(() => onSelect(examType), 300);
  };
  
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`}>
      <div className={`w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 text-center ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
        <p className="text-gray-300 mb-6">Please select your primary exam to personalize your experience.</p>
        
        <div className="space-y-4">
            <button 
                onClick={() => handleSelect('JEE')}
                className="w-full text-left p-4 rounded-lg bg-gray-800/50 border-2 border-transparent hover:border-cyan-500 transition-colors"
            >
                <h3 className="font-bold text-lg text-white">JEE (Engineering)</h3>
                <p className="text-sm text-gray-400">Physics, Chemistry & Mathematics</p>
            </button>
            <button 
                onClick={() => handleSelect('NEET')}
                className="w-full text-left p-4 rounded-lg bg-gray-800/50 border-2 border-transparent hover:border-green-500 transition-colors"
            >
                <h3 className="font-bold text-lg text-white">NEET (Medical)</h3>
                <p className="text-sm text-gray-400">Physics, Chemistry & Biology</p>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ExamTypeSelectionModal;