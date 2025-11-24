
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
  
  const processResult = (result: any): boolean => {
    if (!result || typeof result !== 'object') {
        return false;
    }

    const testData = result.practice_test || result.homework_assignment;
    if (testData?.questions && Array.isArray(testData.questions)) {
        onPracticeTestReady(testData);
        return true;
    }
    
    if (result.flashcard_deck?.cards && Array.isArray(result.flashcard_deck.cards)) {
        onDataReady(result);
        return true;
    }
    
    if (result.custom_widget) {
        onDataReady(result);
        return true;
    }

    // Handle both singular 'schedule' and plural 'schedules'
    if ((result.schedules && result.schedules.length > 0) || (result.schedule && Array.isArray(result.schedule)) || result.exams?.length || result.metrics?.length) {
        onDataReady(result);
        return true;
    }

    return false;
  };

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('Please paste some text to parse.');
      return;
    }
    setIsLoading(true);
    setError('');

    const text = inputText.trim();

    // Attempt 1: Parse as valid JSON directly (works offline and is fastest)
    try {
      const jsonData = JSON.parse(text);
      if (processResult(jsonData)) {
        setIsLoading(false);
        return;
      }
    } catch (e) { /* Not valid JSON, proceed to AI parsing. */ }

    // Attempt 2: If it looks like broken JSON, try to correct it via AI
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        // The API returns the corrected object directly via json response
        const correctedData = await api.correctJson(text);
        if (processResult(correctedData)) {
            setIsLoading(false);
            return;
        }
      } catch (correctionError) {
        console.warn("AI JSON correction failed, falling back to text parser:", correctionError);
      }
    }
    
    // Attempt 3: Fallback to parsing as unstructured text via AI
    try {
      const result = await api.parseText(text, window.location.origin);
      if (!processResult(result)) {
         throw new Error("Could not extract any valid data. Please check the Guide for formatting examples.");
      }
    } catch (parseError: any) {
      console.error("AI Parser error:", parseError);
      setError(parseError.error || 'Failed to parse data. The AI service may be unavailable or the format is unrecognized.');
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
                <div>
                    {theme !== 'liquid-glass' && <h2 className="text-2xl font-bold text-white mb-2">AI Data Import</h2>}
                    <p className="text-sm text-gray-400">Paste unstructured text or raw JSON to import data.</p>
                </div>
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
