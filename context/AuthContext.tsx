import React, { createContext, useEffect, useContext, ReactNode, useCallback } from 'react';
import { StudentData, Config, ScheduleItem, FlashcardDeck } from '../types';
import { api } from '../api/apiService';
import { studentDatabase } from '../data/mockData';
import { initClient, handleSignIn as handleGoogleClientSignIn, handleSignOut as handleGoogleClientSignOut } from '../utils/googleAuth';
import { saveUserDataOffline, getUserDataOffline, clearOfflineUserData } from '../utils/offlineDb';
import { useAppStore } from '../store/useAppStore'; // Import the Zustand store

// Helper to process user data from API, parsing any stringified JSON fields
export const processUserData = (userData: StudentData): StudentData => {
    const processedData = { ...userData };

    console.log('processUserData: Checking SCHEDULE_ITEMS:', processedData.SCHEDULE_ITEMS, 'Type:', typeof processedData.SCHEDULE_ITEMS); // Debug log

    // Parse SCHEDULE_ITEMS
    if (typeof processedData.SCHEDULE_ITEMS === 'string') {
        try {
            processedData.SCHEDULE_ITEMS = JSON.parse(processedData.SCHEDULE_ITEMS) as ScheduleItem[];
        } catch (e) {
            console.error("Failed to parse SCHEDULE_ITEMS string:", e);
            processedData.SCHEDULE_ITEMS = [];
        }
    }
    // Handle case where SCHEDULE_ITEMS is an array of strings (double serialization issue)
    if (Array.isArray(processedData.SCHEDULE_ITEMS)) {
        processedData.SCHEDULE_ITEMS = processedData.SCHEDULE_ITEMS.map(item => {
            if (typeof item === 'string') {
                try {
                    return JSON.parse(item);
                } catch (e) {
                    console.error("Failed to parse individual SCHEDULE_ITEM:", e);
                    return null;
                }
            }
            return item;
        }).filter(item => item !== null) as ScheduleItem[];
    }

    // Parse CONFIG.flashcardDecks
    if (processedData.CONFIG && typeof processedData.CONFIG.flashcardDecks === 'string') {
        try {
            processedData.CONFIG.flashcardDecks = JSON.parse(processedData.CONFIG.flashcardDecks) as FlashcardDeck[];
        } catch (e) {
            console.error("Failed to parse CONFIG.flashcardDecks:", e);
            processedData.CONFIG.flashcardDecks = [];
        }
    }

    // Parse CONFIG.customWidgets
    if (processedData.CONFIG && typeof processedData.CONFIG.customWidgets === 'string') {
        try {
            processedData.CONFIG.customWidgets = JSON.parse(processedData.CONFIG.customWidgets) as any[];
        } catch (e) {
            console.error("Failed to parse CONFIG.customWidgets:", e);
            processedData.CONFIG.customWidgets = [];
        }
    }

    return processedData;
};

interface AuthContextType {
    // Functions that trigger state changes (state itself comes from useAppStore)
    login: (sid: string, password: string) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    logout: () => void;
    enterDemoMode: (role: 'student' | 'admin') => void;
    loginWithToken: (token: string) => void;
    refreshUser: () => Promise<void>;
    updateProfile: (data: { fullName?: string; profilePhoto?: string }) => Promise<void>;
    setVerificationEmail: (email: string | null) => void; // This setter will also become a Zustand action
    handleGoogleSignIn: () => void;
    handleGoogleSignOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Select state and actions from the Zustand store
    const {
        currentUser, userRole, token, isDemoMode, isLoading, verificationEmail,
        googleAuthStatus, googleClientId,
        setCurrentUser, setUserRole, setToken, setIsDemoMode, setIsLoading,
        setVerificationEmail, setGoogleAuthStatus, setGoogleClientId
    } = useAppStore();

    // Removed all useState declarations

    const logout = useCallback(() => {
        setToken(null);
        setCurrentUser(null);
        setUserRole(null);
        setIsDemoMode(false);
        setVerificationEmail(null);
        localStorage.clear();
        clearOfflineUserData();
        if (googleAuthStatus === 'signed_in') {
            handleGoogleClientSignOut((isSignedIn: boolean) => {
                setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out');
            });
        }
    }, [googleAuthStatus, setToken, setCurrentUser, setUserRole, setIsDemoMode, setVerificationEmail, setGoogleAuthStatus]);

    const handleLoginSuccess = useCallback((data: { token: string; user: StudentData }) => {
        setToken(data.token);
        const processedUser = processUserData(data.user);
        setCurrentUser(processedUser);
        setUserRole(processedUser.role);
        saveUserDataOffline(processedUser); // Save to offline DB
        setIsDemoMode(false);
        setVerificationEmail(null);
    }, [setToken, setCurrentUser, setUserRole, setIsDemoMode, setVerificationEmail]);

    const refreshUser = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            logout();
            return;
        };
        try {
            const user = await api.getMe();
            const processedUser = processUserData(user);
            setCurrentUser(processedUser);
            setUserRole(processedUser.role);
            saveUserDataOffline(processedUser); // Save to offline DB
        } catch (error) {
            console.error("Failed to refresh user. App may be offline.", error);
        }
    }, [logout, setCurrentUser, setUserRole]);

    useEffect(() => {
        const handleAuthError = () => {
            console.warn('Authentication error detected. Logging out.');
            logout();
        };
        window.addEventListener('auth-error', handleAuthError);
        return () => window.removeEventListener('auth-error', handleAuthError);
    }, [logout]);

    useEffect(() => {
        const loadInitialState = async () => {
            const storedToken = localStorage.getItem('token');
            setIsLoading(true);

            if (storedToken) {
                let userFetched = false;
                try {
                    await refreshUser();
                    userFetched = true;
                } catch (networkError) {
                    console.warn("Failed to refresh user from network, attempting to load from offline DB:", networkError);
                }

                if (!userFetched) {
                    const cachedUserFromLocalStorage = localStorage.getItem('cachedUser'); // Still need this to get sid
                    const sid = cachedUserFromLocalStorage ? JSON.parse(cachedUserFromLocalStorage).sid : null;

                    if (sid) {
                        const offlineUser = await getUserDataOffline(sid);
                        if (offlineUser) {
                            const processedOfflineUser = processUserData(offlineUser);
                            setCurrentUser(processedOfflineUser);
                            setUserRole(processedOfflineUser.role);
                            console.log("Loaded user from offline DB.");
                            setIsLoading(false);
                            return;
                        }
                    }

                    if (cachedUserFromLocalStorage) {
                        try {
                            const cachedUser = JSON.parse(cachedUserFromLocalStorage);
                            const processedCachedUser = processUserData(cachedUser);
                            setCurrentUser(processedCachedUser);
                            setUserRole(processedCachedUser.role);
                            console.log("Loaded user from localStorage cache.");
                            setIsLoading(false);
                            return;
                        } catch (e) {
                            console.error("Failed to parse localStorage cache or offline DB empty:", e);
                        }
                    }
                    logout();
                    setIsLoading(false);
                    return;
                }
            } else {
                logout();
            }
            setIsLoading(false);
        };
        loadInitialState();
    }, [refreshUser, logout, setIsLoading, setCurrentUser, setUserRole]);

    // Effect for Google API initialization
    useEffect(() => {
        const loadGoogleClient = async () => {
            setGoogleAuthStatus('loading');
            try {
                const config = await api.getPublicConfig();
                if (config.googleClientId) {
                    setGoogleClientId(config.googleClientId);
                    initClient(
                        config.googleClientId,
                        (isSignedIn) => {
                            setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out');
                        },
                        (error) => {
                            console.error("Google Auth Init Error:", error);
                            setGoogleAuthStatus('unconfigured');
                        }
                    );
                } else {
                    setGoogleAuthStatus('unconfigured');
                }
            } catch (error) {
                console.error("Failed to fetch public config for Google Client ID:", error);
                setGoogleAuthStatus('unconfigured');
            }
        };
        loadGoogleClient();
    }, [setGoogleAuthStatus, setGoogleClientId]);


    const login = async (sid: string, password: string) => {
        try {
            setIsLoading(true); // Set loading explicitly before API call
            const data = await api.login(sid, password);
            handleLoginSuccess(data);
            setIsLoading(false);
        } catch (error: any) {
            if (error.needsVerification) {
                setVerificationEmail(error.email);
            }
            setIsLoading(false); // Ensure loading is reset on error
            throw new Error(error.error || 'Login failed');
        }
    };

    const googleLogin = async (credential: string) => {
        try {
            setGoogleAuthStatus('loading');
            setIsLoading(true); // Set loading explicitly
            const data = await api.googleLogin(credential);
            handleLoginSuccess(data);
            setGoogleAuthStatus('signed_in');
            setIsLoading(false);
        } catch (error: any) {
            console.error("Google Login failed:", error);
            setGoogleAuthStatus('signed_out');
            setIsLoading(false); // Ensure loading is reset on error
            throw error;
        }
    };

    const loginWithToken = useCallback(async (newToken: string) => {
        setIsLoading(true);
        setToken(newToken);
        localStorage.setItem('token', newToken); // Keep localStorage token for persist middleware in Zustand
        try {
            const user = await api.getMe();
            handleLoginSuccess({ token: newToken, user });
        } catch (error) {
            console.error("Failed to fetch user with new token.", error);
            logout();
        } finally {
            setIsLoading(false);
        }
    }, [handleLoginSuccess, logout, setIsLoading, setToken]);

    const updateProfile = async (data: { fullName?: string; profilePhoto?: string }) => {
        // currentUser comes from Zustand now, so no need for if(!currentUser) return;
        try {
            // No need to set isLoading here, refreshUser will handle updating the global state
            await api.updateProfile(data);
            await refreshUser();
        } catch (error) {
            console.error("Failed to update profile", error);
            throw error;
        }
    };

    const enterDemoMode = useCallback((role: 'student' | 'admin') => {
        setIsDemoMode(true);
        setUserRole(role);
        if (role === 'student') {
            setCurrentUser(studentDatabase[0]); // studentDatabase[0] might need to be processed
        } else {
            setCurrentUser(null);
        }
        setIsLoading(false);
    }, [setIsDemoMode, setUserRole, setCurrentUser, setIsLoading]);

    const value = {
        login, googleLogin, logout, enterDemoMode, loginWithToken, refreshUser,
        updateProfile, setVerificationEmail, handleGoogleSignIn: handleGoogleClientSignIn,
        handleGoogleSignOut: () => handleGoogleClientSignOut((isSignedIn: boolean) => setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out'))
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    // Access Zustand store directly via a custom hook or directly in components
    const {
        currentUser, userRole, token, isDemoMode, isLoading, verificationEmail,
        googleAuthStatus, googleClientId, allStudents, allDoubts, backendStatus, isSyncing,
        setCurrentUser, setUserRole, setToken, setIsDemoMode, setIsLoading,
        setVerificationEmail, setGoogleAuthStatus, setGoogleClientId,
        setBackendStatus, setIsSyncing, setAllStudents, setAllDoubts, updateUserConfig, updateUserSettings
    } = useAppStore(); // Select all relevant state and actions from the store

    // Return the AuthContext functions merged with the Zustand state/actions
    return {
        ...context,
        currentUser, userRole, token, isDemoMode, isLoading, verificationEmail,
        googleAuthStatus, googleClientId, allStudents, allDoubts, backendStatus, isSyncing,
        setCurrentUser, setUserRole, setToken, setIsDemoMode, setIsLoading,
        setVerificationEmail, setGoogleAuthStatus, setGoogleClientId,
        setBackendStatus, setIsSyncing, setAllStudents, setAllDoubts, updateUserConfig, updateUserSettings
    };
};