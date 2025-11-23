
import React, { useState, useMemo, useRef, useEffect } from 'react';
import McqTimer from './McqTimer';
import Icon from './Icon';
import { getQuestionNumbersFromRanges } from '../utils/qRangesParser';
import { HomeworkData, ResultData, StudentData, ScheduleItem, PracticeQuestion, ScheduleCardData } from '../types';
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
  
  // AI State
  const [aiTopic, setAiTopic] = useState(aiInitialTopic || '');
  const [aiNumQuestions, setAiNumQuestions] = useState(aiInitialTopic ? 5 : 10);
  const [aiDifficulty, setAiDifficulty] = useState('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Session State
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

  // Calculate question numbers ensuring a strict number[] return type
  const finalQuestionNumbers: number[] = useMemo(() => {
      if (practiceQuestions) {
          return practiceQuestions.map(q => Number(q.number));
      }
      if (practiceMode === 'jeeMains') {
          return Array.from({ length: 75 }, (_, i) => i + 1);
      }
      return questionNumbers;
  }, [practiceQuestions, practiceMode, questionNumbers]);

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
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
              <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
              <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">Practice Session</span>
            </div>
          )}
          
          <div className="p-6 overflow-y-auto max-h-[80vh]">
            {isTimerStarted ? (
              <McqTimer 
                questionNumbers={finalQuestionNumbers}
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
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  {theme !== 'liquid-glass' && <h2 className="text-2xl font-bold text-white">Practice Session</h2>}
                  <button onClick={() => setIsAiParserOpen(true)} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"><Icon name="upload" /> Import Text/JSON</button>
                </div>
                
                {/* Tabs */}
                <div className="flex p-1 rounded-xl bg-black/40 border border-white/5">
                  {[
                      { id: 'jeeMains', label: 'JEE Full Test' },
                      { id: 'ai', label: 'AI Quiz' },
                      { id: 'mistakes', label: 'Mistakes' },
                      { id: 'manual', label: 'Manual' }
                  ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)} 
                        disabled={tab.id === 'ai' && !!initialTask}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab.id ? 'bg-gray-700/80 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30'}`}
                      >
                          {tab.label}
                      </button>
                  ))}
                </div>
                
                {/* Content based on Tab */}
                <div className="min-h-[200px]">
                    {activeTab === 'manual' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question Ranges</label>
                                <input 
                                    value={qRanges} 
                                    onChange={(e) => setQRanges(e.target.value)} 
                                    className="w-full mt-2 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all" 
                                    placeholder="e.g., 1-15; 20-25" 
                                />
                            </div>
                            {!initialTask && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Answer Key (Optional)</label>
                                        <div className="flex gap-3">
                                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-cyan-400 hover:text-cyan-300">Upload JSON</button>
                                            <button type="button" onClick={() => setIsAiKeyModalOpen(true)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><Icon name="gemini" className="w-3 h-3" /> AI Gen</button>
                                        </div>
                                    </div>
                                    <textarea 
                                        value={correctAnswersText} 
                                        onChange={(e) => setCorrectAnswersText(e.target.value)} 
                                        className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-cyan-500 outline-none transition-all resize-none" 
                                        placeholder="1:A, 2:C, 3:12.5" 
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Topic</label>
                                <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full mt-2 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none" placeholder="e.g., Rotational Motion" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Count</label>
                                    <input type="number" value={aiNumQuestions} onChange={(e) => setAiNumQuestions(parseInt(e.target.value))} className="w-full mt-2 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Difficulty</label>
                                    <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="w-full mt-2 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none">
                                        <option>Easy</option>
                                        <option>Medium</option>
                                        <option>Hard</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'mistakes' && (
                        <div className="text-center py-6 animate-fadeIn space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Icon name="stopwatch" className="w-8 h-8 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Mistake Remediation</h3>
                                <p className="text-sm text-gray-400">Targeting <span className="text-white font-bold">{allMistakes.length}</span> active weak areas.</p>
                            </div>
                            {allMistakes.length > 0 ? (
                                <div className="bg-black/30 rounded-lg p-3 text-left max-h-32 overflow-y-auto border border-white/5">
                                    <p className="text-xs text-gray-500 mb-2 font-bold uppercase">Focus Areas:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {allMistakes.map((m, i) => <span key={i} className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded border border-red-800/50">{m}</span>)}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-green-400">No mistakes recorded! Good job.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'jeeMains' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
                                <Icon name="trophy" className="w-8 h-8 mx-auto text-purple-400 mb-2"/>
                                <h3 className="font-bold text-white">Full Mock Simulation</h3>
                                <p className="text-xs text-purple-300 mt-1">3 Hours • 75 Questions • Negative Marking</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Syllabus Covered</label>
                                <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} className="w-full mt-2 h-24 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none" placeholder="e.g. Full 11th Physics, Organic Chemistry..." />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Answer Key (Optional)</label>
                                    <div className="flex gap-3">
                                        <input type="file" accept=".json" ref={jeeMainsFileInputRef} onChange={handleJeeMainsFileUpload} className="hidden" />
                                        <button type="button" onClick={() => jeeMainsFileInputRef.current?.click()} className="text-xs text-cyan-400 hover:text-cyan-300">Upload JSON</button>
                                        <button type="button" onClick={() => setIsAiKeyModalOpen(true)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><Icon name="gemini" className="w-3 h-3" /> AI Gen</button>
                                    </div>
                                </div>
                                <textarea value={jeeMainsCorrectAnswersText} onChange={(e) => setJeeMainsCorrectAnswersText(e.target.value)} className="w-full h-20 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-cyan-500 outline-none resize-none" placeholder="For instant feedback during test..." />
                            </div>
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-red-400 text-center bg-red-900/20 py-2 rounded-lg border border-red-900/50">{error}</p>}
              
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button type="button" onClick={handleClose} className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
                    <button onClick={handleStart} disabled={isLoading || (activeTab === 'manual' && totalQuestions === 0) || (activeTab === 'mistakes' && allMistakes.length === 0)} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</> : <><Icon name="play" className="w-4 h-4" /> Start Session</>}
                    </button>
                </div>
              </div>
            )}
          </div>
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
            onPracticeTestReady={() => {}} 
            onOpenGuide={() => {}} 
          />
      )}
    </>
  );
};
