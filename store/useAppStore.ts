import { create } from 'zustand';
import { StudentData, Config, DoubtData } from './../types'; // Adjust path as needed
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppState {
    // User and Auth State
    currentUser: StudentData | null;
    userRole: 'student' | 'admin' | null;
    token: string | null;
    isDemoMode: boolean;
    isLoading: boolean; // For initial app load/auth checks
    verificationEmail: string | null;
    googleAuthStatus: 'signed_in' | 'signed_out' | 'loading' | 'unconfigured';
    googleClientId: string | null;

    // Backend/Sync Status
    backendStatus: 'checking' | 'online' | 'offline' | 'misconfigured';
    isSyncing: boolean; // For indicating background data sync

    // Admin Specific State
    allStudents: StudentData[];
    allDoubts: DoubtData[];

    // Actions
    setCurrentUser: (user: StudentData | null) => void;
    setUserRole: (role: 'student' | 'admin' | null) => void;
    setToken: (token: string | null) => void;
    setIsDemoMode: (isDemo: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    setVerificationEmail: (email: string | null) => void;
    setGoogleAuthStatus: (status: 'signed_in' | 'signed_out' | 'loading' | 'unconfigured') => void;
    setGoogleClientId: (clientId: string | null) => void;
    setBackendStatus: (status: 'checking' | 'online' | 'offline' | 'misconfigured') => void;
    setIsSyncing: (syncing: boolean) => void;
    setAllStudents: (students: StudentData[]) => void;
    setAllDoubts: (doubts: DoubtData[]) => void;

    // Config specific updates (more granular than just replacing entire currentUser)
    updateUserConfig: (config: Partial<Config>) => void;
    updateUserSettings: (settings: Partial<Config['settings']>) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial State
            currentUser: null,
            userRole: null,
            token: localStorage.getItem('token'), // Initialize token from localStorage directly
            isDemoMode: false,
            isLoading: true,
            verificationEmail: null,
            googleAuthStatus: 'unconfigured',
            googleClientId: null,
            backendStatus: 'checking',
            isSyncing: false,
            allStudents: [],
            allDoubts: [],

            // Actions
            setCurrentUser: (user) => set({ currentUser: user, userRole: user?.role || null }),
            setUserRole: (role) => set({ userRole: role }),
            setToken: (token) => {
                set({ token });
                if (token) {
                    localStorage.setItem('token', token);
                } else {
                    localStorage.removeItem('token');
                }
            },
            setIsDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
            setIsLoading: (loading) => set({ isLoading: loading }),
            setVerificationEmail: (email) => set({ verificationEmail: email }),
            setGoogleAuthStatus: (status) => set({ googleAuthStatus: status }),
            setGoogleClientId: (clientId) => set({ googleClientId: clientId }),
            setBackendStatus: (status) => set({ backendStatus: status }),
            setIsSyncing: (syncing) => set({ isSyncing: syncing }),
            setAllStudents: (students) => set({ allStudents: students }),
            setAllDoubts: (doubts) => set({ allDoubts: doubts }),

            updateUserConfig: (config) => set((state) => {
                if (!state.currentUser) return state;
                const updatedUser = {
                    ...state.currentUser,
                    CONFIG: {
                        ...state.currentUser.CONFIG,
                        ...config,
                    },
                };
                return { currentUser: updatedUser };
            }),
            updateUserSettings: (settings) => set((state) => {
                if (!state.currentUser) return state;
                const updatedUser = {
                    ...state.currentUser,
                    CONFIG: {
                        ...state.currentUser.CONFIG,
                        settings: {
                            ...state.currentUser.CONFIG.settings,
                            ...settings,
                        },
                    },
                };
                return { currentUser: updatedUser };
            }),
        }),
        {
            name: 'app-storage', // name of the item in storage (must be unique)
            storage: createJSONStorage(() => localStorage), // use localStorage for persistence
            // Optionally, specify which parts of the state to persist
            partialize: (state) => ({
                currentUser: state.currentUser,
                token: state.token,
                userRole: state.userRole,
                isDemoMode: state.isDemoMode,
            }),
        }
    )
);