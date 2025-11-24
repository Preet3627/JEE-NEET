
import React, { useState, useEffect, useMemo } from 'react';
import { StudentData, Config } from '../../types';
import Icon from '../Icon';

interface InteractiveFlashcardWidgetProps {
  student: StudentData;
  onUpdateConfig: (config: Partial<Config>) => void;
  onAddCard?: () => void;
}

const subjectColors: Record<string, string> = {
  PHYSICS: 'border-cyan-500',
  CHEMISTRY: 'border-green-500',
  MATHS: 'border-amber-500',
  BIOLOGY: 'border-emerald-500',
  DEFAULT: 'border-purple-500',
};

const InteractiveFlashcardWidget: React.FC<InteractiveFlashcardWidgetProps> = ({ student, onUpdateConfig, onAddCard }) => {
  const { settings, flashcardDecks = [] } = student.CONFIG;
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeCards = useMemo(() => {
    const selectedDeckIds = settings.dashboardFlashcardDeckIds || [];
    if (selectedDeckIds.length === 0) return [];
    
    const allCards = selectedDeckIds.flatMap(deckId => {
      const deck = flashcardDecks.find(d => d.id === deckId);
      return deck ? deck.cards : [];
    });
    
    return allCards.sort(() => Math.random() - 0.5);
  }, [settings.dashboardFlashcardDeckIds, flashcardDecks]);

  useEffect(() => { setCurrentIndex(0); }, [activeCards.length]);

  if (activeCards.length === 0) {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center relative group">
            <Icon name="cards" className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Quick Review</h3>
            <p className="text-sm text-gray-400">No flashcard decks selected. Go to Settings or Create one.</p>
            {onAddCard && (
                <button onClick={onAddCard} className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold">
                    Create Card
                </button>
            )}
        </div>
    );
  }

  const currentCard = activeCards[currentIndex];
  const deck = flashcardDecks.find(d => d.cards.some(c => c.id === currentCard.id));
  const cardColorClass = deck ? (subjectColors[deck.subject] || subjectColors.DEFAULT) : subjectColors.DEFAULT;

  const handleNext = () => { setIsFlipped(false); setTimeout(() => setCurrentIndex(prev => (prev + 1) % activeCards.length), 150); };
  const handlePrev = () => { setIsFlipped(false); setTimeout(() => setCurrentIndex(prev => (prev - 1 + activeCards.length) % activeCards.length), 150); };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm relative">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase">Quick Review</h2>
            {onAddCard && (
                <button onClick={onAddCard} className="p-1.5 bg-gray-700 hover:bg-cyan-600 rounded-full text-white transition-colors" title="Add New Card">
                    <Icon name="plus" className="w-4 h-4" />
                </button>
            )}
        </div>
        <div className="flashcard-container cursor-pointer h-40" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`flashcard-inner ${isFlipped ? 'flashcard-flipped' : ''}`}>
                <div className={`flashcard-front bg-gray-900/50 border-2 ${cardColorClass}`}>
                    <p className="text-lg text-white line-clamp-4">{currentCard.front}</p>
                </div>
                <div className={`flashcard-back bg-gray-800/80 border-2 ${cardColorClass}`}>
                    <p className="text-sm text-gray-300 line-clamp-5">{currentCard.back}</p>
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
