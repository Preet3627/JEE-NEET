
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Track } from '../types';
import StaticWaveform from './StaticWaveform';
import { addTrackToDb, getAllTracksFromDb, deleteTrackFromDb, getTrackFromDb } from '../utils/musicDb';
import { useServerStatus } from '../context/ServerStatusContext';

interface MusicLibraryModalProps { onClose: () => void; }

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    track?: Track;
}

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ onClose }) => {
    const { status } = useServerStatus();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [view, setView] = useState<'tracks' | 'playlists' | 'folders'>('tracks'); // 'genres' replaced/renamed if needed, or added
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack, currentTrack, isPlaying, pause, updateTrackMetadata, djDropSettings, setDjDropSettings, playDjDrop, playlists, createPlaylist, addToPlaylist, addToQueue, playNextInQueue } = useMusicPlayer();
    const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', artist: '' });
    const [error, setError] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // Folder view state
    const [currentPath, setCurrentPath] = useState<string>('/');

    const loadTracks = async (syncWithCloud = false) => {
        setIsSyncing(true);
        setError('');

        if (!syncWithCloud) {
            setTracks([]); // No local tracks to load without adding local files
            setIsSyncing(false);
            if (!status?.musicWebDAV.configured) {
                setError("The administrator has not configured the music library. You can still play music from cloud if configured.");
            }
            return;
        }

        if (!status?.musicWebDAV.configured) {
            setError("The administrator has not configured the music library. You can still play music from cloud if configured.");
            setIsSyncing(false);
            return;
        }

        // Fetch from remote
        try {
            const files = await api.getMusicFiles('/');
            if (Array.isArray(files)) {
                const audioFiles = files.filter(f => f.name.match(/\.(mp3|m4a|wav|flac|ogg)$/i));

                const remoteTracks = audioFiles.map(file => {
                    let title = file.name.replace(/\.[^/.]+$/, "");
                    let artist = 'Unknown Artist';
                    const separators = [" - ", " – ", "_-_"];
                    for (const sep of separators) {
                        if (title.includes(sep)) {
                            const parts = title.split(sep);
                            if (parts.length >= 2) {
                                artist = parts[0].trim();
                                title = parts.slice(1).join(sep).trim();
                                break;
                            }
                        }
                    }
                    // Basic metadata extraction from path if available
                    return {
                        id: file.path, title, artist, genre: 'Unclassified', album: 'Cloud', track: '1', coverArt: '', duration: '--:--', size: file.size.toString(), path: file.path, isLocal: false
                    };
                });

                setTracks(remoteTracks);
            }
        } catch (err: any) {
            console.error("Failed to load music files:", err);
            setError(err.error || "Failed to sync with cloud music library.");
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (status?.musicWebDAV.configured) {
            loadTracks(true);
        } else {
            loadTracks(false);
        }
    }, [status]);

    // Build File Tree for Folder View
    const fileTree = useMemo(() => {
        const root: FileNode = { name: 'Root', path: '/', type: 'folder', children: [] };

        tracks.forEach(track => {
            const currentTrackPath = track.path || '';
            const parts = currentTrackPath.split('/').filter(p => p); // remove empty strings
            let currentNode = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;

                if (isFile) {
                    currentNode.children?.push({
                        name: track.title || part, // Use parsed title if available
                        path: currentTrackPath,
                        type: 'file',
                        track: track
                    });
                } else {
                    let folder = currentNode.children?.find(c => c.name === part && c.type === 'folder');
                    if (!folder) {
                        folder = { name: part, path: currentNode.path === '/' ? `/${part}` : `${currentNode.path}/${part}`, type: 'folder', children: [] };
                        currentNode.children?.push(folder);
                    }
                    currentNode = folder;
                }
            }
        });
        return root;
    }, [tracks]);

    const getCurrentFolderContents = () => {
        // Traverse to current path
        if (currentPath === '/') return fileTree.children || [];

        const parts = currentPath.split('/').filter(p => p);
        let currentNode = fileTree;

        for (const part of parts) {
            const nextNode = currentNode.children?.find(c => c.name === part && c.type === 'folder');
            if (nextNode) {
                currentNode = nextNode;
            } else {
                return []; // Path not found
            }
        }
        return currentNode.children || [];
    };

    const handleFolderClick = (folderName: string) => {
        setCurrentPath(prev => prev === '/' ? `/${folderName}` : `${prev}/${folderName}`);
    };

    const handleBackClick = () => {
        const parts = currentPath.split('/').filter(p => p);
        if (parts.length === 0) return;
        parts.pop();
        setCurrentPath(parts.length === 0 ? '/' : `/${parts.join('/')}`);
    };

    // ... Existing handlers ...
    const handleEditClick = (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        setEditingTrackId(track.id);
        setEditForm({ title: track.title, artist: track.artist });
    };

    const saveEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingTrackId) {
            updateTrackMetadata(editingTrackId, editForm.title, editForm.artist);
            setTracks(prev => prev.map(t => t.id === editingTrackId ? { ...t, ...editForm } : t));
            setEditingTrackId(null);
        }
    };

    const handleAddToPlaylist = (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        const playlistName = prompt("Enter playlist name to add to (or create new):");
        if (playlistName) {
            let playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());
            if (!playlist) {
                createPlaylist(playlistName);
                setTimeout(() => {
                    const newPl = playlists.find(p => p.name === playlistName);
                    if (newPl) addToPlaylist(newPl.id, track);
                }, 100);
            } else {
                addToPlaylist(playlist.id, track);
            }
            alert("Added to playlist!");
        }
    };

    const handlePlayNext = (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        playNextInQueue(track);
    };

    const handleAddToQueue = (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        addToQueue(track);
    };

    const handleSaveOffline = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();

        if (!track.path) {
            alert('Cannot save this track offline (missing path).');
            return;
        }

        const existing = await getTrackFromDb(track.id);
        if (existing) {
            alert('This track is already saved for offline use.');
            return;
        }

        try {
            let blob: Blob;
            if (track.isLocal) {
                const response = await fetch(track.path);
                blob = await response.blob();
            } else {
                const response = await fetch(api.getMusicContentUrl(track.path));
                blob = await response.blob();
            }
            await addTrackToDb(track, blob);
            alert(`${track.title} has been saved for offline use.`);
            loadTracks();
        } catch (error) {
            console.error('Error saving track for offline use:', error);
            alert('Failed to save track for offline use.');
        }
    };

    const getGradient = (id: string) => {
        const gradients = ['gradient-1', 'gradient-2', 'gradient-3', 'gradient-4', 'gradient-5'];
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return gradients[Math.abs(hash) % gradients.length];
    };

    const filteredTracks = tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col pt-safe-top pb-safe-bottom">
            <div className="w-full h-full md:max-w-6xl md:mx-auto bg-[#111] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-none md:border md:border-white/10">
                <header className="p-4 md:p-6 bg-[#000] border-b border-white/5 flex flex-col gap-4 sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center gap-3">
                            <Icon name="music" className="text-white" /> LIBRARY
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><Icon name="arrow-left" className="w-6 h-6" /></button>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="w-full md:w-auto flex gap-2 bg-[#222] p-1 rounded-lg">
                            <button onClick={() => setView('tracks')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'tracks' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Tracks</button>
                            <button onClick={() => setView('playlists')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'playlists' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Playlists</button>
                            <button onClick={() => setView('folders')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'folders' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Folders</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => loadTracks(true)} disabled={isSyncing || !status?.musicWebDAV.configured} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                                <Icon name="refresh" className={isSyncing ? 'animate-spin' : ''} /> Sync
                            </button>
                        </div>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tracks..." className="bg-[#222] border border-white/10 rounded-full px-5 py-3 text-base text-white w-full md:w-64 focus:border-cyan-500 outline-none transition-colors" />
                    </div>
                </header>


                <div className="flex-grow overflow-y-auto p-2 md:p-4 custom-scrollbar bg-[#050505] pb-24 md:pb-4">
                    {error && (
                        <div className="text-center text-yellow-400 py-10 border-2 border-dashed border-yellow-500/30 rounded-lg mx-4">
                            <p className="font-semibold">Music Library Notice</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {(view === 'tracks' && !error) && (
                        <div className="space-y-2">
                            {filteredTracks.map(track => {
                                const isCurrent = currentTrack?.id === track.id;
                                const gradient = getGradient(track.id);
                                return (
                                    <div key={track.id} className={`group relative flex items-center gap-3 p-2 rounded-xl transition-all duration-300 border border-transparent hover:border-white/10 ${isCurrent ? 'bg-[#1a1a1a] border-l-4 border-l-cyan-500' : 'bg-[#111] hover:bg-[#161616]'}`} onClick={() => isCurrent && isPlaying ? pause() : playTrack(track, tracks)}>
                                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-lg ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform relative overflow-hidden flex-shrink-0`}>
                                            <div className="absolute inset-0 bg-black/20"></div>
                                            <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="text-white w-6 h-6 md:w-8 md:h-8 drop-shadow-md z-10" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            {editingTrackId === track.id ? (
                                                <div className="flex flex-col md:flex-row gap-2" onClick={e => e.stopPropagation()}>
                                                    <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-base font-bold text-white w-full" />
                                                    <input value={editForm.artist} onChange={e => setEditForm({ ...editForm, artist: e.target.value })} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-sm text-gray-300 w-full" />
                                                    <button onClick={saveEdit} className="px-3 bg-green-600 rounded text-white font-bold text-xs">OK</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 className={`text-base font-bold truncate ${isCurrent ? 'text-cyan-400' : 'text-gray-200 group-hover:text-white'}`}>{track.title}</h3>
                                                    <p className="text-sm text-gray-500 font-medium truncate">{track.artist}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => handleSaveOffline(e, track)} className="p-2 text-gray-400 hover:text-cyan-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Save Offline"><Icon name="download" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handlePlayNext(e, track)} className="p-2 text-gray-400 hover:text-green-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Play Next"><Icon name="forward" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleAddToQueue(e, track)} className="p-2 text-gray-400 hover:text-cyan-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Add to Queue"><Icon name="schedule" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleAddToPlaylist(e, track)} className="p-2 text-gray-400 hover:text-yellow-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Add to Playlist"><Icon name="plus" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleEditClick(e, track)} className="p-2 text-gray-400 hover:text-white bg-[#222] rounded-full hover:bg-[#333] transition-colors"><Icon name="edit" className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {(view === 'playlists' && !error) && (
                        <div className="space-y-4">
                            <button onClick={() => createPlaylist(prompt("Enter new playlist name:") || "New Playlist")} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-purple-600 hover:bg-purple-700">
                                <Icon name="plus" /> Create New Playlist
                            </button>
                            {playlists.map(playlist => (
                                <div key={playlist.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon name="playlist" className="w-6 h-6 text-purple-400" />
                                            <h3 className="font-bold text-white">{playlist.name}</h3>
                                            <span className="text-sm text-gray-400">({playlist.trackIds.length} tracks)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {(view === 'folders' && !error) && (
                        <div className="space-y-2">
                            {currentPath !== '/' && (
                                <button onClick={handleBackClick} className="flex items-center gap-2 p-2 text-cyan-400 hover:text-white mb-2">
                                    <Icon name="arrow-left" className="w-4 h-4" /> Back
                                </button>
                            )}
                            <p className="text-xs text-gray-500 mb-2 px-2 font-mono">{currentPath}</p>

                            {getCurrentFolderContents().map((node, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] cursor-pointer border border-transparent hover:border-white/10 transition-all"
                                    onClick={() => node.type === 'folder' ? handleFolderClick(node.name) : (node.track && playTrack(node.track, tracks))}
                                >
                                    <Icon name={node.type === 'folder' ? 'folder' : 'music'} className={`w-6 h-6 ${node.type === 'folder' ? 'text-yellow-400' : 'text-cyan-400'}`} />
                                    <div className="min-w-0">
                                        <p className="text-white font-medium truncate">{node.name}</p>
                                    </div>
                                </div>
                            ))}
                            {getCurrentFolderContents().length === 0 && <p className="text-center text-gray-500 py-10">Empty folder</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default MusicLibraryModal;

