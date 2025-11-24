
import React, { useState, useEffect, useMemo } from 'react';
import { StudentData, Config } from '../../types';
import Icon from '../Icon';
import { renderMarkdown } from '../../utils/markdownParser';

interface InteractiveFlashcardWidgetProps {
  student: StudentData;
  onUpdateConfig: (config: Partial<Config>) => void;
  onAddCard?: () => void;
  onReviewDeck?: (deckId: string) => void;
  onOpenDeck?: (deckId: string) => void; // New prop
}

const subjectColors: Record<string, string> = {
  PHYSICS: 'border-cyan-500',
  CHEMISTRY: 'border-green-500',
  MATHS: 'border-amber-500',
  BIOLOGY: 'border-emerald-500',
  DEFAULT: 'border-purple-500',
};

const InteractiveFlashcardWidget: React.FC<InteractiveFlashcardWidgetProps> = ({ student, onUpdateConfig, onAddCard, onReviewDeck, onOpenDeck }) => {
  const { settings, flashcardDecks = [] } = student.CONFIG;
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeCards = useMemo(() => {
    const selectedDeckIds = settings.dashboardFlashcardDeckIds || [];
    const targetDecks = selectedDeckIds.length > 0 
        ? flashcardDecks.filter(d => selectedDeckIds.includes(d.id))
        : flashcardDecks;

    if (targetDecks.length === 0) return [];
    
    const allCards = targetDecks.flatMap(deck => {
      return deck.cards.map(c => ({ ...c, _deckId: deck.id, _deckName: deck.name }));
    });
    
    return allCards.sort(() => Math.random() - 0.5);
  }, [settings.dashboardFlashcardDeckIds, flashcardDecks]);

  useEffect(() => { setCurrentIndex(0); }, [activeCards.length]);

  if (activeCards.length === 0) {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center relative group h-full flex flex-col items-center justify-center">
            <Icon name="cards" className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Quick Review</h3>
            <p className="text-sm text-gray-400">No flashcard decks found. Create one to start reviewing.</p>
            {onAddCard && (
                <button onClick={onAddCard} className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold">
                    Create Card
                </button>
            )}
        </div>
    );
  }

  const currentCard = activeCards[currentIndex];
  const currentDeckId = (currentCard as any)._deckId;
  const currentDeckName = (currentCard as any)._deckName;
  
  const deck = flashcardDecks.find(d => d.id === currentDeckId);
  const cardColorClass = deck ? (subjectColors[deck.subject] || subjectColors.DEFAULT) : subjectColors.DEFAULT;

  const handleNext = (e: React.MouseEvent) => { e.stopPropagation(); setIsFlipped(false); setTimeout(() => setCurrentIndex(prev => (prev + 1) % activeCards.length), 150); };
  const handlePrev = (e: React.MouseEvent) => { e.stopPropagation(); setIsFlipped(false); setTimeout(() => setCurrentIndex(prev => (prev - 1 + activeCards.length) % activeCards.length), 150); };
  
  const handleOpenDeckView = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onOpenDeck && currentDeckId) {
          onOpenDeck(currentDeckId);
      }
  };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm relative h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase">Quick Review</h2>
            <div className="flex gap-2">
                {onOpenDeck && (
                    <button onClick={handleOpenDeckView} className="p-1.5 bg-gray-700 hover:bg-purple-600 rounded-full text-white transition-colors" title={`Manage Deck: ${currentDeckName}`}>
                        <Icon name="book-open" className="w-4 h-4" />
                    </button>
                )}
                {onAddCard && (
                    <button onClick={onAddCard} className="p-1.5 bg-gray-700 hover:bg-cyan-600 rounded-full text-white transition-colors" title="Add New Card">
                        <Icon name="plus" className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
        
        <div className="flashcard-container cursor-pointer flex-grow min-h-[10rem]" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`flashcard-inner ${isFlipped ? 'flashcard-flipped' : ''}`}>
                <div className={`flashcard-front bg-gray-900/50 border-2 ${cardColorClass} overflow-y-auto flex flex-col justify-center`}>
                    <p className="text-xs text-gray-500 font-bold absolute top-2 left-2 uppercase">{currentDeckName}</p>
                    <div 
                        className="text-lg text-white line-clamp-6 prose prose-invert prose-sm text-center"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(currentCard.front) }}
                    />
                </div>
                <div className={`flashcard-back bg-gray-800/80 border-2 ${cardColorClass} overflow-y-auto flex items-center justify-center`}>
                    <div 
                        className="text-sm text-gray-300 line-clamp-6 prose prose-invert prose-sm text-center"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(currentCard.back) }}
                    />
                </div>
            </div>
        </div>
        
         <div className="flex justify-between items-center mt-4">
            <button onClick={handlePrev} className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-700 text-white"><Icon name="arrow-left" className="w-4 h-4" /></button>
            <p className="text-xs text-gray-400 font-semibold">{currentIndex + 1} / {activeCards.length}</p>
            <button onClick={handleNext} className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-700 text-white"><Icon name="arrow-right" className="w-4 h-4" /></button>
        </div>
    </div>
  );
};

export default InteractiveFlashcardWidget;
