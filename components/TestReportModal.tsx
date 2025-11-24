
import React, { useState } from 'react';
import { ResultData, StudentData, FlashcardDeck } from '../types';
import TestAnalysisReport from './TestAnalysisReport';
import SpecificMistakeAnalysisModal from './SpecificMistakeAnalysisModal';
import Icon from './Icon';

interface TestReportModalProps {
  result: ResultData;
  onClose: () => void;
  student: StudentData;
  onUpdateWeaknesses: (weaknesses: string[]) => void;
  onSaveDeck: (deck: FlashcardDeck) => void;
}

const TestReportModal: React.FC<TestReportModalProps> = ({ result, onClose, student, onUpdateWeaknesses, onSaveDeck }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [analyzingMistake, setAnalyzingMistake] = useState<number | null>(null);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };
  
  const handleSaveFlashcards = () => {
    if (!result.analysis?.suggestedFlashcards) return;
    
    const newDeck: FlashcardDeck = {
        id: `deck_mistakes_${result.ID}`,
        name: `Mistakes from ${new Date(result.DATE).toLocaleDateString()}`,
        subject: 'MIXED',
        cards: result.analysis.suggestedFlashcards.map((card, i) => ({...card, id: `card_${Date.now()}_${i}`})),
        isLocked: false,
    };
    onSaveDeck(newDeck);
    alert(`New deck "${newDeck.name}" created with ${newDeck.cards.length} flashcards!`);
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const hasFlashcards = result.analysis?.suggestedFlashcards && result.analysis.suggestedFlashcards.length > 0;

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Test Analysis Report</h2>
        
        <TestAnalysisReport 
            result={result}
            onAnalyzeMistake={setAnalyzingMistake}
        />

        <div className="flex justify-end items-center gap-4 mt-6">
            {hasFlashcards && (
                <button onClick={handleSaveFlashcards} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-500">
                    <Icon name="cards" /> Create Flashcard Deck
                </button>
            )}
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">Close</button>
        </div>

        {analyzingMistake !== null && (
            <SpecificMistakeAnalysisModal 
                questionNumber={analyzingMistake}
                onClose={() => setAnalyzingMistake(null)}
                onSaveWeakness={(topic) => {
                    const updatedWeaknesses = [...new Set([...student.CONFIG.WEAK, topic])];
                    onUpdateWeaknesses(updatedWeaknesses);
                }}
            />
        )}
      </div>
    </div>
  );
};

export default TestReportModal;
