import React, { useState } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { simpleParse } from '../utils/simpleParser';
import { api } from '../api/apiService';

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
  const [parseMode, setParseMode] = useState<'non-ai' | 'ai'>('non-ai');

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  const handleNonAIParse = async () => {
    try {
      const result = simpleParse(inputText);

      if (result.error) {
        setError(result.error);
        return false;
      }

      if (result.practice_test) {
        onPracticeTestReady(result.practice_test);
        handleClose();
        return true;
      } else if (result.flashcard_deck) {
        onDataReady(result);
        handleClose();
        return true;
      } else if (result.schedules?.length || result.custom_widget) {
        onDataReady(result);
        handleClose();
        return true;
      } else {
        setError("Couldn't recognize data format. Try 'Subject: Task at Time' or 'Front | Back' for flashcards.");
        return false;
      }
    } catch (e) {
      console.error("Non-AI Parse error:", e);
      setError('An error occurred while parsing.');
      return false;
    }
  };

  const handleAIParse = async () => {
    const text = inputText.trim();

    const handleResult = (result: any) => {
      if (result.practice_test || result.homework_assignment) {
        onPracticeTestReady(result.practice_test || result.homework_assignment);
        handleClose();
      } else if (result.flashcard_deck) {
        onDataReady(result);
        handleClose();
      } else if (result.schedules?.length || result.schedule?.length || result.exams?.length || result.metrics?.length || result.custom_widget) {
        onDataReady(result);
        handleClose();
      } else {
        setError("The AI couldn't find any actionable data in your text. Please check the format or try rephrasing.");
      }
    };

    // Attempt 1: Parse as valid JSON (works offline)
    try {
      const jsonData = JSON.parse(text);
      if (jsonData && typeof jsonData === 'object') {
        if (jsonData.flashcard_deck || jsonData.homework_assignment || jsonData.practice_test || jsonData.schedules?.length || jsonData.schedule?.length || jsonData.exams?.length || jsonData.metrics?.length || jsonData.custom_widget) {
          handleResult(jsonData);
          return true;
        }
      }
    } catch (e) {
      // Not valid JSON, proceed to AI parsing.
    }

    // Attempt 2: If it looks like broken JSON, try to correct it online
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const correctionResult = await api.correctJson(text);
        const correctedData = JSON.parse(correctionResult.correctedJson);
        if (correctedData && Object.keys(correctedData).length > 0) {
          handleResult(correctedData);
          return true;
        }
      } catch (correctionError) {
        console.warn("AI JSON correction failed, falling back to text parser:", correctionError);
      }
    }

    // Attempt 3: Fallback to parsing as unstructured text online
    try {
      const result = await api.parseText(text, window.location.origin);
      handleResult(result);
      return true;
    } catch (parseError: any) {
      console.error("AI Parser error:", parseError);
      setError(parseError.error || 'Failed to parse data. The AI service may be unavailable or the format is unrecognized.');
      return false;
    }
  };

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('Please paste some text to parse.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      if (parseMode === 'non-ai') {
        await handleNonAIParse();
      } else {
        await handleAIParse();
      }
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
        {theme === 'liquid-glass' && (
          <div className="flex-shrink-0 flex items-center p-3 border-b border-[var(--glass-border)]">
            <div className="flex gap-2">
              <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500"></button>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h2 className="text-sm font-semibold text-white text-center flex-grow -ml-12">Smart Data Import</h2>
          </div>
        )}
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              {theme !== 'liquid-glass' && <h2 className="text-2xl font-bold text-white mb-2">Smart Data Import</h2>}
              <p className="text-sm text-gray-400">
                {parseMode === 'non-ai'
                  ? 'Fast local parsing - works offline'
                  : 'AI-powered parsing - requires internet'}
              </p>
            </div>
            <button onClick={onOpenGuide} className="text-xs font-semibold text-cyan-400 hover:underline flex-shrink-0">Formats Guide</button>
          </div>

          {/* Tab Selector */}
          <div className="flex p-1 bg-gray-900/50 rounded-xl border border-white/10 mb-4">
            <button
              onClick={() => setParseMode('non-ai')}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${parseMode === 'non-ai'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon name="sparkles" className="w-4 h-4" />
              Non-AI (Fast)
            </button>
            <button
              onClick={() => setParseMode('ai')}
              className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${parseMode === 'ai'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon name="gemini" className="w-4 h-4" />
              AI (Smart)
            </button>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder={parseMode === 'non-ai'
              ? "Examples:\nPhysics: Solve Chapter 1 at 5pm\nMaths: Integration Practice\nOr for Flashcards:\nQuestion | Answer\nMitochondria | Powerhouse of the cell"
              : "Paste any text - AI will extract tasks, exams, flashcards, or custom data automatically.\n\nExample:\n'I need to study Physics Chapter 5 tomorrow at 3pm and Chemistry organic compounds on Friday'"}
          />

          {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}

          <div className="flex justify-end items-center gap-4 pt-4 mt-4 border-t border-gray-700/50">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
            <button onClick={handleParse} disabled={isLoading} className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
              {isLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Parsing...</> : <><Icon name="upload" /> Import Data</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIParserModal;