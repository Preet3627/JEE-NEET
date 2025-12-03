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
  // FIX: Corrected aiPracticeTest type to allow string or string[] for answers
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
  isAiDoubtSolverOpen: boolean; setIsAiDoubtSolverOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCreateDeckModalOpen: boolean; setCreateDeckModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // FIX: Added missing isAiFlashcardModalOpen and its setter to ModalControlProps
  isAiFlashcardModalOpen: boolean; setAiFlashcardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingDeck: FlashcardDeck | null; setEditingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  viewingDeck: FlashcardDeck | null; setViewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  isCreateCardModalOpen: boolean; setCreateCardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingCard: Flashcard | null; setEditingCard: React.Dispatch<React.SetStateAction<Flashcard | null>>;
  reviewingDeck: FlashcardDeck | null; setReviewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
  viewingFile: StudyMaterialItem | null; setViewingFile: React.Dispatch<React.SetStateAction<StudyMaterialItem | null>>;
  // FIX: Corrected setIsMusicLibraryOpen type to React.Dispatch<React.SetStateAction<boolean>>
  isMusicLibraryOpen: boolean; setIsMusicLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  analyzingMistake: number | null; setAnalyzingMistake: React.Dispatch<React.SetStateAction<number | null>>;
  handleMoveSelected: (taskIds: string[], newDate: string) => void;
  handleSaveDeck: (deck: FlashcardDeck) => void;
  handleDeleteCard: (deckId: string, cardId: string) => void;
  handleSaveCard: (deckId: string, card: Flashcard) => void;
  setDeepLinkAction: React.Dispatch<React.SetStateAction<any>>;
  isMessagingModalOpen: boolean; setMessagingModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // FIX: Added messagingStudent to ModalControlProps
  messagingStudent: StudentData | null; setMessagingStudent: React.Dispatch<React.SetStateAction<StudentData | null>>;
  isAnswerKeyUploadModalOpen: boolean; setAnswerKeyUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isProfileModalOpen: boolean; setIsProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSpecificMistakeAnalysisModalOpen: boolean; setIsSpecificMistakeAnalysisModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  // FIX: Corrected aiPracticeTest type to allow string or string[] for answers
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
  // FIX: Added missing isAiDoubtSolverOpen and its setter.
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
  }, [
    setIsExamTypeSelectionModalOpen, setIsCreateModalOpen, setisAiParserModalOpen, setIsPracticeModalOpen,
    setIsSettingsModalOpen, setIsEditWeaknessesModalOpen, setLogResultModalOpen, setEditResultModalOpen, 
    setIsExamModalOpen, setAiMistakeModalOpen, setViewingReport, setAssistantGuideOpen, setAiGuideModalOpen, 
    setIsSearchOpen, setMoveModalOpen, setAiChatOpen, setIsAiDoubtSolverOpen, setCreateDeckModalOpen, 
    setAiFlashcardModalOpen, setEditingDeck, setViewingDeck, setCreateCardModalOpen, setEditingCard, 
    setReviewingDeck, setViewingFile, setIsMusicLibraryOpen, setDeepLinkAction, setMessagingModalOpen, 
    setAnswerKeyUploadModalOpen, setIsProfileModalOpen, setIsSpecificMistakeAnalysisModalOpen,
  ]);

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
  }, [closeModal]);


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
      console.error("Backend status check failed:", error);
      if (error.status === 'misconfigured') {
          setBackendStatus('misconfigured');
      } else {
          setBackendStatus('offline');
      }
    }
  }, []);

  // Initial check and periodic heartbeat
  useEffect(() => {
    checkBackendStatus();

    const interval = setInterval(async () => {
      if (token) {
        try {
          await api.heartbeat();
        } catch (error) {
          console.warn('Heartbeat failed, backend may be offline:', error);
          checkBackendStatus();
        }
      } else {
        checkBackendStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, checkBackendStatus]);

  // Google API client initialization
  useEffect(() => {
    if (!googleClientId || backendStatus !== 'online') return;
    if (!window.gapi || !window.google) {
      console.warn("Google API scripts not yet loaded.");
      return;
    }

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

  // Deep Link Handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const dataStr = params.get('data');
    const resetToken = params.get('reset-token');

    if (resetToken) {
      setResetToken(resetToken);
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

  // Handle deep link actions
  useEffect(() => {
    if (!deepLinkAction || !currentUser) return;

    const handleDeepLink = async () => {
      const { action, data } = deepLinkAction;
      setDeepLinkAction(null);

      if (action === 'new_schedule' || action === 'import_data' || action === 'import_exam') {
        openModal('DeepLinkConfirmationModal', setDeepLinkAction, deepLinkAction.data);
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
  }, [deepLinkAction, currentUser, openModal, setDeepLinkAction, setPracticeTask, setIsPracticeModalOpen, setViewingTask, setIsCreateModalOpen, setSearchInitialQuery, setIsSearchOpen]);


  // Handlers for specific student data actions
  const handleSaveTask = useCallback(async (task: ScheduleItem) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.saveTask(task);
      await refreshUser();
      if (currentUser.CONFIG.isCalendarSyncEnabled && googleAuthStatus === 'signed_in') {
        if ('googleEventId' in task && task.googleEventId) {
          await gcal.updateEvent(task.googleEventId, task);
        } else {
          const eventId = await gcal.createEvent(task);
          const updatedTask = { ...task, googleEventId: eventId };
          await api.saveTask(updatedTask); 
          await refreshUser();
        }
      }
    } catch (error) {
      console.error("Failed to save task:", error);
      alert("Failed to save task. Please try again or check backend connection.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser, googleAuthStatus]);

  const handleSaveBatchTasks = useCallback(async (tasks: ScheduleItem[]) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.saveBatchTasks(tasks);
      await refreshUser();
    } catch (error) {
      console.error("Failed to save batch tasks:", error);
      alert("Failed to save batch tasks. Please try again or check backend connection.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);
  
  // FIX: handleClearAllSchedule
  const handleClearAllSchedule = useCallback(async () => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to clear all your schedule items? This cannot be undone.")) return;
    setIsSyncing(true);
    try {
        await api.clearAllSchedule();
        await refreshUser();
        alert("All schedule items cleared.");
    } catch (error: any) {
        console.error("Failed to clear schedule:", error);
        alert(`Failed to clear schedule: ${error.message}`);
    } finally {
        setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    setIsSyncing(true);
    try {
      const taskToDelete = currentUser.SCHEDULE_ITEMS.find(item => item.ID === taskId);
      if (taskToDelete && 'googleEventId' in taskToDelete && taskToDelete.googleEventId && googleAuthStatus === 'signed_in') {
        await gcal.deleteEvent(taskToDelete.googleEventId);
      }
      await api.deleteTask(taskId);
      await refreshUser();
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete task. Please try again or check backend connection.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser, googleAuthStatus]);

  const handleToggleMistakeFixed = useCallback(async (resultId: string, mistake: string) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const result = currentUser.RESULTS.find(r => r.ID === resultId);
      if (!result) throw new Error("Result not found");

      const isFixed = result.FIXED_MISTAKES?.includes(mistake);
      const updatedFixedMistakes = isFixed
          ? result.FIXED_MISTAKES.filter(m => m !== mistake)
          : [...(result.FIXED_MISTAKES || []), mistake];
      
      const updatedResult = { ...result, FIXED_MISTAKES: updatedFixedMistakes };
      await api.updateResult(updatedResult);
      await refreshUser();
    } catch (error) {
      console.error("Failed to update mistake status:", error);
      alert("Failed to update mistake status. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleUpdateConfig = useCallback(async (config: Partial<Config>) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.updateConfig(config);
      await refreshUser();
      alert("Settings saved!");
    }<ctrl63>