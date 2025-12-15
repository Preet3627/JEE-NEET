import { StudentData, ScheduleItem, Config, ResultData, ExamData, DoubtData, StudySession } from '../types';

const API_URL = '/api';

// This function will handle responses, safely parsing JSON or text.
const handleResponse = async (res: Response, url: string) => {
    const responseText = await res.text();
    if (!res.ok) {
        try {
            const errorJson = JSON.parse(responseText);
            // Check for AI-specific quota error
            if (res.status === 429 && url.includes('/ai/')) {
                return { error: 'AI_QUOTA_EXCEEDED', message: errorJson.error || 'AI service temporarily unavailable due to quota limits.' };
            }
            throw errorJson; // Throw the whole object
        } catch {
            throw new Error(responseText || `HTTP error! status: ${res.status}`);
        }
    }
    try {
        // Handle successful but empty responses (like 204 No Content)
        return responseText ? JSON.parse(responseText) : {};
    } catch {
        // If response is not JSON, but success (e.g., plain text success message)
        // Return the raw text or a success object depending on expected behavior
        // For now, let's assume successful responses are always JSON or empty
        console.warn("Server returned non-JSON response for a successful call:", responseText);
        return responseText; // Return raw text if not parsable as JSON
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
        // For blob response types, handle them directly here without parsing as JSON
        if ((options as { returnRawResponse?: boolean }).returnRawResponse) { // Custom option to signal raw response needed
            return response;
        }
        return handleResponse(response, url); // Pass the url here
    } catch (error) {
        console.warn('API call failed, request might be queued. Make sure the backend is running and accessible.', error);
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
    getStatus: () => publicFetch('/status'),

    // Auth
    login: (sid: string, password: string) => publicFetch('/login', { method: 'POST', body: JSON.stringify({ sid, password }) }),
    googleLogin: (credential: string) => publicFetch('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
    register: (formData: any) => publicFetch('/register', { method: 'POST', body: JSON.stringify(formData) }),
    verifyEmail: (email: string, code: string) => publicFetch('/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
    resendVerificationEmail: (email: string) => publicFetch('/resend-verification-email', { method: 'POST', body: JSON.stringify({ email }) }),
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
    batchMoveTasks: (taskIds: string[], newDate: string) => authFetch('/schedule-items/batch-move', { method: 'POST', body: JSON.stringify({ taskIds, newDate }) }),
    updateConfig: (config: Partial<Config>) => authFetch('/config', { method: 'POST', body: JSON.stringify(config) }),
    fullSync: (userData: StudentData) => authFetch('/user-data/full-sync', { method: 'POST', body: JSON.stringify({ userData }) }),
    updateResult: (result: ResultData) => authFetch('/results', { method: 'PUT', body: JSON.stringify({ result }) }),
    deleteResult: (resultId: string) => authFetch('/results', { method: 'DELETE', body: JSON.stringify({ resultId }) }),
    addExam: (exam: ExamData) => authFetch('/exams', { method: 'POST', body: JSON.stringify({ exam }) }),
    updateExam: (exam: ExamData) => authFetch(`/exams/${exam.ID}`, { method: 'PUT', body: JSON.stringify({ exam }) }),
    deleteExam: (examId: string) => authFetch(`/exams/${examId}`, { method: 'DELETE' }),
    // FIX: Added missing saveStudySession API endpoint.
    saveStudySession: (session: Omit<StudySession, 'date'> & { date: string }) => authFetch('/study-sessions', { method: 'POST', body: JSON.stringify({ session }) }),

    // Doubts
    getAllDoubts: () => authFetch('/doubts/all'),
    postDoubt: (question: string, image?: string) => authFetch('/doubts', { method: 'POST', body: JSON.stringify({ question, question_image: image }) }),
    postSolution: (doubtId: string, solution: string, image?: string) => authFetch(`/doubts/${doubtId}/solutions`, { method: 'POST', body: JSON.stringify({ solution, solution_image: image }) }),
    // FIX: Added missing updateDoubtStatus API endpoint.
    updateDoubtStatus: (doubtId: string, status: 'archived' | 'deleted') => authFetch(`/admin/doubts/${doubtId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

    // Admin
    getStudents: () => authFetch('/admin/students'),
    deleteStudent: (sid: string) => authFetch(`/admin/students/${sid}`, { method: 'DELETE' }),
    clearStudentData: (sid: string) => authFetch(`/admin/students/${sid}/clear-data`, { method: 'POST' }),
    impersonateStudent: (sid: string) => authFetch(`/admin/impersonate/${sid}`, { method: 'POST' }),
    broadcastTask: (task: ScheduleItem, examType: 'ALL' | 'JEE' | 'NEET') => authFetch('/admin/broadcast-task', { method: 'POST', body: JSON.stringify({ task, examType }) }),
    getGlobalSetting: (key: string) => authFetch(`/admin/settings/${key}`),
    updateGlobalSetting: (key: string, value: string) => authFetch('/admin/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),
    savePushSubscription: (subscription: PushSubscription) => authFetch('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
    deletePushSubscription: () => authFetch('/push/unsubscribe', { method: 'POST' }),

    // Study Material
    // FIX: Added missing getStudyMaterial API endpoint.
    getStudyMaterial: (path: string) => authFetch(`/study-material/browse?path=${encodeURIComponent(path)}`),
    // FIX: Correctly handle blob response for file content.
    getStudyMaterialContent: (path: string) => authFetch(`/study-material/content?path=${encodeURIComponent(path)}`, { returnRawResponse: true } as RequestInit).then(res => (res as Response).blob()),
    // FIX: Added missing getStudyMaterialDetails API endpoint.
    getStudyMaterialDetails: (paths: string[]) => authFetch('/study-material/details', { method: 'POST', body: JSON.stringify({ paths }) }),
    
    // Music
    getMusicFiles: (path: string) => authFetch(`/music/browse?path=${encodeURIComponent(path)}`),
    getMusicContentUrl: (path: string) => `${API_URL}/music/content?path=${encodeURIComponent(path)}&token=${localStorage.getItem('token')}`, // Directly returns URL for audio element
    getMusicAlbumArtUrl: (path: string) => `${API_URL}/music/album-art?path=${encodeURIComponent(path)}&token=${localStorage.getItem('token')}`, // Directly returns URL for audio element

    // AI
    parseText: (text: string, domain: string) => authFetch('/ai/parse-text', { method: 'POST', body: JSON.stringify({ text, domain }) }),
    correctJson: (brokenJson: string) => authFetch('/ai/correct-json', { method: 'POST', body: JSON.stringify({ brokenJson }) }),
    aiChat: (data: { history: any[]; prompt: string; imageBase64?: string; domain: string }) => authFetch('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
    // FIX: Added missing getDailyInsight API endpoint.
    getDailyInsight: (data: { weaknesses: string[]; syllabus?: string }) => authFetch('/ai/daily-insight', { method: 'POST', body: JSON.stringify(data) }),
    // FIX: Added missing analyzeMistake API endpoint.
    analyzeMistake: (data: { prompt: string; imageBase64?: string }) => authFetch('/ai/analyze-mistake', { method: 'POST', body: JSON.stringify(data) }),
    // FIX: Added missing solveDoubt API endpoint.
    solveDoubt: (data: { prompt: string; imageBase64?: string }) => authFetch('/ai/solve-doubt', { method: 'POST', body: JSON.stringify(data) }),
    // FIX: Added missing analyzeSpecificMistake API endpoint.
    analyzeSpecificMistake: (data: { prompt: string; imageBase64?: string }) => authFetch('/ai/analyze-specific-mistake', { method: 'POST', body: JSON.stringify(data) }),
    analyzeTestResults: (data: { imageBase64: string; userAnswers: Record<string, string | string[]>; timings: Record<number, number>; syllabus: string }) => authFetch('/ai/analyze-test-results', { method: 'POST', body: JSON.stringify(data) }),
    generateFlashcards: (data: { topic: string; syllabus?: string }) => authFetch('/ai/generate-flashcards', { method: 'POST', body: JSON.stringify(data) }),
    generateAnswerKey: (prompt: string) => authFetch('/ai/generate-answer-key', { method: 'POST', body: JSON.stringify({ prompt }) }),
    // FIX: Updated generatePracticeTest to include more specific parameters for AI generation.
    generatePracticeTest: (data: { topic: string; numQuestions: number; difficulty: string; questionTypes: ('MCQ' | 'NUM' | 'MULTI_CHOICE')[]; isPYQ: boolean; chapters: string[] }) => authFetch('/ai/generate-practice-test', { method: 'POST', body: JSON.stringify(data) }),
};