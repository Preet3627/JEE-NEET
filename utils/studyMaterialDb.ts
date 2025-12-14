import { openDB, DBSchema } from 'idb';
import { StudyMaterialItem } from '../types';

interface StudyMaterialDB extends DBSchema {
  materials: {
    key: string;
    value: {
        item: StudyMaterialItem;
        blob: Blob;
    };
  };
}

const dbPromise = openDB<StudyMaterialDB>('study-material-cache', 1, {
  upgrade(db) {
    db.createObjectStore('materials', { keyPath: 'item.path' });
  },
});

export const addStudyMaterialToDb = async (item: StudyMaterialItem, blob: Blob) => {
  return (await dbPromise).put('materials', { item, blob });
};

export const getStudyMaterialFromDb = async (path: string) => {
  return (await dbPromise).get('materials', path);
};

export const getAllStudyMaterialsFromDb = async () => {
  return (await dbPromise).getAll('materials');
};

export const deleteStudyMaterialFromDb = async (path: string) => {
  return (await dbPromise).delete('materials', path);
};
