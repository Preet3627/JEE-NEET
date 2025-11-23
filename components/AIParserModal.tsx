import React, { useState, useRef } from 'react';
import Icon from './Icon';
import { api } from '../api/apiService';
import { useAuth } from '../context/AuthContext';

interface AIParserModalProps {
  onClose: () => void;
  onDataReady: (data: any) => void;
  onPracticeTestReady: (data: any) => void;
  onOpenGuide: () => void;
  examType?: 'JEE' | 'NEET';
  animationOrigin?: { x: string, y: string };
}

const AIParserModal: React.FC<AIParserModalProps> = ({ onClose, onDataReady, onPracticeTestReady, onOpenGuide, examType, animationOrigin }) => {
  const { currentUser } = useAuth();
  const theme = currentUser?.CONFIG.settings.theme;
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  // Robust local parser for simple text schedules
  const localParse = (text: string) => {
      const lines = text.split('\n');
      const schedules: any[] = [];
      let currentDay = 'MONDAY'; 
      
      // Detects lines like "Monday", "Mon:", etc.
      const dayRegex = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i;
      // Detects time like "10:00", "2pm", "14.30"
      const timeRegex = /(\d{1,2}[:.]\d{2}|\d{1,2}\s?(?:am|pm))/i;
      
      const subjectRegex = /(PHYSICS|CHEMISTRY|MATHS|MATH|BIOLOGY|BOTANY|ZOOLOGY)/i;

      lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const dayMatch = trimmed.match(dayRegex);
          if (dayMatch) {
              currentDay = dayMatch[0].toUpperCase();
              return;
          }

          const timeMatch = trimmed.match(timeRegex);
          const subjectMatch = trimmed.match(subjectRegex);

          if (timeMatch && subjectMatch) {
              let normalizedSubject = subjectMatch[0].toUpperCase();
              if(normalizedSubject === 'MATH') normalizedSubject = 'MATHS';

              // Normalize time to HH:MM
              let timeStr = timeMatch[0].replace('.', ':');
              if (!timeStr.includes(':')) timeStr += ':00'; // "2pm" -> "2:00pm" handled by date parser usually, but simple "10" -> "10:00"

              schedules.push({
                  id: `OFFLINE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: 'ACTION',
                  day: currentDay,
                  time: timeStr, // UI handles standardizing this later or we can use a helper
                  title: `${normalizedSubject} Session`,
                  detail: trimmed,
                  subject: normalizedSubject
              });
          }
      });

      if (schedules.length > 0) {
          return { schedules };
      }
      return null;
  };

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('Please paste some text to parse.');
      return;
    }
    setIsLoading(true);
    setError('');

    const text = inputText.trim();
    
    const processResult = (result: any) => {
        if (!result || typeof result !== 'object') {
             throw new Error("Invalid data format.");
        }

        // Check for Practice Test / Homework
        if (result.practice_test || result.homework_assignment) {
            const testData = result.practice_test || result.homework_assignment;
            if (testData.questions && Array.isArray(testData.questions)) {
                onPracticeTestReady({ practice_test: testData }); // Pass wrapped object for consistency
                return true;
            }
        } 
        
        // Check for Flashcards
        if (result.flashcard_deck) {
             // Ensure it has cards
             if (result.flashcard_deck.cards && Array.isArray(result.flashcard_deck.cards)) {
                 onDataReady(result); // StudentDashboard handles { flashcard_deck: ... }
                 return true;
             }
        }
        
        // Check for Schedules/Exams/Metrics
        if ((result.schedules && Array.isArray(result.schedules)) || 
            (result.exams && Array.isArray(result.exams)) || 
            (result.metrics && Array.isArray(result.metrics))) {
            onDataReady(result);
            return true;
        }

        return false;
    };

    try {
        // 1. Try parsing as JSON directly
        try {
            const jsonData = JSON.parse(text);
            if (processResult(jsonData)) {
                setIsLoading(false);
                return;
            }
        } catch (e) { /* Not JSON */ }

        // 2. Try AI Correction/Parsing
        // If it looks like JSON but failed, ask AI to fix it.
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
             const fixed = await api.correctJson(text);
             const fixedJson = JSON.parse(fixed.correctedJson || fixed); // Backend might return object or string
             if (processResult(fixedJson)) {
                 setIsLoading(false);
                 return;
             }
        }

        // 3. Full Text AI Parse
        const aiResult = await api.parseText(text, window.location.origin);
        if (processResult(aiResult)) {
             setIsLoading(false);
             return;
        }

        // 4. Local Fallback
        const localData = localParse(text);
        if (localData && processResult(localData)) {
            setIsLoading(false);
            return;
        }
        
        throw new Error("Could not extract any valid schedules, tests, or flashcards.");

    } catch (err: any) {
        console.error("Import failed:", err);
        setError(err.message || "Failed to parse data. Please check the format.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const animationClasses = theme === 'liquid-glass' ? (isExiting ? 'genie-out' : 'genie-in') : (isExiting ? 'modal-exit' : 'modal-enter');
  const contentAnimationClasses = theme === 'liquid-glass' ? '' : (isExiting ? 'modal-content-exit' : 'modal-content-enter');

  return (
    <div
      className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`}
      style={{ '--clip-origin-x': animationOrigin?.x, '--clip-origin-y': animationOrigin?.y } as React.CSSProperties}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--modal-border-radius)] shadow-[var(--modal-shadow)] ${contentAnimationClasses} overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center px-4 py-3 border-b border-white/10 ${theme === 'liquid-glass' ? 'bg-black/20' : 'bg-transparent'}`}>
             {theme === 'liquid-glass' && (
                <div className="flex gap-2 mr-4">
                    <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56]"></button>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
             )}
             <h2 className="text-sm font-semibold text-white tracking-wide flex-grow text-center">AI Data Import</h2>
        </div>

        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-400">Paste unstructured text (e.g., "Maths exam on Friday") or raw JSON.</p>
                <button onClick={onOpenGuide} className="text-xs font-semibold text-cyan-400 hover:underline flex-shrink-0 flex items-center gap-1">
                    <Icon name="book-open" className="w-3 h-3" /> Guide
                </button>
            </div>
            
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Paste here..."
            />

            {error && <p className="text-sm text-red-400 mt-2 text-center bg-red-900/20 p-2 rounded">{error}</p>}

            <div className="flex justify-end items-center gap-4 pt-4 mt-4 border-t border-gray-700/50">
                <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
                <button onClick={handleParse} disabled={isLoading} className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
                    {isLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</> : <><Icon name="upload" /> Parse & Import</>}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AIParserModal;