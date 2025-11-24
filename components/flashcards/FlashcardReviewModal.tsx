
import React, { useState, useEffect } from 'react';
import { FlashcardDeck, Flashcard } from '../../types';
import Icon from '../Icon';
import { renderMarkdown } from '../../utils/markdownParser';

interface FlashcardReviewModalProps {
  deck: FlashcardDeck;
  onClose: () => void;
}

const subjectColors: Record<string, string> = {
  PHYSICS: 'border-cyan-500',
  CHEMISTRY: 'border-green-500',
  MATHS: 'border-amber-500',
  DEFAULT: 'border-purple-500',
};


const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({ deck, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);
  const [needsReview, setNeedsReview] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReviewComplete, setIsReviewComplete] = useState(false);
  const [reviewStage, setReviewStage] = useState<'initial' | 're-review'>('initial');

  useEffect(() => {
    // Shuffle cards on component mount
    setShuffledCards([...deck.cards].sort(() => Math.random() - 0.5));
  }, [deck]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };
  
  const handleShuffle = () => {
    setShuffledCards(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const advanceCard = (addToReview: boolean) => {
      if (addToReview) {
          setNeedsReview(prev => [...prev, shuffledCards[currentIndex]]);
      }

      if (currentIndex + 1 >= shuffledCards.length) {
          // End of current round
          if (needsReview.length > 0 && addToReview) { // if the last card was also marked for review
              const nextReviewCards = [...needsReview, shuffledCards[currentIndex]].sort(() => Math.random() - 0.5);
              setShuffledCards(nextReviewCards);
              setNeedsReview([]);
              setCurrentIndex(0);
              setReviewStage('re-review');
          } else if (needsReview.length > 0) {
              setShuffledCards([...needsReview].sort(() => Math.random() - 0.5));
              setNeedsReview([]);
              setCurrentIndex(0);
              setReviewStage('re-review');
          } else {
              setIsReviewComplete(true);
          }
      } else {
          setCurrentIndex(prev => prev + 1);
      }
      setIsFlipped(false);
  };
  
  const currentCard = shuffledCards[currentIndex];
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  if (!currentCard && !isReviewComplete) {
      return (
        <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
            <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
                <p className="text-center text-gray-400">This deck has no cards to review.</p>
                <button onClick={handleClose} className="mt-4 w-full px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
            </div>
        </div>
      )
  }
  
  const cardColorClass = subjectColors[deck.subject] || subjectColors.DEFAULT;

  return (
    <div className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-transparent ${contentAnimationClasses} flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <header className="flex-shrink-0 mb-4 flex justify-between items-center text-white">
            <div>
                <h2 className="text-2xl font-bold">{deck.name}</h2>
                {!isReviewComplete && (
                   <p className="text-sm text-gray-400">
                     {reviewStage === 're-review' && <span className="text-yellow-400 font-semibold">Reviewing missed cards... </span>}
                     Card {currentIndex + 1} of {shuffledCards.length}
                   </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                 {!isReviewComplete && (
                    <button onClick={handleShuffle} className="p-2 rounded-full hover:bg-white/10 text-gray-300" title="Shuffle Deck">
                        <Icon name="shuffle" className="w-5 h-5" />
                    </button>
                 )}
                <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-gray-300">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        </header>

        <div className="flex-grow flashcard-container min-h-[300px]" onClick={() => !isReviewComplete && setIsFlipped(!isFlipped)}>
            {isReviewComplete ? (
                 <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl">
                    <Icon name="trophy" className="w-20 h-20 text-yellow-400" />
                    <p className="text-2xl text-white text-center mt-4">Review Complete!</p>
                </div>
            ) : (
                <div className={`flashcard-inner ${isFlipped ? 'flashcard-flipped' : ''}`}>
                    <div className={`flashcard-front bg-[var(--glass-bg)] border-2 ${cardColorClass} flex items-center justify-center p-6 overflow-y-auto`}>
                        <div 
                            className="text-2xl text-white prose prose-invert prose-xl text-center break-words w-full"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentCard?.front || '') }}
                        />
                    </div>
                    <div className={`flashcard-back bg-gray-800/80 border-2 ${cardColorClass} flex items-center justify-center p-6 overflow-y-auto`}>
                        <div 
                            className="text-xl text-gray-300 prose prose-invert prose-lg text-center break-words w-full"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentCard?.back || '') }}
                        />
                    </div>
                </div>
            )}
        </div>
        
        <footer className="flex-shrink-0 flex justify-center items-center gap-4 pt-4 mt-4">
            {isReviewComplete ? (
                <button onClick={handleClose} className="px-8 py-4 text-base font-bold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Finish</button>
            ) : isFlipped ? (
                <>
                    <button onClick={() => advanceCard(true)} className="px-6 py-3 text-sm font-semibold rounded-lg bg-red-800/80 text-red-200 hover:bg-red-700/80">Needs Review</button>
                    <button onClick={() => advanceCard(false)} className="px-8 py-4 text-base font-bold rounded-lg bg-green-700/80 text-green-200 hover:bg-green-600/80">I Knew It</button>
                </>
            ) : (
                 <button onClick={() => setIsFlipped(true)} className="px-8 py-4 text-base font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                    Flip Card
                </button>
            )}
        </footer>
      </div>
    </div>
  );
};

export default FlashcardReviewModal;
