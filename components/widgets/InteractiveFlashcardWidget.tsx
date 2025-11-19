import React, { useState, useEffect, useMemo } from 'react';
import { StudentData, Config, Flashcard, FlashcardDeck } from '../../types';
import Icon from '../Icon';

interface InteractiveFlashcardWidgetProps {
  student: StudentData;
  onUpdateConfig: (config: Partial<Config>) => void;
}

const subjectColors: Record<string, string> = {
  PHYSICS: 'border-cyan-500',
  CHEMISTRY: 'border-green-500',
  MATHS: 'border-amber-500',
  BIOLOGY: 'border-emerald-500',
  DEFAULT: 'border-purple-500',
};

const InteractiveFlashcardWidget: React.FC<InteractiveFlashcardWidgetProps> = ({ student, onUpdateConfig }) => {
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
    
    // Shuffle the combined cards
    return allCards.sort(() => Math.random() - 0.5);
  }, [settings.dashboardFlashcardDeckIds, flashcardDecks]);

  useEffect(() => {
    setCurrentIndex(0); // Reset index when decks change
  }, [activeCards.length]);

  if (activeCards.length === 0) {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center">
            <Icon name="cards" className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Quick Review</h3>
            <p className="text-sm text-gray-400">No flashcard decks selected for the dashboard. Go to Settings to choose which decks to review here.</p>
        </div>
    );
  }

  const currentCard = activeCards[currentIndex];
  const deck = flashcardDecks.find(d => d.cards.some(c => c.id === currentCard.id));
  const cardColorClass = deck ? (subjectColors[deck.subject] || subjectColors.DEFAULT) : subjectColors.DEFAULT;

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % activeCards.length);
    }, 150);
  };
  
  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + activeCards.length) % activeCards.length);
    }, 150);
  };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
            Quick Review
        </h2>
        <div className="flashcard-container cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`flashcard-inner ${isFlipped ? 'flashcard-flipped' : ''}`}>
                <div className={`flashcard-front bg-gray-900/50 border-2 ${cardColorClass}`}>
                    <p className="text-xl text-white">{currentCard.front}</p>
                </div>
                <div className={`flashcard-back bg-gray-800/80 border-2 ${cardColorClass}`}>
                    <p className="text-lg text-gray-300">{currentCard.back}</p>
                </div>
            </div>
        </div>
         <div className="flex justify-between items-center mt-4">
            <button onClick={handlePrev} className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-700 text-white">
                <Icon name="arrow-left" className="w-5 h-5" />
            </button>
            <p className="text-sm text-gray-400 font-semibold">{currentIndex + 1} / {activeCards.length}</p>
            <button onClick={handleNext} className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-700 text-white">
                <Icon name="arrow-right" className="w-5 h-5" />
            </button>
        </div>
    </div>
  );
};

export default InteractiveFlashcardWidget;
