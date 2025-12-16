/**
 * Offline Manager
 * Handles offline/online detection, data synchronization, and offline operations
 */

import { dbManager } from './dbManager';
import { StudentData, ScheduleItem, ExamData, ResultData, FlashcardDeck, Config } from '../types';

type NetworkStatus = 'online' | 'offline' | 'checking';

class OfflineManager {
    private networkStatus: NetworkStatus = 'checking';
    private listeners: Set<(status: NetworkStatus) => void> = new Set();
    private syncInProgress = false;

    constructor() {
        this.init();
    }

    /**
     * Initialize offline manager
     */
    private init() {
        // Check initial network status
        this.updateNetworkStatus();

        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('Network: Online');
            this.updateNetworkStatus();
            this.syncWhenOnline();
        });

        window.addEventListener('offline', () => {
            console.log('Network: Offline');
            this.updateNetworkStatus();
        });

        // Periodic network check (every 30 seconds)
        setInterval(() => {
            this.checkNetworkStatus();
        }, 30000);

        // Initialize IndexedDB
        dbManager.init().catch(err => {
            console.error('Failed to initialize IndexedDB:', err);
        });
    }

    /**
     * Update network status
     */
    private updateNetworkStatus() {
        const wasOffline = this.networkStatus === 'offline';
        this.networkStatus = navigator.onLine ? 'online' : 'offline';

        // Notify listeners
        this.listeners.forEach(listener => listener(this.networkStatus));

        // If we just came online, trigger sync
        if (wasOffline && this.networkStatus === 'online') {
            this.syncWhenOnline();
        }
    }

    /**
     * Check network status by making a lightweight request
     */
    private async checkNetworkStatus() {
        try {
            const response = await fetch('/api/status', {
                method: 'HEAD',
                cache: 'no-cache',
            });

            if (response.ok) {
                if (this.networkStatus !== 'online') {
                    this.networkStatus = 'online';
                    this.listeners.forEach(listener => listener('online'));
                    this.syncWhenOnline();
                }
            } else {
                this.networkStatus = 'offline';
                this.listeners.forEach(listener => listener('offline'));
            }
        } catch (error) {
            this.networkStatus = 'offline';
            this.listeners.forEach(listener => listener('offline'));
        }
    }

    /**
     * Subscribe to network status changes
     */
    onNetworkStatusChange(callback: (status: NetworkStatus) => void): () => void {
        this.listeners.add(callback);
        // Immediately call with current status
        callback(this.networkStatus);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Get current network status
     */
    getNetworkStatus(): NetworkStatus {
        return this.networkStatus;
    }

    /**
     * Check if online
     */
    isOnline(): boolean {
        return this.networkStatus === 'online';
    }

    /**
     * Check if offline
     */
    isOffline(): boolean {
        return this.networkStatus === 'offline';
    }

    /**
     * Save user data locally
     */
    async saveUserDataLocally(userData: StudentData): Promise<void> {
        try {
            await dbManager.saveUserData(userData);

            // Also save individual collections for easier access
            if (userData.SCHEDULE_ITEMS) {
                await dbManager.saveBatchScheduleItems(userData.SCHEDULE_ITEMS);
            }

            if (userData.EXAMS) {
                for (const exam of userData.EXAMS) {
                    await dbManager.saveExam(exam);
                }
            }

            if (userData.RESULTS) {
                for (const result of userData.RESULTS) {
                    await dbManager.saveResult(result);
                }
            }

            if (userData.CONFIG.flashcardDecks) {
                for (const deck of userData.CONFIG.flashcardDecks) {
                    await dbManager.saveFlashcardDeck(deck);
                }
            }

            console.log('User data saved locally');
        } catch (error) {
            console.error('Failed to save user data locally:', error);
            throw error;
        }
    }

    /**
     * Get user data from local storage
     */
    async getUserDataLocally(sid: string): Promise<StudentData | null> {
        try {
            const userData = await dbManager.getUserData(sid);

            if (userData) {
                // Reconstruct full user data from individual collections
                const scheduleItems = await dbManager.getScheduleItems();
                const exams = await dbManager.getExams();
                const results = await dbManager.getResults();
                const flashcardDecks = await dbManager.getFlashcardDecks();

                return {
                    ...userData,
                    SCHEDULE_ITEMS: scheduleItems,
                    EXAMS: exams,
                    RESULTS: results,
                    CONFIG: {
                        ...userData.CONFIG,
                        flashcardDecks: flashcardDecks,
                    },
                };
            }

            return null;
        } catch (error) {
            console.error('Failed to get user data locally:', error);
            return null;
        }
    }

    /**
     * Queue an operation for sync when online
     */
    async queueOperation(operation: {
        type: 'CREATE' | 'UPDATE' | 'DELETE';
        entity: 'SCHEDULE' | 'EXAM' | 'RESULT' | 'FLASHCARD' | 'CONFIG';
        data: any;
    }): Promise<void> {
        try {
            await dbManager.addToSyncQueue({
                ...operation,
                timestamp: Date.now(),
                status: 'PENDING',
            });

            console.log('Operation queued for sync:', operation);

            // If online, try to sync immediately
            if (this.isOnline()) {
                this.syncWhenOnline();
            }
        } catch (error) {
            console.error('Failed to queue operation:', error);
            throw error;
        }
    }

    /**
     * Sync queued operations when online
     */
    private async syncWhenOnline() {
        if (this.syncInProgress || this.isOffline()) {
            return;
        }

        this.syncInProgress = true;
        console.log('Starting sync...');

        try {
            const queue = await dbManager.getSyncQueue();
            const pendingOps = queue.filter(op => op.status === 'PENDING');

            for (const op of pendingOps) {
                try {
                    await this.executeSyncOperation(op);
                    await dbManager.removeSyncQueueItem(op.id);
                    console.log('Synced operation:', op);
                } catch (error) {
                    console.error('Failed to sync operation:', op, error);
                    // Mark as failed but keep in queue for retry
                }
            }

            console.log('Sync completed');
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Execute a sync operation
     */
    private async executeSyncOperation(op: any): Promise<void> {
        // This would call the actual API
        // For now, just a placeholder
        console.log('Executing sync operation:', op);

        // TODO: Implement actual API calls based on operation type
        // Example:
        // if (op.type === 'CREATE' && op.entity === 'SCHEDULE') {
        //     await api.saveTask(op.data);
        // }
    }

    /**
     * Force sync now (if online)
     */
    async forceSync(): Promise<void> {
        if (this.isOnline()) {
            await this.syncWhenOnline();
        } else {
            throw new Error('Cannot sync while offline');
        }
    }

    /**
     * Get sync queue status
     */
    async getSyncStatus(): Promise<{
        pending: number;
        failed: number;
        total: number;
    }> {
        const queue = await dbManager.getSyncQueue();
        return {
            pending: queue.filter(op => op.status === 'PENDING').length,
            failed: queue.filter(op => op.status === 'FAILED').length,
            total: queue.length,
        };
    }

    /**
     * Clear sync queue (use with caution!)
     */
    async clearSyncQueue(): Promise<void> {
        await dbManager.clearSyncQueue();
    }

    /**
     * Cache API response
     */
    async cacheResponse(key: string, data: any, ttl?: number): Promise<void> {
        await dbManager.cacheData(key, data, ttl);
    }

    /**
     * Get cached response
     */
    async getCachedResponse(key: string): Promise<any | null> {
        return dbManager.getCachedData(key);
    }

    /**
     * Clear expired cache
     */
    async clearExpiredCache(): Promise<void> {
        await dbManager.clearExpiredCache();
    }
}

// Export singleton instance
export const offlineManager = new OfflineManager();

// Export hook for React components
export const useOfflineStatus = () => {
    const [status, setStatus] = React.useState<NetworkStatus>(offlineManager.getNetworkStatus());

    React.useEffect(() => {
        const unsubscribe = offlineManager.onNetworkStatusChange(setStatus);
        return unsubscribe;
    }, []);

    return {
        status,
        isOnline: status === 'online',
        isOffline: status === 'offline',
        isChecking: status === 'checking',
    };
};

// Add React import for the hook
import React from 'react';
