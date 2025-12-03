
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { StudentData, ScheduleItem, StudySession, Config, ResultData, ExamData, DoubtData, HomeworkData, PracticeQuestion, FlashcardDeck, Flashcard, StudyMaterialItem } from './types';
import { studentDatabase } from './data/mockData';
import { api } from './api/apiService';

import Header from './components/Header';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AuthScreen from './screens/AuthScreen';
import BackendOfflineScreen from './components/BackendOfflineScreen';
import ConfigurationErrorScreen from './components/ConfigurationErrorScreen';
import { exportCalendar } from './utils/calendar';
import * as gcal from './utils/googleCalendar';
import * as gdrive from './utils/googleDrive';
import * as auth from './utils/googleAuth';
import ExamTypeSelectionModal from './components/ExamTypeSelectionModal';
import { useMusicPlayer } from './context/MusicPlayerContext';
import FullScreenMusicPlayer from './components/FullScreenMusicPlayer';
import PersistentMusicPlayer from './components/PersistentMusicPlayer';
import GlobalMusicVisualizer from './components/GlobalMusicVisualizer';
import ProfileModal from './components/ProfileModal';
import AIParserModal from './components/AIParserModal';
import { CustomPracticeModal } from './components/CustomPracticeModal';
import SettingsModal from './components/SettingsModal';
import EditWeaknessesModal from './components/EditWeaknessesModal';
import LogResultModal from './components/LogResultModal';
import EditResultModal from './components/EditResultModal';
import CreateEditExamModal from './components/CreateEditExamModal';
import AIMistakeAnalysisModal from './components/AIMistakeAnalysisModal';
import AIDoubtSolverModal from './components/AIDoubtSolverModal';
import AIChatPopup from './components/AIChatPopup';
import TestReportModal from './components/TestReportModal';
import MoveTasksModal from './components/MoveTasksModal';
import MusicLibraryModal from './components/MusicLibraryModal';
import DeepLinkConfirmationModal from './components/DeepLinkConfirmationModal';
import CreateEditDeckModal from './components/flashcards/CreateEditDeckModal';
import AIGenerateFlashcardsModal from './components/flashcards/AIGenerateFlashcardsModal';
import DeckViewModal from './components/flashcards/DeckViewModal';
import CreateEditFlashcardModal from './components/flashcards/CreateEditFlashcardModal';
import FlashcardReviewModal from './components/flashcards/FlashcardReviewModal';
import FileViewerModal from './components/FileViewerModal';
import GoogleAssistantGuideModal from './components/GoogleAssistantGuideModal';
import AIGuideModal from './components/AIGuideModal';
import CreateEditTaskModal from './components/CreateEditTaskModal';
import { MessagingModal } from './components/MessagingModal';
import UniversalSearch from './components/UniversalSearch';
import AnswerKeyUploadModal from './components/AnswerKeyUploadModal';
import SpecificMistakeAnalysisModal from './components/SpecificMistakeAnalysisModal';


declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_URL = '/api';

// #region Modal State Definition
interface ModalState {
  id: string;
  componentId: string;
}

interface ModalControlProps {
  openModal: (modalId: string, setter: React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void), initialValue?: any) => void;
  closeModal: (modalId: string) => void;

  isExamTypeSelectionModalOpen: boolean; setIsExamTypeSelectionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCreateModalOpen: boolean; setIsCreateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiParserModalOpen: boolean; setisAiParserModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPracticeModalOpen: boolean; setIsPracticeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsModalOpen: boolean; setIsSettingsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingTask: ScheduleItem | null; setEditingTask: React.Dispatch<React.SetStateAction<ScheduleItem | null>>;
  viewingTask: ScheduleItem | null; setViewingTask: React.Dispatch<React.SetStateAction<ScheduleItem | null>>;
  practiceTask: HomeworkData | null; setPracticeTask: React.Dispatch<React.SetStateAction<HomeworkData | null>>;
  aiPracticeTest: { questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null; setAiPracticeTest: React.Dispatch<React.SetStateAction<{ questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null>>;
  isEditWeaknessesModalOpen: boolean; setIsEditWeaknessesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLogResultModalOpen: boolean; setLogResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  initialScoreForModal: string | undefined; setInitialScoreForModal: React.Dispatch<React.SetStateAction<string | undefined>>;
  initialMistakesForModal: string | undefined; setInitialMistakesForModal: React.Dispatch<React.SetStateAction<string | undefined>>;
  isEditResultModalOpen: boolean; setEditResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingResult: ResultData | null; setEditingResult: React.Dispatch<React.SetStateAction<ResultData | null>>;
  isExamModalOpen: boolean; setIsExamModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingExam: ExamData | null; setEditingExam: React.Dispatch<React.SetStateAction<ExamData | null>>;
  isAiMistakeModalOpen: boolean; setAiMistakeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewingReport: ResultData | null; setViewingReport: React.Dispatch<React.SetStateAction<ResultData | null>>;
  isAssistantGuideOpen: boolean; setAssistantGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiGuideModalOpen: boolean; setAiGuideModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSearchOpen: boolean; setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchInitialQuery: string | null; setSearchInitialQuery: React.Dispatch<React.SetStateAction<string | null>>;
  isSelectMode: boolean; setIsSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTaskIds: string[]; setSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
  isMoveModalOpen: boolean; setMoveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiChatOpen: boolean; setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aiChatHistory: { role: string; parts: { text: string }[] }[]; setAiChatHistory: React.Dispatch<React.SetStateAction<{ role: string; parts: { text: string }[] }[]>>;
  showAiChatFab: boolean; setShowAiChatFab: React.Dispatch<React.SetStateAction<boolean>>;
  isAiChatLoading: boolean; setIsAiChatLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isCreateDeckModalOpen: boolean; setCreateDeckModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiFlashcardModalOpen: boolean; setAiFlashcardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingDeck: FlashcardDeck | null; setEditingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  viewingDeck: FlashcardDeck | null; setViewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  isCreateCardModalOpen: boolean; setCreateCardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingCard: Flashcard | null; setEditingCard: React.Dispatch<React.SetStateAction<Flashcard | null>>;
  reviewingDeck: FlashcardDeck | null; setReviewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  viewingFile: StudyMaterialItem | null; setViewingFile: React.Dispatch<React.SetStateAction<StudyMaterialItem | null>>;
  isMusicLibraryOpen: boolean; setIsMusicLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  analyzingMistake: number | null; setAnalyzingMistake: React.Dispatch<React.SetStateAction<number | null>>;
  handleMoveSelected: (taskIds: string[], newDate: string) => void;
  handleSaveDeck: (deck: FlashcardDeck) => void;
  handleDeleteCard: (deckId: string, cardId: string) => void;
  handleSaveCard: (deckId: string, card: Flashcard) => void;
  setDeepLinkAction: React.Dispatch<React.SetStateAction<any>>;
  isMessagingModalOpen: boolean; setMessagingModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  messagingStudent: StudentData | null; setMessagingStudent: React.Dispatch<React.SetStateAction<StudentData | null>>;
  isAnswerKeyUploadModalOpen: boolean; setAnswerKeyUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isProfileModalOpen: boolean; setIsProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSpecificMistakeAnalysisModalOpen: boolean; setIsSpecificMistakeAnalysisModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiDoubtSolverOpen: boolean; setIsAiDoubtSolverOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
// #endregion Modal State Definition


const App: React.FC = () => {
  const { currentUser, userRole, isLoading, isDemoMode, enterDemoMode, logout, refreshUser, token, googleAuthStatus, setGoogleAuthStatus, loginWithToken, verificationEmail, setVerificationEmail } = useAuth();
  const { isFullScreenPlayerOpen, toggleLibrary, isLibraryOpen, currentTrack } = useMusicPlayer(); 
    
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [allDoubts, setAllDoubts] = useState<DoubtData[]>([]);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline' | 'misconfigured'>('checking');
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [apiTokenLoaded, setApiTokenLoaded] = useState<string | null>(null);

  // Modal States
  const [isExamTypeSelectionModalOpen, setIsExamTypeSelectionModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiParserModalOpen, setisAiParserModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null);
  const [viewingTask, setViewingTask] = useState<ScheduleItem | null>(null);
  const [practiceTask, setPracticeTask] = useState<HomeworkData | null>(null);
  const [aiPracticeTest, setAiPracticeTest] = useState<{ questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null>(null);
  const [isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen] = useState(false);
  const [isLogResultModalOpen, setLogResultModalOpen] = useState(false);
  const [initialScoreForModal, setInitialScoreForModal] = useState<string | undefined>();
  const [initialMistakesForModal, setInitialMistakesForModal] = useState<string | undefined>();
  const [isEditResultModalOpen, setEditResultModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ResultData | null>(null);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamData | null>(null);
  const [isAiMistakeModalOpen, setAiMistakeModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<ResultData | null>(null);
  const [isAssistantGuideOpen, setAssistantGuideOpen] = useState(false);
  const [isAiGuideModalOpen, setAiGuideModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isMoveModalOpen, setMoveModalOpen] = useState(false);
  const [isAiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
  const [showAiChatFab, setShowAiChatFab] = useState(false);
  const [isAiChatLoading, setIsAiChatLoading] = useState(false);
  const [isCreateDeckModalOpen, setCreateDeckModalOpen] = useState(false);
  const [isAiFlashcardModalOpen, setAiFlashcardModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [viewingDeck, setViewingDeck] = useState<FlashcardDeck | null>(null);
  const [isCreateCardModalOpen, setCreateCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [reviewingDeck, setReviewingDeck] = useState<FlashcardDeck | null>(null);
  const [viewingFile, setViewingFile] = useState<StudyMaterialItem | null>(null);
  const [isMusicLibraryOpen, setIsMusicLibraryOpen] = useState(false);
  const [analyzingMistake, setAnalyzingMistake] = useState<number | null>(null);
  const [deepLinkAction, setDeepLinkAction] = useState<any | null>(null);
  const [isMessagingModalOpen, setMessagingModalOpen] = useState(false);
  const [messagingStudent, setMessagingStudent] = useState<StudentData | null>(null);
  const [isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSpecificMistakeAnalysisModalOpen, setIsSpecificMistakeAnalysisModalOpen] = useState(false);
  const [isAiDoubtSolverOpen, setIsAiDoubtSolverOpen] = useState(false);


  // General App State
  const [isSyncing, setIsSyncing] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Modal History Management
  const modalStackRef = useRef<ModalState[]>([]);
  const currentModalIdRef = useRef<string | null>(null);
  const modalSettersRef = useRef<Map<string, React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void)>>(new Map());

  useEffect(() => {
    modalSettersRef.current.set('ExamTypeSelectionModal', setIsExamTypeSelectionModalOpen);
    modalSettersRef.current.set('CreateEditTaskModal', setIsCreateModalOpen);
    modalSettersRef.current.set('AIParserModal', setisAiParserModalOpen);
    modalSettersRef.current.set('CustomPracticeModal', setIsPracticeModalOpen);
    modalSettersRef.current.set('SettingsModal', setIsSettingsModalOpen);
    modalSettersRef.current.set('EditWeaknessesModal', setIsEditWeaknessesModalOpen);
    modalSettersRef.current.set('LogResultModal', setLogResultModalOpen);
    modalSettersRef.current.set('EditResultModal', setEditResultModalOpen);
    modalSettersRef.current.set('CreateEditExamModal', setIsExamModalOpen);
    modalSettersRef.current.set('AIMistakeAnalysisModal', setAiMistakeModalOpen);
    modalSettersRef.current.set('AIDoubtSolverModal', setIsAiDoubtSolverOpen);
    modalSettersRef.current.set('AIChatPopup', setAiChatOpen);
    modalSettersRef.current.set('TestReportModal', setViewingReport);
    modalSettersRef.current.set('MoveTasksModal', setMoveModalOpen);
    modalSettersRef.current.set('MusicLibraryModal', setIsMusicLibraryOpen);
    modalSettersRef.current.set('DeepLinkConfirmationModal', setDeepLinkAction);
    modalSettersRef.current.set('CreateEditDeckModal', setCreateDeckModalOpen);
    modalSettersRef.current.set('AIGenerateFlashcardsModal', setAiFlashcardModalOpen);
    modalSettersRef.current.set('DeckViewModal', setViewingDeck);
    modalSettersRef.current.set('CreateEditFlashcardModal', setCreateCardModalOpen);
    modalSettersRef.current.set('FlashcardReviewModal', setReviewingDeck);
    modalSettersRef.current.set('FileViewerModal', setViewingFile);
    modalSettersRef.current.set('GoogleAssistantGuideModal', setAssistantGuideOpen);
    modalSettersRef.current.set('AIGuideModal', setAiGuideModalOpen);
    modalSettersRef.current.set('MessagingModal', setMessagingModalOpen);
    modalSettersRef.current.set('AnswerKeyUploadModal', setAnswerKeyUploadModalOpen);
    modalSettersRef.current.set('ProfileModal', setIsProfileModalOpen);
    modalSettersRef.current.set('SpecificMistakeAnalysisModal', setIsSpecificMistakeAnalysisModalOpen);
    modalSettersRef.current.set('UniversalSearch', setIsSearchOpen);
  }, []);

  const openModal = useCallback((modalId: string, setter: React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void), initialValue?: any) => {
    const isBooleanSetter = typeof initialValue === 'undefined' || typeof initialValue === 'boolean';

    if (isBooleanSetter) {
      (setter as React.Dispatch<React.SetStateAction<boolean>>)(true);
    } else {
      (setter as (val: any) => void)(initialValue);
    }
      
    const newModalState: ModalState = { id: modalId, componentId: `${modalId}-${Date.now()}` };
    modalStackRef.current.push(newModalState);
    currentModalIdRef.current = modalId; 
    
    window.history.pushState({ modal: newModalState.componentId }, '');
  }, []);

  const closeModal = useCallback((modalId: string) => {
    const setter = modalSettersRef.current.get(modalId);
    if (setter) {
      const isBooleanSetter = String(setter).includes('setIs');
      if (isBooleanSetter) {
        (setter as React.Dispatch<React.SetStateAction<boolean>>)(false);
      } else {
        (setter as (val: any) => void)(null);
      }
    }

    modalStackRef.current = modalStackRef.current.filter(m => m.id !== modalId);
    currentModalIdRef.current = modalStackRef.current.length > 0 ? modalStackRef.current[modalStackRef.current.length - 1].id : null;
  }, []);


  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const isModalHistoryState = event.state && event.state.modal;
      if (isModalHistoryState) {
        const modalToClose = modalStackRef.current[modalStackRef.current.length - 1];
        
        if (modalToClose && modalToClose.componentId === event.state.modal) {
          const setter = modalSettersRef.current.get(modalToClose.id);
          if (setter) {
            const isBooleanSetter = String(setter).includes('setIs');
            if (isBooleanSetter) (setter as React.Dispatch<React.SetStateAction<boolean>>)(false); else (setter as (val: any) => void)(null);
          }
          modalStackRef.current.pop();
          currentModalIdRef.current = modalStackRef.current.length > 0 ? modalStackRef.current[modalStackRef.current.length - 1].id : null;
        } else if (modalStackRef.current.length > 0) {
          const topModal = modalStackRef.current[modalStackRef.current.length - 1];
          const setter = modalSettersRef.current.get(topModal.id);
          if (setter) {
            const isBooleanSetter = String(setter).includes('setIs');
            if (isBooleanSetter) (setter as React.Dispatch<React.SetStateAction<boolean>>)(false); else (setter as (val: any) => void)(null);
          }
          modalStackRef.current = [];
          currentModalIdRef.current = null;
        }
      } else {
        if (modalStackRef.current.length > 0) {
          modalStackRef.current.forEach(m => {
            const setter = modalSettersRef.current.get(m.id);
            if (setter) {
              const isBooleanSetter = String(setter).includes('setIs');
              if (isBooleanSetter) (setter as React.Dispatch<React.SetStateAction<boolean>>)(false); else (setter as (val: any) => void)(null);
            }
          });
          modalStackRef.current = [];
          currentModalIdRef.current = null;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const checkBackendStatus = useCallback(async () => {
    try {
      const res = await api.getPublicConfig();
      if (res.status === 'misconfigured') {
          setBackendStatus('misconfigured');
      } else {
          setBackendStatus('online');
          setGoogleClientId(res.googleClientId);
      }
    } catch (error: any) {
      if (error.status === 'misconfigured') setBackendStatus('misconfigured'); else setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(async () => {
      if (token) {
        try {
          await api.heartbeat();
        } catch (error) {
          checkBackendStatus();
        }
      } else {
        checkBackendStatus();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [token, checkBackendStatus]);

  useEffect(() => {
    if (!googleClientId || backendStatus !== 'online') return;
    if (!window.gapi || !window.google) return;

    const initGoogleClient = async () => {
      try {
        auth.initClient(
          googleClientId,
          (isSignedIn: boolean) => setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out'),
          (error: any) => console.error("Google Auth Init Error", error)
        );
        setGapiLoaded(true);
      } catch (error) {
        console.error("Failed to initialize Google GAPI client:", error);
      }
    };

    if (window.gapi.client && window.gapi.client.init) {
      initGoogleClient();
    } else {
      window.gapi.load('client', initGoogleClient);
    }
  }, [googleClientId, backendStatus, setGoogleAuthStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const dataStr = params.get('data');
    const resetTokenParam = params.get('reset-token');

    if (resetTokenParam) {
      setResetToken(resetTokenParam);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reset-token');
      window.history.replaceState({}, document.title, newUrl.toString());
      return;
    }

    if (action && dataStr) {
      try {
        const data = JSON.parse(decodeURIComponent(dataStr));
        setDeepLinkAction({ action, data });
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('action');
        newUrl.searchParams.delete('data');
        window.history.replaceState({}, document.title, newUrl.toString());
      } catch (error) {
        console.error("Failed to parse deep link data:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!deepLinkAction || !currentUser) return;

    const handleDeepLink = async () => {
      const { action, data } = deepLinkAction;
      setDeepLinkAction(null);

      if (action === 'new_schedule' || action === 'import_data' || action === 'import_exam') {
        openModal('DeepLinkConfirmationModal', setDeepLinkAction, data);
      } else if (action === 'start_practice' && data?.id) {
        const homework = currentUser.SCHEDULE_ITEMS.find(item => item.ID === data.id && item.type === 'HOMEWORK') as HomeworkData;
        if (homework) {
          setPracticeTask(homework);
          openModal('CustomPracticeModal', setIsPracticeModalOpen);
        } else {
          alert("Homework task not found for deep link.");
        }
      } else if (action === 'view_task' && data?.id) {
          const task = currentUser.SCHEDULE_ITEMS.find(item => item.ID === data.id);
          if(task) {
              setViewingTask(task);
              openModal('CreateEditTaskModal', setIsCreateModalOpen);
          } else {
              alert("Task not found for deep link.");
          }
      } else if (action === 'search' && data?.query) {
        setSearchInitialQuery(data.query);
        openModal('UniversalSearch', setIsSearchOpen);
      }
    };
    handleDeepLink();
  }, [deepLinkAction, currentUser]);

  const handleSaveTask = useCallback(async (task: ScheduleItem) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.saveTask(task);
      if (currentUser.CONFIG.isCalendarSyncEnabled && googleAuthStatus === 'signed_in') {
        if ('googleEventId' in task && task.googleEventId) {
          await gcal.updateEvent(task.googleEventId, task);
        } else {
          const eventId = await gcal.createEvent(task);
          await api.saveTask({ ...task, googleEventId: eventId });
        }
      }
      await refreshUser();
    } catch (error) { console.error("Failed to save task:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser, googleAuthStatus]);

  const handleSaveBatchTasks = useCallback(async (tasks: ScheduleItem[]) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.saveBatchTasks(tasks);
      await refreshUser();
    } catch (error) { console.error("Failed to save batch tasks:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure?")) return;
    setIsSyncing(true);
    try {
      const taskToDelete = currentUser.SCHEDULE_ITEMS.find(item => item.ID === taskId);
      if (taskToDelete && 'googleEventId' in taskToDelete && taskToDelete.googleEventId && googleAuthStatus === 'signed_in') {
        await gcal.deleteEvent(taskToDelete.googleEventId);
      }
      await api.deleteTask(taskId);
      await refreshUser();
    } catch (error) { console.error("Failed to delete task:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser, googleAuthStatus]);

  const handleToggleMistakeFixed = useCallback(async (resultId: string, mistake: string) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const result = currentUser.RESULTS.find(r => r.ID === resultId);
      if (!result) throw new Error("Result not found");
      const isFixed = result.FIXED_MISTAKES?.includes(mistake);
      const updatedFixedMistakes = isFixed ? result.FIXED_MISTAKES.filter(m => m !== mistake) : [...(result.FIXED_MISTAKES || []), mistake];
      await api.updateResult({ ...result, FIXED_MISTAKES: updatedFixedMistakes });
      await refreshUser();
    } catch (error) { console.error("Failed to update mistake status:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleUpdateConfig = useCallback(async (config: Partial<Config>) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.updateConfig(config);
      await refreshUser();
    } catch (error) { console.error("Failed to update config:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleLogStudySession = useCallback(async (session: Omit<StudySession, 'date'>) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.saveStudySession({ ...session, date: new Date().toISOString().split('T')[0] });
        await refreshUser();
    } catch (error) { console.error("Failed to log study session:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleUpdateWeaknesses = useCallback(async (weaknesses: string[]) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.updateConfig({ WEAK: weaknesses });
        await refreshUser();
    } catch (error) { console.error("Failed to update weaknesses:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleLogResult = useCallback(async (result: ResultData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.updateResult(result);
        await refreshUser();
    } catch (error) { console.error("Failed to log result:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleAddExam = useCallback(async (exam: ExamData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.addExam(exam);
        await refreshUser();
    } catch (error) { console.error("Failed to add exam:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleUpdateExam = useCallback(async (exam: ExamData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.updateExam(exam);
        await refreshUser();
    } catch (error) { console.error("Failed to update exam:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleDeleteExam = useCallback(async (examId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure?")) return;
    setIsSyncing(true);
    try {
        await api.deleteExam(examId);
        await refreshUser();
    } catch (error) { console.error("Failed to delete exam:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleExportToIcs = useCallback(() => {
    if (!currentUser) return;
    exportCalendar(currentUser.SCHEDULE_ITEMS, currentUser.EXAMS, currentUser.fullName);
  }, [currentUser]);

  const handleBatchImport = useCallback(async (data: { schedules: ScheduleItem[], exams: ExamData[], results: ResultData[], weaknesses: string[] }) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        if (data.schedules.length > 0) await api.saveBatchTasks(data.schedules);
        if (data.exams.length > 0) for(const exam of data.exams) await api.addExam(exam);
        if (data.results.length > 0) for(const result of data.results) await api.updateResult(result);
        if (data.weaknesses.length > 0) await api.updateConfig({ WEAK: [...new Set([...currentUser.CONFIG.WEAK, ...data.weaknesses])] });
        await refreshUser();
    } catch (error) { console.error("Failed to batch import data:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!gapiLoaded) return;
    auth.handleSignIn();
  }, [gapiLoaded]);

  const handleGoogleSignOut = useCallback(() => {
    if (googleAuthStatus !== 'signed_in') return;
    auth.handleSignOut(() => setGoogleAuthStatus('signed_out'));
  }, [googleAuthStatus, setGoogleAuthStatus]);

  const handleFullCalendarSync = useCallback(async () => {
    if (!currentUser || googleAuthStatus !== 'signed_in') return;
    setIsSyncing(true);
    try {
        const events = await gcal.listEvents();
        alert("Full calendar sync not fully implemented.");
    } catch (error) { console.error("Full calendar sync failed:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, googleAuthStatus]);

  const handleBackupToDrive = useCallback(async () => {
    if (!currentUser || googleAuthStatus !== 'signed_in') return;
    setIsSyncing(true);
    try {
        const fullUserData = await api.getMe();
        const dataToSave = JSON.stringify(fullUserData);
        const fileId = await gdrive.uploadData(dataToSave, currentUser.CONFIG.googleDriveFileId);
        await api.updateConfig({ googleDriveFileId: fileId, driveLastSync: new Date().toISOString() });
        await refreshUser();
    } catch (error) { console.error("Drive backup failed:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, googleAuthStatus, refreshUser]);

  const handleRestoreFromDrive = useCallback(async () => {
    if (!currentUser || googleAuthStatus !== 'signed_in' || !currentUser.CONFIG.googleDriveFileId) return;
    if (!window.confirm("Restore from Google Drive?")) return;
    setIsSyncing(true);
    try {
        const data = await gdrive.downloadData(currentUser.CONFIG.googleDriveFileId);
        const restoredUserData = JSON.parse(data);
        await api.fullSync(restoredUserData);
        await refreshUser();
    } catch (error) { console.error("Drive restore failed:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, googleAuthStatus, refreshUser]);

  const handlePostDoubt = useCallback(async (question: string, image?: string) => {
    if (!currentUser) return;
    try {
      await api.postDoubt(question, image);
      await refreshUser();
    } catch (error) { alert("Failed to post doubt."); }
  }, [currentUser, refreshUser]);

  const handlePostSolution = useCallback(async (doubtId: string, solution: string, image?: string) => {
    if (!currentUser) return;
    try {
      await api.postSolution(doubtId, solution, image);
      await refreshUser();
    } catch (error) { alert("Failed to post solution."); }
  }, [currentUser, refreshUser]);

  const handleMoveSelectedTasks = useCallback(async (taskIds: string[], newDate: string) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        await api.batchMoveTasks(taskIds, newDate);
        await refreshUser();
    } catch (error) { console.error("Failed to move tasks:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);
  
  const handleSaveDeck = useCallback(async (deck: FlashcardDeck) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        const currentDecks = currentUser.CONFIG.flashcardDecks || [];
        const existingIndex = currentDecks.findIndex(d => d.id === deck.id);
        const newDecks = existingIndex >= 0 ? currentDecks.map(d => d.id === deck.id ? deck : d) : [...currentDecks, deck];
        await api.updateConfig({ flashcardDecks: newDecks });
        await refreshUser();
    } catch (error) { console.error("Failed to save deck:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    if (!currentUser || !window.confirm("Delete this deck?")) return;
    setIsSyncing(true);
    try {
        const newDecks = currentUser.CONFIG.flashcardDecks?.filter(d => d.id !== deckId) || [];
        await api.updateConfig({ flashcardDecks: newDecks });
        await refreshUser();
    } catch (error) { console.error("Failed to delete deck:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleSaveCard = useCallback(async (deckId: string, card: Flashcard) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
        const currentDecks = currentUser.CONFIG.flashcardDecks || [];
        const newDecks = currentDecks.map(deck => {
            if (deck.id === deckId) {
                const cardIndex = deck.cards.findIndex(c => c.id === card.id);
                const newCards = cardIndex >= 0 ? deck.cards.map(c => c.id === card.id ? card : c) : [...deck.cards, card];
                return { ...deck, cards: newCards };
            }
            return deck;
        });
        await api.updateConfig({ flashcardDecks: newDecks });
        await refreshUser();
    } catch (error) { console.error("Failed to save card:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleDeleteCard = useCallback(async (deckId: string, cardId: string) => {
    if (!currentUser || !window.confirm("Delete this card?")) return;
    setIsSyncing(true);
    try {
        const newDecks = currentUser.CONFIG.flashcardDecks?.map(deck => 
            deck.id === deckId ? { ...deck, cards: deck.cards.filter(c => c.id !== cardId) } : deck
        ) || [];
        await api.updateConfig({ flashcardDecks: newDecks });
        await refreshUser();
    } catch (error) { console.error("Failed to delete card:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, refreshUser]);

  const handleBroadcastTask = useCallback(async (task: ScheduleItem, examType: 'ALL' | 'JEE' | 'NEET') => {
    if (!currentUser || userRole !== 'admin') return;
    setIsSyncing(true);
    try {
        await api.broadcastTask(task, examType);
    } catch (error) { console.error("Failed to broadcast task:", error); } 
    finally { setIsSyncing(false); }
  }, [currentUser, userRole]);

  const handleClearStudentData = useCallback(async (sid: string) => {
    if (userRole !== 'admin') return;
    setIsSyncing(true);
    try {
      await api.clearStudentData(sid);
      await refreshUser();
    } catch (error) { console.error("Failed to clear student data:", error); } 
    finally { setIsSyncing(false); }
  }, [userRole, refreshUser]);
  
  const handleDeleteStudent = useCallback(async (sid: string) => {
    if (userRole !== 'admin' || !window.confirm(`Delete student ${sid}?`)) return;
    setIsSyncing(true);
    try {
      await api.deleteStudent(sid);
      await refreshUser();
    } catch (error) { console.error("Failed to delete student:", error); } 
    finally { setIsSyncing(false); }
  }, [userRole, refreshUser]);

  const handleToggleUnacademySub = useCallback(async (sid: string) => {
      alert(`Toggle Unacademy sub for ${sid} - not yet fully implemented.`);
  }, []);

  const handleImpersonateStudent = useCallback(async (sid: string) => {
    if (userRole !== 'admin') return;
    try {
      const { token } = await api.impersonateStudent(sid);
      loginWithToken(token);
    } catch (error) { console.error("Impersonation failed:", error); }
  }, [userRole, loginWithToken]);

  const modalControlProps: ModalControlProps = useMemo(() => ({
    openModal, closeModal, isExamTypeSelectionModalOpen, setIsExamTypeSelectionModalOpen,
    isCreateModalOpen, setIsCreateModalOpen, isAiParserModalOpen, setisAiParserModalOpen,
    isPracticeModalOpen, setIsPracticeModalOpen, isSettingsModalOpen, setIsSettingsModalOpen,
    editingTask, setEditingTask, viewingTask, setViewingTask, practiceTask, setPracticeTask,
    aiPracticeTest, setAiPracticeTest, isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen,
    isLogResultModalOpen, setLogResultModalOpen, initialScoreForModal, setInitialScoreForModal,
    initialMistakesForModal, setInitialMistakesForModal, isEditResultModalOpen, setEditResultModalOpen,
    editingResult, setEditingResult, isExamModalOpen, setIsExamModalOpen, editingExam, setEditingExam,
    isAiMistakeModalOpen, setAiMistakeModalOpen, viewingReport, setViewingReport,
    isAssistantGuideOpen, setAssistantGuideOpen, isAiGuideModalOpen, setAiGuideModalOpen,
    isSearchOpen, setIsSearchOpen, searchInitialQuery, setSearchInitialQuery,
    isSelectMode, setIsSelectMode, selectedTaskIds, setSelectedTaskIds,
    isMoveModalOpen, setMoveModalOpen, isAiChatOpen, setAiChatOpen,
    aiChatHistory, setAiChatHistory, showAiChatFab, setShowAiChatFab,
    isAiChatLoading, setIsAiChatLoading, isAiDoubtSolverOpen, setIsAiDoubtSolverOpen, 
    isCreateDeckModalOpen, setCreateDeckModalOpen, isAiFlashcardModalOpen, setAiFlashcardModalOpen,
    editingDeck, setEditingDeck, viewingDeck, setViewingDeck,
    isCreateCardModalOpen, setCreateCardModalOpen, editingCard, setEditingCard,
    reviewingDeck, setReviewingDeck, viewingFile, setViewingFile,
    isMusicLibraryOpen, setIsMusicLibraryOpen, analyzingMistake, setAnalyzingMistake,
    handleMoveSelected: handleMoveSelectedTasks, handleSaveDeck, handleDeleteCard, handleSaveCard,
    setDeepLinkAction, isMessagingModalOpen, setMessagingModalOpen, messagingStudent, setMessagingStudent,
    isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen, isProfileModalOpen, setIsProfileModalOpen,
    isSpecificMistakeAnalysisModalOpen, setIsSpecificMistakeAnalysisModalOpen,
  }), [
    openModal, closeModal, isExamTypeSelectionModalOpen, setIsExamTypeSelectionModalOpen,
    isCreateModalOpen, setIsCreateModalOpen, isAiParserModalOpen, setisAiParserModalOpen, isPracticeModalOpen, setIsPracticeModalOpen,
    isSettingsModalOpen, setIsSettingsModalOpen, editingTask, setEditingTask,
    viewingTask, setViewingTask, practiceTask, setPracticeTask, aiPracticeTest, setAiPracticeTest,
    isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen, isLogResultModalOpen, setLogResultModalOpen,
    initialScoreForModal, setInitialScoreForModal, initialMistakesForModal, setInitialMistakesForModal,
    isEditResultModalOpen, setEditResultModalOpen, editingResult, setEditingResult,
    isExamModalOpen, setIsExamModalOpen, editingExam, setEditingExam,
    isAiMistakeModalOpen, setAiMistakeModalOpen, viewingReport, setViewingReport,
    isAssistantGuideOpen, setAssistantGuideOpen, isAiGuideModalOpen, setAiGuideModalOpen,
    isSearchOpen, setIsSearchOpen, searchInitialQuery, setSearchInitialQuery,
    isSelectMode, setIsSelectMode, selectedTaskIds, setSelectedTaskIds,
    isMoveModalOpen, setMoveModalOpen, isAiChatOpen, setAiChatOpen,
    aiChatHistory, setAiChatHistory, showAiChatFab, setShowAiChatFab,
    isAiChatLoading, setIsAiChatLoading, isAiDoubtSolverOpen, setIsAiDoubtSolverOpen, 
    isCreateDeckModalOpen, setCreateDeckModalOpen, isAiFlashcardModalOpen, setAiFlashcardModalOpen,
    editingDeck, setEditingDeck, viewingDeck, setViewingDeck,
    isCreateCardModalOpen, setCreateCardModalOpen, editingCard, setEditingCard,
    reviewingDeck, setReviewingDeck, viewingFile, setViewingFile,
    isMusicLibraryOpen, setIsMusicLibraryOpen, analyzingMistake, setAnalyzingMistake,
    handleMoveSelectedTasks, handleSaveDeck, handleDeleteCard, handleSaveCard, // Add handlers as dependencies
    setDeepLinkAction, isMessagingModalOpen, setMessagingModalOpen, messagingStudent, setMessagingStudent,
    isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen, isProfileModalOpen, setIsProfileModalOpen,
    isSpecificMistakeAnalysisModalOpen, setIsSpecificMistakeAnalysisModalOpen
  ]);

  const renderMainContent = () => {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-white"><div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (backendStatus === 'offline') return <BackendOfflineScreen onSelectDemoUser={enterDemoMode} onRetryConnection={checkBackendStatus} backendStatus={backendStatus} />;
    if (backendStatus === 'misconfigured') return <ConfigurationErrorScreen onRetryConnection={checkBackendStatus} backendStatus={backendStatus} />;
    if (!currentUser && !isDemoMode) return <AuthScreen backendStatus={backendStatus} googleClientId={googleClientId} resetToken={resetToken} />;
    if (currentUser && currentUser.CONFIG.settings.examType === undefined) return <ExamTypeSelectionModal onSelect={(type) => handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, examType: type } })} />;
    
    return (
      <div className={`min-h-screen ${currentUser?.CONFIG.settings.theme === 'liquid-glass' ? 'theme-liquid-glass' : currentUser?.CONFIG.settings.theme === 'midnight' ? 'theme-midnight' : ''}`} >
        <div className="container mx-auto px-4 pt-4 sm:pt-6">
          <Header user={{ name: currentUser.fullName, id: currentUser.sid, profilePhoto: currentUser.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} onOpenProfile={() => openModal('ProfileModal', setIsProfileModalOpen)} />
          
          {userRole === 'student' && currentUser ? (
            <StudentDashboard student={currentUser} onSaveTask={handleSaveTask} onSaveBatchTasks={handleSaveBatchTasks} onDeleteTask={handleDeleteTask} onToggleMistakeFixed={handleToggleMistakeFixed} onUpdateConfig={handleUpdateConfig} onLogStudySession={handleLogStudySession} onUpdateWeaknesses={handleUpdateWeaknesses} onLogResult={handleLogResult} onAddExam={handleAddExam} onUpdateExam={handleUpdateExam} onDeleteExam={handleDeleteExam} onExportToIcs={handleExportToIcs} onBatchImport={handleBatchImport} googleAuthStatus={googleAuthStatus} onGoogleSignIn={handleGoogleSignIn} onGoogleSignOut={handleGoogleSignOut} onBackupToDrive={handleBackupToDrive} onRestoreFromDrive={handleRestoreFromDrive} allDoubts={allDoubts} onPostDoubt={handlePostDoubt} onPostSolution={handlePostSolution} deepLinkAction={deepLinkAction} {...modalControlProps} />
          ) : userRole === 'admin' && allStudents ? (
            <TeacherDashboard students={allStudents} onToggleUnacademySub={handleToggleUnacademySub} onDeleteUser={handleDeleteStudent} onBroadcastTask={handleBroadcastTask} {...modalControlProps} />
          ) : <div className="text-center text-gray-500 py-10">Initializing...</div>}
        </div>
        
        {isFullScreenPlayerOpen && <FullScreenMusicPlayer />}
        {currentTrack && <GlobalMusicVisualizer />}
        {currentTrack && !isFullScreenPlayerOpen && (window.innerWidth < 768) && <PersistentMusicPlayer />}
        
        {isExamTypeSelectionModalOpen && <ExamTypeSelectionModal onSelect={(type) => { handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, examType: type } }); closeModal('ExamTypeSelectionModal'); }} />}
        {isCreateModalOpen && <CreateEditTaskModal task={editingTask || viewingTask} viewOnly={!!viewingTask} onClose={() => closeModal('CreateEditTaskModal')} onSave={handleSaveTask} decks={currentUser?.CONFIG.flashcardDecks || []} />}
        {isAiParserModalOpen && <AIParserModal onClose={() => closeModal('AIParserModal')} onDataReady={setDeepLinkAction} onPracticeTestReady={setAiPracticeTest} onOpenGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} examType={currentUser?.CONFIG.settings.examType} />}
        {isPracticeModalOpen && <CustomPracticeModal initialTask={practiceTask} aiPracticeTest={aiPracticeTest} onClose={() => closeModal('CustomPracticeModal')} onSessionComplete={(duration, solved, skipped) => handleLogStudySession({ duration, questions_solved: solved, questions_skipped: skipped })} defaultPerQuestionTime={currentUser?.CONFIG.settings.perQuestionTime || 180} onLogResult={handleLogResult} student={currentUser} onUpdateWeaknesses={handleUpdateWeaknesses} onSaveTask={handleSaveTask} />}
        {isSettingsModalOpen && <SettingsModal settings={currentUser?.CONFIG.settings} decks={currentUser?.CONFIG.flashcardDecks || []} onClose={() => closeModal('SettingsModal')} onSave={handleUpdateConfig} onExportToIcs={handleExportToIcs} googleAuthStatus={googleAuthStatus} onGoogleSignIn={handleGoogleSignIn} onGoogleSignOut={handleGoogleSignOut} onBackupToDrive={handleBackupToDrive} onRestoreFromDrive={handleRestoreFromDrive} onApiKeySet={() => setShowAiChatFab(true)} onOpenAssistantGuide={() => openModal('GoogleAssistantGuideModal', setAssistantGuideOpen)} onOpenAiGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} onClearAllSchedule={() => { if(window.confirm("Are you sure?")) api.clearAllSchedule().then(refreshUser); }} onToggleEditLayout={() => handleUpdateConfig({ settings: { ...currentUser?.CONFIG.settings, dashboardLayout: currentUser?.CONFIG.settings.dashboardLayout || [] } })} />}
        {isEditWeaknessesModalOpen && <EditWeaknessesModal currentWeaknesses={currentUser?.CONFIG.WEAK || []} onClose={() => closeModal('EditWeaknessesModal')} onSave={handleUpdateWeaknesses} />}
        {isLogResultModalOpen && <LogResultModal onClose={() => closeModal('LogResultModal')} onSave={handleLogResult} initialScore={initialScoreForModal} initialMistakes={initialMistakesForModal} />}
        {isEditResultModalOpen && editingResult && <EditResultModal result={editingResult} onClose={() => closeModal('EditResultModal')} onSave={handleLogResult} />}
        {isExamModalOpen && <CreateEditExamModal exam={editingExam} onClose={() => closeModal('CreateEditExamModal')} onSave={(exam) => editingExam ? handleUpdateExam(exam) : handleAddExam(exam)} />}
        {isAiMistakeModalOpen && <AIMistakeAnalysisModal onClose={() => closeModal('AIMistakeAnalysisModal')} onSaveWeakness={(newWeakness) => handleUpdateWeaknesses([...new Set([...(currentUser?.CONFIG.WEAK || []), newWeakness])])} />}
        {isAiDoubtSolverOpen && <AIDoubtSolverModal onClose={() => closeModal('AIDoubtSolverOpen')} />}
        {isAiChatOpen && <AIChatPopup history={aiChatHistory} onSendMessage={(p, img) => api.aiChat({ history: aiChatHistory, prompt: p, imageBase64: img, domain: window.location.origin }).then(res => setAiChatHistory(prev => [...prev, res])).catch(e => setAiChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${e.message}` }] }]))} onClose={() => closeModal('AIChatPopup')} isLoading={isAiChatLoading} />}
        {viewingReport && <TestReportModal result={viewingReport} onClose={() => closeModal('TestReportModal')} onUpdateWeaknesses={handleUpdateWeaknesses} student={currentUser} onSaveDeck={handleSaveDeck} />}
        {isMoveModalOpen && <MoveTasksModal onClose={() => closeModal('MoveTasksModal')} onConfirm={(newDate) => handleMoveSelectedTasks(selectedTaskIds, newDate)} selectedCount={selectedTaskIds.length} />}
        {isMusicLibraryOpen && <MusicLibraryModal onClose={() => closeModal('MusicLibraryModal')} />}
        {deepLinkAction && <DeepLinkConfirmationModal data={deepLinkAction.data} onClose={() => closeModal('DeepLinkConfirmationModal')} onConfirm={() => handleBatchImport(deepLinkAction.data)} />}
        {isCreateDeckModalOpen && <CreateEditDeckModal deck={editingDeck} onClose={() => closeModal('CreateEditDeckModal')} onSave={handleSaveDeck} />}
        {isAiFlashcardModalOpen && <AIGenerateFlashcardsModal student={currentUser} onClose={() => closeModal('AIGenerateFlashcardsModal')} onSaveDeck={handleSaveDeck} />}
        {viewingDeck && <DeckViewModal deck={viewingDeck} onClose={() => closeModal('DeckViewModal')} onAddCard={() => openModal('CreateEditFlashcardModal', setCreateCardModalOpen)} onEditCard={(card) => { setEditingCard(card); openModal('CreateEditFlashcardModal', setCreateCardModalOpen); }} onDeleteCard={(cardId) => handleDeleteCard(viewingDeck.id, cardId)} onStartReview={() => openModal('FlashcardReviewModal', setReviewingDeck, viewingDeck)} />}
        {isCreateCardModalOpen && viewingDeck && <CreateEditFlashcardModal card={editingCard} deckId={viewingDeck.id} onClose={() => closeModal('CreateEditFlashcardModal')} onSave={handleSaveCard} />}
        {reviewingDeck && <FlashcardReviewModal deck={reviewingDeck} onClose={() => closeModal('FlashcardReviewModal')} />}
        {viewingFile && <FileViewerModal file={viewingFile} onClose={() => closeModal('FileViewerModal')} />}
        {isAssistantGuideOpen && <GoogleAssistantGuideModal onClose={() => closeModal('GoogleAssistantGuideModal')} />}
        {isAiGuideModalOpen && <AIGuideModal onClose={() => closeModal('AIGuideModal')} examType={currentUser?.CONFIG.settings.examType} />}
        {isMessagingModalOpen && messagingStudent && <MessagingModal student={messagingStudent} onClose={() => closeModal('MessagingModal')} isDemoMode={isDemoMode} />}
        {isAnswerKeyUploadModalOpen && <AnswerKeyUploadModal onClose={() => closeModal('AnswerKeyUploadModal')} onGrade={() => {}} />}
        {isProfileModalOpen && <ProfileModal user={currentUser} onClose={() => closeModal('ProfileModal')} />}
        {isSpecificMistakeAnalysisModalOpen && analyzingMistake !== null && <SpecificMistakeAnalysisModal questionNumber={analyzingMistake} onClose={() => closeModal('SpecificMistakeAnalysisModal')} onSaveWeakness={(newWeakness) => handleUpdateWeaknesses([...new Set([...(currentUser?.CONFIG.WEAK || []), newWeakness])])} />}
        {isSearchOpen && <UniversalSearch isOpen={isSearchOpen} onClose={() => closeModal('UniversalSearch')} onNavigate={(tab) => {}} onAction={() => {}} scheduleItems={currentUser?.SCHEDULE_ITEMS || []} exams={currentUser?.EXAMS || []} decks={currentUser?.CONFIG.flashcardDecks || []} initialQuery={searchInitialQuery || undefined} />}
      </div>
    );
  };
  
  return renderMainContent();
};

export default App;--- START OF FILE vite.config.ts ---


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'service-worker.js',
      devOptions: {
        enabled: true
      },
      manifest: false // We are using public/manifest.json
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})--- START OF FILE tailwind.config.js ---

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
    "./screens/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}--- START OF FILE postcss.config.js ---

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}--- START OF FILE index.css ---

@tailwind base;
@tailwind components;
@tailwind utilities;--- START OF FILE components/widgets/FlashcardWidget.tsx ---
--- START OF FILE components/ImageToTimetableModal.tsx ---
--- START OF FILE components/EditWeaknessesModal.tsx ---

import React, { useState } from 'react';

interface EditWeaknessesModalProps {
  currentWeaknesses: string[];
  onClose: () => void;
  onSave: (weaknesses: string[]) => void;
}

const EditWeaknessesModal: React.FC<EditWeaknessesModalProps> = ({ currentWeaknesses, onClose, onSave }) => {
  const [weaknessesText, setWeaknessesText] = useState(currentWeaknesses.join('\n'));
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weaknessesArray = weaknessesText.split('\n').map(w => w.trim()).filter(Boolean);
    onSave(weaknessesArray);
    handleClose();
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-2">Edit Priority Weaknesses</h2>
        <p className="text-sm text-gray-400 mb-4">List your main areas for improvement, one per line. These will be prioritized in your schedule.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={weaknessesText}
            onChange={(e) => setWeaknessesText(e.target.value)}
            className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="e.g., Integration by Parts&#10;Wave Optics&#10;Mole Concept"
          />
          <div className="flex justify-end gap-4 pt-2">
            <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 transition-opacity">Save Weaknesses</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWeaknessesModal;