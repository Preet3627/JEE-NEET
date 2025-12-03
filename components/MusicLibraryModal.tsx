
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Track } from '../types';
import StaticWaveform from './StaticWaveform';

interface MusicLibraryModalProps { onClose: () => void; }

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ onClose }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [view, setView] = useState<'tracks' | 'playlists' | 'genres'>('tracks');
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack, currentTrack, isPlaying, pause, updateTrackMetadata, djDropSettings, setDjDropSettings, playDjDrop, playlists, createPlaylist, addToPlaylist, addToQueue, playNextInQueue } = useMusicPlayer();
    const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', artist: '' });
    const dropInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState(''); // State for local errors

    useEffect(() => {
        api.getMusicFiles('/').then(data => {
            if(Array.isArray(data)) {
                setTracks(data.filter(f => f.name.match(/\.(mp3|m4a|wav)$/i)).map(f => ({
                    id: f.path, title: f.name.replace(/\.[^/.]+$/, ""), artist: 'Unknown Artist', genre: 'Unclassified',
                    album: 'Cloud', track: '1', coverArt: '', duration: '--:--', size: f.size.toString(), path: f.path, isLocal: false
                })));
                setError('');
            }
        }).catch(err => {
            console.error("Failed to load music files:", err);
            setError(err.error || "Failed to load music files. Please check your Nextcloud configuration in .env.");
        });
    }, []);

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
                    if(newPl) addToPlaylist(newPl.id, track);
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

    const getGradient = (id: string) => {
        const colors = [
            'from-[#ff0055] to-[#ff00aa]', 
            'from-[#00ddff] to-[#0055ff]', 
            'from-[#00ff88] to-[#00aa44]', 
            'from-[#ffaa00] to-[#ff5500]', 
            'from-[#aa00ff] to-[#5500ff]'
        ];
        let hash = 0;
        for(let i=0; i<id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const filteredTracks = tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col pt-safe-top pb-safe-bottom">
            <div className="w-full h-full md:max-w-6xl md:mx-auto bg-[#111] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-none md:border md:border-white/10">
                
                <header className="p-4 md:p-6 bg-[#000] border-b border-white/5 flex flex-col gap-4 sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center gap-3">
                            <Icon name="music" className="text-white" /> LIBRARY
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><Icon name="arrow-left" className="w-6 h-6"/></button>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="w-full md:w-auto flex gap-2 bg-[#222] p-1 rounded-lg">
                            <button onClick={() => setView('tracks')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'tracks' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Tracks</button>
                            <button onClick={() => setView('playlists')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'playlists' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Playlists</button>
                            <button onClick={() => setView('genres')} className={`flex-1 md:flex-initial text-center md:px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'genres' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Genres</button>
                        </div>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tracks..." className="bg-[#222] border border-white/10 rounded-full px-5 py-3 text-base text-white w-full md:w-64 focus:border-cyan-500 outline-none transition-colors" />
                    </div>
                </header>

                <div className="flex-grow overflow-y-auto p-2 md:p-4 custom-scrollbar bg-[#050505] pb-24 md:pb-4">
                    {error ? (
                        <div className="text-center text-red-400 py-10 border-2 border-dashed border-red-500/30 rounded-lg mx-4">
                            <p className="font-semibold">Music Library Unavailable</p>
                            <p className="text-sm">{error}</p>
                            <p className="text-xs text-gray-500 mt-2">Please ensure Nextcloud WebDAV is configured correctly in your server's .env file.</p>
                        </div>
                    ) : (view === 'tracks' && (
                        <div className="space-y-2">
                             {filteredTracks.map(track => {
                                const isCurrent = currentTrack?.id === track.id;
                                const gradient = getGradient(track.id);
                                return (
                                    <div key={track.id} className={`group relative flex items-center gap-3 p-2 rounded-xl transition-all duration-300 border border-transparent hover:border-white/10 ${isCurrent ? 'bg-[#1a1a1a] border-l-4 border-l-cyan-500' : 'bg-[#111] hover:bg-[#161616]'}`} onClick={() => isCurrent && isPlaying ? pause() : playTrack(track, tracks)}>
                                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform relative overflow-hidden flex-shrink-0`}>
                                             <div className="absolute inset-0 bg-black/20"></div>
                                            <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="text-white w-6 h-6 md:w-8 md:h-8 drop-shadow-md z-10" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            {editingTrackId === track.id ? (
                                                <div className="flex flex-col md:flex-row gap-2" onClick={e => e.stopPropagation()}>
                                                    <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-base font-bold text-white w-full" />
                                                    <input value={editForm.artist} onChange={e => setEditForm({...editForm, artist: e.target.value})} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-sm text-gray-300 w-full" />
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
                                            <button onClick={(e) => handlePlayNext(e, track)} className="p-2 text-gray-400 hover:text-green-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Play Next"><Icon name="forward" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleAddToQueue(e, track)} className="p-2 text-gray-400 hover:text-cyan-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Add to Queue"><Icon name="schedule" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleAddToPlaylist(e, track)} className="p-2 text-gray-400 hover:text-yellow-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Add to Playlist"><Icon name="plus" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleEditClick(e, track)} className="p-2 text-gray-400 hover:text-white bg-[#222] rounded-full hover:bg-[#333] transition-colors"><Icon name="edit" className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
export default MusicLibraryModal;