
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Track, LocalPlaylist } from '../types';
import StaticWaveform from './StaticWaveform';

interface MusicLibraryModalProps { onClose: () => void; }

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ onClose }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [view, setView] = useState<'tracks' | 'playlists' | 'genres'>('tracks');
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack, currentTrack, isPlaying, play, pause, updateTrackMetadata, djDropSettings, setDjDropSettings, playDjDrop, playlists, createPlaylist, addToPlaylist } = useMusicPlayer();
    const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', artist: '' });
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const dropInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api.getMusicFiles('/').then(data => {
            if(Array.isArray(data)) {
                setTracks(data.filter(f => f.name.match(/\.(mp3|m4a|wav)$/i)).map(f => ({
                    id: f.path, title: f.name.replace(/\.[^/.]+$/, ""), artist: 'Unknown Artist', genre: 'Unclassified',
                    album: 'Cloud', track: '1', coverArt: '', duration: '--:--', size: f.size.toString(), path: f.path, isLocal: false
                })));
            }
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
    
    const handleDropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setDjDropSettings({...djDropSettings, customDropUrl: ev.target?.result as string});
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddToPlaylist = (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        const playlistName = prompt("Enter playlist name to add to (or create new):");
        if (playlistName) {
            let playlist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());
            if (!playlist) {
                createPlaylist(playlistName);
                // Wait for state update in real app, here simplistic sync
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

    // Grouping Logic
    const genres = tracks.reduce((acc, track) => {
        const g = track.genre || 'Unclassified';
        if (!acc[g]) acc[g] = [];
        acc[g].push(track);
        return acc;
    }, {} as Record<string, Track[]>);

    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" onClick={onClose}>
            <div className="w-full max-w-6xl h-[90vh] bg-[#111] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                
                <header className="p-6 bg-[#000] border-b border-white/5 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center gap-3">
                            <Icon name="music" className="text-white" /> LIBRARY
                        </h2>
                        
                        <div className="flex items-center gap-3 bg-[#222] p-2 rounded-full border border-white/10">
                             <button onClick={playDjDrop} className="px-4 py-1 bg-[#ff0055] text-white font-bold rounded-full hover:bg-[#d00044] text-xs shadow-[0_0_10px_#ff0055]">
                                DROP!
                             </button>
                             <div className="flex items-center gap-2 px-2 border-l border-white/10">
                                 <span className="text-xs text-gray-400 font-bold">AUTO</span>
                                 <div onClick={() => setDjDropSettings({...djDropSettings, autoTrigger: !djDropSettings.autoTrigger})} className={`w-8 h-4 rounded-full cursor-pointer relative transition-colors ${djDropSettings.autoTrigger ? 'bg-green-500' : 'bg-gray-600'}`}>
                                     <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${djDropSettings.autoTrigger ? 'left-4.5' : 'left-0.5'}`}></div>
                                 </div>
                             </div>
                             <button onClick={() => dropInputRef.current?.click()} className="text-gray-400 hover:text-white"><Icon name="upload" className="w-4 h-4" /></button>
                             <input type="file" ref={dropInputRef} className="hidden" accept="audio/*" onChange={handleDropUpload} />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-2 bg-[#222] p-1 rounded-lg">
                            <button onClick={() => setView('tracks')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'tracks' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Tracks</button>
                            <button onClick={() => setView('playlists')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'playlists' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Playlists</button>
                            <button onClick={() => setView('genres')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${view === 'genres' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>Genres</button>
                        </div>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tracks..." className="bg-[#222] border border-white/10 rounded-full px-5 py-2 text-sm text-white w-full md:w-64 focus:border-cyan-500 outline-none transition-colors" />
                    </div>
                </header>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-[#050505]">
                    {view === 'tracks' && (
                        <div className="space-y-3">
                             {filteredTracks.map(track => {
                                const isCurrent = currentTrack?.id === track.id;
                                const gradient = getGradient(track.id);
                                return (
                                    <div key={track.id} className={`group relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300 border border-transparent hover:border-white/10 ${isCurrent ? 'bg-[#1a1a1a] border-l-4 border-l-cyan-500' : 'bg-[#111] hover:bg-[#161616]'}`} onClick={() => isCurrent && isPlaying ? pause() : playTrack(track, tracks)}>
                                        <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform relative overflow-hidden`}>
                                             <div className="absolute inset-0 bg-black/20"></div>
                                            <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="text-white w-8 h-8 drop-shadow-md z-10" />
                                        </div>
                                        <div className="hidden md:block w-32 h-8 opacity-40 group-hover:opacity-80 transition-opacity">
                                             <StaticWaveform trackId={track.id} color={isCurrent ? '#06b6d4' : '#444'} />
                                        </div>
                                        <div className="flex-grow min-w-0 pl-4">
                                            {editingTrackId === track.id ? (
                                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-lg font-bold text-white w-full" />
                                                    <input value={editForm.artist} onChange={e => setEditForm({...editForm, artist: e.target.value})} className="bg-[#333] border border-white/20 rounded px-2 py-1 text-sm text-gray-300 w-full" />
                                                    <button onClick={saveEdit} className="px-3 bg-green-600 rounded text-white font-bold text-xs">OK</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 className={`text-lg font-bold truncate ${isCurrent ? 'text-cyan-400' : 'text-gray-200 group-hover:text-white'}`}>{track.title}</h3>
                                                    <p className="text-sm text-gray-500 font-medium truncate">{track.artist}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => handleAddToPlaylist(e, track)} className="p-2 text-gray-400 hover:text-yellow-400 bg-[#222] rounded-full hover:bg-[#333] transition-colors" title="Add to Playlist"><Icon name="plus" className="w-4 h-4" /></button>
                                            <button onClick={(e) => handleEditClick(e, track)} className="p-2 text-gray-400 hover:text-white bg-[#222] rounded-full hover:bg-[#333] transition-colors"><Icon name="edit" className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {view === 'playlists' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div onClick={() => { const n = prompt("Playlist Name:"); if(n) createPlaylist(n); }} className="bg-[#111] border border-dashed border-gray-700 hover:border-cyan-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer h-48 transition-colors group">
                                <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center group-hover:bg-cyan-900/30 transition-colors mb-4">
                                    <Icon name="plus" className="w-8 h-8 text-gray-400 group-hover:text-cyan-400" />
                                </div>
                                <span className="text-gray-400 font-bold group-hover:text-white">Create Playlist</span>
                            </div>
                            {playlists.map(pl => (
                                <div key={pl.id} className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6 h-48 flex flex-col justify-between hover:bg-[#222] transition-colors cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-bl-full pointer-events-none"></div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{pl.name}</h3>
                                        <p className="text-sm text-gray-500">{pl.trackIds.length} tracks</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const plTracks = tracks.filter(t => pl.trackIds.includes(t.id));
                                            if(plTracks.length) playTrack(plTracks[0], plTracks);
                                        }}
                                        className="self-start px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105"
                                    >
                                        <Icon name="play" className="w-4 h-4" /> Play All
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'genres' && (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(genres).map(([genre, gTracks]) => (
                                <div key={genre} className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6 h-40 flex items-center gap-6 hover:bg-[#222] transition-colors cursor-pointer" onClick={() => playTrack(gTracks[0], gTracks)}>
                                    <div className={`w-24 h-24 rounded-lg bg-gradient-to-br ${getGradient(genre)} shadow-lg flex items-center justify-center`}>
                                        <span className="text-3xl font-black text-white opacity-50">{genre.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">{genre}</h3>
                                        <p className="text-sm text-gray-400">{gTracks.length} tracks</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default MusicLibraryModal;
