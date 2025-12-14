import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { StudentData } from '../types';
// FIX: Corrected import path to point to apiService.
import { api } from '../api/apiService';
// FIX: Corrected import path for mockData.
import { studentDatabase } from '../data/mockData';
import { initClient, handleSignIn as handleGoogleClientSignIn, handleSignOut as handleGoogleClientSignOut } from '../utils/googleAuth'; // Import initClient and rename functions

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
        setCurrentUser(data.user);
        setUserRole(data.user.role);
        localStorage.setItem('cachedUser', JSON.stringify(data.user));
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
            setCurrentUser(user);
            setUserRole(user.role);
            localStorage.setItem('cachedUser', JSON.stringify(user));
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
            const cachedUserStr = localStorage.getItem('cachedUser');

            if (storedToken) {
                if (cachedUserStr) {
                    try {
                        const cachedUser = JSON.parse(cachedUserStr);
                        setCurrentUser(cachedUser);
                        setUserRole(cachedUser.role);
                        setIsLoading(false); // UI can render immediately with cached data
                        await refreshUser(); // Silently refresh data in the background
                    } catch {
                        logout(); // Bad cache, clear everything
                        setIsLoading(false);
                    }
                } else {
                    // Have a token but no user data, must fetch before rendering
                    await refreshUser();
                    setIsLoading(false);
                }
            } else {
                // No token, not logged in
                setIsLoading(false);
            }
        };
        loadInitialState();
    }, [refreshUser, logout]); // Added dependencies

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