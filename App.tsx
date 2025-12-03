
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
// Added missing imports
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

interface ModalState {
    id: string; // Unique identifier for the modal component (e.g., 'SettingsModal')
    componentId: string; // Internal ID for history state
}

// New interface to encapsulate all modal control props
interface ModalControlProps {
    openModal: (modalId: string, setter: React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void), initialValue?: any) => void;
    closeModal: (modalId: string) => void;

    // Direct modal state setters and getters passed from App.tsx
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
    isAiFlashcardModalOpen: boolean; setIsAiFlashcardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingDeck: FlashcardDeck | null; setEditingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    viewingDeck: FlashcardDeck | null; setViewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    isCreateCardModalOpen: boolean; setCreateCardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingCard: Flashcard | null; setEditingCard: React.Dispatch<React.SetStateAction<Flashcard | null>>;
    reviewingDeck: FlashcardDeck | null; setReviewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    viewingFile: StudyMaterialItem | null; setViewingFile: React.Dispatch<React.SetStateAction<StudyMaterialItem | null>>;
    isMusicLibraryOpen: boolean; setIsMusicLibraryOpen: (val: boolean) => void; // Use function for toggle
    analyzingMistake: number | null; setAnalyzingMistake: React.Dispatch<React.SetStateAction<number | null>>;
    handleMoveSelected: (taskIds: string[], newDate: string) => void;
    handleSaveDeck: (deck: FlashcardDeck) => void;
    handleDeleteCard: (deckId: string, cardId: string) => void;
    handleSaveCard: (deckId: string, card: Flashcard) => void;
    setDeepLinkAction: React.Dispatch<React.SetStateAction<any>>; // Add this
    isMessagingModalOpen: boolean; setMessagingModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // Add this
    isAnswerKeyUploadModalOpen: boolean; setAnswerKeyUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // Add this
    isProfileModalOpen: boolean; setIsProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // Add this
    isSpecificMistakeAnalysisModalOpen: boolean; setIsSpecificMistakeAnalysisModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // Add this
}


const App: React.FC = () => {
    const { currentUser, userRole, isLoading, isDemoMode, enterDemoMode, logout, refreshUser } = useAuth();
    const { isFullScreenPlayerOpen, currentTrack, toggleLibrary, isLibraryOpen } = useMusicPlayer();
    
    const [allStudents, setAllStudents] = useState<StudentData[]>([]);
    const [allDoubts, set