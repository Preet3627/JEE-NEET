import React, { useState } from 'react';
import { FlashcardDeck } from '../../types';

interface CreateEditDeckModalProps {
  deck: FlashcardDeck | null;
  onClose: () => void;
  onSave: (deck: FlashcardDeck) => void;
}

const CreateEditDeckModal: React.FC<CreateEditDeckModalProps> = ({ deck, onClose, onSave }) => {
  const [name, setName] = useState(deck?.name || '');
  const [subject, setSubject] = useState(deck?.subject || 'PHYSICS');
  const [chapter, setChapter] = useState(deck?.chapter || '');
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;

    const finalDeck: FlashcardDeck = {
      id: deck?.id || `deck_${Date.now()}`,
      name: name.trim(),
      subject: subject.trim().toUpperCase(),
      cards: deck?.cards || [],
      chapter: chapter.trim() || undefined,
      isLocked: deck?.isLocked || false,
    };
    onSave(finalDeck);
    handleClose();
  };
  
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">{deck ? 'Edit Deck' : 'Create New Deck'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400">Deck Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g., Organic Chemistry Reactions" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-bold text-gray-400">Subject Tag</label>
                <input required value={subject} onChange={e => setSubject(e.target.value)} className={inputClass} placeholder="e.g., CHEMISTRY" />
            </div>
            <div>
                <label className="text-sm font-bold text-gray-400">Chapter (Optional)</label>
                <input value={chapter} onChange={e => setChapter(e.target.value)} className={inputClass} placeholder="e.g., Aldehydes & Ketones" />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Save Deck</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEditDeckModal;