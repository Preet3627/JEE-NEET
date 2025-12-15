import React, { useState, useMemo } from 'react';
import McqTimer from './components/McqTimer';
import Icon from './components/Icon';
import { getQuestionNumbersFromRanges } from './utils/qRangesParser';
import {
  HomeworkData,
  ResultData,
  StudentData,
  ScheduleItem,
  PracticeQuestion,
} from './types';
import AIGenerateAnswerKeyModal from './components/AIGenerateAnswerKeyModal';
import AIParserModal from './components/AIParserModal';
import { useAuth } from './context/AuthContext';

interface CustomPracticeModalProps {
  onClose: () => void;
  onSessionComplete: (
    duration: number,
    questions_solved: number,
    questions_skipped: number[]
  ) => void;
  initialTask?: HomeworkData | null;
  aiPracticeTest?: {
    questions: PracticeQuestion[];
    answers: Record<string, string | string[]>;
  } | null;
  aiInitialTopic?: string | null;
  defaultPerQuestionTime: number;
  onLogResult: (result: ResultData) => void;
  onUpdateWeaknesses: (weaknesses: string[]) => void;
  student: StudentData;
  onSaveTask: (task: ScheduleItem) => void;
  animationOrigin?: { x: string; y: string };
}

const parseAnswers = (text: string): Record<string, string | string[]> => {
  const answers: Record<string, string | string[]> = {};
  if (!text) return answers;

  try {
    const json = JSON.parse(text);
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      return json;
    }
  } catch {}

  text
    .split(/[,;\n]/)
    .map(v => v.trim())
    .forEach((entry, i) => {
      const [q, a] = entry.split(/[:=]/);
      if (q && a) answers[q.trim()] = a.trim();
      else if (entry) answers[(i + 1).toString()] = entry;
    });

  return answers;
};

export const CustomPracticeModal: React.FC<CustomPracticeModalProps> = ({
  onClose,
  onSessionComplete,
  initialTask,
  defaultPerQuestionTime,
  onLogResult,
  student,
  onUpdateWeaknesses,
  onSaveTask,
  animationOrigin,
}) => {
  const { currentUser } = useAuth();
  const theme = currentUser?.CONFIG?.settings?.theme;

  const [qRanges, setQRanges] = useState(initialTask?.Q_RANGES || '');
  const [subject] = useState(initialTask?.SUBJECT_TAG.EN || 'PHYSICS');
  const [category] = useState(
    initialTask ? 'Homework Practice' : (aiPracticeTest ? 'AI Generated' : '') // Adjust category if AI generated test is present
  );

  const [isTimerStarted, setIsTimerStarted] = useState(!!aiPracticeTest); // Start timer automatically if aiPracticeTest is provided
  const [practiceQuestions, setPracticeQuestions] =
    useState<PracticeQuestion[] | null>(aiPracticeTest?.questions || null); // Initialize with aiPracticeTest questions
  const [practiceAnswers, setPracticeAnswers] =
    useState<Record<string, string | string[]> | null>(aiPracticeTest?.answers || null); // Initialize with aiPracticeTest answers

  const [isExiting, setIsExiting] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const [isAiParserOpen, setIsAiParserOpen] = useState(false);

  const questionNumbers = useMemo(
    () => getQuestionNumbersFromRanges(qRanges),
    [qRanges]
  );

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  const animationClasses =
    theme === 'liquid-glass'
      ? isExiting
        ? 'genie-out'
        : 'genie-in'
      : isExiting
      ? 'modal-exit'
      : 'modal-enter';

  const contentAnimationClasses =
    theme === 'liquid-glass'
      ? ''
      : isExiting
      ? 'modal-content-exit'
      : 'modal-content-enter';

  return (
    <div
      className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`}
      onClick={handleClose}
      style={
        {
          '--clip-origin-x': animationOrigin?.x,
          '--clip-origin-y': animationOrigin?.y,
        } as React.CSSProperties
      }
    >
      <div
        className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-xl ${contentAnimationClasses} overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {theme === 'liquid-glass' && (
          <div className="flex items-center p-3 border-b border-[var(--glass-border)]">
            <div className="flex gap-2">
              <button className="w-3 h-3 rounded-full bg-red-500" title="Close" aria-label="Close window" />
              <button className="w-3 h-3 rounded-full bg-yellow-500" title="Minimize" aria-label="Minimize window" />
              <button className="w-3 h-3 rounded-full bg-green-500" title="Maximize" aria-label="Maximize window" />
            </div>
            <h2 className="text-sm text-white font-semibold flex-grow text-center -ml-12">
              Practice Session
            </h2>
          </div>
        )}

        <div className="p-6 overflow-y-auto">
          {isTimerStarted ? (
            <McqTimer
              questionNumbers={
                practiceQuestions
                  ? practiceQuestions.map(q => q.number)
                  : questionNumbers
              }
              questions={practiceQuestions || undefined}
              perQuestionTime={defaultPerQuestionTime}
              onClose={handleClose}
              onSessionComplete={onSessionComplete}
              practiceMode="custom"
              subject={subject}
              category={category}
              syllabus=""
              onLogResult={onLogResult}
              onUpdateWeaknesses={onUpdateWeaknesses}
              student={student}
              correctAnswers={practiceAnswers || {}}
              onSaveTask={onSaveTask}
              initialTask={initialTask}
            />
          ) : (
            <div className="text-white space-y-4">
              <h3 className="text-lg font-bold">Practice Setup</h3>
              <textarea
                value={qRanges}
                onChange={e => setQRanges(e.target.value)}
                className="w-full h-24 bg-gray-900 rounded p-3"
                placeholder="Example: 1-10, 15, 20-25"
              />
              <button
                onClick={() => setIsTimerStarted(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 rounded text-white"
              >
                <Icon name="play" /> Start
              </button>
            </div>
          )}
        </div>
      </div>

      {isAiKeyModalOpen && (
        <AIGenerateAnswerKeyModal
          onClose={() => setIsAiKeyModalOpen(false)}
          onKeyGenerated={() => {}}
        />
      )}

      {isAiParserOpen && (
        <AIParserModal
          onClose={() => setIsAiParserOpen(false)}
          onDataReady={() => {}}
          onPracticeTestReady={() => {}}
          onOpenGuide={() => {}}
        />
      )}
    </div>
  );
};
