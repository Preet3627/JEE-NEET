
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

  // Offline regex-based parser
  const localParse = (text: string) => {
      const lines = text.split('\n');
      const schedules: any[] = [];
      let currentDay = 'MONDAY'; // Default

      const dayRegex = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i;
      const timeRegex = /(\d{1,2}:\d{2})/;
      const subjectRegex = /(PHYSICS|CHEMISTRY|MATHS|BIOLOGY|MATH)/i;

      lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;

          // Check for day header
          const dayMatch = trimmed.match(dayRegex);
          if (dayMatch) {
              currentDay = dayMatch[0].toUpperCase();
              return;
          }

          // Simple heuristic for a task: "Time - Subject - Topic"
          const timeMatch = trimmed.match(timeRegex);
          const subjectMatch = trimmed.match(subjectRegex);

          if (timeMatch && subjectMatch) {
              let normalizedSubject = subjectMatch[0].toUpperCase();
              if(normalizedSubject === 'MATH') normalizedSubject = 'MATHS';

              schedules.push({
                  id: `OFFLINE_${Date.now()}_${Math.random()}`,
                  type: 'ACTION',
                  day: currentDay,
                  time: timeMatch[0],
                  subject: normalizedSubject,
                  title: `${normalizedSubject} Session`,
                  detail: trimmed // Use full line as detail
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
    
    const handleResult = (result: any) => {
        if (result.practice_test || result.homework_assignment) {
            onPracticeTestReady(result.practice_test || result.homework_assignment);
        } else if (result.flashcard_deck) {
            onDataReady(result);
        } else if (result.schedules?.length || result.exams?.length || result.metrics?.length) {
            onDataReady(result);
        } else {
            setError("No structured data found. Try to rephrase or check format.");
        }
    };

    // 1. Valid JSON check
    try {
      const jsonData = JSON.parse(text);
      if (jsonData && typeof jsonData === 'object') {
        if (jsonData.flashcard_deck || jsonData.homework_assignment || jsonData.practice_test || jsonData.schedules?.length || jsonData.exams?.length || jsonData.metrics?.length) {
          handleResult(jsonData);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) { /* Not JSON */ }

    // 2. Backend API (Smart AI)
    try {
      const result = await api.parseText(text, window.location.origin);
      handleResult(result);
      setIsLoading(false);
      return;
    } catch (parseError: any) {
      console.warn("Online parsing failed, trying local fallback...", parseError);
    }

    // 3. Local Fallback (Regex)
    const localData = localParse(text);
    if (localData) {
        handleResult(localData);
        setError("Note: Processed offline. Some details might be simplified.");
    } else {
        setError("Failed to parse text. Please ensure internet connection for AI features or check text format.");
    }
    setIsLoading(false);
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
        {/* MacOS Traffic Light Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
            <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">AI Data Import</span>
        </div>

        <div className="p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Paste & Import</h2>
                    <p className="text-sm text-gray-400 mb-4">Paste unstructured text, raw JSON, or simple schedules.</p>
                </div>
                <button onClick={onOpenGuide} className="text-xs font-semibold text-cyan-400 hover:underline flex-shrink-0">View {examType} Guide</button>
            </div>
            
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g. 'Monday 10:00 Physics Rotational Motion' OR Paste JSON."
            />

            {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}

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
