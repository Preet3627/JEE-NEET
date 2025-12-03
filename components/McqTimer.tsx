


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from './Icon';
import { playNextSound, playStopSound, playMarkSound, vibrate } from '../utils/sounds';
import { api } from '../api/apiService';
import AnswerKeyUploadModal from './AnswerKeyUploadModal';
import { ResultData, StudentData, HomeworkData, ScheduleItem, ScheduleCardData, PracticeQuestion } from '../types';
import TestAnalysisReport from './TestAnalysisReport';
import SpecificMistakeAnalysisModal from './SpecificMistakeAnalysisModal';
import MusicVisualizerWidget from './widgets/MusicVisualizerWidget';
import { useMusicPlayer } from '../context/MusicPlayerContext'; // Import useMusicPlayer

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
  // FIX: Updated correctAnswers type to allow string or string[]
  correctAnswers?: Record<string, string | string[]>; // Modified to accept string or array of strings
  onSaveTask?: (task: ScheduleItem) => void;
  initialTask?: HomeworkData | null;
}

// FIX: Updated normalizeAnswer to accept string | string[]
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

    const { isPlaying, play, pause, currentTrack, nextTrack } = useMusicPlayer(); // Use music player context

    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(practiceMode === 'jeeMains' ? 180 * 60 : perQuestionTime * questionNumbers.length);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    // FIX: Updated answers state to allow string or string[]
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({}); // Updated to string | string[]
    const [timings, setTimings] = useState<Record<number, number>>({});
    const [markedForReview, setMarkedForReview] = useState<number[]>([]);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isUploadingKey, setIsUploadingKey] = useState(false);
    const [testResult, setTestResult] = useState<ResultData | null>(null);
    const [gradingError, setGradingError] = useState('');
    const [isGrading, setIsGrading] = useState(false);
    // FIX: Updated feedback state to allow string or string[] for correctAnswer
    const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect' | 'answered', correctAnswer?: string | string[] } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
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
        const elem = timerRef.current?.closest('.modal-content-enter');
        if (!elem) return;
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    const getQuestionInfo = useCallback((index: number) => {
        // If questions array is provided, use its type. Otherwise, fallback logic.
        if (questions && questions[index]) {
            return { subject: subject, type: questions[index].type };
        }
        if (practiceMode !== 'jeeMains') {
            return { subject: subject, type: 'MCQ' as 'MCQ' | 'NUM' | 'MULTI_CHOICE' };
        }
        // JEE Mains specific question type distribution (example, adjust as needed)
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
            const questionType = currentQuestion?.type || getQuestionInfo(index).type; // Get question type
    
            if (!userAnswer) { // Skipped or not answered
                incorrectQuestionNumbers.push(qNum);
                // Do not deduct for skipped numerical/multi-choice, only for MCQ as per JEE standard
                if (questionType === 'MCQ' && practiceMode === 'jeeMains') { // Only deduct if MCQ in JEE Mains
                    score -= 1;
                }
                return;
            }

            const normalizedUserAnswer = normalizeAnswer(userAnswer);
            const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
    
            let isCorrect = false;
            if (questionType === 'MULTI_CHOICE') {
                // For multiple correct, both should be arrays. Compare sorted arrays.
                if (Array.isArray(normalizedUserAnswer) && Array.isArray(normalizedCorrectAnswer)) {
                    isCorrect = JSON.stringify(normalizedUserAnswer) === JSON.stringify(normalizedCorrectAnswer);
                }
            } else { // MCQ or NUM
                isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
            }
    
            if (isCorrect) {
                score += 4;
            } else { // Answered but incorrect
                incorrectQuestionNumbers.push(qNum);
                // Deduct 1 mark only for MCQs in JEE Mains. Numerical/Multi-choice usually no negative.
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
        if (isNavigating || (feedback && practiceMode !== 'jeeMains')) return; // No input if feedback is shown in quick practice

        playNextSound();

        // For MULTI_CHOICE, value is already an array of selected options
        setAnswers(prev => ({ ...prev, [currentQuestionNumber]: value }));

        if (practiceMode === 'jeeMains') return; // No instant feedback in JEE Mains mode

        if (correctAnswers) {
            const correctAnswer = correctAnswers[currentQuestionNumber.toString()];
            // FIX: Ensure normalizeAnswer can handle string | string[] for both arguments
            const isCorrect = normalizeAnswer(value) === normalizeAnswer(correctAnswer);
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
                        // FIX: Cast correctAnswer to string if it's an array for the FOCUS_DETAIL.
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
                setTimings(prev => ({...prev, [currentQuestionNumber]: (prev[currentQuestionNumber] || 0) + timeSpent}));
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
            // Convert answers to a compatible format for the API if needed
            const userAnswersForApi: Record<string, string | string[]> = {};
            for (const qNum in answers) {
                const answer = answers[qNum];
                if (Array.isArray(answer)) {
                    userAnswersForApi[qNum] = answer.sort().join(','); // Send multi-choice as comma-separated string
                } else {
                    userAnswersForApi[qNum] = answer;
                }
            }

            // FIX: Pass userAnswersForApi to api.analyzeTestResults
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
            setGradingError(error.error || "Failed to grade answers. Please try again.");
        } finally {
            setIsGrading(false);
            setIsUploadingKey(false);
        }
    };

    const currentQuestionType = useMemo(() => {
        if (currentQuestion) return currentQuestion.type;
        // Fallback if `questions` array is not provided (e.g. manual JEE Mains mode)
        if (correctAnswers && correctAnswers[currentQuestionNumber.toString()]) {
            const answer = correctAnswers[currentQuestionNumber.toString()];
            if (Array.isArray(answer)) return 'MULTI_CHOICE';
            // Simple check: if answer contains only A-D, it's likely MCQ. Otherwise, NUM.
            return ['A', 'B', 'C', 'D'].includes(answer.toUpperCase().trim()) ? 'MCQ' : 'NUM';
        }
        if (practiceMode === 'jeeMains') {
            return getQuestionInfo(currentQuestionIndex).type;
        }
        return 'MCQ'; // Default to MCQ
    }, [currentQuestion, correctAnswers, currentQuestionNumber, practiceMode, currentQuestionIndex, getQuestionInfo]);


    const { subject: currentSubject } = getQuestionInfo(currentQuestionIndex);
    
    if (!isActive) {
      return (
          <div className="text-center">
              {/* MacOS Traffic Light Header */}
              <div className="flex items-center gap-2 px-4 py-3 mb-6 border-b border-white/10 bg-black/20 rounded-t-lg -mt-4 -mx-4">
                    <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 shadow-inner"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 shadow-inner"></div>
                    <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">Timer Ready</span>
