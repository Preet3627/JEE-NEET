
import { StudentData, ScheduleItem, Config, ResultData, ExamData } from '../types';

const API_URL = '/api';

// This function will handle responses, safely parsing JSON or text.
const handleResponse = async (res: Response) => {
    const responseText = await res.text();
    if (!res.ok) {
        try {
            const errorJson = JSON.parse(responseText);
            throw errorJson; // Throw the whole object
        } catch {
            throw new Error(responseText || `HTTP error! status: ${res.status}`);
        }
    }
    try {
        // Handle successful but empty responses (like 204 No Content)
        return responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error('Failed to parse server response.');
    }
};

// Centralized fetch logic that adds the auth token
export const authFetch = async (url: string, options: RequestInit = {}) => {
    const fullUrl = `${API_URL}${url}`;
    const token = localStorage.getItem('token');
    
    const headersInit: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (token) {
        if (headersInit instanceof Headers) {
            headersInit.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(headersInit)) {
            headersInit.push(['Authorization', `Bearer ${token}`]);
        } else {
            headersInit['Authorization'] = `Bearer ${token}`;
        }
    }

    const fetchOptions = { ...options, headers: headersInit };

    try {
        const response = await fetch(fullUrl, fetchOptions);
        if (response.status === 401) {
             // Dispatch a global event for the AuthContext to handle logout
             window.dispatchEvent(new Event('auth-error'));
             throw new Error('Unauthorized');
        }
        return handleResponse(response);
    } catch (error) {
        console.warn('API call failed, request might be queued.', error);
        // Offline queueing logic could be implemented here if needed
        throw error;
    }
};

// Helper for public fetch calls (no token)
const publicFetch = (url: string, options: RequestInit = {}) => {
    const fullUrl = `${API_URL}${url}`;
    const fetchOptions = {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
    };
    return fetch(fullUrl, fetchOptions).then(handleResponse);
};

// Collection of all API call functions
export const api = {
    // Config
    getPublicConfig: () => fetch(`${API_URL}/config/public`).then(handleResponse),

    // Auth
    login: (sid: string, password: string) => publicFetch('/login', { method: 'POST', body: JSON.stringify({ sid, password }) }),
    googleLogin: (credential: string) => publicFetch('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
    register: (formData: any) => publicFetch('/register', { method: 'POST', body: JSON.stringify(formData) }),
    verifyEmail: (email: string, code: string) => publicFetch('/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
    forgotPassword: (email: string) => publicFetch('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) => publicFetch('/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    
    // User Data
    getMe: () => authFetch('/me'),
    heartbeat: () => authFetch('/heartbeat', { method: 'POST' }),
    updateProfile: (data: { fullName?: string; profilePhoto?: string }) => authFetch('/profile', { method: 'PUT', body: JSON.stringify(data) }),
    generateApiToken: () => authFetch('/me/api-token', { method: 'POST' }),
    revokeApiToken: () => authFetch('/me/api-token', { method: 'DELETE' }),
    saveTask: (task: ScheduleItem) => authFetch('/schedule-items', { method: 'POST', body: JSON.stringify({ task }) }),
    saveBatchTasks: (tasks: ScheduleItem[]) => authFetch('/schedule-items/batch', { method: 'POST', body: JSON.stringify({ tasks }) }),
    deleteTask: (taskId: string) => authFetch(`/schedule-items/${taskId}`, { method: 'DELETE' }),
    deleteBatchTasks: (taskIds: string[]) => authFetch('/schedule-items/batch-delete', { method: 'POST', body: JSON.stringify({ taskIds }) }),
    clearAllSchedule: () => authFetch('/schedule-items/clear-all', { method: 'POST' }),
    moveBatchTasks: (taskIds: string[], newDate: string) => authFetch('/schedule-items/batch-move', { method: 'POST', body: JSON.stringify({ taskIds, newDate }) }),
    updateConfig: (updates: Partial<Config>) => authFetch('/config', { method: 'POST', body: JSON.stringify(updates) }),
    fullSync: (userData: StudentData) => authFetch('/user-data/full-sync', { method: 'POST', body: JSON.stringify({ userData }) }),
    updateResult: (result: ResultData) => authFetch('/results', { method: 'PUT', body: JSON.stringify({ result }) }),
    deleteResult: (resultId: string) => authFetch('/results', { method: 'DELETE', body: JSON.stringify({ resultId }) }),


    // Doubts
    getAllDoubts: () => authFetch('/doubts/all'),
    postDoubt: (question: string, question_image?: string) => authFetch('/doubts', { method: 'POST', body: JSON.stringify({ question, question_image }) }),
    postSolution: (doubtId: string, solution: string, solution_image?: string) => authFetch(`/doubts/${doubtId}/solutions`, { method: 'POST', body: JSON.stringify({ solution, solution_image }) }),
    updateDoubtStatus: (doubtId: string, status: 'archived' | 'deleted') => authFetch(`/admin/doubts/${doubtId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),


    // Study Material
    getStudyMaterial: (path: string) => authFetch(`/study-material/browse?path=${encodeURIComponent(path)}`),
    getStudyMaterialDetails: (paths: string[]) => authFetch('/study-material/details', { method: 'POST', body: JSON.stringify({ paths }) }),
    getStudyMaterialContent: async (path: string): Promise<Blob> => {
        const fullUrl = `${API_URL}/study-material/content?path=${encodeURIComponent(path)}`;
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(fullUrl, { headers });

        if (!res.ok) {
            if (res.status === 401) {
                window.dispatchEvent(new Event('auth-error'));
            }
            const errorText = await res.text().catch(() => `HTTP error! status: ${res.status}`);
            throw new Error(errorText);
        }
        return res.blob();
    },

    // Music (WebDAV via Nextcloud)
    getMusicFiles: (path: string) => authFetch(`/music/browse?path=${encodeURIComponent(path)}`),
    getMusicContentUrl: (path: string): string => {
        const token = localStorage.getItem('token');
        return `${API_URL}/music/content?path=${encodeURIComponent(path)}&token=${token}`;
    },


    // Admin
    getStudents: () => authFetch('/admin/students'),
    impersonateStudent: (sid: string) => authFetch(`/admin/impersonate/${sid}`, { method: 'POST' }),
    broadcastTask: (task: ScheduleItem, examType: 'JEE' | 'NEET' | 'ALL') => authFetch('/admin/broadcast-task', { method: 'POST', body: JSON.stringify({ task, examType }) }),
    deleteStudent: (sid: string) => authFetch(`/admin/students/${sid}`, { method: 'DELETE' }),
    clearStudentData: (sid: string) => authFetch(`/admin/students/${sid}/clear-data`, { method: 'POST' }),
    
    // AI (secure backend endpoints)
    getDailyInsight: (data: { weaknesses: string[], syllabus?: string }) => authFetch('/ai/daily-insight', { method: 'POST', body: JSON.stringify(data) }),
    aiChat: (data: { history: any[]; prompt: string; imageBase64?: string; domain?: string }) => authFetch('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
    analyzeMistake: (data: { prompt: string; imageBase64?: string; }) => authFetch('/ai/analyze-mistake', { method: 'POST', body: JSON.stringify(data) }),
    solveDoubt: (data: { prompt: string; imageBase64?: string; }) => authFetch('/ai/solve-doubt', { method: 'POST', body: JSON.stringify(data) }),
    parseText: (text: string, domain: string) => authFetch('/ai/parse-text', { method: 'POST', body: JSON.stringify({ text, domain }) }),
    correctJson: (brokenJson: string) => authFetch('/ai/correct-json', { method: 'POST', body: JSON.stringify({ brokenJson }) }),
    analyzeTestResults: (data: { imageBase64: string; userAnswers: Record<string, string>; timings: Record<string, number>, syllabus: string }) => authFetch('/ai/analyze-test-results', { method: 'POST', body: JSON.stringify(data) }),
    analyzeSpecificMistake: (data: { imageBase64: string; prompt: string; }) => authFetch('/ai/analyze-specific-mistake', { method: 'POST', body: JSON.stringify(data) }),
    generateFlashcards: (data: { topic: string; syllabus?: string; }) => authFetch('/ai/generate-flashcards', { method: 'POST', body: JSON.stringify(data) }),
    generateAnswerKey: (prompt: string) => authFetch('/ai/generate-answer-key', { method: 'POST', body: JSON.stringify({ prompt }) }),
    generatePracticeTest: (data: { topic: string; numQuestions: number; difficulty: string; }) => authFetch('/ai/generate-practice-test', { method: 'POST', body: JSON.stringify(data) }),
};
