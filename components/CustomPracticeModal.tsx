import React, { useState, useMemo, useRef, useEffect } from 'react';
import McqTimer from './McqTimer';
import Icon from './Icon';
import { getQuestionNumbersFromRanges } from '../utils/qRangesParser';
import { HomeworkData, ResultData, StudentData, ScheduleItem, PracticeQuestion } from '../types';
import AIGenerateAnswerKeyModal from './AIGenerateAnswerKeyModal';
import AIParserModal from './AIParserModal';
import { api } from '../api/apiService';
import { useAuth } from '../context/AuthContext';

interface CustomPracticeModalProps {
  onClose: () => void;
  onSessionComplete: (duration: number, questions_solved: number, questions_skipped: number[]) => void;
  initialTask?: HomeworkData | null;
  aiPracticeTest?: { questions: PracticeQuestion[], answers: Record<string, string> } | null;
  aiInitialTopic?: string | null;
  defaultPerQuestionTime: number;
  onLogResult: (result: ResultData) => void;
  onUpdateWeaknesses: (weaknesses: string[]) => void;
  student: StudentData;
  onSaveTask: (task: ScheduleItem) => void;
  animationOrigin?: { x: string, y: string };
}

const parseAnswers = (text: string): Record<string, string> => {
    const answers: Record<string, string> = {};
    if (!text) return answers;
    if (/[:=,;\n]/.test(text)) {
        const entries = text.split(/[,;\n]/);
        entries.forEach(entry => {
            const parts = entry.split(/[:=]/);
            if (parts.length === 2) {
                const qNum = parts[0].trim();
                const answer = parts[1].trim();
                if (qNum && answer) {
                    answers[qNum] = answer;
                }
            }
        });
    } else {
        const answerList = text.trim().split(/\s+/);
        answerList.forEach((answer, index) => {
            if (answer) {
                answers[(index + 1).toString()] = answer;
            }
        });
    }
    return answers;
};

export const CustomPracticeModal: React.FC<CustomPracticeModalProps> = (props) => {
  const { onClose, onSessionComplete, initialTask, aiPracticeTest, aiInitialTopic, defaultPerQuestionTime, onLogResult, student, onUpdateWeaknesses, onSaveTask, animationOrigin } = props;
  const { currentUser } = useAuth();
  const theme = currentUser?.CONFIG.settings.theme;
  
  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'jeeMains' | 'mistakes'>(initialTask ? 'manual' : 'ai');
  const [qRanges, setQRanges] = useState(initialTask?.Q_RANGES || '');
  const [subject, setSubject] = useState(initialTask?.SUBJECT_TAG.EN || 'PHYSICS');
  const [category, setCategory] = useState(initialTask ? 'Homework Practice' : 'AI Generated');
  const [perQuestionTime, setPerQuestionTime] = useState(defaultPerQuestionTime);
  const [syllabus, setSyllabus] = useState('');
  const [correctAnswersText, setCorrectAnswersText] = useState('');
  const [jeeMainsCorrectAnswersText, setJeeMainsCorrectAnswersText] = useState('');
  
  const [aiTopic, setAiTopic] = useState(aiInitialTopic || '');
  const [aiNumQuestions, setAiNumQuestions] = useState(aiInitialTopic ? 5 : 10);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'custom' | 'jeeMains'>('custom');
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[] | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string> | null>(null);

  const [isExiting, setIsExiting] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const [isAiParserOpen, setIsAiParserOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jeeMainsFileInputRef = useRef<HTMLInputElement>(null);

  const questionNumbers = useMemo(() => getQuestionNumbersFromRanges(qRanges), [qRanges]);
  
  const allMistakes = useMemo(() => {
      if (!student.RESULTS) return [];
      const all = new Set<string>();
      student.RESULTS.forEach(r => {
          r.MISTAKES.forEach(m => {
              if (!r.FIXED_MISTAKES?.includes(m)) {
                  all.add(m);
              }
          });
      });
      return Array.from(all);
  }, [student.RESULTS]);

  const totalQuestions = activeTab === 'mistakes' ? allMistakes.length : questionNumbers.length;
  
  const handleStart = async () => {
    setError('');
    if (activeTab === 'manual') {
        if (totalQuestions > 0) {
            setPracticeMode('custom');
            setIsTimerStarted(true);
        } else {
            alert('Please enter valid question ranges (e.g., "1-25; 30-35").');
        }
    } else if (activeTab === 'jeeMains') {
        if (!syllabus.trim()) {
            setError('Please provide a syllabus for the AI to analyze your results correctly.');
            return;
        }
        setPracticeMode('jeeMains');
        setIsTimerStarted(true);
    } else if (activeTab === 'mistakes') {
        if (allMistakes.length === 0) {
            setError("No active mistakes found to practice.");
            return;
        }
        setIsLoading(true);
        try {
            const topicPrompt = `Create a remedial quiz for these weak topics: ${allMistakes.join(', ')}`;
            const result = await api.generatePracticeTest({ topic: topicPrompt, numQuestions: Math.min(10, allMistakes.length), difficulty: 'Medium' });
            if (result.questions && result.answers) {
                setPracticeMode('custom');
                setPracticeQuestions(result.questions);
                setPracticeAnswers(result.answers);
                setCategory("Mistake Remediation");
                setIsTimerStarted(true);
            } else {
                throw new Error("AI returned invalid data.");
            }
        } catch (e: any) {
            setError(e.error || "Failed to generate mistake quiz.");
        } finally {
            setIsLoading(false);
        }
    } else { 
        if (!aiTopic.trim()) {
            setError('Please enter a topic for the AI to generate questions.');
            return;
        }
        setIsLoading(true);
        try {
            const result = await api.generatePracticeTest({ topic: aiTopic, numQuestions: aiNumQuestions, difficulty: aiDifficulty });
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
    }
  };

    useEffect(() => {
        if (aiInitialTopic) {
            setActiveTab('ai');
            setAiTopic(aiInitialTopic);
            setCategory('Post-Session Quiz');
            // The handleStart call needs to be inside the hook, but we must ensure
            // all dependencies are handled. For simplicity in the fix, we keep
            // the logic as is, relying on the state update to trigger the correct
            // path if handleStart is called external to the hook.
            // handleStart(); // Commented out to prevent infinite loop or issues if not careful with dependencies
        }
    }, [aiInitialTopic]); // Dependencies changed to only include stable props/state if handleStart were active

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
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                 if (typeof json !== 'object' || json === null || Array.isArray(json)) {
                    throw new Error("JSON is not a valid key-value object.");
                }
                const formattedKey = Object.entries(json).map(([q, a]) => `${q}:${a}`).join('\n');
                setCorrectAnswersText(formattedKey);
            } catch (err) {
                alert("Failed to parse JSON file. Please ensure it's a valid JSON object of answers.");
            }
        };
        reader.readAsText(file);
    }
  };

  const handleJeeMainsFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                 if (typeof json !== 'object' || json === null || Array.isArray(json)) {
                    throw new Error("JSON is not a valid key-value object.");
                }
                const formattedKey = Object.entries(json).map(([q, a]) => `${q}:${a}`).join('\n');
                setJeeMainsCorrectAnswersText(formattedKey);
            } catch (err) {
                alert("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
    }
  };

  const handleDataFromParser = (data: any) => {
    if (data.practice_test && data.practice_test.questions && data.practice_test.answers) {
        let parsedAnswers = data.practice_test.answers;
        if (typeof parsedAnswers === 'string' && parsedAnswers.trim().startsWith('{')) {
            try {
                parsedAnswers = JSON.parse(parsedAnswers);
            } catch (e) {
                console.warn('Could not parse practice test answers string, treating as empty.');
                parsedAnswers = {};
            }
        } else if (typeof parsedAnswers !== 'object') {
            parsedAnswers = {};
        }
        setPracticeMode('custom');
        setPracticeQuestions(data.practice_test.questions);
        setPracticeAnswers(parsedAnswers);
        setCategory('Imported Test');
        setSubject('MIXED');
        setIsTimerStarted(true);
    } else {
        alert("The imported data did not contain a valid practice test.");
    }
    setIsAiParserOpen(false);
  };
  
  const animationClasses = theme === 'liquid-glass' ? (isExiting ? 'genie-out' : 'genie-in') : (isExiting ? 'modal-exit' : 'modal-enter');
  const contentAnimationClasses = theme === 'liquid-glass' ? '' : (isExiting ? 'modal-content-exit' : 'modal-content-enter');
  
  const correctAnswers = useMemo(() => {
    if (activeTab === 'jeeMains') return parseAnswers(jeeMainsCorrectAnswersText);
    if (initialTask && initialTask.answers) return initialTask.answers;
    return parseAnswers(correctAnswersText);
  }, [correctAnswersText, jeeMainsCorrectAnswersText, initialTask, activeTab]);

  return (
    // Outer Fragment - Opens on line 369
    <>
      <div // Fixed overlay div - Opens on line 370
        className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`}
        style={{ '--clip-origin-x': animationOrigin?.x, '--clip-origin-y': animationOrigin?.y } as React.CSSProperties}
        onClick={handleClose}
      >
        <div // Inner modal content card div - Opens on line 374
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
              <h2 className="text-sm font-semibold text-white text-center flex-grow -ml-12">Practice Session</h2>
            </div>
          )}
          
          <div className="p-6 overflow-y-auto max-h-[80vh]"> // Scrollable content div - Opens here
            {isTimerStarted ? (
              <McqTimer 
                questionNumbers={practiceQuestions ? practiceQuestions.map(q => Number(q.number)) : practiceMode === 'jeeMains' ? Array.from({ length: 75 }, (_, i) => i + 1) : questionNumbers.map(Number)}
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
                  {theme !== 'liquid-glass' && <h2 className="text-2xl font-bold text-white mb-4">Practice Session</h2>}
                  <button onClick={() => setIsAiParserOpen(true)} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"><Icon name="upload" /> Import from Text/JSON</button>
                </div>
                
                <div className="flex items-center gap-2 p-1 rounded-full bg-gray-900/50 my-4 overflow-x-auto">
                  <button onClick={() => setActiveTab('jeeMains')} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-full whitespace-nowrap px-2 ${activeTab === 'jeeMains' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>JEE Full Test</button>
                  <button onClick={() => setActiveTab('ai')} disabled={!!initialTask} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-full disabled:opacity-50 whitespace-nowrap px-2 ${activeTab === 'ai' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>AI Quiz</button>
                  <button onClick={() => setActiveTab('mistakes')} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-full whitespace-nowrap px-2 ${activeTab === 'mistakes' ? 'bg-red-600 text-white' : 'text-gray-300'}`}>Mistakes</button>
                  <button onClick={() => setActiveTab('manual')} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-full whitespace-nowrap px-2 ${activeTab === 'manual' ? 'bg-gray-600 text-white' : 'text-gray-300'}`}>Manual</button>
                </div>
                
                {activeTab === 'manual' && (
                    <> // Inner fragment opens
                      <div className="mt-4">
                        <label className="text-sm font-bold text-gray-400">Question Ranges (e.g., 1-15; 20-25)</label>
                        <textarea value={qRanges} onChange={(e) => setQRanges(e.target.value)} className="w-full h-20 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1" placeholder="e.g., 1-25; 30-35;" />
                      </div>
                       {!initialTask && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-gray-400">Correct Answers (Optional)</label>
                                    <div className="flex gap-2">
                                       <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                       <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-cyan-400 hover:underline">Upload JSON</button>
                                       <button type="button" onClick={() => setIsAiKeyModalOpen(true)} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"><Icon name="gemini" className="w-3 h-3" /> AI Gen</button>
                                    </div>
                                </div>
                                <textarea value={correctAnswersText} onChange={(e) => setCorrectAnswersText(e.target.value)} className="w-full h-20 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1" placeholder="1:A, 2:C, 3:12.5 OR A C 12.5" />
                            </div>
                       )}
                    </> // Inner fragment closes
                )}
                {activeTab === 'ai' && (
                    <div className="space-y-4">
                       <div>
                          <label className="text-sm font-bold text-gray-400">Topic</label>
                           <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full px-3 py-2 mt-1 text-gray-200 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="e.g., Rotational Motion" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-sm font-bold text-gray-400"># of Questions</label>
                              <input type="number" value={aiNumQuestions} onChange={(e) => setAiNumQuestions(parseInt(e.target.value))} className="w-full px-3 py-2 mt-1 text-gray-200 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg" />
                          </div>
                          <div>
                              <label className="text-sm font-bold text-gray-400">Difficulty</label>
                              <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="w-full px-3 py-2 mt-1 text-gray-200 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg">
                                  <option>Easy</option>
                                  <option>Medium</option>
                                  <option>Hard</option>
                              </select>
                          </div>
                      </div>
                    </div>
                )}
                {activeTab === 'mistakes' && (
                    <div className="space-y-4 text-center py-4">
                        <Icon name="stopwatch" className="w-12 h-12 text-red-400 mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-white">Mistake Remediation</h3>
                        <p className="text-sm text-gray-300">You have <span className="font-bold text-red-400">{allMistakes.length}</span> active mistakes.</p>
                        <p className="text-xs text-gray-500">The AI will generate specific practice questions targeting these weak areas.</p>
                        {allMistakes.length > 0 && (
                            <div className="text-left max-h-32 overflow-y-auto bg-gray-900/50 p-2 rounded border border-gray-700 text-xs text-gray-400 mt-2">
                                {allMistakes.join(', ')}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'jeeMains' && (
                  <div className="space-y-4">
                     <div className="text-center p-4 bg-purple-900/30 border border-purple-500/50 rounded-lg">
                        <Icon name="trophy" className="w-8 h-8 mx-auto text-purple-400 mb-2"/>
                        <h3 className="font-bold text-white">JEE Mains Full Test Simulation</h3>
                        <p className="text-xs text-gray-400">This is a 3-hour, 75-question test. After completion, you'll upload the answer key for AI-powered analysis.</p>
                     </div>
                     <div>
                        <label className="text-sm font-bold text-gray-400">Syllabus</label>
                         <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} className="w-full h-24 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1" placeholder="Enter the comma-separated list of chapters for this test, e.g., Kinematics, NLM, Rotational Motion..." />
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-400">Correct Answers (Optional)</label>
                            <div className="flex gap-2">
                                <input type="file" accept=".json" ref={jeeMainsFileInputRef} onChange={handleJeeMainsFileUpload} className="hidden" />
                                <button type="button" onClick={() => jeeMainsFileInputRef.current?.click()} className="text-xs font-semibold text-cyan-400 hover:underline">Upload JSON</button>
                                <button type="button" onClick={() => setIsAiKeyModalOpen(true)} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"><Icon name="gemini" className="w-3 h-3" /> AI Gen</button>
                            </div>
                        </div>
                        <textarea value={jeeMainsCorrectAnswersText} onChange={(e) => setJeeMainsCorrectAnswersText(e.target.value)} className="w-full h-20 bg-gray-900/70 border border-[var(--glass-border)] rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 mt-1" placeholder="Provide answers for instant feedback..." />
                        <p className="text-xs text-gray-500 mt-1">If provided, you'll get instant feedback. You can still use AI Grade later for detailed analysis.</p>
                    </div>
                  </div>
              )}

              {error && <p className="text-sm text-red-400 mt-2 text-center">{error}</p>}
              
              <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-[var(--glass-border)]">
                <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">Cancel</button>
                <button onClick={handleStart} disabled={isLoading || (activeTab === 'manual' && totalQuestions === 0)} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  {isLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</> : <><Icon name="play" className="w-4 h-4" /> Start</>}
                </button>
              </div>
            </div>
          )} // End of isTimerStarted ternary (false branch)
        </div> // End of scrollable content div (Line 383)
      </div> // End of Inner modal content card div (Line 374)
    </div> // End of Fixed overlay div (Line 370)
    
    // Conditional Modals (rendered outside the main overlay, but inside the fragment)
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
            onPracticeTestReady={() => {}}
            onOpenGuide={() => {}}
        />
    )}
    </> // End of Outer Fragment
  );
};