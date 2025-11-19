import React from 'react';
import { FlashcardDeck } from '../../types';
import Icon from '../Icon';

interface FlashcardManagerProps {
  decks: FlashcardDeck[];
  onAddDeck: () => void;
  onEditDeck: (deck: FlashcardDeck) => void;
  onDeleteDeck: (deckId: string) => void;
  onViewDeck: (deck: FlashcardDeck) => void;
  onStartReview: (deckId: string) => void;
  onGenerateWithAI: () => void;
}

const FlashcardManager: React.FC<FlashcardManagerProps> = ({ decks, onAddDeck, onEditDeck, onDeleteDeck, onViewDeck, onStartReview, onGenerateWithAI }) => {

  const groupedDecks = decks.reduce((acc, deck) => {
    const subject = deck.subject || 'UNCATEGORIZED';
    const chapter = deck.chapter || 'General';
    if (!acc[subject]) {
      acc[subject] = {};
    }
    if (!acc[subject][chapter]) {
      acc[subject][chapter] = [];
    }
    acc[subject][chapter].push(deck);
    return acc;
  }, {} as Record<string, Record<string, FlashcardDeck[]>>);


  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white">My Flashcard Decks</h2>
        <div className="flex items-center gap-2">
          <button onClick={onGenerateWithAI} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gray-700/80 hover:bg-gray-700">
            <Icon name="gemini" /> Generate with AI
          </button>
          <button onClick={onAddDeck} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
            <Icon name="plus" /> New Deck
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {decks.length > 0 ? (
          Object.keys(groupedDecks).sort().map(subject => (
            <div key={subject}>
                <h3 className="text-xl font-bold text-cyan-400 tracking-wider mb-4 border-b border-cyan-500/20 pb-2">{subject}</h3>
                {Object.keys(groupedDecks[subject]).sort().map(chapter => (
                    <div key={chapter} className="mb-6">
                        <h4 className="text-md font-semibold text-gray-300 mb-3 ml-2">{chapter}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groupedDecks[subject][chapter].map(deck => {
                                const handleLockToggle = () => onEditDeck({ ...deck, isLocked: !deck.isLocked });
                                const handleDelete = () => {
                                    if (deck.isLocked) {
                                        if (window.confirm("This deck is locked. Are you sure you want to delete it? This cannot be undone.")) {
                                            onDeleteDeck(deck.id);
                                        }
                                    } else {
                                        if (window.confirm(`Are you sure you want to delete the deck "${deck.name}"?`)) {
                                            onDeleteDeck(deck.id);
                                        }
                                    }
                                };
                                
                                return (
                                <div key={deck.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 flex flex-col justify-between group">
                                  <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2 pr-12">
                                            {deck.isLocked && <Icon name="lock-closed" className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                                            {deck.name}
                                        </h3>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={handleLockToggle} className="p-1 text-gray-400 hover:text-yellow-400" title={deck.isLocked ? 'Unlock Deck' : 'Lock Deck'}><Icon name={deck.isLocked ? 'lock-closed' : 'lock-open'} className="w-4 h-4" /></button>
                                            <button onClick={() => onEditDeck(deck)} disabled={deck.isLocked} className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><Icon name="edit" className="w-4 h-4" /></button>
                                            <button onClick={handleDelete} className="p-1 text-gray-400 hover:text-red-400"><Icon name="trash" className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2">{deck.cards.length} card(s)</p>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <button onClick={() => onViewDeck(deck)} className="flex-1 text-center px-3 py-2 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600">Manage</button>
                                    <button onClick={() => onStartReview(deck.id)} disabled={deck.cards.length === 0} className="flex-1 text-center px-3 py-2 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed">Review</button>
                                  </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 py-12 border-2 border-dashed border-gray-700 rounded-lg">
            <Icon name="cards" className="w-12 h-12 mx-auto text-gray-600" />
            <p className="mt-4 font-semibold">No flashcard decks found.</p>
            <p className="text-sm">Click "New Deck" to create your first one, or use the AI generator.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashcardManager;