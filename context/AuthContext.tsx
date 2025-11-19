
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { StudentData } from '../types';
// FIX: Corrected import path to point to apiService.
import { api } from '../api/apiService';
// FIX: Corrected import path for mockData.
import { studentDatabase } from '../data/mockData';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<StudentData | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'admin' | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setUserRole(null);
        setToken(null);
        setIsDemoMode(false);
        setVerificationEmail(null);
        localStorage.clear();
    }, []);

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
    }, []); // Run only on initial mount

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
        const data = await api.googleLogin(credential);
        handleLoginSuccess(data);
        setIsLoading(false);
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

    const value = { currentUser, userRole, token, isDemoMode, isLoading, verificationEmail, login, googleLogin, logout, enterDemoMode, loginWithToken, refreshUser, updateProfile, setVerificationEmail };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};