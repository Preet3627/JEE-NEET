import React, { useState } from 'react';
import { FlashcardDeck, Flashcard, StudentData } from '../../types';
import { api } from '../../api/apiService';
import Icon from '../Icon';

interface AIGenerateFlashcardsModalProps {
  student: StudentData | null;
  onClose: () => void;
  onSaveDeck: (deck: FlashcardDeck) => void;
}

const AIGenerateFlashcardsModal: React.FC<AIGenerateFlashcardsModalProps> = ({ student, onClose, onSaveDeck }) => {
  const [topic, setTopic] = useState('');
  const [examSyllabus, setExamSyllabus] = useState('');
  const [generatedCards, setGeneratedCards] = useState<Flashcard[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
        setError("Please enter a topic.");
        return;
    }
    
    setIsLoading(true);
    setError('');
    setGeneratedCards(null);

    try {
      const weaknessesContext = (student?.CONFIG.WEAK && student.CONFIG.WEAK.length > 0) ? `Consider these student weaknesses: ${student.CONFIG.WEAK.join(', ')}.` : '';
      const fullPrompt = `${topic}. ${weaknessesContext}`;
      
      const result = await api.generateFlashcards({ topic: fullPrompt, syllabus: examSyllabus });
      
      // Ensure cards have IDs
      const cardsWithIds = result.flashcards.map((card: any, idx: number) => ({
          ...card,
          id: `card_ai_${Date.now()}_${idx}`
      }));
      
      setGeneratedCards(cardsWithIds);
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.error || 'Failed to generate flashcards. AI service may be unavailable.';
      if (err && typeof err === 'object' && 'error' in err && err.error === 'AI_QUOTA_EXCEEDED') {
          errorMessage = "AI flashcard generation service temporarily unavailable due to quota limits or maintenance. Please try again later.";
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!generatedCards || generatedCards.length === 0) return;
    
    // Infer subject from syllabus or topic
    let subjectGuess = 'GENERAL';
    const context = (examSyllabus + topic).toLowerCase();
    if (context.includes('physics')) subjectGuess = 'PHYSICS';
    else if (context.includes('chemistry')) subjectGuess = 'CHEMISTRY';
    else if (context.includes('math')) subjectGuess = 'MATHS';
    else if (context.includes('bio')) subjectGuess = 'BIOLOGY';

    const newDeck: FlashcardDeck = {
        id: `deck_${Date.now()}`,
        name: topic.length > 30 ? topic.substring(0, 30) + '...' : topic,
        subject: subjectGuess,
        cards: generatedCards,
        isLocked: false
    };
    onSaveDeck(newDeck);
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  
  const upcomingExams = student?.EXAMS.filter(e => new Date(e.date) >= new Date()) || [];

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">AI Flashcard Generator</h2>
        
        {!generatedCards && (
            <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-400">Topic or Concept</label>
                    <input required value={topic} onChange={e => setTopic(e.target.value)} className={inputClass} placeholder="e.g., Organic Chemistry Mechanisms" />
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-400">Exam Context (Optional)</label>
                    <select value={examSyllabus} onChange={e => setExamSyllabus(e.target.value)} className={inputClass}>
                        <option value="">General</option>
                        {upcomingExams.map(exam => (
                            <option key={exam.ID} value={exam.syllabus}>
                                {exam.title} ({new Date(exam.date).toLocaleDateString()})
                            </option>
                        ))}
                    </select>
                </div>
                {error && <p className="text-sm text-red-400 text-center bg-red-900/20 p-2 rounded">{error}</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
                    <button type="submit" disabled={isLoading} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
                    {isLoading ? 'Thinking...' : 'Generate'}
                    </button>
                </div>
            </form>
        )}
        
        {generatedCards && (
            <>
                <div className="flex-grow overflow-y-auto space-y-3 pr-2 my-4 custom-scrollbar">
                    <h3 className="text-lg font-semibold text-cyan-400">Preview: {generatedCards.length} Cards</h3>
                     {generatedCards.map((card, index) => (
                        <div key={index} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                            <p className="text-xs text-gray-500 font-semibold uppercase">Front</p>
                            <p className="text-sm text-white mb-2">{card.front}</p>
                            <div className="border-t border-gray-700 my-2"></div>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Back</p>
                            <p className="text-sm text-gray-300">{card.back}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-700/50">
                    <button type="button" onClick={() => setGeneratedCards(null)} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Back</button>
                    <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">
                        Save to My Decks
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AIGenerateFlashcardsModal;