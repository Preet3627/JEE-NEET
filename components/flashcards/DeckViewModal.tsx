
import React, { useState } from 'react';
import { FlashcardDeck, Flashcard } from '../../types';
import Icon from '../Icon';
import { renderMarkdown } from '../../utils/markdownParser';

interface DeckViewModalProps {
  deck: FlashcardDeck;
  onClose: () => void;
  onAddCard: () => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (cardId: string) => void;
  onStartReview: () => void;
}

const DeckViewModal: React.FC<DeckViewModalProps> = ({ deck, onClose, onAddCard, onEditCard, onDeleteCard, onStartReview }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <header className="flex-shrink-0 mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {deck.name}
                {deck.isLocked && <span title="This deck is locked and cannot be edited."><Icon name="lock-closed" className="w-5 h-5 text-yellow-400" /></span>}
            </h2>
            <p className="text-sm text-cyan-400 font-semibold">{deck.subject} {deck.chapter && ` - ${deck.chapter}`}</p>
        </header>

        <main className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {deck.cards.length > 0 ? (
                deck.cards.map(card => (
                    <div key={card.id} className="bg-gray-900/50 p-3 rounded-lg flex justify-between items-start gap-2 group">
                        <div className="flex-grow">
                            <p className="text-xs text-gray-500 font-semibold">FRONT</p>
                            <div 
                                className="text-sm text-gray-200 prose prose-invert prose-sm"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(card.front) }}
                            />
                            <div className="border-t border-gray-700 my-2"></div>
                            <p className="text-xs text-gray-500 font-semibold">BACK</p>
                            <div 
                                className="text-sm text-gray-300 prose prose-invert prose-sm"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(card.back) }}
                            />
                        </div>
                        {!deck.isLocked && (
                            <div className="flex-shrink-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEditCard(card)} className="p-1 text-gray-400 hover:text-white"><Icon name="edit" className="w-4 h-4" /></button>
                                <button onClick={() => onDeleteCard(card.id)} className="p-1 text-gray-400 hover:text-red-400"><Icon name="trash" className="w-4 h-4" /></button>
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500 py-10">This deck is empty. Add a card to get started!</p>
            )}
        </main>
        
        <footer className="flex-shrink-0 flex justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-700/50">
          <button onClick={onAddCard} disabled={deck.isLocked} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon name="plus" /> Add Card
          </button>
          <div className="flex gap-4">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
            <button onClick={onStartReview} disabled={deck.cards.length === 0} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">Start Review</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DeckViewModal;
