import { openDB, DBSchema } from 'idb';
import { Track } from '../types';

interface MusicDB extends DBSchema {
  tracks: {
    key: string;
    value: {
        track: Track;
        blob: Blob;
    };
  };
}

const dbPromise = openDB<MusicDB>('music-cache', 1, {
  upgrade(db) {
    db.createObjectStore('tracks', { keyPath: 'track.id' });
  },
});

export const addTrackToDb = async (track: Track, blob: Blob) => {
  return (await dbPromise).put('tracks', { track, blob });
};

export const getTrackFromDb = async (id: string) => {
  return (await dbPromise).get('tracks', id);
};

export const getAllTracksFromDb = async () => {
  return (await dbPromise).getAll('tracks');
};

export const deleteTrackFromDb = async (id: string) => {
  return (await dbPromise).delete('tracks', id);
};
