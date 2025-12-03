

import React, { useState, useMemo, useRef, useEffect } from 'react';
import McqTimer from './components/McqTimer';
import Icon from './components/Icon';
import { getQuestionNumbersFromRanges } from './utils/qRangesParser';
import { HomeworkData, ResultData, StudentData, ScheduleItem, PracticeQuestion } from './types';
import AIGenerateAnswerKeyModal from './components/AIGenerateAnswerKeyModal';
import AIParserModal from './components/AIParserModal';
import { api } from './api/apiService';
import { useAuth } from './context/AuthContext';
import { knowledgeBase } from './data/knowledgeBase'; // Import knowledgeBase for chapters

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
    if (data.practice_test && data.practice_