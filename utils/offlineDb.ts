import { openDB, IDBPDatabase } from 'idb';
import { StudentData } from '../types';

const DB_NAME = 'jee-scheduler-db';
const DB_VERSION = 1;
const STORE_NAME = 'user-data';

let db: IDBPDatabase;

/**
 * Initializes the IndexedDB database.
 */
async function initDb(): Promise<IDBPDatabase> {
    if (db) {
        return db;
    }
    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'sid' });
            }
        },
    });
    return db;
}

/**
 * Saves the current user's data to IndexedDB.
 * @param userData The StudentData object to save.
 */
export async function saveUserDataOffline(userData: StudentData): Promise<void> {
    try {
        const database = await initDb();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.store.put(userData);
        await tx.done;
        console.log('User data saved offline successfully.');
    } catch (error) {
        console.error('Failed to save user data offline:', error);
        throw error;
    }
}

/**
 * Retrieves the current user's data from IndexedDB.
 * @param sid The student ID of the user to retrieve.
 * @returns The StudentData object if found, otherwise null.
 */
export async function getUserDataOffline(sid: string): Promise<StudentData | null> {
    try {
        const database = await initDb();
        const userData = await database.get(STORE_NAME, sid);
        console.log('Retrieved user data offline:', userData);
        return userData || null;
    } catch (error) {
        console.error('Failed to retrieve user data offline:', error);
        return null;
    }
}

/**
 * Clears all user data from the offline store.
 */
export async function clearOfflineUserData(): Promise<void> {
    try {
        const database = await initDb();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.store.clear();
        await tx.done;
        console.log('Offline user data cleared.');
    } catch (error) {
        console.error('Failed to clear offline user data:', error);
        throw error;
    }
}
