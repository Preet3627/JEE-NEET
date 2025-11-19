import React, { useState } from 'react';
import { FlashcardDeck, Flashcard, StudentData } from '../../types';
import { api } from '../../api/apiService';
import Icon from '../Icon';

interface AIGenerateFlashcardsModalProps {
  student: StudentData;
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
      const weaknessesContext = student.CONFIG.WEAK.length > 0 ? `Please pay special attention to these weaknesses: ${student.CONFIG.WEAK.join(', ')}.` : '';
      const fullPrompt = `${topic}. ${weaknessesContext}`;
      
      const result = await api.generateFlashcards({ topic: fullPrompt, syllabus: examSyllabus });
      setGeneratedCards(result.flashcards);
    } catch (err: any) {
      setError(err.error || 'Failed to generate flashcards. The AI service may be unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!generatedCards || generatedCards.length === 0) return;
    
    // Try to guess subject from syllabus or topic
    let subjectGuess = 'GENERAL';
    const lowerSyllabus = (examSyllabus + topic).toLowerCase();
    if (lowerSyllabus.includes('physics')) subjectGuess = 'PHYSICS';
    else if (lowerSyllabus.includes('chemistry')) subjectGuess = 'CHEMISTRY';
    else if (lowerSyllabus.includes('math')) subjectGuess = 'MATHS';

    const newDeck: FlashcardDeck = {
        id: `deck_${Date.now()}`,
        name: topic,
        subject: subjectGuess,
        cards: generatedCards,
    };
    onSaveDeck(newDeck);
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  
  const upcomingExams = student.EXAMS.filter(e => new Date(e.date) >= new Date());

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Generate Flashcards with AI</h2>
        
        {!generatedCards && (
            <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-400">Topic or Concept</label>
                    <input required value={topic} onChange={e => setTopic(e.target.value)} className={inputClass} placeholder="e.g., Quick formulas for Thermodynamics" />
                    <p className="text-xs text-gray-500 mt-1">The AI will also consider your listed weaknesses.</p>
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-400">Context from Exam Syllabus (Optional)</label>
                    <select value={examSyllabus} onChange={e => setExamSyllabus(e.target.value)} className={inputClass}>
                        <option value="">None</option>
                        {upcomingExams.map(exam => (
                            <option key={exam.ID} value={exam.syllabus}>
                                {exam.title} ({new Date(exam.date).toLocaleDateString()})
                            </option>
                        ))}
                    </select>
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
                    <button type="submit" disabled={isLoading} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
                    {isLoading ? 'Generating...' : 'Generate Cards'}
                    </button>
                </div>
            </form>
        )}
        
        {generatedCards && (
            <>
                <div className="flex-grow overflow-y-auto space-y-3 pr-2 my-4">
                    <h3 className="text-lg font-semibold text-cyan-400">Generated Cards ({generatedCards.length})</h3>
                     {generatedCards.map((card, index) => (
                        <div key={index} className="bg-gray-900/50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 font-semibold">FRONT</p>
                            <p className="text-sm text-gray-200">{card.front}</p>
                            <div className="border-t border-gray-700 my-2"></div>
                            <p className="text-xs text-gray-500 font-semibold">BACK</p>
                            <p className="text-sm text-gray-300">{card.back}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-700/50">
                    <button type="button" onClick={() => setGeneratedCards(null)} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Back</button>
                    <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">
                        Save to New Deck
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AIGenerateFlashcardsModal;