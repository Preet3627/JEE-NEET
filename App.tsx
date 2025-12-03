
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { StudentData, ScheduleItem, StudySession, Config, ResultData, ExamData, DoubtData } from './types';
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

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_URL = '/api';

interface ModalState {
    id: string;
    onClose: () => void;
    historyStateId: string;
}

const App: React.FC = () => {
    const { currentUser, userRole, isLoading, isDemoMode, enterDemoMode, logout, refreshUser } = useAuth();
    const { isFullScreenPlayerOpen, currentTrack, toggleLibrary, isLibraryOpen: isMusicLibraryOpen } = useMusicPlayer();
    
    const [allStudents, setAllStudents] = useState<StudentData[]>([]);
    const [allDoubts, setAllDoubts] = useState<DoubtData[]>([]);
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
    const [currentModalId, setCurrentModalId] = useState<string | null>(null);

    const openModal = useCallback((modalId: string, onCloseCallback: () => void) => {
        if (modalStack.current.some(m => m.id === modalId)) {
            // Modal already in stack, prevent opening twice or pushing duplicate history
            return;
        }

        const historyStateId = `modal-${Date.now()}`;
        window.history.pushState({ modalId: historyStateId }, ''); // Push a new state to browser history

        const modalState: ModalState = {
            id: modalId,
            onClose: () => {
                // This onClose is called when the modal wants to close itself normally
                // It should trigger a browser back to pop its history state
                if (modalStack.current.length > 0 && modalStack.current[modalStack.current.length - 1].historyStateId === historyStateId) {
                    window.history.back(); // Trigger popstate
                } else {
                    // Fallback for unexpected state (e.g. modal closed out of sync)
                    modalStack.current = modalStack.current.filter(m => m.historyStateId !== historyStateId);
                    setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
                    onCloseCallback(); // Directly call the original callback
                }
            },
            historyStateId: historyStateId,
        };
        modalStack.current.push(modalState);
        setCurrentModalId(modalId);
    }, []);

    const closeTopModal = useCallback(() => {
        // This is called by the popstate listener when browser back is hit
        const topModal = modalStack.current.pop();
        if (topModal) {
            topModal.onClose(); // Call the modal's original onClose logic
            setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
        }
    }, []);

    const genericOnClose = useCallback((modalId: string, setStateFalse: React.Dispatch<React.SetStateAction<boolean>>) => {
        const modalToClose = modalStack.current.find(m => m.id === modalId);
        if (modalToClose) {
            // This will trigger window.history.back(), which in turn calls popstate,
            // and the popstate listener then calls closeTopModal, handling actual state updates.
            modalToClose.onClose();
        } else {
            // If modal not found in stack, just close its state directly.
            setStateFalse(false);
            setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
        }
    }, []);


    // --- Global popstate listener for browser back button ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // Check if it's a modal history state
            if (event.state && event.state.modalId) {
                // This means we are navigating back WITHIN the modal stack
                if (modalStack.current.length > 0 && modalStack.current[modalStack.current.length - 1].historyStateId === event.state.modalId) {
                    // It's the same modal state we just pushed, so let it pop naturally
                    // (This should ideally not be called here if the modal handles its own history.back())
                } else {
                    // Browser navigated to a state NOT managed by a modal, or modal stack is out of sync
                    // Force-close the topmost modal if one exists
                    const topModal = modalStack.current[modalStack.current.length - 1];
                    if (topModal) {
                         modalStack.current.pop(); // Remove it from our internal stack
                         setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
                         topModal.onClose(); // This should trigger its actual close effect
                    }
                }
            } else if (modalStack.current.length > 0) {
                 // Browser back was pressed and there's a modal open, but it's not a modal-specific state being popped.
                 // This means the user is trying to go back past the modal's entry point.
                 // Prevent default and close the modal.
                 const topModal = modalStack.current.pop();
                 if (topModal) {
                     topModal.onClose(); // Trigger its specific onClose logic
                     setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
                     // If we preventDefault here, it stops the browser navigation completely.
                     // Instead, the modal's onClose should be designed to handle the history pop.
                     // The modal's onClose() is expected to call window.history.back() or similar.
                 }
            }
        };
        
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [closeTopModal]);


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
                        const correctionResult = await api.correctJson(decodedData);
                        const correctedData = JSON.parse(correctionResult.correctedJson);
                        setDeepLinkAction({ action, data: correctedData });
                    } catch (correctionError) {
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
            setIsExamTypeModalOpen(true);
        }
    }, [currentUser, userRole, isDemoMode]);
    

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
        await api.fullSync(updatedUser);
        refreshUser();
    };
    
    const onLogResult = async (result: ResultData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, RESULTS: [...currentUser.RESULTS, result], CONFIG: {...currentUser.CONFIG, SCORE: result.SCORE, WEAK: [...new Set([...currentUser.CONFIG.WEAK, ...result.MISTAKES])] } };
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onAddExam = async (exam: ExamData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: [...currentUser.EXAMS, exam] };
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onUpdateExam = async (exam: ExamData) => {
         if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: currentUser.EXAMS.map(e => e.ID === exam.ID ? exam : e) };
        await api.fullSync(updatedUser);
        refreshUser();
    };

    const onDeleteExam = async (examId: string) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, EXAMS: currentUser.EXAMS.filter(e => e.ID !== examId) };
        await api.fullSync(updatedUser);
        refreshUser();
    };
    
    const onUpdateWeaknesses = async (weaknesses: string[]) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, CONFIG: { ...currentUser.CONFIG, WEAK: weaknesses } };
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

        await api.fullSync(updatedUser);
        await refreshUser();

        if (currentUser.CONFIG.isCalendarSyncEnabled) {
            if (window.confirm("Sync imported tasks to Google Calendar?")) handleFullCalendarSync();
        }
    };

    const onPostDoubt = async (question: string, image?: string) => {
        await api.postDoubt(question, image);
        const doubtsData = await api.getAllDoubts();
        setAllDoubts(doubtsData);
    };

    const onPostSolution = async (doubtId: string, solution: string, image?: string) => {
        await api.postSolution(doubtId, solution, image);
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
                const students = await api.getStudents();
                setAllStudents(students);
            }
            if (currentUser || userRole === 'admin') {
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
        await handleUpdateConfig({ settings: newSettings });
        setIsExamTypeModalOpen(false);
    };

    // --- Modal Control Functions for Children ---
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isAiParserModalOpen, setAiParserModalOpen] = useState(false);
    const [isPracticeModalOpen, setPracticeModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isEditWeaknessesModalOpen, setEditWeaknessesModalOpen] = useState(false);
    const [isLogResultModalOpen, setLogResultModalOpen] = useState(false);
    const [isEditResultModalOpen, setEditResultModalOpen] = useState(false);
    const [isExamModalOpen, setExamModalOpen] = useState(false);
    const [isAiMistakeModalOpen, setAiMistakeModalOpen] = useState(false);
    const [isAssistantGuideOpen, setAssistantGuideOpen] = useState(false);
    const [isAiGuideModalOpen, setAiGuideModalOpen] = useState(false);
    const [isSelectMode, setSelectMode] = useState(false);
    const [isMoveModalOpen, setMoveModalOpen] = useState(false);
    const [isAiChatOpen, setAiChatOpen] = useState(false);
    const [isAiDoubtSolverOpen, setAiDoubtSolverOpen] = useState(false);
    const [isCreateDeckModalOpen, setCreateDeckModalOpen] = useState(false);
    const [isAiFlashcardModalOpen, setAiFlashcardModalOpen] = useState(false);
    const [isCreateCardModalOpen, setCreateCardModalOpen] = useState(false);
    const [isMessagingModalOpen, setMessagingModalOpen] = useState(false); // For teacher dashboard
    const [isUniversalSearchOpen, setUniversalSearchOpen] = useState(false);
    const [isFileViewerModalOpen, setFileViewerModalOpen] = useState(false);
    const [isAnswerKeyUploadModalOpen, setAnswerKeyUploadModalOpen] = useState(false);


    const modalMap = useRef<{[key: string]: React.Dispatch<React.SetStateAction<boolean>>}>({
        'CreateEditTaskModal': setCreateModalOpen,
        'AIParserModal': setAiParserModalOpen,
        'CustomPracticeModal': setPracticeModalOpen,
        'SettingsModal': setSettingsModalOpen,
        'EditWeaknessesModal': setEditWeaknessesModalOpen,
        'LogResultModal': setLogResultModalOpen,
        'EditResultModal': setEditResultModalOpen,
        'CreateEditExamModal': setExamModalOpen,
        'AIMistakeAnalysisModal': setAiMistakeModalOpen,
        'GoogleAssistantGuideModal': setAssistantGuideOpen,
        'AIGuideModal': setAiGuideModalOpen,
        'MoveTasksModal': setMoveModalOpen,
        'AIChatPopup': setAiChatOpen,
        'AIDoubtSolverModal': setAiDoubtSolverOpen,
        'CreateEditDeckModal': setCreateDeckModalOpen,
        'AIGenerateFlashcardsModal': setAiFlashcardModalOpen,
        'CreateEditFlashcardModal': setCreateCardModalOpen,
        'MusicLibraryModal': toggleLibrary, // Special case for MusicLibraryModal
        'MessagingModal': setMessagingModalOpen,
        'UniversalSearch': setUniversalSearchOpen,
        'FileViewerModal': setFileViewerModalOpen,
        'AnswerKeyUploadModal': setAnswerKeyUploadModalOpen,
    });

    const openModalHandler = useCallback((modalId: string, customOnClose?: () => void) => {
        const setStateTrue = modalMap.current[modalId];
        if (setStateTrue) {
            // Special handling for MusicLibraryModal which uses a context toggle
            if (modalId === 'MusicLibraryModal') {
                toggleLibrary(); // Directly toggle the music library
                // We still want it in the history stack if needed for navigation
                openModal(modalId, () => toggleLibrary());
            } else {
                setStateTrue(true);
                openModal(modalId, () => setStateTrue(false)); // Pass actual setter for history handling
            }
        } else {
            console.warn(`Attempted to open unknown modal: ${modalId}`);
        }
    }, [openModal, toggleLibrary]);

    const closeModalHandler = useCallback((modalId: string) => {
        const setStateFalse = modalMap.current[modalId];
        if (setStateFalse) {
            // Special handling for MusicLibraryModal
            if (modalId === 'MusicLibraryModal') {
                if (isMusicLibraryOpen) toggleLibrary(); // Only toggle if it's open
            } else {
                setStateFalse(false);
            }
            // Remove from modalStack if found (should be handled by history.back())
            const index = modalStack.current.findIndex(m => m.id === modalId);
            if (index !== -1) {
                modalStack.current.splice(index, 1);
                setCurrentModalId(modalStack.current.length > 0 ? modalStack.current[modalStack.current.length - 1].id : null);
            }
        } else {
            console.warn(`Attempted to close unknown modal: ${modalId}`);
        }
    }, [toggleLibrary, isMusicLibraryOpen]);


    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center min-h-screen"><div className="text-xl animate-pulse">Loading...</div></div>;
        }

        if (isExamTypeModalOpen) {
            return <ExamTypeSelectionModal onClose={() => genericOnClose('ExamTypeSelectionModal', setIsExamTypeModalOpen)} onSelect={handleSelectExamType} />;
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
                        <Header user={{ name: dashboardUser.fullName, id: dashboardUser.sid, profilePhoto: dashboardUser.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} />
                        {userRole === 'admin' ? (
                            <TeacherDashboard 
                                students={allStudents} 
                                onToggleUnacademySub={()=>{}} 
                                onDeleteUser={onDeleteUser} 
                                onBroadcastTask={api.broadcastTask} 
                                openModal={openModalHandler}
                                closeModal={closeModalHandler}
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
                                openModal={openModalHandler}
                                closeModal={closeModalHandler}
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
                        <Header user={{ name: 'Admin', id: 'ADMIN_DEMO', profilePhoto: currentUser?.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} />
                        <TeacherDashboard 
                            students={allStudents} 
                            onToggleUnacademySub={()=>{}} 
                            onDeleteUser={() => alert("Disabled in demo mode")} 
                            onBroadcastTask={() => alert("Disabled in demo mode")}
                            openModal={openModalHandler}
                            closeModal={closeModalHandler}
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

    return <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">{renderContent()}</div>;
};

export default App;