import { create } from 'zustand';
import { StudentData, Config, DoubtData, ScheduleItem, ExamData, ResultData, FlashcardDeck } from './../types'; // Adjust path as needed
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    validateScheduleItem,
    validateExam,
    validateResult,
    validateFlashcardDeck,
    deduplicateScheduleItems,
    deduplicateExams,
    deduplicateResults,
    sanitizeScheduleItem,
    sortScheduleItemsByDate
} from '../utils/dataHandlers';

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

    // Enhanced Data Management Actions
    addScheduleItem: (item: ScheduleItem) => void;
    updateScheduleItem: (id: string, updates: Partial<ScheduleItem>) => void;
    deleteScheduleItem: (id: string) => void;
    batchAddScheduleItems: (items: ScheduleItem[]) => void;
    batchDeleteScheduleItems: (ids: string[]) => void;

    addExam: (exam: ExamData) => void;
    updateExam: (id: string, updates: Partial<ExamData>) => void;
    deleteExam: (id: string) => void;

    addResult: (result: ResultData) => void;
    updateResult: (id: string, updates: Partial<ResultData>) => void;
    deleteResult: (id: string) => void;

    addFlashcardDeck: (deck: FlashcardDeck) => void;
    updateFlashcardDeck: (id: string, updates: Partial<FlashcardDeck>) => void;
    deleteFlashcardDeck: (id: string) => void;

    // Data cleanup and maintenance
    cleanupDuplicates: () => void;
    sortScheduleItems: () => void;
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

            // Enhanced Schedule Item Management
            addScheduleItem: (item) => set((state) => {
                if (!state.currentUser) return state;

                // Validate and sanitize
                if (!validateScheduleItem(item)) {
                    console.error('Invalid schedule item:', item);
                    return state;
                }

                const sanitized = sanitizeScheduleItem(item);
                const updatedItems = [...state.currentUser.SCHEDULE_ITEMS, sanitized];

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: deduplicateScheduleItems(updatedItems)
                    }
                };
            }),

            updateScheduleItem: (id, updates) => set((state) => {
                if (!state.currentUser) return state;

                const updatedItems = state.currentUser.SCHEDULE_ITEMS.map(item =>
                    item.ID === id ? sanitizeScheduleItem({ ...item, ...updates }) : item
                );

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: updatedItems
                    }
                };
            }),

            deleteScheduleItem: (id) => set((state) => {
                if (!state.currentUser) return state;

                const updatedItems = state.currentUser.SCHEDULE_ITEMS.filter(item => item.ID !== id);

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: updatedItems
                    }
                };
            }),

            batchAddScheduleItems: (items) => set((state) => {
                if (!state.currentUser) return state;

                const validItems = items.filter(validateScheduleItem).map(sanitizeScheduleItem);
                const updatedItems = [...state.currentUser.SCHEDULE_ITEMS, ...validItems];

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: deduplicateScheduleItems(updatedItems)
                    }
                };
            }),

            batchDeleteScheduleItems: (ids) => set((state) => {
                if (!state.currentUser) return state;

                const idsSet = new Set(ids);
                const updatedItems = state.currentUser.SCHEDULE_ITEMS.filter(item => !idsSet.has(item.ID));

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: updatedItems
                    }
                };
            }),

            // Exam Management
            addExam: (exam) => set((state) => {
                if (!state.currentUser) return state;

                if (!validateExam(exam)) {
                    console.error('Invalid exam:', exam);
                    return state;
                }

                const updatedExams = [...state.currentUser.EXAMS, exam];

                return {
                    currentUser: {
                        ...state.currentUser,
                        EXAMS: deduplicateExams(updatedExams)
                    }
                };
            }),

            updateExam: (id, updates) => set((state) => {
                if (!state.currentUser) return state;

                const updatedExams = state.currentUser.EXAMS.map(exam =>
                    exam.ID === id ? { ...exam, ...updates } : exam
                );

                return {
                    currentUser: {
                        ...state.currentUser,
                        EXAMS: updatedExams
                    }
                };
            }),

            deleteExam: (id) => set((state) => {
                if (!state.currentUser) return state;

                const updatedExams = state.currentUser.EXAMS.filter(exam => exam.ID !== id);

                return {
                    currentUser: {
                        ...state.currentUser,
                        EXAMS: updatedExams
                    }
                };
            }),

            // Result Management
            addResult: (result) => set((state) => {
                if (!state.currentUser) return state;

                if (!validateResult(result)) {
                    console.error('Invalid result:', result);
                    return state;
                }

                const updatedResults = [...state.currentUser.RESULTS, result];

                return {
                    currentUser: {
                        ...state.currentUser,
                        RESULTS: deduplicateResults(updatedResults)
                    }
                };
            }),

            updateResult: (id, updates) => set((state) => {
                if (!state.currentUser) return state;

                const updatedResults = state.currentUser.RESULTS.map(result =>
                    result.ID === id ? { ...result, ...updates } : result
                );

                return {
                    currentUser: {
                        ...state.currentUser,
                        RESULTS: updatedResults
                    }
                };
            }),

            deleteResult: (id) => set((state) => {
                if (!state.currentUser) return state;

                const updatedResults = state.currentUser.RESULTS.filter(result => result.ID !== id);

                return {
                    currentUser: {
                        ...state.currentUser,
                        RESULTS: updatedResults
                    }
                };
            }),

            // Flashcard Deck Management
            addFlashcardDeck: (deck) => set((state) => {
                if (!state.currentUser) return state;

                if (!validateFlashcardDeck(deck)) {
                    console.error('Invalid flashcard deck:', deck);
                    return state;
                }

                const currentDecks = state.currentUser.CONFIG.flashcardDecks || [];
                const updatedDecks = [...currentDecks, deck];

                return {
                    currentUser: {
                        ...state.currentUser,
                        CONFIG: {
                            ...state.currentUser.CONFIG,
                            flashcardDecks: updatedDecks
                        }
                    }
                };
            }),

            updateFlashcardDeck: (id, updates) => set((state) => {
                if (!state.currentUser) return state;

                const currentDecks = state.currentUser.CONFIG.flashcardDecks || [];
                const updatedDecks = currentDecks.map(deck =>
                    deck.id === id ? { ...deck, ...updates } : deck
                );

                return {
                    currentUser: {
                        ...state.currentUser,
                        CONFIG: {
                            ...state.currentUser.CONFIG,
                            flashcardDecks: updatedDecks
                        }
                    }
                };
            }),

            deleteFlashcardDeck: (id) => set((state) => {
                if (!state.currentUser) return state;

                const currentDecks = state.currentUser.CONFIG.flashcardDecks || [];
                const updatedDecks = currentDecks.filter(deck => deck.id !== id);

                return {
                    currentUser: {
                        ...state.currentUser,
                        CONFIG: {
                            ...state.currentUser.CONFIG,
                            flashcardDecks: updatedDecks
                        }
                    }
                };
            }),

            // Data Cleanup and Maintenance
            cleanupDuplicates: () => set((state) => {
                if (!state.currentUser) return state;

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: deduplicateScheduleItems(state.currentUser.SCHEDULE_ITEMS),
                        EXAMS: deduplicateExams(state.currentUser.EXAMS),
                        RESULTS: deduplicateResults(state.currentUser.RESULTS)
                    }
                };
            }),

            sortScheduleItems: () => set((state) => {
                if (!state.currentUser) return state;

                return {
                    currentUser: {
                        ...state.currentUser,
                        SCHEDULE_ITEMS: sortScheduleItemsByDate(state.currentUser.SCHEDULE_ITEMS)
                    }
                };
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