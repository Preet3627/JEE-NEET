
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

const normalizeAnswer = (answer?: string | string[]): string | string[] => {
    if (!answer) return '';
    if (Array.isArray(answer)) {
        return answer.map(a => a.toUpperCase().trim()).sort();
    }
    const upperAnswer = answer.toUpperCase().trim();
    switch (upperAnswer) {
        case '1': return 'A';
        case '2': return 'B';
        case '3': return 'C';
        case '4': return 'D';
        default: return upperAnswer;
    }
};


const McqTimer: React.FC<McqTimerProps> = (props) => {
    const {
        questionNumbers, questions, perQuestionTime, onClose, onSessionComplete,
        onLogResult, onUpdateWeaknesses, practiceMode, subject, category,
        syllabus, student, correctAnswers, onSaveTask, initialTask
    } = props;

    const { isPlaying } = useMusicPlayer();

    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(practiceMode === 'jeeMains' ? 180 * 60 : perQuestionTime * questionNumbers.length);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
    const [timings, setTimings] = useState<Record<number, number>>({});
    const [markedForReview, setMarkedForReview] = useState<number[]>([]);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
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
    const totalQuestions = questions ? questions.length : questionNumbers.length;

    const currentQuestion = questions ? questions[currentQuestionIndex] : null;
    const currentQuestionNumber = useMemo(() => {
        return questions ? questions[currentQuestionIndex].number : questionNumbers[currentQuestionIndex];
    }, [questions, questionNumbers, currentQuestionIndex]);


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
        if (questions && questions[index]) {
            return { subject: subject, type: questions[index].type };
        }
        if (practiceMode !== 'jeeMains') {
            return { subject: subject, type: 'MCQ' as 'MCQ' | 'NUM' | 'MULTI_CHOICE' };
        }
        if (index < 20) return { subject: 'Physics', type: 'MCQ' as const };
        if (index < 25) return { subject: 'Physics', type: 'NUM' as const };
        if (index < 45) return { subject: 'Chemistry', type: 'MCQ' as const };
        if (index < 50) return { subject: 'Chemistry', type: 'NUM' as const };
        if (index < 70) return { subject: 'Maths', type: 'MCQ' as const };
        return { subject: 'Maths', type: 'NUM' as const };
    }, [practiceMode, subject, questions]);


    const gradeTest = useCallback(() => {
        if (!correctAnswers || Object.keys(correctAnswers).length === 0) return;

        let score = 0;
        const incorrectQuestionNumbers: number[] = [];
        const totalMarks = practiceMode === 'jeeMains' ? 300 : questionNumbers.length * 4;

        questionNumbers.forEach((qNum, index) => {
            const userAnswer = answers[qNum];
            const correctAnswer = correctAnswers[qNum.toString()];
            const questionType = currentQuestion?.type || getQuestionInfo(index).type;

            if (!userAnswer) {
                incorrectQuestionNumbers.push(qNum);
                if (questionType === 'MCQ' && practiceMode === 'jeeMains') {
                    score -= 1;
                }
                return;
            }

            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);

            let isCorrect = false;
            if (questionType === 'MULTI_CHOICE') {
                if (Array.isArray(normalizedUserAnswer) && Array.isArray(normalizedCorrectAnswer)) {
                    isCorrect = JSON.stringify(normalizedUserAnswer) === JSON.stringify(normalizedCorrectAnswer);
                }
            } else {
                isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
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
    }, [answers, correctAnswers, questionNumbers, practiceMode, syllabus, timings, onLogResult, getQuestionInfo, currentQuestion]);


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
        const solved = Object.keys(answers).filter(k => answers[parseInt(k)] !== '' && (Array.isArray(answers[parseInt(k)]) ? answers[parseInt(k)]?.length > 0 : true));
        const skipped = questionNumbers.filter(q => !solved.includes(q.toString()));
        onSessionComplete(duration, solved.length, skipped);
    }, [isFinished, sessionStartTime, answers, questionNumbers, onSessionComplete]);

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

        if (correctAnswers) {
            const correctAnswer = correctAnswers[currentQuestionNumber.toString()];
            const isCorrect = JSON.stringify(normalizeAnswer(value)) === JSON.stringify(normalizeAnswer(correctAnswer));
            setFeedback({
                status: isCorrect ? 'correct' : 'incorrect',
                correctAnswer: correctAnswer,
            });

            setIsNavigating(true);
            setTimeout(() => handleNextQuestion(), 1500);

            if (!isCorrect && onSaveTask && initialTask) {
                const isReattempt = initialTask.CARD_TITLE.EN.startsWith('[RE-ATTEMPT]');
                if (!isReattempt) {
                    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
                    const todayIndex = new Date().getDay();
                    const nextDay = days[(todayIndex + 1) % 7];
                    const reattemptTask: ScheduleCardData = {
                        ID: `A${Date.now()}${currentQuestionNumber}`, type: 'ACTION', isUserCreated: true,
                        DAY: { EN: nextDay, GU: '' }, TIME: '21:00',
                        FOCUS_DETAIL: { EN: `You got this question wrong. Try solving it again. Correct answer was: ${Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer}.`, GU: '' },
                        CARD_TITLE: { EN: `[RE-ATTEMPT] Q.${currentQuestionNumber} of: ${initialTask.CARD_TITLE.EN}`, GU: '' },
                        SUBJECT_TAG: initialTask.SUBJECT_TAG, SUB_TYPE: 'ANALYSIS'
                    };
                    onSaveTask(reattemptTask);
                }
            }
        } else {
            setFeedback({ status: 'answered' });
            setIsNavigating(true);
            setTimeout(() => handleNextQuestion(), 1000);
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
        if (isNavigating) return;
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
                setIsPaletteOpen(false);
                setTimeout(() => setIsNavigating(false), 50);
            }, 300);
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
            const userAnswersForApi: Record<string, string | string[]> = {};
            for (const qNum in answers) {
                const answer = answers[qNum];
                if (Array.isArray(answer)) {
                    userAnswersForApi[qNum] = answer.sort().join(',');
                } else {
                    userAnswersForApi[qNum] = answer;
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
            if (error && typeof error === 'object' && 'error' in error && error.error === 'AI_QUOTA_EXCEEDED') {
                errorMessage = "AI grading service temporarily unavailable due to quota limits or maintenance. Please try again later.";
            }
            setGradingError(errorMessage);
        } finally {
            setIsGrading(false);
            setIsUploadingKey(false);
        }
    };

    const currentQuestionType = useMemo(() => {
        if (currentQuestion) return currentQuestion.type;
        if (correctAnswers && correctAnswers[currentQuestionNumber.toString()]) {
            const answer = correctAnswers[currentQuestionNumber.toString()];
            if (Array.isArray(answer)) return 'MULTI_CHOICE';
            if (typeof answer === 'string') {
                return ['A', 'B', 'C', 'D'].includes(answer.toUpperCase().trim()) ? 'MCQ' : 'NUM';
            }
        }
        if (practiceMode === 'jeeMains') {
            return getQuestionInfo(currentQuestionIndex).type;
        }
        return 'MCQ';
    }, [currentQuestion, correctAnswers, currentQuestionNumber, practiceMode, currentQuestionIndex, getQuestionInfo]);


    const { subject: currentSubject } = getQuestionInfo(currentQuestionIndex);

    // UI HELPER: Option Styles
    const getOptionClasses = (option: string) => {
        const isMultiChoice = currentQuestionType === 'MULTI_CHOICE';
        const userAnswer = answers[currentQuestionNumber];
        const normalizedOption = normalizeAnswer(option);

        const isOptionSelected = isMultiChoice && Array.isArray(userAnswer)
            ? userAnswer.some(ans => normalizeAnswer(ans) === normalizedOption)
            : normalizeAnswer(userAnswer) === normalizedOption;

        const baseClass = "relative w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group hover:scale-[1.01] active:scale-[0.99]";

        if (isOptionSelected && !feedback) {
            return `${baseClass} bg-cyan-900/30 border-cyan-400 text-white shadow-lg shadow-cyan-900/20`;
        }

        if (!feedback) {
            return `${baseClass} bg-gray-800/40 border-white/5 hover:border-cyan-500/50 hover:bg-gray-800/60 text-gray-300`;
        }

        const normalizedCorrectAnswer = normalizeAnswer(feedback.correctAnswer);
        const currentOption = normalizeAnswer(option) as string;

        if (isMultiChoice) {
            const normalizedUserAnswers = Array.isArray(userAnswer) ? userAnswer.map(normalizeAnswer) : [];
            const normalizedCorrectAnswers = Array.isArray(normalizedCorrectAnswer) ? normalizedCorrectAnswer : [];

            const isCorrectOption = normalizedCorrectAnswers.includes(currentOption);
            const wasUserSelected = normalizedUserAnswers.includes(currentOption);

            if (isCorrectOption) {
                return `${baseClass} bg-green-900/40 border-green-500 text-green-100 shadow-green-900/20`;
            } else if (wasUserSelected && !isCorrectOption) {
                return `${baseClass} bg-red-900/40 border-red-500 text-red-100 shadow-red-900/20`;
            }
            return `${baseClass} opacity-50 border-transparent bg-gray-900/30`;
        } else {
            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            if (currentOption === normalizedCorrectAnswer) return `${baseClass} bg-green-900/40 border-green-500 text-green-100 shadow-green-900/20`;
            if (typeof normalizedUserAnswer === 'string' && currentOption === normalizedUserAnswer && normalizedUserAnswer !== normalizedCorrectAnswer) return `${baseClass} bg-red-900/40 border-red-500 text-red-100 shadow-red-900/20`;
            return `${baseClass} opacity-50 border-transparent bg-gray-900/30`;
        }
    };

    if (!isActive) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-[var(--glass-bg)] rounded-3xl border border-[var(--glass-border)] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none" />

                <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse-slow">
                    <Icon name="play" className="w-10 h-10 text-white fill-current translate-x-1" />
                </div>

                <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">Ready to Ace It?</h3>
                <p className="text-gray-400 mb-8 max-w-sm">
                    You are about to start a practice session for <span className="text-cyan-400 font-semibold">{subject}</span>.
                </p>

                <div className="flex gap-6 mb-8 text-sm font-medium">
                    <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-white/5">
                        <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Questions</span>
                        <span className="text-xl text-white">{totalQuestions}</span>
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-gray-800/50 border border-white/5">
                        <span className="text-gray-400 block text-xs uppercase tracking-wider mb-1">Duration</span>
                        <span className="text-xl text-white">{formatTime(totalSeconds)}</span>
                    </div>
                </div>

                <button onClick={handleStart} className="px-8 py-3 bg-white text-black font-bold rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-lg flex items-center gap-2">
                    <Icon name="play" className="w-5 h-5" /> Start Now
                </button>

                <button onClick={onClose} className="mt-6 text-sm text-gray-500 hover:text-white transition-colors">
                    Cancel Session
                </button>
            </div>
        )
    }

    if (isFinished) {
        return (
            <div className="flex flex-col h-[80vh] bg-[var(--glass-bg)] rounded-3xl border border-[var(--glass-border)] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-cyan-900/10 to-transparent">
                    <h3 className="text-2xl font-bold text-white">Session Analysis</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><Icon name="close" className="w-6 h-6 text-gray-400" /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {testResult && !testResult.analysis && (
                        <div className="bg-gray-900/50 p-6 rounded-2xl border border-white/5 text-center">
                            <p className="text-lg font-medium text-gray-400 uppercase tracking-widest mb-2">Total Score</p>
                            <div className="text-6xl font-black text-cyan-400 mb-2 drop-shadow-lg tracking-tighter">{testResult.SCORE}</div>
                            <p className="text-sm text-gray-400">{testResult.MISTAKES.length} Incorrect Answers</p>
                        </div>
                    )}

                    {(practiceMode === 'jeeMains' || (questions && onLogResult)) ? (
                        testResult && testResult.analysis ? (
                            <TestAnalysisReport
                                result={testResult}
                                onAnalyzeMistake={(qNum) => setAnalyzingMistake(qNum)}
                            />
                        ) : (
                            <div className="space-y-4">
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 text-center">
                                    <Icon name="bulb" className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                                    <h4 className="text-xl font-bold text-white mb-2">Get Deep AI Analysis</h4>
                                    <p className="text-gray-400 mb-6 text-sm max-w-md mx-auto">
                                        Upload the answer key (image or text) to get instant subject-wise breakdown, weak areas, and AI suggestions.
                                    </p>
                                    <button onClick={() => setIsUploadingKey(true)} disabled={isGrading} className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all hover:scale-105">
                                        {isGrading ? 'Analyzing...' : <><Icon name="upload" className="w-5 h-5" /> Analyze with AI</>}
                                    </button>
                                    {gradingError && <p className="text-sm text-red-400 mt-4">{gradingError}</p>}
                                </div>
                            </div>
                        )
                    ) : (
                        !testResult && (
                            <div className="text-center py-10">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check" className="w-10 h-10 text-green-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Great Work!</h3>
                                <p className="text-gray-400">Session successfully logged to your history.</p>
                            </div>
                        )
                    )}

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
        <div ref={timerRef} className={`flex flex-col relative bg-[#0f1115] overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[85vh] max-h-[800px] w-full max-w-5xl rounded-3xl border border-white/5 shadow-2xl'}`}>

            {/* Header Toolbar */}
            <div className={`flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#14161a] z-20 transition-all ${focusMode ? '-translate-y-full absolute w-full opacity-0 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${currentSubject === 'Physics' ? 'bg-purple-500/20 text-purple-400' :
                            currentSubject === 'Chemistry' ? 'bg-yellow-500/20 text-yellow-400' :
                                currentSubject === 'Maths' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-300'
                        }`}>
                        {currentSubject[0]}
                    </div>
                    <div>
                        <h4 className="text-base font-bold text-white leading-tight">{category}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>Q{currentQuestionIndex + 1} of {totalQuestions}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            <span className="text-cyan-400 font-medium">{currentSubject}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setFocusMode(true)} className="p-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="Focus Mode">
                        <Icon name="maximize" className="w-5 h-5" />
                    </button>
                    <button onClick={toggleFullscreen} className="p-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                        <Icon name={isFullscreen ? "minimize" : "expand"} className="w-5 h-5" />
                    </button>
                    <button onClick={finishSession} className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-semibold text-sm transition-all border border-red-500/20">
                        End Test
                    </button>
                </div>
            </div>

            {/* Focus Mode Floating Exit */}
            {focusMode && (
                <button onClick={() => setFocusMode(false)} className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md">
                    <Icon name="minimize" className="w-5 h-5" />
                </button>
            )}

            {/* Main Content Split */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">

                {/* Visualizers & Timer (Left/Bottom) */}
                <div className={`md:w-64 bg-[#111317] border-r border-white/5 flex flex-col z-10 ${focusMode ? 'hidden' : 'block'}`}>
                    {/* Timer */}
                    <div className="p-6 text-center border-b border-white/5">
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Time Remaining</div>
                        <div className={`text-4xl font-black font-mono tracking-wider ${totalSeconds < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {formatTime(totalSeconds)}
                        </div>
                    </div>

                    {/* Palette Button / Grid Preview */}
                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                        <div className="grid grid-cols-4 gap-2">
                            {questionNumbers.map((qNum, index) => {
                                const userAnswer = answers[qNum];
                                const isAnswered = userAnswer !== undefined && (Array.isArray(userAnswer) ? userAnswer.length > 0 : userAnswer !== '');
                                const isMarked = markedForReview.includes(qNum);
                                const isCurrent = index === currentQuestionIndex;

                                let statusClass = 'bg-gray-800 text-gray-500 hover:bg-gray-700';
                                if (isCurrent) statusClass = 'bg-white text-black ring-2 ring-cyan-500 z-10 scale-105';
                                else if (isAnswered && isMarked) statusClass = 'bg-purple-900 text-purple-200 border border-purple-500';
                                else if (isAnswered) statusClass = 'bg-green-900 text-green-200 border border-green-500';
                                else if (isMarked) statusClass = 'bg-yellow-900 text-yellow-200 border border-yellow-500';

                                return (
                                    <button key={qNum} onClick={() => navigate(index)} className={`aspect-square rounded-lg text-xs font-bold transition-all ${statusClass}`}>
                                        {qNum}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Music Visualizer at bottom */}
                    {isPlaying && (
                        <div className="h-24 p-4 border-t border-white/5">
                            <MusicVisualizerWidget height={60} color="#06b6d4" />
                        </div>
                    )}
                </div>

                {/* Question Area (Right/Main) */}
                <div className={`flex-1 flex flex-col relative ${isNavigating ? 'opacity-50 scale-[0.99]' : 'opacity-100 scale-100'} transition-all duration-300`}>

                    {/* Question Content */}
                    <div className="flex-grow overflow-y-auto p-6 md:p-10 custom-scrollbar flex items-center justify-center">
                        <div className="w-full max-w-3xl">
                            <div className="mb-8">
                                <span className="text-cyan-500 font-bold text-sm uppercase tracking-wider mb-2 block">Question {currentQuestionNumber}</span>
                                {currentQuestion ? (
                                    <p className="text-xl md:text-2xl text-white font-medium leading-relaxed whitespace-pre-wrap">{currentQuestion.text}</p>
                                ) : (
                                    <div className="text-center py-10 opacity-50">
                                        <p className="text-xl">Question text unavailable</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {currentQuestionType === 'NUM' && (
                                    <input
                                        type="text"
                                        value={(answers[currentQuestionNumber] as string) || ''}
                                        onChange={(e) => handleAnswerInput(e.target.value)}
                                        disabled={isNavigating || !!feedback}
                                        className="w-full max-w-md mx-auto block text-center text-3xl font-mono bg-[#1a1d23] border border-white/10 rounded-2xl p-6 focus:outline-none focus:ring-4 focus:ring-cyan-500/30 focus:border-cyan-500 text-white placeholder-gray-700 transition-all"
                                        placeholder="Enter Value..."
                                    />
                                )}

                                {(currentQuestionType === 'MCQ' || currentQuestionType === 'MULTI_CHOICE') && (
                                    <div className="grid grid-cols-1 gap-4">
                                        {(currentQuestion?.options || ['A', 'B', 'C', 'D'].map(o => `(${o}) Option ${o}`)).map((optionText, idx) => {
                                            const optionLetter = currentQuestion?.options ? String.fromCharCode(65 + idx) : (optionText as string).replace(/[()]/g, ''); // Extract 'A' from '(A)' etc if fallback
                                            const cleanOptionText = currentQuestion ? optionText.replace(/^\([A-D]\)\s*/, '') : optionText;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        if (currentQuestionType === 'MULTI_CHOICE') {
                                                            const currentMultiAnswers = (answers[currentQuestionNumber] || []) as string[];
                                                            if (currentMultiAnswers.includes(optionLetter)) handleAnswerInput(currentMultiAnswers.filter(a => a !== optionLetter));
                                                            else handleAnswerInput([...currentMultiAnswers, optionLetter]);
                                                        } else {
                                                            handleAnswerInput(optionLetter);
                                                        }
                                                    }}
                                                    disabled={isNavigating || (!!feedback && currentQuestionType !== 'MULTI_CHOICE')}
                                                    className={getOptionClasses(optionLetter)}
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-400 group-hover:bg-white/10 transition-colors border border-white/5">
                                                        {optionLetter}
                                                    </div>
                                                    <div className="font-medium text-lg">{cleanOptionText}</div>

                                                    {/* Checkmark/Cross Indicator */}
                                                    {getOptionClasses(optionLetter).includes('green') && <Icon name="check-circle" className="w-6 h-6 text-green-400 ml-auto" />}
                                                    {getOptionClasses(optionLetter).includes('red') && <Icon name="close" className="w-6 h-6 text-red-400 ml-auto" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Control Bar */}
            <div className={`p-4 bg-[#14161a] border-t border-white/5 flex items-center justify-between z-20 ${focusMode ? 'hidden' : 'flex'}`}>
                <button onClick={handleMarkForReview} className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-colors ${markedForReview.includes(currentQuestionNumber) ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                    <Icon name="marker" className="w-4 h-4" />
                    {markedForReview.includes(currentQuestionNumber) ? 'Marked' : 'Review'}
                </button>

                <div className="flex gap-4">
                    <button onClick={() => navigate(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0 || isNavigating} className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 transition-colors">
                        <Icon name="arrow-left" className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={() => setAnswers(prev => ({ ...prev, [currentQuestionNumber]: '' }))} className="px-6 py-2 rounded-full font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                        Clear
                    </button>
                    <button onClick={() => handleNextQuestion()} disabled={isNavigating} className="px-8 py-2 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2">
                        {currentQuestionIndex === totalQuestions - 1 ? 'Finish' : 'Next'} <Icon name="arrow-right" className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Feedback Pop-up Toast */}
            {feedback && feedback.status !== 'answered' && (
                <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl animate-bounce-in flex items-center gap-3 backdrop-blur-md border border-white/10
                    ${feedback.status === 'correct' ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
                    <Icon name={feedback.status === 'correct' ? 'check-circle' : 'close'} className="w-6 h-6" />
                    <span>{feedback.status === 'correct' ? 'Correct Answer!' : `Wrong! Correct was ${Array.isArray(feedback.correctAnswer) ? feedback.correctAnswer.join(', ') : feedback.correctAnswer}`}</span>
                </div>
            )}

        </div>
    );
};

export default McqTimer;