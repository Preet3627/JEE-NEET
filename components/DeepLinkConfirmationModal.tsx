
import React, { useState } from 'react';
import Icon from './Icon';

interface DeepLinkConfirmationModalProps {
  data: {
    schedules?: any[];
    exams?: any[];
    results?: any[];
    weaknesses?: string[];
  };
  onClose: () => void;
  onConfirm: () => void;
}

const DeepLinkConfirmationModal: React.FC<DeepLinkConfirmationModalProps> = ({ data, onClose, onConfirm }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  const counts = {
    schedules: data.schedules?.length || 0,
    exams: data.exams?.length || 0,
    results: data.results?.length || 0,
    weaknesses: data.weaknesses?.length || 0
  };

  const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Confirm Data Import</h2>
        <p className="text-sm text-gray-400 mb-4">A link has requested to add the following data to your account. Please review and confirm.</p>
        
        {totalItems > 0 ? (
          <div className="space-y-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            {counts.schedules > 0 && <p className="text-gray-200"><span className="font-bold text-cyan-400">{counts.schedules}</span> Schedule Item(s)</p>}
            {counts.exams > 0 && <p className="text-gray-200"><span className="font-bold text-cyan-400">{counts.exams}</span> Exam(s)</p>}
            {counts.results > 0 && <p className="text-gray-200"><span className="font-bold text-cyan-400">{counts.results}</span> Test Result(s)</p>}
            {counts.weaknesses > 0 && <p className="text-gray-200"><span className="font-bold text-cyan-400">{counts.weaknesses}</span> Weakness(es)</p>}
          </div>
        ) : (
          <p className="text-yellow-400 text-center">The link did not contain any valid data to import.</p>
        )}

        <div className="flex justify-end gap-4 pt-4 mt-4">
          <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
          <button onClick={handleConfirm} disabled={totalItems === 0} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
            Confirm & Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeepLinkConfirmationModal;
