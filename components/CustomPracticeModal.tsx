import React, { useState, useMemo, useRef, useEffect } from 'react';
import McqTimer from './McqTimer';
import Icon from './Icon';
import { getQuestionNumbersFromRanges } from '../utils/qRangesParser';
import { HomeworkData, ResultData, StudentData, ScheduleItem, PracticeQuestion, StudySession } from '../types';
import AIGenerateAnswerKeyModal from './AIGenerateAnswerKeyModal';
import AIParserModal from './AIParserModal';
import { api } from '../api/apiService';
import { useAuth } from '../context/AuthContext';
import { knowledgeBase } from '../data/knowledgeBase'; // Import knowledgeBase for chapters

interface CustomPracticeModalProps {
  onClose: () => void;
  onSessionComplete: (duration: number, questions_solved: number, questions_skipped: number[]) => Promise<void>;
  initialTask?: HomeworkData | null;
  aiPracticeTest?: { questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null;
  aiInitialTopic?: string | null;
  defaultPerQuestionTime: number;
  onLogResult: (result: ResultData) => void;
  onUpdateWeaknesses: (weaknesses: string[]) => void;
  student: StudentData | null;
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
  if (/[:=,;\n]/.test(text) && !text.includes(' ')) { // Allow : or = as separator and newline/semicolon
    const entries = text.split(/[,;\n]/);
    entries.forEach(entry => {
      const parts = entry.split(/[:=]/); // Allow : or = as separator
      if (parts.length === 2) {
        const qNum = parts[0].trim();
        const answer = parts[1].trim();
        if (qNum && answer) {
          if (answer.startsWith('[') && answer.endsWith(']')) {
            answers[qNum] = answer.slice(1, -1).split(',');
          } else {
            answers[qNum] = answer;
          }
        }
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
  const theme = student?.CONFIG.settings.theme || currentUser?.CONFIG.settings.theme;

  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'jeeMains'>(initialTask ? 'manual' : 'ai');
  const [qRanges, setQRanges] = useState(initialTask?.Q_RANGES || '');
  const [subject, setSubject] = useState(initialTask?.SUBJECT_TAG.EN || 'PHYSICS');
  const [category, setCategory] = useState(initialTask ? 'Homework Practice' : 'AI Generated');
  const [perQuestionTime, setPerQuestionTime] = useState(defaultPerQuestionTime);
  const [syllabus, setSyllabus] = useState('');
  const [correctAnswersText, setCorrectAnswersText] = useState(formatAnswers(initialTask?.answers));
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

    // Manual Tab: Generate questions from homework context
    if (activeTab === 'manual') {
      if (totalQuestions > 0 && initialTask) {
        setIsLoading(true);
        try {
          const result = await api.generatePracticeTest({
            topic: `Practice questions on ${initialTask.CARD_TITLE.EN} for ${initialTask.SUBJECT_TAG.EN}`,
            numQuestions: totalQuestions,
            difficulty: 'Medium',
            questionTypes: ['MCQ', 'NUM'],
            isPYQ: false,
            chapters: [],
          });
          if (result.questions && result.answers) {
            setPracticeMode('custom');
            setPracticeQuestions(result.questions);
            setPracticeAnswers(result.answers);
            setSyllabus(initialTask.CARD_TITLE.EN); // Set syllabus for context
            setCategory('Homework Practice');
            setIsTimerStarted(true);
          } else {
            throw new Error("AI failed to return a valid test format.");
          }
        } catch (err: any) {
          setError(err.error || 'Failed to generate practice questions. You can still practice without question text by using the provided answer key.');
          setIsLoading(false); // Make sure loading is off
          alert("Failed to generate questions. Please check your AI/backend configuration and try again. You can still use manual mode with an answer key.");
          return; // Stay on the modal
        } finally {
          setIsLoading(false);
        }
      } else if (totalQuestions === 0) {
        alert('Please enter valid question ranges.');
      }
      return;
    }

    // JEE Mains Tab
    if (activeTab === 'jeeMains') {
      if (!syllabus.trim()) {
        setError('Please provide a syllabus for the mock test.');
        return;
      }
      setPracticeMode('jeeMains');
      setIsTimerStarted(true);
      return;
    }

    // AI Tab
    if (!aiTopic.trim()) {
      setError('Please enter a topic to generate questions.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.generatePracticeTest({
        topic: aiTopic,
        numQuestions: aiNumQuestions,
        difficulty: aiDifficulty,
        questionTypes: aiQuestionTypes,
        isPYQ: aiIsPYQ,
        chapters: aiPYQChapters,
      });
      if (result.questions && result.answers) {
        setPracticeMode('custom');
        setPracticeQuestions(result.questions);
        setPracticeAnswers(result.answers);
        setSyllabus(aiTopic);
        setCategory('AI Generated Practice');
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
    <div
      className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`}
      style={
        {
          '--clip-origin-x': animationOrigin?.x,
          '--clip-origin-y': animationOrigin?.y,
        } as React.CSSProperties
      }
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--modal-border-radius)] shadow-[var(--modal-shadow)] ${contentAnimationClasses} overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {theme === 'liquid-glass' && (
          <div className="flex-shrink-0 flex items-center p-3 border-b border-[var(--glass-border)]">
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="w-3 h-3 rounded-full bg-red-500"
                aria-label="Close practice modal"
                title="Close practice modal"
              >
                <span className="sr-only">Close</span>
              </button>
              <div className="w-3 h-3 rounded-full bg-yellow-500" aria-hidden="true" />
              <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
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
                  ? practiceQuestions.map((q) => q.number)
                  : practiceMode === 'jeeMains'
                    ? Array.from({ length: 75 }, (_, i) => i + 1)
                    : questionNumbers
              }
              questions={practiceQuestions || undefined}
              perQuestionTime={perQuestionTime}
              onClose={handleClose}
              onSessionComplete={async (duration: number, solved: number, skipped: number[]) => {
                await onSessionComplete(duration, solved, skipped);
              }}
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
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex p-1 bg-gray-900/50 rounded-xl border border-white/10">
                {(['ai', 'manual', 'jeeMains'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab
                      ? 'bg-[var(--accent-color)] text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {tab === 'ai' ? 'AI Generate' : tab === 'manual' ? 'Manual / Homework' : 'JEE Mains Mock'}
                  </button>
                ))}
              </div>

              {/* AI Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Icon name="sparkles" className="text-purple-400" />
                        AI Test Generator
                      </h3>
                      <button onClick={() => setIsAiParserOpen(true)} className="text-xs text-cyan-400 hover:underline">
                        Import from Text
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Auto-generate questions based on any topic.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Topic</label>
                        <input
                          value={aiTopic}
                          onChange={(e) => setAiTopic(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                          placeholder="e.g. Rotational Motion, Thermodynamics"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Questions</label>
                          <select value={aiNumQuestions} onChange={(e) => setAiNumQuestions(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white">
                            <option value={5}>5 Questions</option>
                            <option value={10}>10 Questions</option>
                            <option value={20}>20 Questions</option>
                            <option value={30}>30 Questions</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Difficulty</label>
                          <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white">
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                            <option value="JEE Advanced">JEE Advanced</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={aiQuestionTypes.includes('MCQ')} onChange={(e) => handleQuestionTypeChange('MCQ', e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-purple-600" />
                          <span className="text-sm text-gray-300">MCQ</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={aiQuestionTypes.includes('NUM')} onChange={(e) => handleQuestionTypeChange('NUM', e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-purple-600" />
                          <span className="text-sm text-gray-300">Numerical</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white font-bold shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Generating...' : 'Start AI Practice'}
                  </button>
                </div>
              )}

              {/* Manual Tab */}
              {activeTab === 'manual' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Icon name="list" className="text-cyan-400" />
                        Custom / Homework
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Practice specific question ranges from your material.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white">
                          <option value="PHYSICS">Physics</option>
                          <option value="CHEMISTRY">Chemistry</option>
                          <option value="MATHS">Maths</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Question Ranges</label>
                        <input
                          value={qRanges}
                          onChange={(e) => setQRanges(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono placeholder-gray-600"
                          placeholder="e.g. 1-10, 15, 20-25"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Total Questions: <span className="text-white font-bold">{totalQuestions}</span>
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Per Question Timer</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={perQuestionTime}
                            onChange={(e) => setPerQuestionTime(Number(e.target.value))}
                            className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-center"
                            min="10"
                          />
                          <span className="text-sm text-gray-400">seconds</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase">Answer Key (Optional)</label>
                          <div className="flex gap-2">
                            <button onClick={() => setIsAiKeyModalOpen(true)} className="text-[10px] bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded hover:bg-purple-600/40">AI Scan</button>
                            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] bg-cyan-600/20 text-cyan-300 px-2 py-0.5 rounded hover:bg-cyan-600/40">Upload JSON</button>
                          </div>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".json,.txt" />
                        </div>
                        <textarea
                          value={correctAnswersText}
                          onChange={(e) => setCorrectAnswersText(e.target.value)}
                          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                          placeholder="1:A&#10;2:B&#10;3:C..."
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={totalQuestions === 0}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Practice Session
                  </button>
                </div>
              )}

              {/* JEE Mains Tab */}
              {activeTab === 'jeeMains' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Icon name="trophy" className="text-yellow-400" />
                        Full Mock Test
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">
                      Standard 75 Questions (300 Marks) 3-Hour Test pattern.
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Syllabus / Test Name</label>
                        <input
                          value={syllabus}
                          onChange={(e) => setSyllabus(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none"
                          placeholder="e.g. Full Syllabus Mock 5"
                        />
                      </div>

                      <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase">Answer Key (Optional)</label>
                          <button onClick={() => jeeMainsFileInputRef.current?.click()} className="text-[10px] bg-yellow-600/20 text-yellow-300 px-2 py-0.5 rounded hover:bg-yellow-600/40">Upload JSON</button>
                          <input type="file" ref={jeeMainsFileInputRef} onChange={handleJeeMainsFileUpload} className="hidden" accept=".json,.txt" />
                        </div>
                        <textarea
                          value={jeeMainsCorrectAnswersText}
                          onChange={(e) => setJeeMainsCorrectAnswersText(e.target.value)}
                          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs focus:border-yellow-500 focus:outline-none"
                          placeholder="1:A&#10;2:B..."
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleStart}
                    disabled={!syllabus}
                    className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl text-white font-bold shadow-lg hover:shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Mock Test
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isAiKeyModalOpen && (
        <AIGenerateAnswerKeyModal
          onClose={() => setIsAiKeyModalOpen(false)}
          onKeyGenerated={(keyText) => {
            if (activeTab === 'jeeMains') {
              setJeeMainsCorrectAnswersText(keyText);
            } else {
              setCorrectAnswersText(keyText);
            }
          }}
        />
      )}

      {isAiParserOpen && (
        <AIParserModal
          onClose={() => setIsAiParserOpen(false)}
          onDataReady={handleDataFromParser}
          onPracticeTestReady={() => { }}
          onOpenGuide={() => { }}
        />
      )}
    </div>
  );
};