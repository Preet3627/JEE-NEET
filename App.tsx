import React, { useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useAppStore } from './store/useAppStore';
import { api } from './api/apiService';
import { studentDatabase } from './data/mockData';

// Component Imports
import Header from './components/Header';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AuthScreen from './screens/AuthScreen';
import BackendOfflineScreen from './components/BackendOfflineScreen';
import ConfigurationErrorScreen from './components/ConfigurationErrorScreen';
import ExamTypeSelectionModal from './components/ExamTypeSelectionModal';
import FullScreenMusicPlayer from './components/FullScreenMusicPlayer';
import PersistentMusicPlayer from './components/PersistentMusicPlayer';
import { useMusicPlayer } from './context/MusicPlayerContext';
import { processUserData } from './context/AuthContext';


const App: React.FC = () => {
    // Get auth functions from context
    const { logout, enterDemoMode } = useAuth();
    
    // Get ALL state and setters from the Zustand store
    const {
        currentUser, userRole, isLoading, isDemoMode,
        backendStatus, isSyncing, googleClientId, resetToken,
        isExamTypeModalOpen, allStudents, allDoubts,
        setBackendStatus, setGoogleClientId, setAllStudents, setAllDoubts,
        handleUpdateConfig, // Assuming this action exists in the store now
        setIsExamTypeModalOpen
    } = useAppStore();

    const { isFullScreenPlayerOpen, currentTrack } = useMusicPlayer();
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
    const [deepLinkAction, setDeepLinkAction] = React.useState<any>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Deep Link & Voice Action Integration ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('reset-token');
        if (token) {
            // This needs to be handled by the store or auth context
            // For now, let's assume AuthScreen handles it.
            // setResetToken(token); 
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const action = params.get('action');
        const dataStr = params.get('data');
        const taskId = params.get('id');

        if (action === 'view_task' && taskId) {
            setDeepLinkAction({ action: 'view_task', data: { id: taskId } });
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (action && dataStr) {
             const handleDeepLink = async (encodedData: string) => {
                let decodedData = '';
                try {
                    decodedData = decodeURIComponent(encodedData);
                    const data = JSON.parse(decodedData);
                    setDeepLinkAction({ action, data });
                } catch (e) {
                    console.error("Failed to parse deep link data, attempting AI correction:", e);
                    try {
                        const correctionResult = await api.correctJson(decodedData);
                        const correctedData = JSON.parse(correctionResult.correctedJson);
                        setDeepLinkAction({ action, data: correctedData });
                        console.log("AI correction successful!");
                    } catch (correctionError) {
                        console.error("AI correction failed:", correctionError);
                        alert("The data from the link is malformed and could not be automatically corrected. Please check the source.");
                    }
                } finally {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            };
            handleDeepLink(dataStr);
        }
    }, []);

     useEffect(() => {
        // Apply theme class to body
        const theme = currentUser?.CONFIG.settings.theme || 'default';
        document.body.className = `theme-${theme}`;

        // If a user is logged in but hasn't selected an exam type, show the selection modal.
        if (currentUser && userRole === 'student' && !isDemoMode && !currentUser.CONFIG.settings.examType) {
            setIsExamTypeModalOpen(true);
        }
    }, [currentUser, userRole, isDemoMode, setIsExamTypeModalOpen]);

    const checkBackend = useCallback(async (isInitialCheck: boolean) => {
        let statusCheckTimeout: ReturnType<typeof setTimeout> | null = null;
        if (isInitialCheck && !currentUser) {
            statusCheckTimeout = setTimeout(() => {
                setBackendStatus(backendStatus === 'checking' ? 'offline' : backendStatus);
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
    }, [googleClientId, currentUser, backendStatus, setBackendStatus, setGoogleClientId]);

    useEffect(() => {
        checkBackend(true);
        const interval = setInterval(() => checkBackend(false), 30000);
        return () => clearInterval(interval);
    }, [checkBackend]);

    useEffect(() => {
        if (currentUser) {
            const heartbeat = setInterval(() => {
                api.heartbeat().catch(err => console.debug("Heartbeat failed, user might be offline.", err));
            }, 60000);
            return () => clearInterval(heartbeat);
        }
    }, [currentUser]);


    useEffect(() => {
        const loadExtraData = async () => {
            if (isDemoMode) {
                if (userRole === 'admin') setAllStudents(studentDatabase.map(s => processUserData(s)));
                return;
            }
            if (userRole === 'admin') {
                const students = await api.getStudents();
                setAllStudents(students.map(s => processUserData(s)));
            }
            if (currentUser || userRole === 'admin') {
                const doubts = await api.getAllDoubts();
                setAllDoubts(doubts);
            }
        };

        if (backendStatus === 'online' && !isLoading) {
            loadExtraData();
        }
    }, [backendStatus, isLoading, userRole, isDemoMode, currentUser, setAllStudents, setAllDoubts]);
    

    const handleSelectExamType = async (examType: 'JEE' | 'NEET') => {
        if (!currentUser) return;
        const newSettings = { ...currentUser.CONFIG.settings, examType };
        // This should be a store action now
        // await handleUpdateConfig({ settings: newSettings }); 
        useAppStore.getState().updateUserSettings({ examType });
        setIsExamTypeModalOpen(false);
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center min-h-screen"><div className="text-xl animate-pulse">Initializing Interface...</div></div>;
        }

        if (isExamTypeModalOpen) {
            return <ExamTypeSelectionModal onSelect={handleSelectExamType} />;
        }

        if (backendStatus === 'misconfigured') {
            return <ConfigurationErrorScreen onRetryConnection={() => checkBackend(false)} backendStatus={backendStatus} />;
        }
        
        if (currentUser) {
            const dashboardUser = currentUser;
            const useToolbarLayout = isMobile && dashboardUser.CONFIG.settings.mobileLayout === 'toolbar';

            return (
                 <div style={{'--accent-color': dashboardUser.CONFIG.settings.accentColor} as React.CSSProperties} className={`${dashboardUser.CONFIG.settings.blurEnabled === false ? 'no-blur' : ''} safe-padding-left safe-padding-right safe-padding-top safe-padding-bottom`}>
                    {isFullScreenPlayerOpen && <FullScreenMusicPlayer />}
                    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 ${useToolbarLayout || currentTrack ? 'pb-24' : ''}`}>
                        <Header user={{ name: dashboardUser.fullName, id: dashboardUser.sid, profilePhoto: dashboardUser.profilePhoto }} onLogout={logout} backendStatus={backend-status} isSyncing={isSyncing} />
                        {userRole === 'admin' ? (
                            <TeacherDashboard />
                        ) : (
                            <StudentDashboard deepLinkAction={deepLinkAction} />
                        )}
                    </div>
                    {currentTrack && <PersistentMusicPlayer />}
                </div>
            );
        }
        
        if (isDemoMode && userRole === 'admin') {
             return (
                 <div style={{'--accent-color': '#0891b2'} as React.CSSProperties} className="safe-padding-left safe-padding-right safe-padding-top safe-padding-bottom">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <Header user={{ name: 'Admin', id: 'ADMIN_DEMO', profilePhoto: currentUser?.profilePhoto }} onLogout={logout} backendStatus={backendStatus} isSyncing={isSyncing} />
                        <TeacherDashboard />
                    </div>
                </div>
            );
        }

        if (backendStatus === 'offline' && !isDemoMode) {
            return <BackendOfflineScreen onSelectDemoUser={enterDemoMode} onRetryConnection={() => checkBackend(false)} backendStatus={backendStatus} />;
        }

        return <AuthScreen />;
    };

    return <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">{renderContent()}</div>;
};

export default App;