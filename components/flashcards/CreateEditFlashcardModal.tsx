
import React, { useState } from 'react';
import { Flashcard } from '../../types';

interface CreateEditFlashcardModalProps {
  card: Flashcard | null;
  deckId: string;
  onClose: () => void;
  onSave: (deckId: string, card: Flashcard) => void;
}

const CreateEditFlashcardModal: React.FC<CreateEditFlashcardModalProps> = ({ card, deckId, onClose, onSave }) => {
  const [front, setFront] = useState(card?.front || '');
  const [back, setBack] = useState(card?.back || '');
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    const finalCard: Flashcard = {
      id: card?.id || `card_${Date.now()}`,
      front: front.trim(),
      back: back.trim(),
    };
    onSave(deckId, finalCard);
    handleClose();
  };
  
  const textAreaClass = "w-full h-28 px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-gray-800/80 border border-gray-600 rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">{card ? 'Edit Card' : 'Add New Card'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400">Front (Question or Term)</label>
            <textarea required value={front} onChange={e => setFront(e.target.value)} className={textAreaClass} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400">Back (Answer or Definition)</label>
            <textarea required value={back} onChange={e => setBack(e.target.value)} className={textAreaClass} />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Save Card</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEditFlashcardModal;
