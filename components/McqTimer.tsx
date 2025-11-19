import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from './Icon';
import { playNextSound, playStopSound, playMarkSound, vibrate } from '../utils/sounds';
import { api } from '../api/apiService';
import AnswerKeyUploadModal from './AnswerKeyUploadModal';
import { ResultData, StudentData, HomeworkData, ScheduleItem, ScheduleCardData, PracticeQuestion } from '../types';
import TestAnalysisReport from './TestAnalysisReport';
import SpecificMistakeAnalysisModal from './SpecificMistakeAnalysisModal';
import MusicVisualizerWidget from './widgets/MusicVisualizerWidget';

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
  correctAnswers?: Record<string, string>;
  onSaveTask?: (task: ScheduleItem) => void;
  initialTask?: HomeworkData | null;
}

const normalizeAnswer = (answer?: string): string => {
    if (!answer) return '';
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

    const [isActive, setIsActive] = useState(false);
    const [totalSeconds, setTotalSeconds] = useState(practiceMode === 'jeeMains' ? 180 * 60 : perQuestionTime * questionNumbers.length);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [timings, setTimings] = useState<Record<number, number>>({});
    const [markedForReview, setMarkedForReview] = useState<number[]>([]);
    const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isUploadingKey, setIsUploadingKey] = useState(false);
    const [testResult, setTestResult] = useState<ResultData | null>(null);
    const [gradingError, setGradingError] = useState('');
    const [isGrading, setIsGrading] = useState(false);
    const [feedback, setFeedback] = useState<{ status: 'correct' | 'incorrect' | 'answered', correctAnswer?: string } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [analyzingMistake, setAnalyzingMistake] = useState<number | null>(null);

    const questionStartTimeRef = useRef<number | null>(null);
    const timerRef = useRef<HTMLDivElement>(null);
    const totalQuestions = questions ? questions.length : questionNumbers.length;
    const currentQuestion = questions ? questions[currentQuestionIndex] : null;
    const currentQuestionNumber = questions ? questions[currentQuestionIndex].number : questionNumbers[currentQuestionIndex];

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
        if (practiceMode !== 'jeeMains') {
            return { subject, type: 'MCQ' as 'MCQ' | 'NUM' };
        }
        if (index < 20) return { subject: 'Physics', type: 'MCQ' as const };
        if (index < 25) return { subject: 'Physics', type: 'NUM' as const };
        if (index < 45) return { subject: 'Chemistry', type: 'MCQ' as const };
        if (index < 50) return { subject: 'Chemistry', type: 'NUM' as const };
        if (index < 70) return { subject: 'Maths', type: 'MCQ' as const };
        return { subject: 'Maths', type: 'NUM' as const };
    }, [practiceMode, subject]);


    const gradeTest = useCallback(() => {
        if (!correctAnswers || Object.keys(correctAnswers).length === 0) return;
    
        let score = 0;
        const incorrectQuestionNumbers: number[] = [];
        
        const totalMarks = practiceMode === 'jeeMains' ? 300 : questionNumbers.length * 4;
    
        questionNumbers.forEach((qNum, index) => {
            const userAnswer = answers[qNum];
            const correctAnswer = correctAnswers[qNum.toString()];
    
            if (userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
                score += 4;
            } else if (userAnswer) { // Answered but incorrect
                incorrectQuestionNumbers.push(qNum);
                if (practiceMode === 'jeeMains') {
                    const info = getQuestionInfo(index);
                    if (info.type === 'MCQ') {
                        score -= 1;
                    }
                } else {
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
    }, [answers, correctAnswers, questionNumbers, practiceMode, syllabus, timings, onLogResult, getQuestionInfo]);
    

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
        const solved = Object.keys(answers).filter(k => answers[parseInt(k)] !== '');
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

    const handleAnswerSelect = (answer: string) => {
        if (isNavigating || feedback) return;

        playNextSound();
        setAnswers(prev => ({ ...prev, [currentQuestionNumber]: answer }));

        if (correctAnswers) {
            const correctAnswer = correctAnswers[currentQuestionNumber.toString()];
            const isCorrect = normalizeAnswer(answer) === normalizeAnswer(correctAnswer);
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
                        CARD_TITLE: { EN: `[RE-ATTEMPT] Q.${currentQuestionNumber} of: ${initialTask.CARD_TITLE.EN}`, GU: '' },
                        FOCUS_DETAIL: { EN: `You got this question wrong. Try solving it again. Correct answer was: ${correctAnswer}.`, GU: '' },
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
            const resultAnalysis = await api.analyzeTestResults({ imageBase64, userAnswers: answers, timings, syllabus });
            
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
        if (correctAnswers && correctAnswers[currentQuestionNumber.toString()]) {
            const answer = normalizeAnswer(correctAnswers[currentQuestionNumber.toString()]);
            return ['A', 'B', 'C', 'D'].includes(answer) ? 'MCQ' : 'NUM';
        }
        if (practiceMode === 'jeeMains') {
            return getQuestionInfo(currentQuestionIndex).type;
        }
        return 'MCQ';
    }, [correctAnswers, currentQuestionIndex, practiceMode, currentQuestionNumber, getQuestionInfo]);


    const { subject: currentSubject } = getQuestionInfo(currentQuestionIndex);
    
    if (!isActive) {
      return (
          <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-4">Ready to Practice?</h3>
              <p className="text-gray-400 mb-2">Total Questions: <span className="font-bold text-white">{totalQuestions}</span></p>
              <p className="text-gray-400 mb-6">Total Time: <span className="font-bold text-white">{formatTime(totalSeconds)}</span></p>
              <button onClick={handleStart} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
                  <Icon name="play" /> Start Practice
              </button>
          </div>
      )
    }

    if (isFinished) {
        return (
            <div className="text-center space-y-4 max-h-[75vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-white">Session Finished!</h3>

                {testResult && !testResult.analysis && (
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <p className="text-lg font-semibold">Your Score:</p>
                        <p className="text-4xl font-bold text-cyan-400">{testResult.SCORE}</p>
                        <p className="text-sm text-gray-400">Mistakes: {testResult.MISTAKES.length}</p>
                    </div>
                )}

                {(practiceMode === 'jeeMains' || (questions && onLogResult)) ? (
                    testResult && testResult.analysis ? (
                        <TestAnalysisReport 
                          result={testResult} 
                          onAnalyzeMistake={(qNum) => setAnalyzingMistake(qNum)}
                        />
                    ) : (
                        <>
                            <p className="text-sm text-gray-400">
                                {testResult ? "For a detailed chapter-wise analysis, use the AI grader." : "Upload the answer key to get your score and detailed analysis instantly."}
                            </p>
                            <button onClick={() => setIsUploadingKey(true)} disabled={isGrading} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50">
                               {isGrading ? 'Analyzing...' : <><Icon name="upload" /> Grade with AI</>}
                            </button>
                            {gradingError && <p className="text-sm text-red-400">{gradingError}</p>}
                        </>
                    )
                ) : (
                    !testResult && (
                        <div className="bg-gray-900/50 p-4 rounded-lg">
                            <Icon name="check" className="w-10 h-10 text-green-400 mx-auto mb-2" />
                            <p className="text-lg text-gray-300">Great work!</p>
                            <p className="text-sm text-gray-400">
                                Your practice session has been logged.
                            </p>
                        </div>
                    )
                )}

                <button onClick={onClose} className="w-full px-4 py-2 mt-4 text-base font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600">Close</button>
                
                {isUploadingKey && <AnswerKeyUploadModal onClose={() => setIsUploadingKey(false)} onGrade={handleGradeWithAI} />}
                {analyzingMistake !== null && onUpdateWeaknesses && (
                    <SpecificMistakeAnalysisModal 
                        questionNumber={analyzingMistake}
                        onClose={() => setAnalyzingMistake(null)}
                        onSaveWeakness={(topic) => onUpdateWeaknesses([...new Set([...(student.CONFIG.WEAK || []), topic])])}
                    />
                )}
            </div>
        );
    }
    
    const getOptionClasses = (option: string) => {
        // Always show the user's current selection for the question, even without feedback
        if (answers[currentQuestionNumber] === option && !feedback) {
            return 'bg-cyan-800/50 border-cyan-500 text-white';
        }
        
        if (!feedback) {
            return `bg-gray-800 border-gray-700 hover:border-cyan-500`;
        }
        
        const userAnswer = normalizeAnswer(answers[currentQuestionNumber]);
        const correctAnswer = normalizeAnswer(feedback.correctAnswer);
        const currentOption = normalizeAnswer(option);

        if (currentOption === correctAnswer) return 'bg-green-800/50 border-green-500';
        if (currentOption === userAnswer && userAnswer !== correctAnswer) return 'bg-red-800/50 border-red-500';

        return 'bg-gray-800 border-gray-700 opacity-60';
    };
  
    return (
        <div ref={timerRef} className="flex flex-col h-[70vh] max-h-[600px] relative fullscreen:h-screen fullscreen:max-h-screen bg-gray-900/50 p-4 rounded-lg">
            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-start pb-3 border-b border-gray-700">
                <div className="flex items-center gap-4">
                     <button onClick={toggleFullscreen} className="p-2 text-gray-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isFullscreen ? "M4 8V4m0 0h4M4 4l5 5m11 7h-4m0 0v4m0-4l5 5M4 16v4m0 0h4m-4 0l5-5m11-7h-4m0 0v-4m0 4l5-5" : "M4 8V4m0 0h4M4 4l5 5m11-1v4m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 1v-4m0 0h-4m4 0l-5 5"} /></svg>
                    </button>
                    <div>
                        <h4 className="text-lg font-bold text-white">{category}</h4>
                        <p className="text-sm text-cyan-400">{currentSubject}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-mono text-xl font-bold tracking-wider">{formatTime(totalSeconds)}</p>
                    <button onClick={() => setIsPaletteOpen(true)} className="text-xs text-gray-400 hover:text-white">
                        Question {currentQuestionIndex + 1} / {totalQuestions}
                    </button>
                </div>
            </div>
            
            <div className="py-2"><MusicVisualizerWidget /></div>

            {/* Question Area */}
            <div className={`flex-grow flex flex-col items-center justify-center p-4 overflow-y-auto ${isNavigating ? 'question-exit' : 'question-enter'}`}>
                {/* Add key to force re-mount on navigation, fixing state preservation bugs */}
                <div key={currentQuestionNumber} className="w-full">
                    {currentQuestion ? (
                        <div className="text-left w-full space-y-4">
                            <p className="text-base text-gray-300 whitespace-pre-wrap">{currentQuestion.text}</p>
                            <div className="space-y-2">
                                {currentQuestion.options.map((option, idx) => {
                                    const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
                                    return (
                                        <button key={idx} onClick={() => handleAnswerSelect(optionLetter)} disabled={isNavigating || !!feedback} className={`w-full text-left p-3 rounded-lg border-2 transition-colors flex items-start gap-3 disabled:cursor-default focus:outline-none ${getOptionClasses(optionLetter)}`}>
                                            <span className="font-bold">{optionLetter}.</span> 
                                            <span>{option.replace(/^\([A-D]\)\s*/, '')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <>
                             <h2 className="text-2xl font-bold mb-6">Question {currentQuestionNumber.toString().padStart(3,'0')}</h2>
                             {currentQuestionType === 'MCQ' ? (
                                 <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                                     {(['A', 'B', 'C', 'D'] as const).map(option => (
                                         <button key={option} onClick={() => handleAnswerSelect(option)} disabled={isNavigating || !!feedback} className={`py-3 px-6 rounded-lg font-semibold border-2 transition-colors disabled:cursor-default focus:outline-none ${getOptionClasses(option)}`}>
                                             {option}
                                         </button>
                                     ))}
                                 </div>
                             ) : (
                                 <input type="text" value={answers[currentQuestionNumber] || ''} onChange={(e) => handleAnswerSelect(e.target.value)} disabled={isNavigating || !!feedback} className="w-full max-w-xs text-center text-2xl font-mono bg-gray-900 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60" placeholder="Numerical Answer" />
                             )}
                        </>
                    )}
                </div>
            </div>
            
            {/* Navigation */}
            <div className="flex-shrink-0 space-y-2">
                 <div className="flex gap-2">
                    <button onClick={() => navigate(currentQuestionIndex - 1)} disabled={isNavigating || currentQuestionIndex === 0} className="flex-1 py-2 text-sm font-semibold rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Back</button>
                    <button onClick={() => setAnswers(prev => ({...prev, [currentQuestionNumber]: ''}))} disabled={isNavigating || !!feedback} className="flex-1 py-2 text-sm font-semibold rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Clear</button>
                    <button onClick={() => navigate(currentQuestionIndex + 1)} disabled={isNavigating} className="flex-1 py-2 text-sm font-semibold rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Skip</button>
                    <button onClick={handleMarkForReview} disabled={isNavigating} className="flex-1 py-2 text-sm font-semibold rounded-md bg-yellow-600/80 hover:bg-yellow-500/80 flex items-center justify-center gap-1 disabled:opacity-50">
                        <Icon name="marker" className="w-4 h-4"/> Review
                    </button>
                </div>
                 <button onClick={finishSession} className="w-full py-2 text-sm font-semibold rounded-md bg-red-800/80 hover:bg-red-700/80">
                    Submit Test
                 </button>
            </div>
            
            {/* Feedback Pop-up */}
            {feedback && feedback.status !== 'answered' && (
                <div className={`absolute bottom-[100px] left-1/2 -translate-x-1/2 p-3 rounded-lg text-white font-semibold text-sm shadow-lg animate-fadeIn
                    ${feedback.status === 'correct' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {feedback.status === 'correct' ? 'Correct!' : `Incorrect. The correct answer is ${feedback.correctAnswer}.`}
                </div>
            )}
            
            {/* Question Palette */}
            {isPaletteOpen && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10" onClick={() => setIsPaletteOpen(false)}>
                    <div className="bg-gray-800 p-4 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h4 className="font-bold text-lg mb-4">Question Palette</h4>
                        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                            {questionNumbers.map((qNum, index) => {
                                const isAnswered = qNum in answers && answers[qNum] !== '';
                                const isMarked = markedForReview.includes(qNum);
                                const isCurrent = index === currentQuestionIndex;

                                let statusClass = 'bg-gray-700 hover:bg-gray-600';
                                if(isCurrent) statusClass = 'ring-2 ring-white';
                                else if(isAnswered && isMarked) statusClass = 'bg-purple-600';
                                else if(isAnswered) statusClass = 'bg-green-600';
                                else if(isMarked) statusClass = 'bg-yellow-600';

                                return (
                                    <button key={qNum} onClick={() => navigate(index)} className={`w-10 h-10 text-xs rounded-md font-semibold transition-colors ${statusClass}`}>
                                        {qNum}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default McqTimer;