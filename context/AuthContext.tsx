import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { StudentData, ScheduleItem, FlashcardDeck } from '../types'; // Import FlashcardDeck
// FIX: Corrected import path to point to apiService.
import { api } from '../api/apiService';
// FIX: Corrected import path for mockData.
import { studentDatabase } from '../data/mockData';
import { initClient, handleSignIn as handleGoogleClientSignIn, handleSignOut as handleGoogleClientSignOut } from '../utils/googleAuth'; // Import initClient and rename functions
import { saveUserDataOffline, getUserDataOffline, clearOfflineUserData } from '../utils/offlineDb'; // Import offlineDb functions

// Helper to process user data from API, parsing any stringified JSON fields
const processUserData = (userData: StudentData): StudentData => {
    const processedData = { ...userData };

    console.log('processUserData: Checking SCHEDULE_ITEMS:', processedData.SCHEDULE_ITEMS, 'Type:', typeof processedData.SCHEDULE_ITEMS); // Debug log

    // Parse SCHEDULE_ITEMS
    if (typeof processedData.SCHEDULE_ITEMS === 'string') {
        try {
            processedData.SCHEDULE_ITEMS = JSON.parse(processedData.SCHEDULE_ITEMS) as ScheduleItem[];
        } catch (e) {
            console.error("Failed to parse SCHEDULE_ITEMS:", e);
            processedData.SCHEDULE_ITEMS = [];
        }
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
            processedData.CONFIG.customWidgets = JSON.parse(processedData.CONFIG.customWidgets) as any[]; // Assuming any[] for customWidgets
        } catch (e) {
            console.error("Failed to parse CONFIG.customWidgets:", e);
            processedData.CONFIG.customWidgets = [];
        }
    }

    return processedData;
};

interface AuthContextType {
    currentUser: StudentData | null;
    userRole: 'student' | 'admin' | null;
    token: string | null;
    isDemoMode: boolean;
    isLoading: boolean;
    verificationEmail: string | null; // Email that needs verification
    login: (sid: string, password: string) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    logout: () => void;
    enterDemoMode: (role: 'student' | 'admin') => void;
    loginWithToken: (token: string) => void;
    refreshUser: () => Promise<void>;
    updateProfile: (data: { fullName?: string; profilePhoto?: string }) => Promise<void>;
    setVerificationEmail: (email: string | null) => void;
    googleAuthStatus: 'signed_in' | 'signed_out' | 'loading' | 'unconfigured';
    setGoogleAuthStatus: React.Dispatch<React.SetStateAction<'signed_in' | 'signed_out' | 'loading' | 'unconfigured'>>;
    googleClientId: string | null; // Add googleClientId to context type
    handleGoogleSignIn: () => void; // Add to interface
    handleGoogleSignOut: () => void; // Add to interface
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<StudentData | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'admin' | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
    const [googleAuthStatus, setGoogleAuthStatus] = useState<'signed_in' | 'signed_out' | 'loading' | 'unconfigured'>('unconfigured');
    const [googleClientId, setGoogleClientId] = useState<string | null>(null); // Add state for googleClientId

    const logout = useCallback(() => {
        setCurrentUser(null);
        setUserRole(null);
        setToken(null);
        setIsDemoMode(false);
        setVerificationEmail(null);
        localStorage.clear();
        clearOfflineUserData(); // Clear offline DB data
        // Also sign out from Google if signed in
        if (googleAuthStatus === 'signed_in') {
            handleGoogleClientSignOut((isSignedIn: boolean) => {
                setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out');
            });
        }
    }, [googleAuthStatus]);

    const handleLoginSuccess = useCallback((data: { token: string; user: StudentData }) => {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        const processedUser = processUserData(data.user); // Process the user data
        setCurrentUser(processedUser);
        setUserRole(processedUser.role);
        localStorage.setItem('cachedUser', JSON.stringify(processedUser)); // Store processed user data
        saveUserDataOffline(processedUser); // Save to offline DB
        setIsDemoMode(false);
        setVerificationEmail(null);
    }, []);
    
    const refreshUser = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            logout();
            return;
        };
        try {
            const user = await api.getMe();
            const processedUser = processUserData(user); // Process the user data
            setCurrentUser(processedUser);
            setUserRole(processedUser.role);
            localStorage.setItem('cachedUser', JSON.stringify(processedUser)); // Store processed user data
            saveUserDataOffline(processedUser); // Save to offline DB
        } catch (error) {
            console.error("Failed to refresh user. App may be offline.", error);
            // Don't log out on network failure, allow offline mode.
            // The global 'auth-error' event will handle actual 401s.
        }
    }, [logout]);
    
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
                // 1. Try to refresh from network first
                let userFetched = false;
                try {
                    await refreshUser(); // This will fetch, process, and save to offlineDb and update currentUser
                    userFetched = true;
                } catch (networkError) {
                    console.warn("Failed to refresh user from network, attempting to load from offline DB:", networkError);
                }

                if (!userFetched) {
                    // 2. If network refresh failed, try to load from offline DB
                    const cachedUserFromLocalStorage = localStorage.getItem('cachedUser');
                    const sid = cachedUserFromLocalStorage ? JSON.parse(cachedUserFromLocalStorage).sid : null; // Get SID from local storage cache

                    if (sid) {
                        const offlineUser = await getUserDataOffline(sid);
                        if (offlineUser) {
                            const processedOfflineUser = processUserData(offlineUser); // Process offline user data
                            setCurrentUser(processedOfflineUser);
                            setUserRole(processedOfflineUser.role);
                            console.log("Loaded user from offline DB.");
                            setIsLoading(false);
                            return; // Loaded from offline DB
                        }
                    }
                    
                    // 3. Fallback to localStorage if offline DB is also empty or couldn't retrieve
                    if (cachedUserFromLocalStorage) {
                        try {
                            const cachedUser = JSON.parse(cachedUserFromLocalStorage);
                            const processedCachedUser = processUserData(cachedUser); // Process cached user data
                            setCurrentUser(processedCachedUser);
                            setUserRole(processedCachedUser.role);
                            console.log("Loaded user from localStorage cache.");
                            setIsLoading(false);
                            return;
                        } catch (e) {
                            console.error("Failed to parse localStorage cache or offline DB empty:", e);
                        }
                    }
                    // If all offline methods fail, then logout
                    logout();
                    setIsLoading(false);
                    return;
                }
            } else {
                // No token, not logged in
                logout(); // Ensure clean state
            }
            setIsLoading(false); // Ensure isLoading is set to false in all paths
        };
        loadInitialState();
    }, [refreshUser, logout]); // Removed currentUser?.sid as dependency, as refreshUser manages currentUser state directly.

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
                            setGoogleAuthStatus('unconfigured'); // Or 'error'
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
    }, []);


    const login = async (sid: string, password: string) => {
        try {
            const data = await api.login(sid, password);
            handleLoginSuccess(data);
            setIsLoading(false);
        } catch (error: any) {
            if (error.needsVerification) {
                setVerificationEmail(error.email);
            }
            throw new Error(error.error || 'Login failed');
        }
    };

    const googleLogin = async (credential: string) => {
        try {
            setGoogleAuthStatus('loading');
            const data = await api.googleLogin(credential);
            handleLoginSuccess(data);
            setGoogleAuthStatus('signed_in');
            setIsLoading(false);
        } catch (error) {
            console.error("Google Login failed:", error);
            setGoogleAuthStatus('signed_out');
            throw error;
        }
    };

    const loginWithToken = useCallback(async (newToken: string) => {
        setIsLoading(true);
        setToken(newToken);
        localStorage.setItem('token', newToken);
        try {
            const user = await api.getMe();
            handleLoginSuccess({ token: newToken, user });
        } catch (error) {
            console.error("Failed to fetch user with new token.", error);
            logout();
        } finally {
            setIsLoading(false);
        }
    }, [handleLoginSuccess, logout]);
    
    const updateProfile = async (data: { fullName?: string; profilePhoto?: string }) => {
        if(!currentUser) return;
        try {
            await api.updateProfile(data);
            await refreshUser();
        } catch (error) {
            console.error("Failed to update profile", error);
            throw error;
        }
    };

    const enterDemoMode = (role: 'student' | 'admin') => {
        setIsDemoMode(true);
        setUserRole(role);
        if (role === 'student') {
            setCurrentUser(studentDatabase[0]);
        } else {
            setCurrentUser(null);
        }
        setIsLoading(false);
    };

    const value = { currentUser, userRole, token, isDemoMode, isLoading, verificationEmail, login, googleLogin, logout, enterDemoMode, loginWithToken, refreshUser, updateProfile, setVerificationEmail, googleAuthStatus, setGoogleAuthStatus, googleClientId, handleGoogleSignIn: handleGoogleClientSignIn, handleGoogleSignOut: () => handleGoogleClientSignOut((isSignedIn: boolean) => setGoogleAuthStatus(isSignedIn ? 'signed_in' : 'signed_out')) };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};