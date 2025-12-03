import React, { useState, useMemo, useRef, useEffect } from 'react';
import McqTimer from './McqTimer';
import Icon from './Icon';
import { getQuestionNumbersFromRanges } from '../utils/qRangesParser';
import { HomeworkData, ResultData, StudentData, ScheduleItem, PracticeQuestion } from '../types';
import AIGenerateAnswerKeyModal from './AIGenerateAnswerKeyModal';
import AIParserModal from './AIParserModal';
import { api } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import { knowledgeBase } from '../data/knowledgeBase'; // Import knowledgeBase for chapters

interface CustomPracticeModalProps {
  onClose: () => void;
  onSessionComplete: (duration: number, questions_solved: number, questions_skipped: number[]) => void;
  initialTask?: HomeworkData | null;
  // FIX: Updated aiPracticeTest prop type to correctly handle string | string[] for answers
  aiPracticeTest?: { questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null;
  aiInitialTopic?: string | null;
  defaultPerQuestionTime: number;
  onLogResult: (result: ResultData) => void;
  onUpdateWeaknesses: (weaknesses: string[]) => void;
  student: StudentData;
  onSaveTask: (task: ScheduleItem) => void;
  animationOrigin?: { x: string, y: string };
}

const parseAnswers = (text: string): Record<string, string | string[]> => {
  const answers: Record<string, string | string[]> = {};
  if (!text) return answers;

  // Attempt to parse as full JSON first for arrays
  try {
    const jsonAttempt = JSON.parse(text);
    if (typeof jsonAttempt === 'object' && jsonAttempt !== null && !Array.isArray(jsonAttempt)) {
      // Validate that all values are string or string[]
      const isValidJson = Object.values(jsonAttempt).every(
        val => typeof val === 'string' || (Array.isArray(val) && val.every(item => typeof item === 'string'))
      );
      if (isValidJson) return jsonAttempt;
    }
  } catch (e) {
    // Not a direct JSON object, proceed with simpler parsing
  }

  // Check for key-value pair format (e.g., "1:A, 2:C")
  if (/[:=,;\n]/.test(text) && !text.includes(' ') ) { // Added !text.includes(' ') to differentiate from space separated list
    const entries = text.split(/[,;\n]/);
    entries.forEach(entry => {
      const parts = entry.split(/[:=]/); // Allow : or = as separator
      if (parts.length === 2) {
        const qNum = parts[0].trim();
        const answer = parts[1].trim();
        if (qNum && answer) answers[qNum] = answer;
      }
    });
  } else {
    // Assume space-separated list for questions 1, 2, 3... (e.g., "A C 12.5")
    const answerList = text.trim().split(/\s+/);
    answerList.forEach((answer, index) => {
      if (answer) answers[(index + 1).toString()] = answer;
    });
  }
  return answers;
};


// Helper to format answers back to a displayable string
const formatAnswers = (answers?: Record<string, string | string[]>): string => {
  if (!answers) return '';
  return Object.entries(answers).map(([q, a]) => {
    if (Array.isArray(a)) {
      return `${q}:[${a.join(',')}]`;
    }
    return `${q}:${a}`;
  }).join('\n');
};

export const CustomPracticeModal: React.FC<CustomPracticeModalProps> = (props) => {
  const { onClose, onSessionComplete, initialTask, aiPracticeTest, aiInitialTopic, defaultPerQuestionTime, onLogResult, student, onUpdateWeaknesses, onSaveTask, animationOrigin } = props;
  const { currentUser } = useAuth();
  const theme = currentUser?.CONFIG.settings.theme;

  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'jeeMains'>(initialTask ? 'manual' : 'ai');
  const [qRanges, setQRanges] = useState(initialTask?.Q_RANGES || '');
  const [subject, setSubject] = useState(initialTask?.SUBJECT_TAG.EN || 'PHYSICS');
  const [category, setCategory] = useState(initialTask ? 'Homework Practice' : 'AI Generated');
  const [perQuestionTime, setPerQuestionTime] = useState(defaultPerQuestionTime);
  const [syllabus, setSyllabus] = useState('');
  const [correctAnswersText, setCorrectAnswersText] = useState('');
  const [jeeMainsCorrectAnswersText, setJeeMainsCorrectAnswersText] = useState('');

  // AI state
  const [aiTopic, setAiTopic] = useState(aiInitialTopic || '');
  const [aiNumQuestions, setAiNumQuestions] = useState(aiInitialTopic ? 5 : 10);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [aiQuestionTypes, setAiQuestionTypes] = useState<('MCQ' | 'NUM' | 'MULTI_CHOICE')[]>(['MCQ']);
  const [aiIsPYQ, setAiIsPYQ] = useState(false);
  const [aiPYQChapters, setAiPYQChapters] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // session state
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'custom' | 'jeeMains'>('custom');
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[] | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string | string[]> | null>(null);

  const [isExiting, setIsExiting] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const [isAiParserOpen, setIsAiParserOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jeeMainsFileInputRef = useRef<HTMLInputElement>(null);


  const questionNumbers = useMemo(() => getQuestionNumbersFromRanges(qRanges), [qRanges]);
  const totalQuestions = questionNumbers.length;

  // Determine available chapters based on selected subject
  const availableChapters = useMemo(() => {
    const subjectKey = subject.toUpperCase() as keyof typeof knowledgeBase;
    if (knowledgeBase[subjectKey]) {
      const content = knowledgeBase[subjectKey];
      // Simple regex to extract chapter-like headings (lines starting with **)
      const chapterMatches = content.match(/\*\*([^*:]+):\*\*/g);
      return chapterMatches ? chapterMatches.map(match => match.replace(/\*\*|:\*\*/g, '').trim()) : [];
    }
    return [];
  }, [subject]);

  const handleStart = async () => {
    setError('');
    if (activeTab === 'manual') {
      if (totalQuestions > 0) {
        setPracticeMode('custom');
        setIsTimerStarted(true);
      } else {
        alert('Please enter valid question ranges.');
      }
      return;
    }

    if (activeTab === 'jeeMains') {
      if (!syllabus.trim()) {
        setError('Please provide a syllabus.');
        return;
      }
      setPracticeMode('jeeMains');
      setIsTimerStarted(true);
      return;
    }

    // AI mode
    if (!aiTopic.trim()) {
      setError('Please enter a topic.');
      return;
    }

    setIsLoading(true);
    try {
      // FIX: Pass new AI generation parameters
      const result = await api.generatePracticeTest({
        topic: aiTopic,
        numQuestions: aiNumQuestions,
        difficulty: aiDifficulty,
        questionTypes: aiQuestionTypes, // NEW
        isPYQ: aiIsPYQ, // NEW
        chapters: aiPYQChapters, // NEW
      });
      if (result.questions && result.answers) {
        setPracticeMode('custom');
        setPracticeQuestions(result.questions);
        setPracticeAnswers(result.answers);
        setIsTimerStarted(true);
      } else {
        throw new Error("AI returned an invalid test format.");
      }
    } catch (err: any) {
      setError(err.error || 'Failed to generate practice test.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (aiInitialTopic) {
      setActiveTab('ai');
      setAiTopic(aiInitialTopic);
      setCategory('Post-Session Quiz');
      handleStart();
    }
  }, [aiInitialTopic]);

  useEffect(() => {
    if (aiPracticeTest) {
      setPracticeQuestions(aiPracticeTest.questions);
      setPracticeAnswers(aiPracticeTest.answers);
      setPracticeMode('custom');
      setCategory('AI Imported Test');
      setSubject('MIXED');
      setIsTimerStarted(true);
    }
  }, [aiPracticeTest]);


  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const txt = evt.target?.result as string;
        const json = JSON.parse(txt);
        // Using parseAnswers to handle both string and string[]
        const formatted = formatAnswers(parseAnswers(JSON.stringify(json))); 
        setCorrectAnswersText(formatted);
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleJeeMainsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const txt = evt.target?.result as string;
        const json = JSON.parse(txt);
        // Using parseAnswers to handle both string and string[]
        const formatted = formatAnswers(parseAnswers(JSON.stringify(json)));
        setJeeMainsCorrectAnswersText(formatted);
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };


  const handleDataFromParser = (data: any) => {
    if (data.practice_test && data.practice_test.questions && data.practice_test.answers) {
      let parsedAnswers = data.practice_test.answers;

      // Ensure answers are correctly parsed if they come as a stringified JSON
      if (typeof parsedAnswers === 'string' && parsedAnswers.trim().startsWith('{')) {
        try {
          parsedAnswers = JSON.parse(parsedAnswers);
        } catch {
          parsedAnswers = {};
        }
      } else if (typeof parsedAnswers !== 'object') {
        parsedAnswers = {};
      }

      setPracticeMode('custom');
      setPracticeQuestions(data.practice_test.questions);
      setPracticeAnswers(parsedAnswers);
      setCategory('AI Imported Test');
      setSubject('MIXED');
      setIsTimerStarted(true);
    } else {
      alert("Invalid imported practice test.");
    }
    setIsAiParserOpen(false);
  };


  const animationClasses = theme === 'liquid-glass'
    ? (isExiting ? 'genie-out' : 'genie-in')
    : (isExiting ? 'modal-exit' : 'modal-enter');

  const contentAnimationClasses = theme === 'liquid-glass'
    ? ''
    : (isExiting ? 'modal-content-exit' : 'modal-content-enter');

  const correctAnswers = useMemo(() => {
    if (activeTab === 'jeeMains') return parseAnswers(jeeMainsCorrectAnswersText);
    if (initialTask?.answers) return initialTask.answers;
    return parseAnswers(correctAnswersText);
  }, [correctAnswersText, jeeMainsCorrectAnswersText, initialTask, activeTab]);

  const handleQuestionTypeChange = (type: 'MCQ' | 'NUM' | 'MULTI_CHOICE', isChecked: boolean) => {
    setAiQuestionTypes(prev => 
      isChecked ? [...prev, type] : prev.filter(t => t !== type)
    );
  };

  const handlePYQChapterChange = (chapter: string, isChecked: boolean) => {
    setAiPYQChapters(prev => 
      isChecked ? [...prev, chapter] : prev.filter(c => c !== chapter)
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`}
        style={{ '--clip-origin-x': animationOrigin?.x, '--clip-origin-y': animationOrigin?.y } as React.CSSProperties}
        onClick={handleClose}
      >
        <div
          className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--modal-border-radius)] shadow-[var(--modal-shadow)] ${contentAnimationClasses} overflow-hidden flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {theme === 'liquid-glass' && (
            <div className="flex-shrink-0 flex items-center p-3 border-b border-[var(--glass-border)]">
              <div className="flex gap-2">
                <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500"></button>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <h2 className="text-sm text-white font-semibold text-center flex-grow -ml-12">
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
                    : practiceMode === 'jeeMains'
                      ? Array.from({ length: 75 }, (_, i) => i + 1)
                      : questionNumbers
                }
                questions={practiceQuestions || undefined}
                perQuestionTime={perQuestionTime}
                onClose={handleClose}
                onSessionComplete={onSessionComplete}
                practiceMode={practiceMode}
                subject={subject}
                category={category}
                syllabus={syllabus}
                onLogResult={onLogResult}
                onUpdateWeaknesses={onUpdateWeaknesses}
                student={student}
                correctAnswers={practiceAnswers || correctAnswers}
                onSaveTask={onSaveTask}
                initialTask={initialTask}
              />
            ) : (
              <div>
                <div className="flex justify-between items-center">
                  {theme !== 'liquid-glass' && (
                    <h2 className="text-2xl font-bold text-white mb-4">
                      Practice Session
                    </h2>
                  )}

                  <button
                    onClick={() => setIsAiParserOpen(true)}
                    className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Icon name="upload" /> Import from Text/JSON
                  </button>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-full bg-gray-900/50 my-4">
                  <button
                    onClick={() => setActiveTab('jeeMains')}
                    className={`flex-1 text-sm font-semibold py-1.5 rounded-full ${
                      activeTab === 'jeeMains'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300'
                    }`}
                  >
                    JEE Mains Full Test
                  </button>

                  <button
                    onClick={() => setActiveTab('ai')}
                    disabled={!!initialTask}
                    className={`flex-1 text-sm font-semibold py-1.5 rounded-full disabled:opacity-50 ${
                      activeTab === 'ai'
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-300'
                    }`}
                  >
                    AI Quick Practice
                  </button>

                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 text-sm font-semibold py-1.5 rounded-full ${
                      activeTab === 'manual'
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-300'
                    }`}
                  >
                    From Homework
                  </button>
                </div>

                {/* ---------------------- MANUAL TAB (FIXED FRAGMENT) ---------------------- */}
                {activeTab === 'manual' && (
                  <>
                    <div className="mt-4">
                      <label className="text-sm font-bold text-gray-400">
                        Question Ranges (e.g., 1-15; 20-25)
                      </label>
                      <textarea
                        value={qRanges}
                        onChange={(e) => setQRanges(e.target.value)}
                        className="w-full h-20 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1"
                        placeholder="e.g., 1-25; 30-35;"
                      />
                    </div>

                    {!initialTask && (
                      <div className="mt-4">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-bold text-gray-400">
                            Correct Answers (Optional)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept=".json"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs font-semibold text-cyan-400 hover:underline"
                            >
                              Upload JSON
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAiKeyModalOpen(true)}
                              className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <Icon name="gemini" className="w-3 h-3" /> AI Gen
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={correctAnswersText}
                          onChange={(e) => setCorrectAnswersText(e.target.value)}
                          className="w-full h-20 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1"
                          placeholder='1:A, 2:C, 3:12.5 OR 1:["A","C"]' // Updated placeholder
                        />
                      </div>
                    )}
                  </>
                )}
                {/* ---------------------- END FIXED MANUAL TAB ---------------------- */}


                {activeTab === 'ai' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-gray-400">Topic</label>
                      <input
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        className="w-full px-3 py-2 mt-1 text-gray-200 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="e.g., Rotational Motion"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-400">Subject</label>
                      <select 
                        value={subject} 
                        onChange={e => setSubject(e.target.value)} 