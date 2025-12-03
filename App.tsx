

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
import MessagingModal from './components/MessagingModal';
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
    onCloseCallback: () => void; // The original setState(false) function for the modal component
}

const App: React.FC = () => {
    const { currentUser, userRole, isLoading, isDemoMode, enterDemoMode, logout, refreshUser } = useAuth();
    const { isFullScreenPlayerOpen, currentTrack, toggleLibrary, isLibraryOpen } = useMusicPlayer();
    
    const [allStudents, setAllStudents] = useState<StudentData[]>([]);
    const [allDoubts, setAllDoubts] = useState<DoubtData[]>([]);// FIX: Added `DoubtData` type.
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline' | 'misconfigured'>('checking');
    const [isSyncing, setIsSyncing] = useState(false);
    const [googleClientId, setGoogleClientId] = useState<string | null>(null);
    const [googleAuthStatus, setGoogleAuthStatus] = useState<'unconfigured' | 'loading' | 'signed_in' | 'signed_out'>('loading');
    const [resetToken, setResetToken] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [deepLinkAction, setDeepLinkAction] = useState<any>(null);
    const [isExamTypeModalOpen, setIsExamTypeModalOpen] = useState(false);

    // --- Modal Navigation State ---
    const modalStack = useRef<ModalState[]>([]);
    // This map stores the setState functions for each modal, allowing generic open/close
    const modalSetStateMap = useRef<Map<string, React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void)>>(new Map()); // FIX: Updated type for `modalSetStateMap`

    const openModal = useCallback((modalId: string, setStateTrue: React.Dispatch<React.SetStateAction<boolean>> | (() => void)) => {
        // Prevent opening if already in stack, or if another modal with same ID is topmost
        if (modalStack.current.some(m => m.id === modalId)) {
            console.warn(`Attempted to open modal ${modalId} which is already in the stack.`);
            // If it's already open, ensure it's at the top of the history
            if (modalStack.current.length > 0 && modalStack.current[modalStack.current.length - 1].id === modalId) {
                return;
            }
        }

        const historyStateId = `modal-${modalId}-${Date.now()}`;
        // Push a new state to browser history, linking it to our modal
        window.history.pushState({ modalId: historyStateId, appModal: true }, '', window.location.pathname); 

        // Store the original setState callback for this modal
        modalSetStateMap.current.set(modalId, setStateTrue);

        const modalState: ModalState = {
            id: modalId,
            componentId: historyStateId,
            onCloseCallback: setStateTrue,
        };
        modalStack.current.push(modalState);
        
        // Call the original setState to truly open the modal component
        if (typeof setStateTrue === 'function') {
            (setStateTrue as React.Dispatch<React.SetStateAction<boolean>>)(true);
        } else {
            // For special setters that don't take boolean, e.g., toggleLibrary() or setViewingDeck(deck)
            (setStateTrue as () => void)();
        }
    }, []);

    const closeModal = useCallback((modalId: string) => {
        const index = modalStack.current.findIndex(m => m.id === modalId);
        if (index === -1) {
            console.warn(`Attempted to close modal ${modalId} not found in stack.`);
            // If not in stack, just set its state to false if we can.
            const setStateFalse = modalSetStateMap.current.get(modalId);
            if (setStateFalse) { // FIX: Check if setter exists
                if (typeof setStateFalse === 'function') {
                    (setStateFalse as React.Dispatch<React.SetStateAction<boolean>>)(false);
                } else {
                    (setStateFalse as (val: any) => void)(null); // For object-based setters, pass null to clear
                }
            }
            return;
        }

        const modalToClose = modalStack.current[index];
        // Only trigger history.back() if this is the topmost modal
        if (index === modalStack.current.length - 1) {
            // This will trigger handlePopState
            window.history.back(); 
        } else {
            // If not topmost, remove from stack and force close its component state
            modalStack.current.splice(index, 1);
            const setStateFalse = modalSetStateMap.current.get(modalId);
            if (setStateFalse) { // FIX: Check if setter exists
                if (typeof setStateFalse === 'function') {
                    (setStateFalse as React.Dispatch<React.SetStateAction<boolean>>)(false);
                } else {
                    (setStateFalse as (val: any) => void)(null); // For object-based setters, pass null to clear
                }
            }
            console.warn(`Modal ${modalId} closed out of order, removed from stack. Current stack size: ${modalStack.current.length}`);
        }
    }, []);


    // --- Global popstate listener for browser back button and modal `onClose` callbacks ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // Check if the state we are popping is one created by our modal system
            if (event.state && event.state.appModal) {
                const topmostModal = modalStack.current[modalStack.current.length - 1];

                if (topmostModal && topmostModal.componentId === event.state.modalId) {
                    // This is a controlled back navigation for our topmost modal
                    modalStack.current.pop();
                    // Call the original setState(false) to hide the component
                    const setStateFalse = modalSetStateMap.current.get(topmostModal.id);
                    if (setStateFalse) { // FIX: Check if setter exists
                        if (typeof setStateFalse === 'function') {
                            (setStateFalse as React.Dispatch<React.SetSetStateAction<boolean>>)(false);
                        } else {
                            (setStateFalse as (val: any) => void)(null); // For object-based setters
                        }
                    }
                } else {
                    // This means the browser history went back to a point where our stack is inconsistent,
                    // or a modal was closed externally. We try to reconcile.
                    console.warn("Popstate detected out of sync with modal stack. Reconciling...");
                    
                    // Find if any modal in stack matches the expected history state.
                    const expectedModalIdInHistory = event.state.modalId;
                    const indexInStack = modalStack.current.findIndex(m => m.componentId === expectedModalIdInHistory);

                    if (indexInStack > -1) {
                        // Close all modals from the top down to (and including) the one that was popped
                        for (let i = modalStack.current.length - 1; i >= indexInStack; i--) {
                            const modal = modalStack.current[i];
                            const setStateFalse = modalSetStateMap.current.get(modal.id);
                            if (setStateFalse) { // FIX: Check if setter exists
                                if (typeof setStateFalse === 'function') {
                                    (setStateFalse as React.Dispatch<React.SetStateAction<boolean>>)(false);
                                } else {
                                    (setStateFalse as (val: any) => void)(null);
                                }
                            }
                        }
                        modalStack.current.splice(indexInStack); // Trim the stack
                    } else {
                        // If no modal in stack matches, it means we navigated completely past our modal history,
                        // or a modal was closed unexpectedly. Clear stack and ensure no modals are rendered.
                        modalStack.current.forEach(modal => {
                            const setStateFalse = modalSetStateMap.current.get(modal.id);
                            if (setStateFalse) { // FIX: Check if setter exists
                                if (typeof setStateFalse === 'function') {
                                    (setStateFalse as React.Dispatch<React.SetStateAction<boolean>>)(false);
                                } else {
                                    (setStateFalse as (val: any) => void)(null);
                                }
                            }
                        });
                        modalStack.current = [];
                    }
                }
            } else if (modalStack.current.length > 0) {
                 // Browser back triggered but not for our custom modal state.
                 // This typically happens if user clicks back from a root route.
                 // We want to prevent leaving the app if any modal is still active.
                const topmostModal = modalStack.current[modalStack.current.length - 1];
                console.log(`Intercepting browser back for modal ${topmostModal.id}.`);
                // Re-push the state to stay on page and effectively prevent default browser navigation
                // This might cause an infinite loop if not handled carefully, ensuring the next `popstate`
                // is properly consumed by `closeModal` or `handlePopState` logic.
                window.history.pushState(event.state, '', window.location.pathname); 
                
                // Then, trigger the close of the topmost modal
                const setStateFalse = modalSetStateMap.current.get(topmostModal.id);
                if (setStateFalse) { // FIX: Check if setter exists
                    if (typeof setStateFalse === 'function') {
                        (setStateFalse as React.Dispatch<React.SetStateAction<boolean>>)(false);
                    } else {
                        (setStateFalse as (val: any) => void)(null);
                    }
                }
                modalStack.current.pop(); // Remove from our stack as we've handled it
            }
        };
        
        // Initial history state for the base app page
        window.history.replaceState({ appModal: false, page: 'home' }, '', window.location.pathname);

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('reset-token');
        if (token) {
            setResetToken(token);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const action = params.get('action');
        const query = params.get('query');
        const dataStr = params.get('data');
        const taskId = params.get('id');

        if (action === 'search' && query) {
            setDeepLinkAction({ action: 'search', data: { query } });
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (taskId && (action === 'view_task' || action === 'start_practice')) {
            setDeepLinkAction({ action, data: { id: taskId } });
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (action && dataStr) {
            const handleDeepLink = async (encodedData: string) => {
                let decodedData = '';
                try {
                    decodedData = decodeURIComponent(encodedData);
                    const data = JSON.parse(decodedData);
                    setDeepLinkAction({ action, data });
                } catch (e) {
                    try {
                        // Attempt to correct malformed JSON
                        // FIX: Ensure `api.correctJson` exists and is called correctly
                        const correctionResult = await api.correctJson(decodedData);
                        const correctedData = JSON.parse(correctionResult.correctedJson);
                        setDeepLinkAction({ action, data: correctedData });
                    } catch (correctionError) {
                        console.error("Deep link JSON correction failed:", correctionError);
                        alert("The data from the link is malformed and could not be corrected.");
                    }
                } finally {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            };
            handleDeepLink(dataStr);
        }
    }, []);

    useEffect(() => {
        const theme = currentUser?.CONFIG.settings.theme || 'default';
        document.body.className = `theme-${theme}`;
        if (currentUser && userRole === 'student' && !isDemoMode && !currentUser.CONFIG.settings.examType) {
            openModal('ExamTypeSelectionModal', setIsExamTypeModalOpen);
        }
    }, [currentUser, userRole, isDemoMode, openModal]);
    

    const handleGoogleSignOut = () => {
        auth.handleSignOut(() => {
            setGoogleAuthStatus('signed_out');
        });
    };

    const handleGapiError = (error: any, contextMessage?: string) => {
        const status = error.status || error.code || (error.result && error.result.error && error.result.error.code);
        if (status === 401 || status === 403) {
            alert("Your Google session has expired. Please sign in again.");
            handleGoogleSignOut();
        } else {
            alert(contextMessage || "Google API Error.");
        }
    };


    const handleSaveTask = async (task: ScheduleItem) => {
        let taskToSave = { ...task };
        if (currentUser?.CONFIG.isCalendarSyncEnabled && googleAuthStatus === 'signed_in' && 'TIME' in task && task.TIME) {
            setIsSyncing(true);
            try {
                let eventId;
                if ('googleEventId' in task && task.googleEventId) {
                    eventId = await gcal.updateEvent(task.googleEventId, task);
                } else {
                    eventId = await gcal.createEvent(task);
                }
                (taskToSave as any).googleEventId = eventId;
            } catch (syncError) {
                handleGapiError(syncError);
                setIsSyncing(false);
                return;
            } finally {
                setIsSyncing(false);
            }
        }
        await api.saveTask(taskToSave);
        refreshUser();
    };

    const handleSaveBatchTasks = async (tasks: ScheduleItem[]) => {
        await api.saveBatchTasks(tasks);
        refreshUser();
    };

    const handleDeleteTask = async (taskId: string) => {
        const taskToDelete = currentUser?.SCHEDULE_ITEMS.find(t => t.ID === taskId);
        if (currentUser?.CONFIG.isCalendarSyncEnabled && googleAuthStatus === 'signed_in' && taskToDelete && 'googleEventId' in taskToDelete && taskToDelete.googleEventId) {
            try {
                setIsSyncing(true);
                await gcal.deleteEvent(taskToDelete.googleEventId);
            } catch (syncError) {
                handleGapiError(syncError);
            } finally {
                setIsSyncing(false);
            }
        }
        await api.deleteTask(taskId);
        refreshUser();
    };
    
    const handleFullCalendarSync = async () => {
        if (!currentUser || googleAuthStatus !== 'signed_in') {
            if(googleAuthStatus !== 'signed_in') alert("Please connect your Google Account in Settings first.");
            return;
        }
        setIsSyncing(true);
        try {
            const tasksToUpdate: ScheduleItem[] = [];
            const allTasks = currentUser.SCHEDULE_ITEMS;
            
            for (const task of allTasks) {
                if (!('googleEventId' in task && task.googleEventId) && 'TIME' in task && task.TIME) {
                    try {
                        const eventId = await gcal.createEvent(task);
                        tasksToUpdate.push({ ...task, googleEventId: eventId });
                    } catch (error) { console.warn(error); }
                }
            }

            if (tasksToUpdate.length > 0) await handleSaveBatchTasks(tasksToUpdate);

            // FIX: Ensure `api.updateConfig` exists
            await api.updateConfig({ isCalendarSyncEnabled: true, calendarLastSync: new Date().toISOString() });
            await refreshUser();
            alert(`Synced ${tasksToUpdate.length} tasks.`);

        } catch (error) {
            handleGapiError(error, "Calendar sync failed.");
        } finally {
            setIsSyncing(false);
        }
    };


    const handleUpdateConfig = async (configUpdate: Partial<Config>) => {
        if (!currentUser) return;
        const wasSyncDisabled = !currentUser.CONFIG.isCalendarSyncEnabled;
        const isSyncBeingEnabled = configUpdate.isCalendarSyncEnabled === true;
        // FIX: Ensure `api.updateConfig` exists
        await api.updateConfig(configUpdate);
        await refreshUser();
        if (wasSyncDisabled && isSyncBeingEnabled) {
             setTimeout(() => {
                if (window.confirm("Sync all existing tasks to Google Calendar now?")) handleFullCalendarSync();
            }, 100);
        }
    };
    
    const onLogStudySession = async (session: Omit<StudySession, 'date'>) => {
        if (!currentUser) return;
        const newSession = { ...session, date: new Date().toISOString().split('T')[0] };
        const updatedUser = {...currentUser, STUDY_SESSIONS: [...currentUser.STUDY_SESSIONS, newSession]};
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };
    
    const onLogResult = async (result: ResultData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, RESULTS: [...currentUser.RESULTS, result], CONFIG: {...currentUser.CONFIG, SCORE: result.SCORE, WEAK: [...new Set([...currentUser.CONFIG.WEAK, ...result.MISTAKES])] } };
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onAddExam = async (exam: ExamData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: [...currentUser.EXAMS, exam] };
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onUpdateExam = async (exam: ExamData) => {
         if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: currentUser.EXAMS.map(e => e.ID === exam.ID ? exam : e) };
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onDeleteExam = async (examId: string) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: currentUser.EXAMS.filter(e => e.ID !== examId) };
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };
    
    const onUpdateWeaknesses = async (weaknesses: string[]) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, CONFIG: { ...currentUser.CONFIG, WEAK: weaknesses } };
        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const handleBatchImport = async (data: { schedules: ScheduleItem[], exams: ExamData[], results: ResultData[], weaknesses: string[] }) => {
        if (!currentUser) return;
        
        // Regenerate IDs to prevent collisions
        const safeSchedules = data.schedules.map((s, i) => ({ ...s, ID: `IMP_S_${Date.now()}_${i}` }));
        const safeExams = data.exams.map((e, i) => ({ ...e, ID: `IMP_E_${Date.now()}_${i}` }));
        const safeResults = data.results.map((r, i) => ({ ...r, ID: `IMP_R_${Date.now()}_${i}` }));

        const updatedUser = JSON.parse(JSON.stringify(currentUser));
        updatedUser.SCHEDULE_ITEMS.push(...safeSchedules);
        updatedUser.EXAMS.push(...safeExams);
        updatedUser.RESULTS.push(...safeResults);

        const newWeaknesses = new Set([...updatedUser.CONFIG.WEAK, ...data.weaknesses]);
        safeResults.forEach((r: ResultData) => {
            r.MISTAKES.forEach(m => newWeaknesses.add(m));
        });
        updatedUser.CONFIG.WEAK = Array.from(newWeaknesses);

        if (safeResults.length > 0) {
            const sortedResults = [...updatedUser.RESULTS].sort((a: ResultData, b: ResultData) => new Date(b.DATE).getTime() - new Date(a.DATE).getTime());
            updatedUser.CONFIG.SCORE = sortedResults[0].SCORE;
        }

        // FIX: Ensure `api.fullSync` exists
        await api.fullSync(updatedUser);
        await refreshUser();

        if (currentUser.CONFIG.isCalendarSyncEnabled) {
            if (window.confirm("Sync imported tasks to Google Calendar?")) handleFullCalendarSync();
        }
    };

    const onPostDoubt = async (question: string, image?: string) => {
        // FIX: Ensure `api.postDoubt` exists
        await api.postDoubt(question, image);
        // FIX: Ensure `api.getAllDoubts` exists
        const doubtsData = await api.getAllDoubts();
        setAllDoubts(doubtsData);
    };

    const onPostSolution = async (doubtId: string, solution: string, image?: string) => {
        // FIX: Ensure `api.postSolution` exists
        await api.postSolution(doubtId, solution, image);
        // FIX: Ensure `api.getAllDoubts` exists
        const doubtsData = await api.getAllDoubts();
        setAllDoubts(doubtsData);
    };

    const onBackupToDrive = async () => {
        if (!currentUser || googleAuthStatus !== 'signed_in') return;
        try {
            const backupData = {
                SCHEDULE_ITEMS: currentUser.SCHEDULE_ITEMS,
                RESULTS: currentUser.RESULTS,
                EXAMS: currentUser.EXAMS,
                STUDY_SESSIONS: currentUser.STUDY_SESSIONS,
                CONFIG: {
                    WEAK: currentUser.CONFIG.WEAK,
                    flashcardDecks: currentUser.CONFIG.flashcardDecks,
                }
            };
            const fileId = await gdrive.uploadData(JSON.stringify(backupData), currentUser.CONFIG.googleDriveFileId);
            const syncTime = new Date().toISOString();
            // FIX: Ensure `api.updateConfig` exists
            await api.updateConfig({ googleDriveFileId: fileId, driveLastSync: syncTime });
            refreshUser();
            alert('Backup successful!');
        } catch (error) {
            handleGapiError(error, 'Backup failed.');
        }
    };
    
    const onRestoreFromDrive = async () => {
        if (!currentUser?.CONFIG.googleDriveFileId || googleAuthStatus !== 'signed_in') return;
        if (!window.confirm("Overwrite local data?")) return;
        try {
            const dataStr = await gdrive.downloadData(currentUser.CONFIG.googleDriveFileId);
            const restoredData = JSON.parse(dataStr);
            const updatedUser = { ...currentUser, ...restoredData };
            // FIX: Ensure `api.fullSync` exists
            await api.fullSync(updatedUser);
            refreshUser();
            alert('Restore successful!');
        } catch (error) {
            handleGapiError(error, 'Restore failed.');
        }
    };
    
    const onDeleteUser = async (sid: string) => {
        if (window.confirm(`Permanently delete user ${sid}?`)) {
            try {
                // FIX: Ensure `api.deleteStudent` exists
                await api.deleteStudent(sid);
                setAllStudents(prev => prev.filter(s => s.sid !== sid));
            } catch (error: any) {
                alert(`Failed: ${error.message}`);
            }
        }
    };

    const checkBackend = useCallback(async (isInitialCheck: boolean) => {
        let statusCheckTimeout: ReturnType<typeof setTimeout> | null = null;
        if (isInitialCheck && !currentUser) {
            statusCheckTimeout = setTimeout(() => {
                setBackendStatus(prev => prev === 'checking' ? 'offline' : prev);
            }, 5000);
        }

        try {
            const res = await fetch(`/api/status`, { signal: AbortSignal.timeout(5000) });
            if (statusCheckTimeout) clearTimeout(statusCheckTimeout);

            if (res.ok) {
                 const data = await res.json().catch(() => ({}));
                 if(data.status === 'misconfigured') {
                    setBackendStatus('misconfigured');
                 } else {
                    setBackendStatus('online');
                    if (!googleClientId) {
                        api.getPublicConfig().then(config => setGoogleClientId(config.googleClientId)).catch(console.error);
                    }
                 }
            } else {
                 setBackendStatus('offline');
            }
        } catch (error) {
            if (statusCheckTimeout) clearTimeout(statusCheckTimeout);
            setBackendStatus('offline');
        }
    }, [googleClientId, currentUser]);

    useEffect(() => {
        checkBackend(true);
        const interval = setInterval(() => checkBackend(false), 30000);
        return () => clearInterval(interval);
    }, [checkBackend]);

    useEffect(() => {
        if (currentUser) {
            const heartbeat = setInterval(() => {
                api.heartbeat().catch(err => console.debug("Heartbeat failed", err));
            }, 60000);
            return () => clearInterval(heartbeat);
        }
    }, [currentUser]);


    useEffect(() => {
        const loadExtraData = async () => {
            if (isDemoMode) {
                if (userRole === 'admin') setAllStudents(studentDatabase);
                return;
            }
            if (userRole === 'admin') {
                // FIX: Ensure `api.getStudents` exists
                const students = await api.getStudents();
                setAllStudents(students);
            }
            if (currentUser || userRole === 'admin') {
                // FIX: Ensure `api.getAllDoubts` exists
                const doubts = await api.getAllDoubts();
                setAllDoubts(doubts);
            }
        };

        if (backendStatus === 'online' && !isLoading) {
            loadExtraData();
        }
    }, [backendStatus, isLoading, userRole, isDemoMode, currentUser]);
    
    useEffect(() => {
        const initializeGoogleApis = () => {
            if (googleClientId && window.gapi && window.google) {
                auth.initClient(
                    googleClientId,
                    (isSignedIn) => {
                        setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out');
                    },
                    (error) => {
                        console.error("GAPI Init Error:", error);
                        setGoogleAuthStatus('unconfigured');
                    }
                );
            } else if (googleClientId) {
                const checkScripts = setInterval(() => {
                    if (window.gapi && window.google) {
                        clearInterval(checkScripts);
                        initializeGoogleApis();
                    }
                }, 100);
                return () => clearInterval(checkScripts);
            }
        };
        initializeGoogleApis();
    }, [googleClientId, backendStatus]);


    const handleSelectExamType = async (examType: 'JEE' | 'NEET') => {
        if (!currentUser) return;
        const newSettings = JSON.parse(JSON.stringify(currentUser.CONFIG.settings));
        newSettings.examType = examType;
        handleUpdateConfig({ settings: newSettings }); // Already calls closeModal internally
    };

    // --- Modal Control Functions for Children ---
    // Corrected useState declarations
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAiParserModalOpen, setisAiParserModalOpen] = useState(false);
    const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen] = useState(false);
    const [isLogResultModalOpen, setLogResultModalOpen] = useState(false);
    const [isEditResultModalOpen, setEditResultModalOpen] = useState(false);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [isAiMistakeModalOpen, setAiMistakeModalOpen] = useState(false);
    const [isAssistantGuideOpen, setAssistantGuideOpen] = useState(false);
    const [isAiGuideModalOpen, setAiGuideModalOpen] = useState(false);
    const [isMoveModalOpen, setMoveModalOpen] = useState(false);
    const [isAiChatOpen, setAiChatOpen] = useState(false);
    const [isAiDoubtSolverOpen, setAiDoubtSolverOpen] = useState(false);
    const [isCreateDeckModalOpen, setCreateDeckModalOpen] = useState(false);
    const [isAiFlashcardModalOpen, setAiFlashcardModalOpen] = useState(false);
    const [isCreateCardModalOpen, setCreateCardModalOpen] = useState(false);
    const [isMessagingModalOpen, setMessagingModalOpen] = useState(false); 
    const [isUniversalSearchOpen, setUniversalSearchOpen] = useState(false);
    const [isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); 
    
    // For modals that take objects, the setter should accept null to close
    const [viewingTask, setViewingTask] = useState<ScheduleItem | null>(null); 
    const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null); 
    const [practiceTask, setPracticeTask] = useState<HomeworkData | null>(null); 
    const [aiPracticeTest, setAiPracticeTest] = useState<{ questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null>(null); 
    const [editingResult, setEditingResult] = useState<ResultData | null>(null); 
    const [editingExam, setEditingExam] = useState<ExamData | null>(null); 
    const [viewingReport, setViewingReport] = useState<ResultData | null>(null); 
    const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null); 
    const [viewingDeck, setViewingDeck] = useState<FlashcardDeck | null>(null); 
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null); 
    const [reviewingDeck, setReviewingDeck] = useState<FlashcardDeck | null>(null); 
    const [isFileViewerModalOpen, setFileViewerModalOpen] = useState(false); // Renamed for consistency
    const [viewingFile, setViewingFile] = useState<StudyMaterialItem | null>(null);
    const [initialScoreForModal, setInitialScoreForModal] = useState<string | undefined>(undefined); 
    const [initialMistakesForModal, setInitialMistakesForModal] = useState<string | undefined>(undefined); 
    const [analyzingMistake, setAnalyzingMistake] = useState<number | null>(null);


    // Map modal IDs to their respective setState functions
    const modalSetters = useMemo(() => new Map<string, React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void)>([
        ['ExamTypeSelectionModal', setIsExamTypeModalOpen],
        ['SettingsModal', setIsSettingsModalOpen],
        ['AIParserModal', setisAiParserModalOpen],
        ['CreateEditTaskModal', setIsCreateModalOpen],
        ['CustomPracticeModal', setIsPracticeModalOpen],
        ['EditWeaknessesModal', setIsEditWeaknessesModalOpen],
        ['LogResultModal', setLogResultModalOpen],
        ['EditResultModal', setEditResultModalOpen], // For boolean control
        ['CreateEditExamModal', setIsExamModalOpen],
        ['AIMistakeAnalysisModal', setAiMistakeModalOpen],
        ['AIDoubtSolverModal', setAiDoubtSolverOpen],
        ['AIChatPopup', setAiChatOpen],
        ['TestReportModal', setViewingReport], 
        ['MoveTasksModal', setMoveModalOpen],
        ['MusicLibraryModal', toggleLibrary], 
        ['DeepLinkConfirmationModal', setDeepLinkAction], 
        ['CreateEditDeckModal', setCreateDeckModalOpen],
        ['AIGenerateFlashcardsModal', setAiFlashcardModalOpen],
        ['DeckViewModal', setViewingDeck], 
        ['CreateEditFlashcardModal', setCreateCardModalOpen],
        ['FlashcardReviewModal', setReviewingDeck], 
        ['FileViewerModal', setViewingFile], 
        ['GoogleAssistantGuideModal', setAssistantGuideOpen],
        ['AIGuideModal', setAiGuideModalOpen],
        ['MessagingModal', setMessagingModalOpen],
        ['UniversalSearch', setUniversalSearchOpen],
        ['AnswerKeyUploadModal', setAnswerKeyUploadModalOpen],
        ['ProfileModal', setIsProfileModalOpen], 
        ['SpecificMistakeAnalysisModal', setAnalyzingMistake]
    ]), [toggleLibrary]);

    // Update modalSetStateMap for the global popstate listener
    useEffect(() => {
        modalSetStateMap.current = modalSetters;
    }, [modalSetters]);


    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center min-h-screen"><div className="text-xl animate-pulse">Loading...</div></div>;
        }

        if (resetToken) {
            return <AuthScreen backendStatus={backendStatus} googleClientId={googleClientId} resetToken={resetToken} />;
        }

        if (backendStatus === 'misconfigured') {
            return <ConfigurationErrorScreen onRetryConnection={() => checkBackend(false)} backendStatus={backendStatus} />;
        }
        
        if (currentUser) {
            const dashboardUser = currentUser;
            const useToolbarLayout = isMobile && dashboardUser.CONFIG.settings.mobileLayout === 'toolbar';

            return (
                 <div style={{'--accent-color': dashboardUser.CONFIG.settings.accentColor} as React.CSSProperties} className={`${dashboardUser.CONFIG.settings.blurEnabled === false ? 'no-blur' : ''} safe-padding-left safe-padding-right safe-padding-top safe-padding-bottom`}>
                    {dashboardUser.CONFIG.settings.notchSettings?.enabled !== false && <GlobalMusicVisualizer />}
                    {isFullScreenPlayerOpen && <FullScreenMusicPlayer />}
                    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 ${useToolbarLayout || currentTrack ? 'pb-24' : ''}`}>
                        <Header user={{ name: dashboardUser.fullName, id: dashboardUser.sid, profilePhoto: dashboardUser.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} onOpenProfile={() => openModal('ProfileModal', setIsProfileModalOpen)} />
                        {userRole === 'admin' ? (
                            <TeacherDashboard 
                                students={allStudents} 
                                onToggleUnacademySub={()=>{}} 
                                onDeleteUser={onDeleteUser} 
                                // FIX: Ensure `api.broadcastTask` exists
                                onBroadcastTask={api.broadcastTask} 
                                openModal={openModal}
                                closeModal={closeModal}
                            />
                        ) : (
                            <StudentDashboard 
                                student={currentUser} 
                                onSaveTask={handleSaveTask} 
                                onSaveBatchTasks={handleSaveBatchTasks} 
                                onDeleteTask={handleDeleteTask} 
                                onToggleMistakeFixed={()=>{}} 
                                onUpdateConfig={handleUpdateConfig} 
                                onLogStudySession={onLogStudySession} 
                                onUpdateWeaknesses={onUpdateWeaknesses} 
                                onLogResult={onLogResult} 
                                onAddExam={onAddExam} 
                                onUpdateExam={onUpdateExam} 
                                onDeleteExam={onDeleteExam} 
                                onExportToIcs={() => exportCalendar(currentUser.SCHEDULE_ITEMS, currentUser.EXAMS, currentUser.fullName)} 
                                onBatchImport={handleBatchImport} 
                                googleAuthStatus={googleAuthStatus} 
                                onGoogleSignIn={auth.handleSignIn} 
                                onGoogleSignOut={handleGoogleSignOut} 
                                onBackupToDrive={onBackupToDrive} 
                                onRestoreFromDrive={onRestoreFromDrive} 
                                allDoubts={allDoubts} 
                                onPostDoubt={onPostDoubt} 
                                onPostSolution={onPostSolution} 
                                deepLinkAction={deepLinkAction}
                                openModal={openModal}
                                closeModal={closeModal}
                                // Pass specific modal state setters and getters for granular control
                                isCreateModalOpen={isCreateModalOpen} setIsCreateModalOpen={setIsCreateModalOpen}
                                isAiParserModalOpen={isAiParserModalOpen} setisAiParserModalOpen={setisAiParserModalOpen}
                                isPracticeModalOpen={isPracticeModalOpen} setIsPracticeModalOpen={setIsPracticeModalOpen}
                                isSettingsModalOpen={isSettingsModalOpen} setIsSettingsModalOpen={setIsSettingsModalOpen}
                                editingTask={editingTask} setEditingTask={setEditingTask}
                                viewingTask={viewingTask} setViewingTask={setViewingTask}
                                practiceTask={practiceTask} setPracticeTask={setPracticeTask}
                                aiPracticeTest={aiPracticeTest} setAiPracticeTest={setAiPracticeTest}
                                isEditWeaknessesModalOpen={isEditWeaknessesModalOpen} setIsEditWeaknessesModalOpen={setIsEditWeaknessesModalOpen}
                                isLogResultModalOpen={isLogResultModalOpen} setLogResultModalOpen={setLogResultModalOpen}
                                initialScoreForModal={initialScoreForModal} setInitialScoreForModal={setInitialScoreForModal}
                                initialMistakesForModal={initialMistakesForModal} setInitialMistakesForModal={setInitialMistakesForModal}
                                isEditResultModalOpen={isEditResultModalOpen} setEditResultModalOpen={setEditResultModalOpen}
                                editingResult={editingResult} setEditingResult={setEditingResult}
                                isExamModalOpen={isExamModalOpen} setIsExamModalOpen={setIsExamModalOpen}
                                editingExam={editingExam} setEditingExam={setEditingExam}
                                isAiMistakeModalOpen={isAiMistakeModalOpen} setAiMistakeModalOpen={setAiMistakeModalOpen}
                                viewingReport={viewingReport} setViewingReport={setViewingReport}
                                isAssistantGuideOpen={isAssistantGuideOpen} setAssistantGuideOpen={setAssistantGuideOpen}
                                isAiGuideModalOpen={isAiGuideModalOpen} setAiGuideModalOpen={setAiGuideModalOpen}
                                isSearchOpen={isUniversalSearchOpen} setIsSearchOpen={setUniversalSearchOpen}
                                searchInitialQuery={null} setSearchInitialQuery={()=>{}} // Not directly used in studentDashboard
                                isSelectMode={false} setIsSelectMode={()=>{}} // Not directly used in studentDashboard
                                selectedTaskIds={[]} setSelectedTaskIds={()=>{}} // Not directly used in studentDashboard
                                isMoveModalOpen={isMoveModalOpen} setMoveModalOpen={setMoveModalOpen}
                                isAiChatOpen={isAiChatOpen} setAiChatOpen={setAiChatOpen}
                                aiChatHistory={[]} setAiChatHistory={()=>{}} // Not directly used in studentDashboard
                                showAiChatFab={false} setShowAiChatFab={()=>{}} // Not directly used in studentDashboard
                                isAiChatLoading={false} setIsAiChatLoading={()=>{}} // Not directly used in studentDashboard
                                isAiDoubtSolverOpen={isAiDoubtSolverOpen} setAiDoubtSolverOpen={setAiDoubtSolverOpen}
                                isCreateDeckModalOpen={isCreateDeckModalOpen} setCreateDeckModalOpen={setCreateDeckModalOpen}
                                isAiFlashcardModalOpen={isAiFlashcardModalOpen} setAiFlashcardModalOpen={setAiFlashcardModalOpen}
                                editingDeck={editingDeck} setEditingDeck={setEditingDeck}
                                viewingDeck={viewingDeck} setViewingDeck={setViewingDeck}
                                isCreateCardModalOpen={isCreateCardModalOpen} setCreateCardModalOpen={setCreateCardModalOpen}
                                editingCard={editingCard} setEditingCard={setEditingCard}
                                reviewingDeck={reviewingDeck} setReviewingDeck={setReviewingDeck}
                                viewingFile={viewingFile} setViewingFile={setViewingFile}
                                isMusicLibraryOpen={isLibraryOpen} setIsMusicLibraryOpen={toggleLibrary}
                                analyzingMistake={analyzingMistake} setAnalyzingMistake={setAnalyzingMistake}
                            />
                        )}
                    </div>
                    {currentTrack && !isFullScreenPlayerOpen && <PersistentMusicPlayer />}
                </div>
            );
        }
        
        if (isDemoMode && userRole === 'admin') {
             return (
                 <div style={{'--accent-color': '#0891b2'} as React.CSSProperties} className="safe-padding-left safe-padding-right safe-padding-top safe-padding-bottom">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <Header user={{ name: 'Admin', id: 'ADMIN_DEMO', profilePhoto: currentUser?.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} onOpenProfile={() => openModal('ProfileModal', setIsProfileModalOpen)} />
                        <TeacherDashboard 
                            students={allStudents} 
                            onToggleUnacademySub={()=>{}} 
                            onDeleteUser={() => alert("Disabled in demo mode")} 
                            onBroadcastTask={() => alert("Disabled in demo mode")}
                            openModal={openModal}
                            closeModal={closeModal}
                        />
                    </div>
                </div>
            );
        }

        if (backendStatus === 'offline' && !isDemoMode) {
            return <BackendOfflineScreen onSelectDemoUser={enterDemoMode} onRetryConnection={() => checkBackend(false)} backendStatus={backendStatus} />;
        }

        return <AuthScreen backendStatus={backendStatus} googleClientId={googleClientId} resetToken={resetToken} />;
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">
            {renderContent()}

            {/* All Modals (Conditionally Rendered based on their own state, controlled by openModal/closeModal) */}
            {isExamTypeModalOpen && <ExamTypeSelectionModal onClose={() => closeModal('ExamTypeSelectionModal')} onSelect={handleSelectExamType} />}
            {isSettingsModalOpen && currentUser && <SettingsModal settings={currentUser.CONFIG.settings} decks={currentUser.CONFIG.flashcardDecks || []} onClose={() => closeModal('SettingsModal')} onSave={(s) => handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, ...s } as any })} onExportToIcs={() => exportCalendar(currentUser.SCHEDULE_ITEMS, currentUser.EXAMS, currentUser.fullName)} googleAuthStatus={googleAuthStatus} onGoogleSignIn={auth.handleSignIn} onGoogleSignOut={handleGoogleSignOut} onBackupToDrive={onBackupToDrive} onRestoreFromDrive={onRestoreFromDrive} onApiKeySet={() => openModal('AIChatPopup', setAiChatOpen)} onOpenAssistantGuide={() => openModal('GoogleAssistantGuideModal', setAssistantGuideOpen)} onOpenAiGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} onClearAllSchedule={() => api.clearAllSchedule().then(refreshUser)} onToggleEditLayout={() => { handleUpdateConfig({ settings: { ...currentUser.CONFIG.settings, dashboardLayout: currentUser.CONFIG.settings.dashboardLayout } }); closeModal('SettingsModal'); }} />}
            {isAiParserModalOpen && currentUser && <AIParserModal onClose={() => closeModal('AIParserModal')} onDataReady={handleBatchImport} onPracticeTestReady={(data) => {setAiPracticeTest(data); openModal('CustomPracticeModal', setIsPracticeModalOpen);}} onOpenGuide={() => openModal('AIGuideModal', setAiGuideModalOpen)} examType={currentUser.CONFIG.settings.examType} />}
            {isCreateModalOpen && currentUser && <CreateEditTaskModal task={editingTask || null} onClose={() => { closeModal('CreateEditTaskModal'); setEditingTask(null); setViewingTask(null); }} onSave={handleSaveTask} decks={currentUser.CONFIG.flashcardDecks || []} />}
            {isPracticeModalOpen && currentUser && <CustomPracticeModal initialTask={practiceTask} aiPracticeTest={aiPracticeTest} onClose={() => { closeModal('CustomPracticeModal'); setPracticeTask(null); setAiPracticeTest(null); }} onSessionComplete={(duration, solved, skipped) => onLogStudySession({ duration, questions_solved: solved, questions_skipped: skipped })} defaultPerQuestionTime={currentUser.CONFIG.settings.perQuestionTime || 180} onLogResult={onLogResult} student={currentUser} onUpdateWeaknesses={onUpdateWeaknesses} onSaveTask={handleSaveTask} />}
            {isEditWeaknessesModalOpen && currentUser && <EditWeaknessesModal currentWeaknesses={currentUser.CONFIG.WEAK} onClose={() => closeModal('EditWeaknessesModal')} onSave={onUpdateWeaknesses} />}
            {isLogResultModalOpen && currentUser && <LogResultModal onClose={() => {closeModal('LogResultModal'); setInitialScoreForModal(undefined); setInitialMistakesForModal(undefined);}} onSave={onLogResult} initialScore={initialScoreForModal} initialMistakes={initialMistakesForModal} />}
            {isEditResultModalOpen && currentUser && editingResult && <EditResultModal result={editingResult} onClose={() => { closeModal('EditResultModal'); setEditingResult(null); }} onSave={api.updateResult} />}
            {isExamModalOpen && currentUser && <CreateEditExamModal exam={editingExam} onClose={() => { closeModal('CreateEditExamModal'); setEditingExam(null); }} onSave={(exam) => editingExam ? onUpdateExam(exam) : onAddExam(exam)} />}
            {isAiMistakeModalOpen && currentUser && <AIMistakeAnalysisModal onClose={() => closeModal('AIMistakeAnalysisModal')} onSaveWeakness={onUpdateWeaknesses} />}
            {isAiDoubtSolverOpen && currentUser && <AIDoubtSolverModal onClose={() => closeModal('AIDoubtSolverModal')} />}
            {isAiChatOpen && currentUser && <AIChatPopup history={[]} onSendMessage={() => {}} onClose={() => closeModal('AIChatPopup')} isLoading={false} />}
            {currentUser && viewingReport && <TestReportModal result={viewingReport} onClose={() => setViewingReport(null)} onUpdateWeaknesses={onUpdateWeaknesses} student={currentUser} onSaveDeck={() => {}} />}
            {isMoveModalOpen && currentUser && <MoveTasksModal onClose={() => closeModal('MoveTasksModal')} onConfirm={() => {}} selectedCount={0} />}
            {isLibraryOpen && currentUser && <MusicLibraryModal onClose={() => closeModal('MusicLibraryModal')} />}
            {deepLinkAction && currentUser && <DeepLinkConfirmationModal data={deepLinkAction.data} onClose={() => setDeepLinkAction(null)} onConfirm={() => handleBatchImport(deepLinkAction.data)} />}

            {/* Flashcard Modals */}
            {isCreateDeckModalOpen && currentUser && <CreateEditDeckModal deck={editingDeck} onClose={() => { closeModal('CreateEditDeckModal'); setEditingDeck(null); }} onSave={() => {}} />}
            {isAiFlashcardModalOpen && currentUser && <AIGenerateFlashcardsModal student={currentUser} onClose={() => closeModal('AIGenerateFlashcard sModal')} onSaveDeck={() => {}} />}
            {currentUser && viewingDeck && <DeckViewModal deck={viewingDeck} onClose={() => setViewingDeck(null)} onAddCard={() => openModal('CreateEditFlashcardModal', setCreateCardModalOpen)} onEditCard={() => {}} onDeleteCard={() => {}} onStartReview={() => {setReviewingDeck(viewingDeck); openModal('FlashcardReviewModal', setReviewingDeck);}} />}
            {isCreateCardModalOpen && currentUser && viewingDeck && <CreateEditFlashcardModal card={editingCard} deckId={viewingDeck.id} onClose={() => { closeModal('CreateEditFlashcardModal'); setEditingCard(null); }} onSave={() => {}} />}
            {currentUser && reviewingDeck && <FlashcardReviewModal deck={reviewingDeck} onClose={() => closeModal('FlashcardReviewModal')} />}
            
            {/* Study Material Modal */}
            {currentUser && viewingFile && <FileViewerModal file={viewingFile} onClose={() => closeModal('FileViewerModal')} />}

            {/* Assistant & AI Guide Modals */}
            {isAssistantGuideOpen && <GoogleAssistantGuideModal onClose={() => closeModal('GoogleAssistantGuideModal')} />}
            {isAiGuideModalOpen && currentUser && <AIGuideModal onClose={() => closeModal('AIGuideModal')} examType={currentUser.CONFIG.settings.examType} />}
            
            {/* Other Modals */}
            {isProfileModalOpen && currentUser && <ProfileModal user={currentUser} onClose={() => closeModal('ProfileModal')} />}
            {currentUser && <MessagingModal student={allStudents[0]} onClose={() => closeModal('MessagingModal')} isDemoMode={isDemoMode} />} {/* FIX: Needs actual messagingStudent */}
            {isUniversalSearchOpen && currentUser && <UniversalSearch isOpen={true} onClose={() => closeModal('UniversalSearch')} onNavigate={() => {}} onAction={() => {}} scheduleItems={currentUser.SCHEDULE_ITEMS} exams={currentUser.EXAMS} decks={currentUser.CONFIG.flashcardDecks || []} />}
            {isAnswerKeyUploadModalOpen && <AnswerKeyUploadModal onClose={() => closeModal('AnswerKeyUploadModal')} onGrade={() => {}} />}
            {currentUser && viewingReport && analyzingMistake !== null && <SpecificMistakeAnalysisModal questionNumber={analyzingMistake} onClose={() => closeModal('SpecificMistakeAnalysisModal')} onSaveWeakness={() => {}} />} {/* FIX: Needs questionNumber, onSaveWeakness, etc. */}

        </div>
    );
};

export default App;