
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from './components/Icon';
import { playNextSound, playStopSound, playMarkSound, vibrate } from './utils/sounds';
import { api } from './api/apiService';
import AnswerKeyUploadModal from './components/AnswerKeyUploadModal';
import { ResultData, StudentData, HomeworkData, ScheduleItem, ScheduleCardData, PracticeQuestion } from './types';
import TestAnalysisReport from './components/TestAnalysisReport';
import SpecificMistakeAnalysisModal from './components/SpecificMistakeAnalysisModal';
import MusicVisualizerWidget from './components/widgets/MusicVisualizerWidget';
import { useMusicPlayer } from './context/MusicPlayerContext';

type PracticeMode = 'custom' | 'jeeMains';

interface McqTimerProps {
    questionNumbers: number[];
    questions?: PracticeQuestion[];
    perQuestionTime: number;
    onClose: () => void;
    onSessionComplete: (duration: number, questions_solved: number, questions_skipped: number[]) => void;
    onLogResult?: (result: ResultData) => void;
    onUpdateWeaknesses?: (weaknesses: string[]) => void;
    practiceMode: PracticeMode;
    subject: string;
    category: string;
    syllabus: string;
    student: StudentData;
    correctAnswers?: Record<string, string | string[]>;
    onSaveTask?: (task: ScheduleItem) => void;
    initialTask?: HomeworkData | null;
}

// Helper to safely normalize answers for comparison
const normalizeAnswer = (answer?: string | string[] | number): string | string[] => {
    if (answer === undefined || answer === null || answer === '') return '';

    if (Array.isArray(answer)) {
        return answer.map(a => String(a).toUpperCase().trim()).sort();
    }

    const strAnswer = String(answer).toUpperCase().trim();
    switch (strAnswer) {
        case '1': return 'A';
        case '2': return 'B';
        case '3': return 'C';
        case '4': return 'D';
        default: return strAnswer;
    }
};

const McqTimer: React.FC<McqTimerProps> = (props) => {
    const {
        questionNumbers, questions = [], perQuestionTime, onClose, onSessionComplete,
        onLogResult, onUpdateWeaknesses, practiceMode, subject, category,
        syllabus, student, correctAnswers = {}, onSaveTask, initialTask
    } = props;

    const { isPlaying } = useMusicPlayer();

    // Validate inputs to prevent crashes
    const safeQuestions = useMemo(() => {
        if (questions && questions.length > 0) return questions;
        // Fallback for when no question objects are provided (just numbers)
        return questionNumbers.map(num => ({
            number: num,
            text: 'Question text not available.',
            type: 'MCQ' as const,
            options: ['A', 'B', 'C', 'D']
        }));
    }, [questions, questionNumbers]);

    const totalQuestions = safeQuestions.length;

    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(practiceMode === 'jeeMains' ? 180 * 60 : perQuestionTime * totalQuestions);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
    const [timings, setTimings] = useState<Record<number, number>>({});
    const [markedForReview, setMarkedForReview] = useState<number[]>([]);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [isUploadingKey, setIsUploadingKey] = useState(false);
    const [testResult, setTestResult] = useState<ResultData | null>(null);
    const [gradingError, setGradingError] = useState('');
    const [isGrading, setIsGrading] = useState(false);
    const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect' | 'answered', correctAnswer?: string | string[] } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [analyzingMistake, setAnalyzingMistake] = useState<number | null>(null);

    const questionStartTimeRef = useRef<number | null>(null);
    const timerRef = useRef<HTMLDivElement>(null);

    const currentQuestion = safeQuestions[currentQuestionIndex];
    const currentQuestionNumber = currentQuestion?.number || (currentQuestionIndex + 1);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const toggleFullscreen = () => {
        const elem = timerRef.current?.closest('.modal-content-enter') || timerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    const getQuestionInfo = useCallback((index: number) => {
        if (safeQuestions[index]) {
            // Heuristics for subject based on index for JEE Mains full mock
            if (practiceMode === 'jeeMains') {
                if (index < 25) return { subject: 'Physics', type: safeQuestions[index].type };
                if (index < 50) return { subject: 'Chemistry', type: safeQuestions[index].type };
                return { subject: 'Maths', type: safeQuestions[index].type };
            }
            return { subject: subject, type: safeQuestions[index].type };
        }
        return { subject: 'Unknown', type: 'MCQ' as const };
    }, [practiceMode, subject, safeQuestions]);

    const gradeTest = useCallback(() => {
        // Robust grading: check if we have answers to grade against
        if (!correctAnswers || Object.keys(correctAnswers).length === 0) {
            // Generate a result without grading (manual review needed)
            const tempResult: ResultData = {
                ID: `R${Date.now()}`,
                DATE: new Date().toISOString().split('T')[0],
                SCORE: `N/A`,
                MISTAKES: [], // Cannot determine mistakes
                syllabus: syllabus,
                timings: timings,
            };
            setTestResult(tempResult);
            if (onLogResult) onLogResult(tempResult);
            return;
        }

        let score = 0;
        const incorrectQuestionNumbers: number[] = [];
        const totalMarks = practiceMode === 'jeeMains' ? 300 : totalQuestions * 4;

        safeQuestions.forEach((q, index) => {
            const qNum = q.number;
            const userAnswer = answers[qNum];
            const correctAnswer = correctAnswers[qNum] || correctAnswers[String(qNum)];
            const questionType = q.type;

            if (!userAnswer) {
                // Unanswered
                if (questionType === 'MCQ' && practiceMode === 'jeeMains') {
                    // No negative marking for unanswered? Usually no.
                }
                return;
            }

            // If we have an answer but no key, skip or mark wrong? 
            // Better to match robustly.
            if (!correctAnswer) return;

            const normUser = normalizeAnswer(userAnswer);
            const normCorrect = normalizeAnswer(correctAnswer);

            let isCorrect = false;

            // Compare arrays for multi-choice/multi-select
            if (Array.isArray(normUser) && Array.isArray(normCorrect)) {
                isCorrect = JSON.stringify(normUser) === JSON.stringify(normCorrect);
            } else if (Array.isArray(normCorrect) && typeof normUser === 'string') {
                // Single selection matching one of multiple valid answers (rare) or partial? 
                // Assuming exact match needed for array
                isCorrect = false;
            } else {
                isCorrect = normUser === normCorrect;
            }

            if (isCorrect) {
                score += 4;
            } else {
                incorrectQuestionNumbers.push(qNum);
                if (questionType === 'MCQ' && practiceMode === 'jeeMains') {
                    score -= 1;
                }
            }
        });

        const newResult: ResultData = {
            ID: `R${Date.now()}`,
            DATE: new Date().toISOString().split('T')[0],
            SCORE: `${score}/${totalMarks}`,
            MISTAKES: incorrectQuestionNumbers.map(String),
            syllabus: syllabus,
            timings: timings,
        };

        setTestResult(newResult);
        if (onLogResult) onLogResult(newResult);
    }, [answers, correctAnswers, safeQuestions, practiceMode, syllabus, timings, onLogResult, totalQuestions]);

    useEffect(() => {
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const finishSession = useCallback(() => {
        if (isFinished) return;
        playStopSound(); vibrate('finish');
        setIsActive(false);
        setIsFinished(true);
        const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
        const solved = Object.keys(answers).filter(k => {
            const ans = answers[parseInt(k)];
            return ans !== '' && (Array.isArray(ans) ? ans.length > 0 : true);
        });

        // Robust skipping calculation
        const solvedSet = new Set(solved.map(String));
        const skipped = safeQuestions.filter(q => !solvedSet.has(String(q.number))).map(q => q.number);

        onSessionComplete(duration, solved.length, skipped);
    }, [isFinished, sessionStartTime, answers, safeQuestions, onSessionComplete]);

    useEffect(() => {
        let interval: ReturnType<typeof setTimeout> | null = null;
        if (isActive && !isFinished && totalSeconds > 0) {
            interval = setInterval(() => setTotalSeconds(s => s - 1), 1000);
        } else if (isActive && !isFinished && totalSeconds <= 0) {
            finishSession();
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isActive, isFinished, totalSeconds, finishSession]);

    useEffect(() => {
        if (isFinished) {
            gradeTest();
        }
    }, [isFinished, gradeTest]);

    const handleStart = () => {
        vibrate('click');
        setSessionStartTime(Date.now());
        questionStartTimeRef.current = Date.now();
        setIsActive(true);
    };

    const handleAnswerInput = (value: string | string[]) => {
        if (isNavigating || (feedback && practiceMode !== 'jeeMains')) return;

        playNextSound();
        setAnswers(prev => ({ ...prev, [currentQuestionNumber]: value }));

        if (practiceMode === 'jeeMains') return;

        // Immediate feedback mode (non-JEE)
        if (correctAnswers && (correctAnswers[currentQuestionNumber] || correctAnswers[String(currentQuestionNumber)])) {
            const correctAnswer = correctAnswers[currentQuestionNumber] || correctAnswers[String(currentQuestionNumber)];
            const isCorrect = JSON.stringify(normalizeAnswer(value)) === JSON.stringify(normalizeAnswer(correctAnswer));

            setFeedback({
                status: isCorrect ? 'correct' : 'incorrect',
                correctAnswer: correctAnswer,
            });

            setIsNavigating(true);
            setTimeout(() => handleNextQuestion(), 1500);

            // Create re-attempt task if wrong
            if (!isCorrect && onSaveTask && initialTask) {
                const isReattempt = initialTask.CARD_TITLE.EN.startsWith('[RE-ATTEMPT]');
                if (!isReattempt) {
                    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
                    const todayIndex = new Date().getDay();
                    const nextDay = days[(todayIndex + 1) % 7];
                    const reattemptTask: ScheduleCardData = {
                        ID: `A${Date.now()}${currentQuestionNumber}`, type: 'ACTION', isUserCreated: true,
                        // Safe string conversions
                        DAY: { EN: nextDay, GU: '' }, TIME: '21:00',
                        FOCUS_DETAIL: { EN: `You got this question wrong. Correct answer: ${Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer}.`, GU: '' },
                        CARD_TITLE: { EN: `[RE-ATTEMPT] Q.${currentQuestionNumber} of: ${initialTask.CARD_TITLE.EN}`, GU: '' },
                        SUBJECT_TAG: initialTask.SUBJECT_TAG || { EN: 'General', GU: '' },
                        SUB_TYPE: 'ANALYSIS'
                    };
                    onSaveTask(reattemptTask);
                }
            }
        } else {
            // No answer key provided for immediate feedback
            setFeedback({ status: 'answered' });
            setIsNavigating(true);
            setTimeout(() => handleNextQuestion(), 500);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            navigate(currentQuestionIndex + 1);
        } else {
            finishSession();
        }
    };

    const navigate = (newIndex: number) => {
        if (isNavigating && newIndex !== currentQuestionIndex + 1) return; // Allow next, block rapid random jumps if animating? No, allow jumps.
        // If feedback is showing, force wait? 
        // Better UX: Allow skipping feedback delay if user manually clicks nav
        setIsNavigating(true);

        if (newIndex >= 0 && newIndex < totalQuestions) {
            if (questionStartTimeRef.current) {
                const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
                setTimings(prev => ({ ...prev, [currentQuestionNumber]: (prev[currentQuestionNumber] || 0) + timeSpent }));
            }

            setTimeout(() => {
                setFeedback(null);
                questionStartTimeRef.current = Date.now();
                setCurrentQuestionIndex(newIndex);
                setTimeout(() => setIsNavigating(false), 50);
            }, 200); // Shorter delay for snappier feel
        } else {
            setIsNavigating(false);
        }
    };

    const handleMarkForReview = () => {
        playMarkSound();
        setMarkedForReview(prev =>
            prev.includes(currentQuestionNumber)
                ? prev.filter(q => q !== currentQuestionNumber)
                : [...prev, currentQuestionNumber]
        );
        handleNextQuestion();
    };

    const handleGradeWithAI = async (imageBase64: string) => {
        setIsGrading(true);
        setGradingError('');
        try {
            const userAnswersForApi: Record<string, string> = {};
            for (const qNum in answers) {
                const answer = answers[qNum];
                if (Array.isArray(answer)) {
                    userAnswersForApi[qNum] = answer.sort().join(',');
                } else {
                    userAnswersForApi[qNum] = String(answer);
                }
            }

            const resultAnalysis = await api.analyzeTestResults({ imageBase64, userAnswers: userAnswersForApi, timings, syllabus });

            const newResult: ResultData = {
                ID: `R${Date.now()}`,
                DATE: new Date().toISOString().split('T')[0],
                SCORE: `${resultAnalysis.score}/${resultAnalysis.totalMarks}`,
                MISTAKES: resultAnalysis.incorrectQuestionNumbers.map(String),
                syllabus: syllabus,
                timings: timings,
                analysis: {
                    subjectTimings: resultAnalysis.subjectTimings,
                    chapterScores: resultAnalysis.chapterScores,
                    aiSuggestions: resultAnalysis.aiSuggestions,
                    incorrectQuestionNumbers: resultAnalysis.incorrectQuestionNumbers,
                },
            };
            setTestResult(newResult);
            if (onLogResult) onLogResult(newResult);

        } catch (error: any) {
            let errorMessage = error.error || "Failed to grade answers. Please try again.";
            setGradingError(errorMessage);
        } finally {
            setIsGrading(false);
            setIsUploadingKey(false);
        }
    };

    const { subject: currentSubject } = getQuestionInfo(currentQuestionIndex);
    const currentQuestionType = currentQuestion?.type || 'MCQ';

    // UI HELPER
    const getOptionClasses = (option: string) => {
        const isMultiChoice = currentQuestionType === 'MULTI_CHOICE';
        const userAnswer = answers[currentQuestionNumber];
        const normalizedOption = normalizeAnswer(option);

        // Handle undefined user answer robustly
        let isOptionSelected = false;
        if (isMultiChoice) {
            const userArr = Array.isArray(userAnswer) ? userAnswer : (userAnswer ? [userAnswer] : []);
            isOptionSelected = userArr.some(ans => normalizeAnswer(ans) === normalizedOption);
        } else {
            isOptionSelected = normalizeAnswer(userAnswer) === normalizedOption;
        }

        const baseClass = "relative w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group hover:scale-[1.01] active:scale-[0.99] outline-none focus:ring-2 focus:ring-cyan-500/50";

        // Selection State (Blue)
        if (isOptionSelected && !feedback) {
            return `${baseClass} bg-cyan-900/30 border-cyan-400 text-white shadow-lg shadow-cyan-900/20`;
        }

        // Default State
        if (!feedback) {
            return `${baseClass} bg-gray-800/40 border-white/5 hover:border-cyan-500/50 hover:bg-gray-800/60 text-gray-300`;
        }

        // Feedback State
        const normalizedCorrectAnswer = normalizeAnswer(feedback.correctAnswer);
        const currentOptionStr = normalizedOption as string;

        if (isMultiChoice) {
            // Multi-choice logic (complex, handled simplified here)
            const correctArr = Array.isArray(normalizedCorrectAnswer) ? normalizedCorrectAnswer : [normalizedCorrectAnswer];
            const isCorrectOption = correctArr.includes(currentOptionStr);

            if (isCorrectOption) return `${baseClass} bg-green-900/40 border-green-500 text-green-100`;
            if (isOptionSelected && !isCorrectOption) return `${baseClass} bg-red-900/40 border-red-500 text-red-100`;
        } else {
            if (currentOptionStr === normalizedCorrectAnswer) return `${baseClass} bg-green-900/40 border-green-500 text-green-100 shadow-green-900/20`;
            if (isOptionSelected && currentOptionStr !== normalizedCorrectAnswer) return `${baseClass} bg-red-900/40 border-red-500 text-red-100 shadow-red-900/20`;
        }

        return `${baseClass} opacity-50 border-transparent bg-gray-900/30`;
    };

    // Render Start Screen
    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-[var(--glass-bg)] rounded-3xl border border-[var(--glass-border)] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                <div className="relative z-10 w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse-slow">
                    <Icon name="play" className="w-10 h-10 text-white fill-current translate-x-1" />
                </div>

                <h3 className="relative z-10 text-4xl font-black text-white mb-2 tracking-tight">Ready?</h3>
                <p className="relative z-10 text-gray-400 mb-8 max-w-sm font-medium">
                    {subject} Practice • {totalQuestions} Questions
                </p>

                <button onClick={handleStart} className="relative z-10 px-10 py-4 bg-white text-black font-bold rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all text-xl flex items-center gap-3">
                    <Icon name="play" className="w-6 h-6" /> Start Session
                </button>
                <button onClick={onClose} className="relative z-10 mt-6 text-sm text-gray-500 hover:text-white transition-colors">
                    Cancel
                </button>
            </div>
        )
    }

    // Render Finish Screen
    if (isFinished) {
        return (
            <div className="flex flex-col h-[75vh] md:h-[85vh] bg-[var(--glass-bg)] rounded-3xl border border-[var(--glass-border)] overflow-hidden shadow-2xl backdrop-blur-xl">
                {/* Finish Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
                    <div>
                        <h3 className="text-2xl font-bold text-white">Analysis</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">{syllabus}</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 transition-colors"><Icon name="close" className="w-6 h-6 text-gray-400" /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Score Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                        <div className="absolute top-0 right-0 p-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10 text-center">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Score Achieved</p>
                            <div className="text-7xl font-black text-white mb-2 tracking-tighter drop-shadow-2xl">
                                {testResult?.SCORE || 'Pending'}
                            </div>
                            <div className="flex gap-4 mt-2 justify-center">
                                <span className="text-green-400 text-sm font-bold flex items-center gap-1"><Icon name="check" className="w-4 h-4" /> Correct</span>
                                <span className="text-red-400 text-sm font-bold flex items-center gap-1"><Icon name="close" className="w-4 h-4" /> {testResult?.MISTAKES?.length || 0} Mistakes</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => setIsUploadingKey(true)} className="p-4 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 rounded-2xl flex items-center gap-4 transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Icon name="gemini" className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-white">AI Analysis</h4>
                                <p className="text-xs text-gray-400">Deep dive into weak areas</p>
                            </div>
                        </button>
                        <button onClick={() => setAnalyzingMistake(testResult && testResult.MISTAKES.length > 0 ? parseInt(testResult.MISTAKES[0]) : null)} disabled={!testResult || testResult.MISTAKES.length === 0} className="p-4 bg-gray-800/40 border border-white/5 hover:bg-gray-800/60 rounded-2xl flex items-center gap-4 transition-all group disabled:opacity-50">
                            <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Icon name="refresh" className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-white">Review Mistakes</h4>
                                <p className="text-xs text-gray-400">Step-by-step solution check</p>
                            </div>
                        </button>
                    </div>

                    {testResult?.analysis && <TestAnalysisReport result={testResult} onAnalyzeMistake={(q) => setAnalyzingMistake(q)} />}

                    {isUploadingKey && <AnswerKeyUploadModal onClose={() => setIsUploadingKey(false)} onGrade={handleGradeWithAI} />}
                    {analyzingMistake !== null && onUpdateWeaknesses && (
                        <SpecificMistakeAnalysisModal
                            questionNumber={analyzingMistake}
                            onClose={() => setAnalyzingMistake(null)}
                            onSaveWeakness={(topic) => onUpdateWeaknesses([...new Set([...(student.CONFIG.WEAK || []), topic])])}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={timerRef} className={`flex flex-col relative bg-[#0f1115] overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[200] rounded-none' : 'h-[85vh] max-h-[850px] w-full max-w-6xl rounded-3xl border border-white/10 shadow-2xl'}`}>

            {/* Header */}
            <div className="flex-shrink-0 bg-[#0f1115] border-b border-white/5 p-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${currentSubject === 'Physics' ? "bg-purple-900/30 text-purple-400" : currentSubject === 'Chemistry' ? "bg-amber-900/30 text-amber-400" : "bg-blue-900/30 text-blue-400"}`}>
                        <Icon name="book-open" className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg leading-tight">{category}</h2>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">Q{currentQuestionNumber} <span className="text-gray-700">|</span> {currentSubject}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-lg font-mono font-bold text-lg flex items-center gap-2 ${totalSeconds < 300 ? 'bg-red-900/20 text-red-500 animate-pulse' : 'bg-gray-900 text-cyan-400'}`}>
                        <Icon name="clock" className="w-4 h-4 opacity-70" />
                        {formatTime(totalSeconds)}
                    </div>
                    <button onClick={toggleFullscreen} className="p-2.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors">
                        <Icon name={isFullscreen ? "minimize" : "expand"} className="w-5 h-5" />
                    </button>
                    <button onClick={finishSession} className="px-4 py-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg text-sm font-bold transition-all border border-white/5 hover:border-red-500/30">
                        Finish
                    </button>
                </div>
            </div>

            <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">

                {/* Left Sidebar: Navigation Grid */}
                <div className="w-full md:w-72 bg-[#0a0c10] border-r border-white/5 flex flex-col z-10 flex-shrink-0">
                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 sticky top-0 bg-[#0a0c10] py-2 z-10">Question Palette</h4>
                        <div className="grid grid-cols-5 gap-2">
                            {safeQuestions.map((q, idx) => {
                                const qNum = q.number;
                                const isCurrent = idx === currentQuestionIndex;
                                const userAnswer = answers[qNum];
                                const isAnswered = userAnswer !== undefined && userAnswer !== '' && (Array.isArray(userAnswer) ? userAnswer.length > 0 : true);
                                const isMarked = markedForReview.includes(qNum);

                                let statusClass = "bg-gray-800/50 text-gray-500 border border-transparent";
                                if (isCurrent) statusClass = "bg-cyan-600 text-white shadow-lg shadow-cyan-900/50 scale-110 z-10 ring-2 ring-cyan-400";
                                else if (isAnswered && isMarked) statusClass = "bg-purple-900/50 text-purple-200 border-purple-500/50";
                                else if (isAnswered) statusClass = "bg-green-900/50 text-green-200 border-green-500/50";
                                else if (isMarked) statusClass = "bg-yellow-900/50 text-yellow-200 border-yellow-500/50";

                                return (
                                    <button
                                        key={qNum}
                                        onClick={() => navigate(idx)}
                                        className={`aspect-square rounded-md text-xs font-bold transition-all ${statusClass}`}
                                    >
                                        {qNum}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {isPlaying && (
                        <div className="border-t border-white/5 p-4 bg-black/40">
                            <MusicVisualizerWidget height={40} color="#22d3ee" barCount={12} />
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gradient-to-br from-[#0f1115] to-[#14161a]">
                    <div className={`max-w-4xl mx-auto transition-all duration-300 ${isNavigating ? 'opacity-50 blur-sm scale-[0.99]' : 'opacity-100 scale-100'}`}>
                        {currentQuestion ? (
                            <div className="bg-[#1a1d23] rounded-3xl p-6 md:p-8 shadow-2xl border border-white/5">
                                <div className="min-h-[100px] mb-8">
                                    <p className="text-lg md:text-xl text-gray-200 leading-relaxed font-medium whitespace-pre-wrap">
                                        {currentQuestion.text}
                                    </p>
                                </div>

                                <div className="space-y-4 max-w-2xl mx-auto">
                                    {currentQuestionType === 'NUM' ? (
                                        <input
                                            type="text"
                                            value={(answers[currentQuestionNumber] as string) || ''}
                                            onChange={(e) => handleAnswerInput(e.target.value)}
                                            disabled={isNavigating || !!feedback}
                                            className="w-full text-center text-4xl font-mono bg-black/30 border border-white/10 rounded-2xl p-6 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 text-white placeholder-gray-700 transition-all"
                                            placeholder="Enter Answer"
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {(currentQuestion.options || ['A', 'B', 'C', 'D']).map((opt, idx) => {
                                                const label = typeof opt === 'string' && opt.match(/^\([A-D]\)/) ? opt.substring(3).trim() : opt;
                                                const letter = String.fromCharCode(65 + idx);
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            if (currentQuestionType === 'MULTI_CHOICE') {
                                                                const curr = (answers[currentQuestionNumber] || []) as string[];
                                                                if (curr.includes(letter)) handleAnswerInput(curr.filter(x => x !== letter));
                                                                else handleAnswerInput([...curr, letter]);
                                                            } else {
                                                                handleAnswerInput(letter);
                                                            }
                                                        }}
                                                        disabled={isNavigating}
                                                        className={getOptionClasses(letter)}
                                                    >
                                                        <span className="w-8 h-8 rounded bg-black/20 flex items-center justify-center font-bold text-sm text-gray-400 border border-white/5">{letter}</span>
                                                        <span className="flex-1 font-medium">{label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-500">Question Unavailable</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="bg-[#0f1115] border-t border-white/5 p-4 flex items-center justify-between z-20">
                <button onClick={handleMarkForReview} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                    <Icon name={markedForReview.includes(currentQuestionNumber) ? "bookmark-check" : "bookmark"} className="w-5 h-5" />
                    {markedForReview.includes(currentQuestionNumber) ? "Unmark" : "Mark Review"}
                </button>

                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0} className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 disabled:opacity-30 transition-all">
                        <Icon name="arrow-left" className="w-5 h-5" />
                    </button>
                    <button onClick={() => setAnswers({ ...answers, [currentQuestionNumber]: '' })} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:text-white transition-colors">Clear</button>
                    <button onClick={() => handleNextQuestion()} className="px-8 py-3 bg-white text-black rounded-full font-bold shadow-lg hover:bg-gray-100 active:scale-95 transition-all flex items-center gap-2">
                        Next <Icon name="arrow-right" className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Toast Feedback */}
            {feedback && feedback.status !== 'answered' && (
                <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl text-white font-bold shadow-2xl animate-fade-in-up flex items-center gap-4 backdrop-blur-xl border-2 z-50
                    ${feedback.status === 'correct' ? 'bg-green-500/10 border-green-500 text-green-100' : 'bg-red-500/10 border-red-500 text-red-100'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${feedback.status === 'correct' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                        <Icon name={feedback.status === 'correct' ? 'check' : 'close'} className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold opacity-70 uppercase tracking-wider">{feedback.status === 'correct' ? 'Well Done!' : 'Incorrect'}</p>
                        <p className="text-lg leading-none">{feedback.status === 'correct' ? 'Correct Answer' : `Correct was ${Array.isArray(feedback.correctAnswer) ? feedback.correctAnswer.join(', ') : feedback.correctAnswer}`}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default McqTimer;