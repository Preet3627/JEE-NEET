
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAppStore } from './store/useAppStore'; // Import Zustand store
import { urlBase64ToUint8Array } from './utils/push';
import { api } from './api/apiService';
import {
  ScheduleItem, HomeworkData, ResultData, ExamData, FlashcardDeck, Flashcard, StudyMaterialItem,
  StudentData, DoubtData, Config, StudySession, PracticeQuestion, ActiveTab, NotchSettings,
  VisualizerSettings, DjDropSettings, LocalPlaylist, Track, DashboardWidgetItem // Added DashboardWidgetItem
} from './types';

import Header from './components/Header';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AuthScreen from './screens/AuthScreen';
import BackendOfflineScreen from './components/BackendOfflineScreen';
import ConfigurationErrorScreen from './components/ConfigurationErrorScreen';
import { exportCalendar } from './utils/calendar';
import * as gcal from './utils/googleCalendar';
import * as gdrive from './utils/googleDrive';

import ExamTypeSelectionModal from './components/ExamTypeSelectionModal';
import { useMusicPlayer } from './context/MusicPlayerContext';
import FullScreenMusicPlayer from './components/FullScreenMusicPlayer';
import PersistentMusicPlayer from './components/PersistentMusicPlayer';
import GlobalMusicVisualizer from './components/GlobalMusicVisualizer';
import DynamicIsland from './components/widgets/DynamicIsland';
import { useAuth, processUserData } from './context/AuthContext';
import WidgetSelectorModal from './components/WidgetSelectorModal';
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
  isAiDoubtSolverOpen: boolean; setIsAiDoubtSolverOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  isWidgetSelectorModalOpen: boolean; setIsWidgetSelectorModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
// #endregion Modal State Definition


const App: React.FC = () => {
  const {
    currentUser, userRole, isLoading, isDemoMode, enterDemoMode, logout, refreshUser, token,
    googleAuthStatus, setGoogleAuthStatus, loginWithToken, verificationEmail, setVerificationEmail,
    handleGoogleSignIn, handleGoogleSignOut,
    allStudents, setAllStudents, allDoubts, setAllDoubts, backendStatus, setBackendStatus, googleClientId, setGoogleClientId, updateUserConfig
  } = useAuth();
  const { isFullScreenPlayerOpen, toggleLibrary, isLibraryOpen, currentTrack, analyser, visualizerSettings, notchSettings, play, pause, nextTrack, prevTrack, isPlaying, toggleFullScreenPlayer } = useMusicPlayer();

  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setPushNotificationsEnabled(true);
          }
        });
      });
    }
  }, []);

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
  const [isWidgetSelectorModalOpen, setIsWidgetSelectorModalOpen] = useState(false);
  const [isAiDoubtSolverOpen, setIsAiDoubtSolverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard'); // State for managing active tab

  const navigateTab = useCallback((tab: ActiveTab, replace = false) => {
    // Update URL hash directly for better browser history integration
    const newHash = `#${tab}`;
    if (replace) {
      window.history.replaceState({ tab }, '', newHash);
    } else {
      window.history.pushState({ tab }, '', newHash);
    }
    setActiveTab(tab);
  }, []);

  // General App State
  const [isSyncing, setIsSyncing] = useState(false);
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
    modalSettersRef.current.set('WidgetSelectorModal', setIsWidgetSelectorModalOpen);
    modalSettersRef.current.set('UniversalSearch', setIsSearchOpen);
  }, [
    setIsExamTypeSelectionModalOpen, setIsCreateModalOpen, setisAiParserModalOpen, setIsPracticeModalOpen,
    setIsSettingsModalOpen, setIsEditWeaknessesModalOpen, setLogResultModalOpen, setEditResultModalOpen,
    setIsExamModalOpen, setAiMistakeModalOpen, setViewingReport, setAssistantGuideOpen, setAiGuideModalOpen,
    setIsSearchOpen, setMoveModalOpen, setAiChatOpen, setIsAiDoubtSolverOpen, setCreateDeckModalOpen,
    setAiFlashcardModalOpen, setEditingDeck, setViewingDeck, setCreateCardModalOpen, setEditingCard,
    setReviewingDeck, setViewingFile, setIsMusicLibraryOpen, setDeepLinkAction, setMessagingModalOpen,
    setAnswerKeyUploadModalOpen, setIsProfileModalOpen, setIsSpecificMistakeAnalysisModalOpen,
    setIsWidgetSelectorModalOpen, // Added for WidgetSelectorModal
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

    // Use hash for modal history
    window.location.hash = `#${modalId}`;
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

    // Go back in history if modal was opened via hash
    if (window.location.hash === `#${modalId}`) {
      window.history.back();
    }
  }, []);


  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove '#'
      // Handle tab navigation from hash
      const possibleTabs: ActiveTab[] = ['dashboard', 'today', 'schedule', 'planner', 'material', 'flashcards', 'exams', 'performance', 'doubts'];
      if (possibleTabs.includes(hash as ActiveTab)) {
        setActiveTab(hash as ActiveTab);
      } else if (!hash && modalStackRef.current.length === 0) {
        // If hash is empty and no modals are open, default to dashboard
        setActiveTab('dashboard');
      }

      // Handle modals from hash
      const modalIdFromHash = hash.split('?')[0]; // Get modal ID without query params
      const topModalInStack = modalStackRef.current.length > 0 ? modalStackRef.current[modalStackRef.current.length - 1].id : null;

      if (modalIdFromHash && modalSettersRef.current.has(modalIdFromHash) && modalIdFromHash !== topModalInStack) {
        // Open modal if it's in the hash and not already the top modal
        const setter = modalSettersRef.current.get(modalIdFromHash);
        if (setter) {
          // Extract initialValue if present in hash query params
          const query = new URLSearchParams(hash.split('?')[1]);
          let initialValue = null;
          if (query.has('data')) {
            try {
              initialValue = JSON.parse(decodeURIComponent(query.get('data') || ''));
            } catch (e) {
              console.error("Failed to parse deep link data from modal hash:", e);
            }
          }
          openModal(modalIdFromHash, setter, initialValue);
        }
      } else if (!modalIdFromHash && topModalInStack) {
        // Close top modal if hash is empty and there's a modal in stack
        closeModal(topModalInStack);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial check on load
    handleHashChange();

    // Set initial active tab based on hash or default to dashboard
    const initialHashTab = window.location.hash.substring(1).split('?')[0] as ActiveTab;
    const possibleTabs: ActiveTab[] = ['dashboard', 'today', 'schedule', 'planner', 'material', 'flashcards', 'exams', 'performance', 'doubts'];
    if (possibleTabs.includes(initialHashTab)) {
      setActiveTab(initialHashTab);
    } else {
      setActiveTab('dashboard');
    }

    // Set the initial state of the app
    window.history.replaceState({ tab: activeTab }, '', `#${activeTab}`);


    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [openModal, closeModal, activeTab, navigateTab]); // Include activeTab to prevent stale closures

  const checkBackendStatus = useCallback(async () => {
    try {
      const res = await api.getPublicConfig();
      if (typeof res === 'object' && res.status === 'misconfigured') {
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

  useEffect(() => {
    const fetchAllStudents = async () => {
      if (userRole === 'admin') {
        try {
          const studentsData = await api.getStudents();
          // Process each student's data using the helper from AuthContext
          const processedStudents = studentsData.map((student: StudentData) => processUserData(student));
          setAllStudents(processedStudents);
        } catch (error) {
          console.error("Failed to fetch all students for admin dashboard:", error);
        }
      } else {
        setAllStudents([]); // Clear student data if not admin
      }
    };
    fetchAllStudents();
  }, [userRole]); // Run this effect when userRole changes



  // Deep Link Handling (for custom protocol)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepLinkUrl = params.get('url'); // For custom protocol handler

    if (deepLinkUrl) {
      try {
        const decodedUrl = decodeURIComponent(deepLinkUrl); // e.g., web+jeescheduler://dashboard
        const urlObj = new URL(decodedUrl);
        const path = urlObj.pathname.substring(1); // e.g., "dashboard"
        const queryParams = urlObj.searchParams;

        // Map path to tab or action
        const possibleTabs: ActiveTab[] = ['dashboard', 'today', 'schedule', 'planner', 'material', 'flashcards', 'exams', 'performance', 'doubts'];
        if (possibleTabs.includes(path as ActiveTab)) {
          navigateTab(path as ActiveTab);
        } else if (path === 'open_modal') {
          const modalId = queryParams.get('modalId');
          const modalData = queryParams.get('data');
          if (modalId && modalSettersRef.current.has(modalId)) {
            const setter = modalSettersRef.current.get(modalId);
            let initialValue = null;
            if (modalData) {
              try {
                initialValue = JSON.parse(decodeURIComponent(modalData));
              } catch (e) {
                console.error("Failed to parse deep link modal data:", e);
              }
            }
            if (setter) {
              openModal(modalId, setter, initialValue);
            }
          }
        }

        // Clean up URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('url');
        window.history.replaceState({}, document.title, newUrl.toString());

      } catch (error) {
        console.error("Failed to process custom protocol deep link:", error);
      }
    }

    // Existing deep link handling (from regular URL query params)
    const action = params.get('action');
    const dataStr = params.get('data');
    const resetToken = params.get('reset-token');
    const tabParam = params.get('tab');

    if (resetToken) {
      setResetToken(resetToken);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reset-token');
      window.history.replaceState({}, document.title, newUrl.toString());
      return;
    }

    if (tabParam && ['dashboard', 'today', 'schedule', 'material', 'flashcards', 'exams', 'performance', 'doubts'].includes(tabParam)) {
      navigateTab(tabParam as ActiveTab, true);
    }

    if (action) {
      let parsedData = null;
      if (dataStr) {
        try {
          parsedData = JSON.parse(decodeURIComponent(dataStr));
        } catch (error) {
          console.error("Failed to parse deep link data:", error);
        }
      }
      // Set the state which triggers the effect in StudentDashboard
      setDeepLinkAction({ action, data: parsedData });

      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('action');
      newUrl.searchParams.delete('data');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
  }, [openModal, navigateTab, setDeepLinkAction]);

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
        ? (result.FIXED_MISTAKES || []).filter(m => m !== mistake)
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
    console.log('handleUpdateConfig received config:', config); // Debug log
    try {
      await api.updateConfig(config);
      await refreshUser();
      alert("Settings saved!");
    } catch (error) {
      console.error("Failed to update config:", error);
      alert("Failed to save settings. Please try again or check backend connection.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleLogStudySession = useCallback(async (session: Omit<StudySession, 'date'> & { date: string }) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.saveStudySession(session);
      await refreshUser();
    } catch (error) {
      console.error("Failed to log study session:", error);
      alert("Failed to log study session. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleUpdateWeaknesses = useCallback(async (weaknesses: string[]) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.updateConfig({ WEAK: weaknesses });
      await refreshUser();
    } catch (error) {
      console.error("Failed to update weaknesses:", error);
      alert("Failed to update weaknesses. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleLogResult = useCallback(async (result: ResultData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.updateResult(result);
      await refreshUser();
      alert("Test result logged successfully!");
    } catch (error) {
      console.error("Failed to log result:", error);
      alert("Failed to log test result. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleAddExam = useCallback(async (exam: ExamData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.addExam(exam);
      await refreshUser();
      alert("Exam added successfully!");
    } catch (error) {
      console.error("Failed to add exam:", error);
      alert("Failed to add exam. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleUpdateExam = useCallback(async (exam: ExamData) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.updateExam(exam);
      await refreshUser();
      alert("Exam updated successfully!");
    } catch (error) {
      console.error("Failed to update exam:", error);
      alert("Failed to update exam. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleDeleteExam = useCallback(async (examId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to delete this exam?")) return;
    setIsSyncing(true);
    try {
      await api.deleteExam(examId);
      await refreshUser();
      alert("Exam deleted successfully.");
    } catch (error) {
      console.error("Failed to delete exam:", error);
      alert("Failed to delete exam. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleExportToIcs = useCallback(() => {
    if (!currentUser) return;
    exportCalendar(currentUser.SCHEDULE_ITEMS, currentUser.EXAMS, currentUser.fullName);
  }, [currentUser]);

  const handleBatchImport = useCallback(async (data: { schedules: ScheduleItem[]; exams: ExamData[]; results: ResultData[]; weaknesses: string[]; }) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      if (data.schedules.length > 0) await api.saveBatchTasks(data.schedules);
      if (data.exams.length > 0) {
        for (const exam of data.exams) {
          await api.addExam(exam);
        }
      }
      if (data.results.length > 0) {
        for (const result of data.results) {
          await api.updateResult(result);
        }
      }
      if (data.weaknesses.length > 0) {
        const newWeaknesses = [...new Set([...currentUser.CONFIG.WEAK, ...data.weaknesses])];
        await api.updateConfig({ WEAK: newWeaknesses });
      }
      await refreshUser();
      alert("Data imported successfully!");
    } catch (error) {
      console.error("Failed to batch import data:", error);
      alert("Failed to import data. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);





  const handleFullCalendarSync = useCallback(async () => {
    if (!currentUser || googleAuthStatus !== 'signed_in') return;
    setIsSyncing(true);
    try {
      const events = await gcal.listEvents();
      alert(`Fetched ${events.length} events from Google Calendar.`);
    } catch (error) {
      console.error("Full calendar sync failed:", error);
      alert("Failed to sync calendar. Ensure permissions are granted and try again.");
    } finally {
      setIsSyncing(false);
    }
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
      alert("Data backed up to Google Drive!");
    } catch (error) {
      console.error("Drive backup failed:", error);
      alert("Failed to backup to Drive. Ensure permissions are granted and try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, googleAuthStatus, refreshUser]);

  const handleRestoreFromDrive = useCallback(async () => {
    if (!currentUser || googleAuthStatus !== 'signed_in' || !currentUser.CONFIG.googleDriveFileId) return;
    if (!window.confirm("Are you sure you want to restore data from Google Drive? This will overwrite your current app data.")) return;
    setIsSyncing(true);
    try {
      const data = await gdrive.downloadData(currentUser.CONFIG.googleDriveFileId);
      const restoredUserData = JSON.parse(data);
      await api.fullSync(restoredUserData);
      await refreshUser();
      alert("Data restored from Google Drive!");
    } catch (error) {
      console.error("Drive restore failed:", error);
      alert("Failed to restore from Drive. The backup file might be missing or an error occurred.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, googleAuthStatus, refreshUser]);

  // Handler for posting doubts to community
  const handlePostDoubt = useCallback(async (question: string, image?: string) => {
    if (!currentUser) return;
    try {
      await api.postDoubt(question, image);
      await refreshUser();
    } catch (error) {
      alert("Failed to post doubt.");
    }
  }, [currentUser, refreshUser]);

  // Handler for posting solutions to doubts
  const handlePostSolution = useCallback(async (doubtId: string, solution: string, image?: string) => {
    if (!currentUser) return;
    try {
      await api.postSolution(doubtId, solution, image);
      await refreshUser();
    } catch (error) {
      alert("Failed to post solution.");
    }
  }, [currentUser, refreshUser]);

  // Handler for moving selected tasks to a new date
  const handleMoveSelectedTasks = useCallback(async (taskIds: string[], newDate: string) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await api.batchMoveTasks(taskIds, newDate);
      await refreshUser();
      alert(`Moved ${taskIds.length} tasks to ${newDate}.`);
    } catch (error) {
      console.error("Failed to move tasks:", error);
      alert("Failed to move tasks. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  // Handlers for Flashcard Decks (passed to StudentDashboard)
  const handleSaveDeck = useCallback(async (deck: FlashcardDeck) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const currentDecks = currentUser.CONFIG.flashcardDecks || [];
      const existingIndex = currentDecks.findIndex(d => d.id === deck.id);
      let newDecks;
      if (existingIndex >= 0) {
        newDecks = [...currentDecks];
        newDecks[existingIndex] = deck;
      } else {
        newDecks = [...currentDecks, deck];
      }
      await api.updateConfig({ flashcardDecks: newDecks });
      await refreshUser();
    } catch (error) {
      console.error("Failed to save deck:", error);
      alert("Failed to save flashcard deck.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to delete this deck and all its cards?")) return;
    setIsSyncing(true);
    try {
      const newDecks = currentUser.CONFIG.flashcardDecks?.filter(d => d.id !== deckId) || [];
      await api.updateConfig({ flashcardDecks: newDecks });
      await refreshUser();
      alert("Deck deleted.");
    } catch (error) {
      console.error("Failed to delete deck:", error);
      alert("Failed to delete flashcard deck.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleSaveCard = useCallback(async (deckId: string, card: Flashcard) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const currentDecks = currentUser.CONFIG.flashcardDecks || [];
      const targetDeckIndex = currentDecks.findIndex(d => d.id === deckId);
      if (targetDeckIndex === -1) throw new Error("Deck not found");

      const newDecks = [...currentDecks];
      const targetDeck = { ...newDecks[targetDeckIndex] };

      const existingCardIndex = targetDeck.cards.findIndex(c => c.id === card.id);
      if (existingCardIndex >= 0) {
        targetDeck.cards[existingCardIndex] = card;
      } else {
        targetDeck.cards.push(card);
      }
      newDecks[targetDeckIndex] = targetDeck;

      await api.updateConfig({ flashcardDecks: newDecks });
      await refreshUser();
    } catch (error) {
      console.error("Failed to save card:", error);
      alert("Failed to save flashcard.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  const handleDeleteCard = useCallback(async (deckId: string, cardId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to delete this card?")) return;
    setIsSyncing(true);
    try {
      const currentDecks = currentUser.CONFIG.flashcardDecks || [];
      const newDecks = currentDecks.map(deck =>
        deck.id === deckId ? { ...deck, cards: deck.cards.filter(c => c.id !== cardId) } : deck
      );
      await api.updateConfig({ flashcardDecks: newDecks });
      await refreshUser();
    } catch (error) {
      console.error("Failed to delete card:", error);
      alert("Failed to delete flashcard.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, refreshUser]);

  // For Admin broadcasting tasks
  const handleBroadcastTask = useCallback(async (task: ScheduleItem, examType: 'ALL' | 'JEE' | 'NEET') => {
    if (!currentUser || userRole !== 'admin') return;
    setIsSyncing(true);
    try {
      await api.broadcastTask(task, examType);
      alert("Task broadcasted successfully!");
    } catch (error: any) {
      console.error("Failed to broadcast task:", error);
      let errorMessage = "Failed to broadcast task. Please try again.";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Failed to broadcast task: ${error.message}`;
      } else if (error && typeof error === 'object' && 'error' in error) {
        errorMessage = `Failed to broadcast task: ${error.error}`;
      }
      alert(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, userRole]);

  // For Admin to clear all schedule data for a student
  const handleClearStudentData = useCallback(async (sid: string) => {
    if (userRole !== 'admin') return;
    setIsSyncing(true);
    try {
      await api.clearStudentData(sid);
      alert(`All data for student ${sid} cleared.`);
      await refreshUser();
    } catch (error) {
      console.error("Failed to clear student data:", error);
      alert("Failed to clear student data.");
    } finally {
      setIsSyncing(false);
    }
  }, [userRole, refreshUser]);

  // For Admin to delete a student account
  const handleDeleteStudent = useCallback(async (sid: string) => {
    if (userRole !== 'admin') return;
    if (!window.confirm(`Are you sure you want to delete student ${sid}? This is irreversible.`)) return;
    setIsSyncing(true);
    try {
      await api.deleteStudent(sid);
      alert(`Student ${sid} deleted.`);
      await refreshUser();
    } catch (error) {
      console.error("Failed to delete student:", error);
      alert("Failed to delete student.");
    } finally {
      setIsSyncing(false);
    }
  }, [userRole, refreshUser]);

  // For Admin to toggle Unacademy subscription (placeholder)
  const handleToggleUnacademySub = useCallback(async (sid: string) => {
    alert(`Toggle Unacademy sub for ${sid} - not yet fully implemented.`);
  }, []);

  // For Admin to impersonate a student
  const handleImpersonateStudent = useCallback(async (sid: string) => {
    if (userRole !== 'admin') return;
    try {
      const { token } = await api.impersonateStudent(sid);
      loginWithToken(token);
    } catch (error) {
      console.error("Impersonation failed:", error);
      alert("Failed to impersonate student.");
    }
  }, [userRole, loginWithToken]);

  const handleTogglePushNotifications = useCallback(async (enabled: boolean) => {
    const env = (import.meta as any).env;
    if (!env.VITE_VAPID_PUBLIC_KEY) {
      alert('Push notification service is not configured by the administrator.');
      setPushNotificationsEnabled(false);
      return;
    }

    if (enabled) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission for notifications was denied.');
        setPushNotificationsEnabled(false);
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // If getRegistration() returns null, wait for the service worker to be ready
        if ('serviceWorker' in navigator) {
          registration = await navigator.serviceWorker.ready;
        } else {
          alert('Service worker not registered.');
          setPushNotificationsEnabled(false);
          return;
        }
      }

      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array((import.meta as any).env.VITE_VAPID_PUBLIC_KEY as string) as any,
        });
        await api.savePushSubscription(subscription);
        setPushNotificationsEnabled(true);
        alert('Push notifications enabled!');
      } catch (error) {
        console.error("Push subscription failed:", error);
        alert("Failed to subscribe to push notifications.");
        setPushNotificationsEnabled(false);
      }
    } else {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        try {
          await subscription.unsubscribe();
          await api.deletePushSubscription();
          setPushNotificationsEnabled(false);
          alert('Push notifications disabled.');
        } catch (error) {
          console.error("Push unsubscription failed:", error);
          alert("Failed to disable push notifications.");
        }
      }
    }
  }, []);

  // Group all modal control props for easier passing
  const modalControlProps: ModalControlProps = useMemo(() => ({
    openModal, closeModal,
    isExamTypeSelectionModalOpen, setIsExamTypeSelectionModalOpen,
    isCreateModalOpen, setIsCreateModalOpen,
    isAiParserModalOpen, setisAiParserModalOpen,
    isPracticeModalOpen, setIsPracticeModalOpen,
    isSettingsModalOpen, setIsSettingsModalOpen,
    editingTask, setEditingTask,
    viewingTask, setViewingTask,
    practiceTask, setPracticeTask,
    aiPracticeTest, setAiPracticeTest,
    isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen,
    isLogResultModalOpen, setLogResultModalOpen,
    initialScoreForModal, setInitialScoreForModal,
    initialMistakesForModal, setInitialMistakesForModal,
    isEditResultModalOpen, setEditResultModalOpen,
    editingResult, setEditingResult,
    isExamModalOpen, setIsExamModalOpen,
    editingExam, setEditingExam,
    isAiMistakeModalOpen, setAiMistakeModalOpen,
    viewingReport, setViewingReport,
    isAssistantGuideOpen, setAssistantGuideOpen,
    isAiGuideModalOpen, setAiGuideModalOpen,
    isSearchOpen, setIsSearchOpen,
    searchInitialQuery, setSearchInitialQuery,
    isSelectMode, setIsSelectMode,
    selectedTaskIds, setSelectedTaskIds,
    isMoveModalOpen, setMoveModalOpen,
    isAiChatOpen, setAiChatOpen,
    aiChatHistory, setAiChatHistory,
    showAiChatFab, setShowAiChatFab,
    isAiChatLoading, setIsAiChatLoading,
    isAiDoubtSolverOpen, setIsAiDoubtSolverOpen,
    isCreateDeckModalOpen, setCreateDeckModalOpen,
    isAiFlashcardModalOpen, setAiFlashcardModalOpen,
    editingDeck, setEditingDeck,
    viewingDeck, setViewingDeck,
    isCreateCardModalOpen, setCreateCardModalOpen,
    editingCard, setEditingCard,
    reviewingDeck, setReviewingDeck,
    viewingFile, setViewingFile,
    isMusicLibraryOpen, setIsMusicLibraryOpen,
    analyzingMistake, setAnalyzingMistake,
    handleMoveSelected: handleMoveSelectedTasks,
    handleSaveDeck,
    handleDeleteCard,
    handleSaveCard,
    setDeepLinkAction,
    isMessagingModalOpen, setMessagingModalOpen,
    messagingStudent, setMessagingStudent,
    isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen,
    isProfileModalOpen, setIsProfileModalOpen,
    isSpecificMistakeAnalysisModalOpen, setIsSpecificMistakeAnalysisModalOpen,
    isWidgetSelectorModalOpen, setIsWidgetSelectorModalOpen,
  }), [
    openModal, closeModal, isExamTypeSelectionModalOpen, setIsExamTypeSelectionModalOpen,
    isCreateModalOpen, setIsCreateModalOpen, setisAiParserModalOpen, setIsPracticeModalOpen,
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
    handleMoveSelectedTasks, handleSaveDeck, handleDeleteCard, handleSaveCard,
    setDeepLinkAction, isMessagingModalOpen, setMessagingModalOpen, messagingStudent, setMessagingStudent,
    isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen, isProfileModalOpen, setIsProfileModalOpen,
    isSpecificMistakeAnalysisModalOpen, setIsSpecificMistakeAnalysisModalOpen,
    isWidgetSelectorModalOpen, setIsWidgetSelectorModalOpen
  ]);


  // Dummy handlers for missing implementations
  const handleApiKeySet = () => Promise.resolve();
  const handleAiChatMessage = async (msg: string) => { return { response: "AI Unavailable" }; };

  // Determine main content based on auth state and backend status
  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center text-white text-xl">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mr-4"></div>
          Loading app...
        </div>
      );
    }

    if (backendStatus === 'offline') {
      return <BackendOfflineScreen onSelectDemoUser={enterDemoMode} onRetryConnection={checkBackendStatus} backendStatus={backendStatus} />;
    }

    if (backendStatus === 'misconfigured') {
      return <ConfigurationErrorScreen onRetryConnection={checkBackendStatus} backendStatus={backendStatus} />;
    }

    if (!currentUser && !isDemoMode) {
      return <AuthScreen backendStatus={backendStatus} googleClientId={googleClientId} resetToken={resetToken} />;
    }

    if (currentUser && currentUser.CONFIG.settings.examType === undefined) {
      return <ExamTypeSelectionModal onClose={() => { /* no-op for initial selection */ }} onSelect={(type) => handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, examType: type } as any })} />;
    }

    // Main App Layout
    return (
      <div className={`min-h-screen ${currentUser?.CONFIG.settings.theme === 'liquid-glass' ? 'theme-liquid-glass' : currentUser?.CONFIG.settings.theme === 'midnight' ? 'theme-midnight' : ''}`} >
        <DynamicIsland />
        <div className="container mx-auto px-4 pt-4 sm:pt-6">
          <Header
            user={currentUser ? { name: currentUser.fullName, id: currentUser.sid, profilePhoto: currentUser.profilePhoto } : { name: '', id: '', profilePhoto: '' }}
            onLogout={logout}
            backendStatus={backendStatus}
            isSyncing={isSyncing}
            onOpenProfile={() => openModal('ProfileModal', setIsProfileModalOpen)}
          />

          {userRole === 'student' && currentUser ? (
            console.log('currentUser.SCHEDULE_ITEMS:', currentUser.SCHEDULE_ITEMS),
            <StudentDashboard
              student={currentUser}
              onSaveTask={handleSaveTask}
              onSaveBatchTasks={handleSaveBatchTasks}
              onDeleteTask={handleDeleteTask}
              onToggleMistakeFixed={handleToggleMistakeFixed}
              onUpdateConfig={handleUpdateConfig}
              onLogStudySession={handleLogStudySession}
              onUpdateWeaknesses={handleUpdateWeaknesses}
              onLogResult={handleLogResult}
              onAddExam={handleAddExam}
              onUpdateExam={handleUpdateExam}
              onDeleteExam={handleDeleteExam}
              onExportToIcs={handleExportToIcs}
              onBatchImport={handleBatchImport}
              googleAuthStatus={googleAuthStatus}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onBackupToDrive={handleBackupToDrive}
              onRestoreFromDrive={handleRestoreFromDrive}
              allDoubts={allDoubts}
              onPostDoubt={handlePostDoubt}
              onPostSolution={handlePostSolution}
              deepLinkAction={deepLinkAction}
              {...modalControlProps}
            />
          ) : userRole === 'admin' && allStudents ? (
            <TeacherDashboard
              students={allStudents}
              onToggleUnacademySub={handleToggleUnacademySub}
              onDeleteUser={handleDeleteStudent}
              onBroadcastTask={handleBroadcastTask}
              onClearData={handleClearStudentData}
              onImpersonate={handleImpersonateStudent}
              {...modalControlProps}
            />
          ) : (
            <div className="text-center text-gray-500 py-10">Initializing dashboard...</div>
          )}
        </div>

        {currentTrack && <GlobalMusicVisualizer analyser={analyser} visualizerSettings={visualizerSettings} isPlaying={isPlaying} currentTrack={currentTrack} notchSettings={notchSettings} play={play} pause={pause} nextTrack={nextTrack} prevTrack={prevTrack} />}
        <div className="z-[110] relative">
          <DynamicIsland />
        </div>
        {/* Modals and Overlays */}
        {isFullScreenPlayerOpen && (
          <FullScreenMusicPlayer onClose={toggleFullScreenPlayer} />
        )}

        {currentTrack && !isFullScreenPlayerOpen && (window.innerWidth < 768) && <PersistentMusicPlayer />}

        {/* Modals - All rendered at the App level, managed by modalControlProps */}
        {isExamTypeSelectionModalOpen && <ExamTypeSelectionModal onClose={() => closeModal('ExamTypeSelectionModal')} onSelect={(type) => { handleUpdateConfig({ settings: { ...currentUser?.CONFIG.settings, examType: type } as any }); closeModal('ExamTypeSelectionModal'); }} />}
        {isCreateModalOpen && <CreateEditTaskModal
          onClose={() => closeModal('CreateEditTaskModal')}
          task={editingTask || viewingTask}
          viewOnly={!!viewingTask}
          onSave={handleSaveTask}
          decks={currentUser?.CONFIG.flashcardDecks || []}
          onDelete={handleDeleteTask}
        />}
        {isAiParserModalOpen && <AIParserModal onClose={() => closeModal('AIParserModal')} onDataReady={setDeepLinkAction} onPracticeTestReady={setAiPracticeTest} onOpenGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} examType={currentUser?.CONFIG.settings.examType} />}
        {isPracticeModalOpen && <CustomPracticeModal
          initialTask={practiceTask}
          aiPracticeTest={aiPracticeTest}
          onClose={() => closeModal('CustomPracticeModal')}
          onSessionComplete={async (duration, solved, skipped) => {
            const session: StudySession = {
              date: new Date().toISOString().split('T')[0],
              duration,
              questions_solved: solved,
              questions_skipped: skipped,
            };
            await handleLogStudySession(session);
          }}
          defaultPerQuestionTime={currentUser?.CONFIG.settings.perQuestionTime || 180}
          onLogResult={handleLogResult}
          student={currentUser}
          onUpdateWeaknesses={handleUpdateWeaknesses}
          onSaveTask={handleSaveTask}
        />}
        {isSettingsModalOpen && currentUser && <SettingsModal settings={currentUser.CONFIG.settings} decks={currentUser.CONFIG.flashcardDecks || []} onClose={() => closeModal('SettingsModal')} onSave={(s) => handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, ...s } as any })} onExportToIcs={handleExportToIcs} googleAuthStatus={googleAuthStatus} onGoogleSignIn={handleGoogleSignIn} onGoogleSignOut={handleGoogleSignOut} onBackupToDrive={handleBackupToDrive} onRestoreFromDrive={handleRestoreFromDrive} onApiKeySet={handleApiKeySet} onOpenAssistantGuide={() => openModal('GoogleAssistantGuideModal', setAssistantGuideOpen)} onOpenAiGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} onClearAllSchedule={handleClearAllSchedule} onToggleEditLayout={() => handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, dashboardLayout: currentUser.CONFIG.settings.dashboardLayout || [] } as any })} onTogglePushNotifications={handleTogglePushNotifications} pushNotificationsEnabled={pushNotificationsEnabled} isVapidKeyAvailable={!!(import.meta as any).env.VITE_VAPID_PUBLIC_KEY} />}
        {isEditWeaknessesModalOpen && <EditWeaknessesModal currentWeaknesses={currentUser?.CONFIG.WEAK || []} onClose={() => closeModal('EditWeaknessesModal')} onSave={handleUpdateWeaknesses} />}
        {isLogResultModalOpen && <LogResultModal onClose={() => closeModal('LogResultModal')} onSave={handleLogResult} initialScore={initialScoreForModal} initialMistakes={initialMistakesForModal} />}
        {isEditResultModalOpen && editingResult && <EditResultModal result={editingResult} onClose={() => closeModal('EditResultModal')} onSave={handleLogResult} />}
        {isExamModalOpen && <CreateEditExamModal exam={editingExam} onClose={() => closeModal('CreateEditExamModal')} onSave={(exam) => editingExam ? handleUpdateExam(exam) : handleAddExam(exam)} />}
        {isAiMistakeModalOpen && <AIMistakeAnalysisModal onClose={() => closeModal('AIMistakeAnalysisModal')} onSaveWeakness={handleUpdateWeaknesses} />}
        {isAiDoubtSolverOpen && <AIDoubtSolverModal onClose={() => closeModal('AIDoubtSolverModal')} />}
        {isAiChatOpen && <AIChatPopup history={aiChatHistory} onSendMessage={handleAiChatMessage} onClose={() => closeModal('AIChatPopup')} isLoading={isAiChatLoading} />}
        {viewingReport && <TestReportModal result={viewingReport} onClose={() => closeModal('TestReportModal')} onUpdateWeaknesses={handleUpdateWeaknesses} student={currentUser} onSaveDeck={handleSaveDeck} />}
        {isMoveModalOpen && <MoveTasksModal onClose={() => closeModal('MoveTasksModal')} onConfirm={handleMoveSelectedTasks} selectedCount={selectedTaskIds.length} selectedTaskIds={selectedTaskIds} />}
        {isMusicLibraryOpen && <MusicLibraryModal onClose={() => closeModal('MusicLibraryModal')} />}
        {deepLinkAction && <DeepLinkConfirmationModal data={deepLinkAction.data} onClose={() => closeModal('DeepLinkConfirmationModal')} onConfirm={() => handleBatchImport(deepLinkAction.data)} />}

        {/* Flashcard Modals */}
        {isCreateDeckModalOpen && <CreateEditDeckModal deck={editingDeck} onClose={() => closeModal('CreateEditDeckModal')} onSave={handleSaveDeck} />}
        {isAiFlashcardModalOpen && <AIGenerateFlashcardsModal student={currentUser} onClose={() => closeModal('AIGenerateFlashcardsModal')} onSaveDeck={handleSaveDeck} />}
        {viewingDeck && <DeckViewModal deck={viewingDeck} onClose={() => closeModal('DeckViewModal')} onAddCard={() => openModal('CreateEditFlashcardModal', setCreateCardModalOpen)} onEditCard={(card) => { setEditingCard(card); openModal('CreateEditFlashcardModal', setCreateCardModalOpen); }} onDeleteCard={handleDeleteCard} onStartReview={() => openModal('FlashcardReviewModal', setReviewingDeck, viewingDeck)} />}
        {isCreateCardModalOpen && viewingDeck && <CreateEditFlashcardModal card={editingCard} deckId={viewingDeck.id} onClose={() => closeModal('CreateEditFlashcardModal')} onSave={handleSaveCard} />}
        {reviewingDeck && <FlashcardReviewModal deck={reviewingDeck} onClose={() => closeModal('FlashcardReviewModal')} />}

        {/* Study Material Modal */}
        {viewingFile && <FileViewerModal file={viewingFile} onClose={() => closeModal('FileViewerModal')} />}

        {/* Assistant & AI Guide Modals */}
        {isAssistantGuideOpen && <GoogleAssistantGuideModal onClose={() => closeModal('GoogleAssistantGuideModal')} />}
        {isAiGuideModalOpen && <AIGuideModal onClose={() => closeModal('AIGuideModal')} examType={currentUser?.CONFIG.settings.examType} />}
        {isMessagingModalOpen && messagingStudent && <MessagingModal student={messagingStudent} onClose={() => closeModal('MessagingModal')} isDemoMode={isDemoMode} />}
        {isAnswerKeyUploadModalOpen && <AnswerKeyUploadModal onClose={() => closeModal('AnswerKeyUploadModal')} onGrade={() => { /* Graded in McqTimer, this modal is only for input */ }} />}
        {isProfileModalOpen && <ProfileModal user={currentUser} onClose={() => closeModal('ProfileModal')} />}
        {isSpecificMistakeAnalysisModalOpen && analyzingMistake !== null && <SpecificMistakeAnalysisModal questionNumber={analyzingMistake} onClose={() => closeModal('SpecificMistakeAnalysisModal')} onSaveWeakness={handleUpdateWeaknesses} />}
        {isSearchOpen && <UniversalSearch isOpen={isSearchOpen} onClose={() => closeModal('UniversalSearch')} onNavigate={(tab) => { /* Logic to navigate tabs in StudentDashboard */ }} onAction={() => { /* Logic to perform actions */ }} scheduleItems={currentUser?.SCHEDULE_ITEMS || []} exams={currentUser?.EXAMS || []} decks={currentUser?.CONFIG.flashcardDecks || []} initialQuery={searchInitialQuery || undefined} />}
        {isWidgetSelectorModalOpen && <WidgetSelectorModal currentLayout={currentUser?.CONFIG.settings.dashboardLayout || []} onSaveLayout={(layout) => handleUpdateConfig({ settings: { ...currentUser?.CONFIG.settings, dashboardLayout: layout } as any })} onClose={() => closeModal('WidgetSelectorModal')} />}


      </div>
    );
  };

  return renderMainContent();
};

export default App;
