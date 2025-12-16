/**
 * IndexedDB Manager for Offline Data Storage
 * Provides a robust local database for offline-first architecture
 */

import { StudentData, ScheduleItem, ExamData, ResultData, FlashcardDeck } from '../types';

const DB_NAME = 'JEE_NEET_Scheduler';
const DB_VERSION = 1;

// Store names
const STORES = {
    USER_DATA: 'userData',
    SCHEDULE_ITEMS: 'scheduleItems',
    EXAMS: 'exams',
    RESULTS: 'results',
    FLASHCARDS: 'flashcards',
    SYNC_QUEUE: 'syncQueue',
    CACHE: 'cache',
} as const;

class DBManager {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<IDBDatabase> | null = null;

    /**
     * Initialize the database
     */
    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                console.log('Upgrading IndexedDB schema...');

                // User Data Store
                if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
                    db.createObjectStore(STORES.USER_DATA, { keyPath: 'sid' });
                }

                // Schedule Items Store
                if (!db.objectStoreNames.contains(STORES.SCHEDULE_ITEMS)) {
                    const scheduleStore = db.createObjectStore(STORES.SCHEDULE_ITEMS, { keyPath: 'ID' });
                    scheduleStore.createIndex('type', 'type', { unique: false });
                    scheduleStore.createIndex('date', 'date', { unique: false });
                    scheduleStore.createIndex('subject', 'SUBJECT_TAG.EN', { unique: false });
                }

                // Exams Store
                if (!db.objectStoreNames.contains(STORES.EXAMS)) {
                    const examsStore = db.createObjectStore(STORES.EXAMS, { keyPath: 'ID' });
                    examsStore.createIndex('date', 'date', { unique: false });
                    examsStore.createIndex('subject', 'subject', { unique: false });
                }

                // Results Store
                if (!db.objectStoreNames.contains(STORES.RESULTS)) {
                    const resultsStore = db.createObjectStore(STORES.RESULTS, { keyPath: 'ID' });
                    resultsStore.createIndex('date', 'DATE', { unique: false });
                }

                // Flashcards Store
                if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
                    const flashcardsStore = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' });
                    flashcardsStore.createIndex('subject', 'subject', { unique: false });
                }

                // Sync Queue Store (for offline operations)
                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('status', 'status', { unique: false });
                }

                // Cache Store (for API responses)
                if (!db.objectStoreNames.contains(STORES.CACHE)) {
                    const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
                    cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                console.log('IndexedDB schema upgraded successfully');
            };
        });

        return this.initPromise;
    }

    /**
     * Generic get operation
     */
    async get<T>(storeName: string, key: string): Promise<T | null> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic get all operation
     */
    async getAll<T>(storeName: string): Promise<T[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic put operation
     */
    async put<T>(storeName: string, data: T): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic delete operation
     */
    async delete(storeName: string, key: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data from a store
     */
    async clear(storeName: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ===== User Data Operations =====

    async saveUserData(userData: StudentData): Promise<void> {
        await this.put(STORES.USER_DATA, userData);
        console.log('User data saved to IndexedDB');
    }

    async getUserData(sid: string): Promise<StudentData | null> {
        return this.get<StudentData>(STORES.USER_DATA, sid);
    }

    // ===== Schedule Items Operations =====

    async saveScheduleItem(item: ScheduleItem): Promise<void> {
        await this.put(STORES.SCHEDULE_ITEMS, item);
    }

    async getScheduleItems(): Promise<ScheduleItem[]> {
        return this.getAll<ScheduleItem>(STORES.SCHEDULE_ITEMS);
    }

    async deleteScheduleItem(id: string): Promise<void> {
        await this.delete(STORES.SCHEDULE_ITEMS, id);
    }

    async saveBatchScheduleItems(items: ScheduleItem[]): Promise<void> {
        const db = await this.init();
        const transaction = db.transaction(STORES.SCHEDULE_ITEMS, 'readwrite');
        const store = transaction.objectStore(STORES.SCHEDULE_ITEMS);

        for (const item of items) {
            store.put(item);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // ===== Exams Operations =====

    async saveExam(exam: ExamData): Promise<void> {
        await this.put(STORES.EXAMS, exam);
    }

    async getExams(): Promise<ExamData[]> {
        return this.getAll<ExamData>(STORES.EXAMS);
    }

    async deleteExam(id: string): Promise<void> {
        await this.delete(STORES.EXAMS, id);
    }

    // ===== Results Operations =====

    async saveResult(result: ResultData): Promise<void> {
        await this.put(STORES.RESULTS, result);
    }

    async getResults(): Promise<ResultData[]> {
        return this.getAll<ResultData>(STORES.RESULTS);
    }

    async deleteResult(id: string): Promise<void> {
        await this.delete(STORES.RESULTS, id);
    }

    // ===== Flashcards Operations =====

    async saveFlashcardDeck(deck: FlashcardDeck): Promise<void> {
        await this.put(STORES.FLASHCARDS, deck);
    }

    async getFlashcardDecks(): Promise<FlashcardDeck[]> {
        return this.getAll<FlashcardDeck>(STORES.FLASHCARDS);
    }

    async deleteFlashcardDeck(id: string): Promise<void> {
        await this.delete(STORES.FLASHCARDS, id);
    }

    // ===== Sync Queue Operations =====

    async addToSyncQueue(operation: {
        type: 'CREATE' | 'UPDATE' | 'DELETE';
        entity: 'SCHEDULE' | 'EXAM' | 'RESULT' | 'FLASHCARD' | 'CONFIG';
        data: any;
        timestamp: number;
        status: 'PENDING' | 'SYNCING' | 'FAILED';
    }): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
            const store = transaction.objectStore(STORES.SYNC_QUEUE);
            const request = store.add(operation);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSyncQueue(): Promise<any[]> {
        return this.getAll(STORES.SYNC_QUEUE);
    }

    async removeSyncQueueItem(id: number): Promise<void> {
        await this.delete(STORES.SYNC_QUEUE, id.toString());
    }

    async clearSyncQueue(): Promise<void> {
        await this.clear(STORES.SYNC_QUEUE);
    }

    // ===== Cache Operations =====

    async cacheData(key: string, data: any, ttl: number = 3600000): Promise<void> {
        await this.put(STORES.CACHE, {
            key,
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    async getCachedData(key: string): Promise<any | null> {
        const cached = await this.get<any>(STORES.CACHE, key);
        if (!cached) return null;

        // Check if cache is expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            await this.delete(STORES.CACHE, key);
            return null;
        }

        return cached.data;
    }

    async clearExpiredCache(): Promise<void> {
        const db = await this.init();
        const transaction = db.transaction(STORES.CACHE, 'readwrite');
        const store = transaction.objectStore(STORES.CACHE);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const cached = cursor.value;
                if (Date.now() - cached.timestamp > cached.ttl) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    }
}

// Export singleton instance
export const dbManager = new DBManager();
