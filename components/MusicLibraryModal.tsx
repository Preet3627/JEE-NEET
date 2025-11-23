import React, { useState, useEffect } from 'react';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Track } from '../types';
import StaticWaveform from './StaticWaveform';

interface MusicLibraryModalProps { onClose: () => void; }

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ onClose }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack, currentTrack, isPlaying, play, pause, updateTrackMetadata } = useMusicPlayer();
    const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', artist: '' });

    useEffect(() => {
        api.getMusicFiles('/').then(data => {
            if(Array.isArray(data)) {
                setTracks(data.filter(f => f.name.match(/\.(mp3|m4a|wav)$/i)).map(f => ({
                    id: f.path, title: f.name.replace(/\.[^/.]+$/, ""), artist: 'Unknown Artist', 
                    album: 'Nextcloud', track: '1', coverArt: '', duration: '--:--', size: f.size.toString(), path: f.path, isLocal: false
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

    // Gradient generator
    const getGradient = (id: string) => {
        const colors = ['from-pink-500 to-rose-500', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-violet-500 to-purple-500', 'from-amber-500 to-orange-500'];
        return colors[id.length % colors.length];
    };

    const filteredTracks = tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-xl" onClick={onClose}>
            <div className="w-full max-w-5xl h-[85vh] bg-[#0a0a0a] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                <header className="p-6 bg-gradient-to-r from-gray-900 via-gray-800 to-black border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Icon name="music" className="text-purple-500" /> Cloud Library</h2>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="bg-black/30 border border-white/10 rounded-full px-4 py-2 text-sm text-white w-64 focus:border-purple-500 outline-none" />
                </header>
                <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {filteredTracks.map(track => {
                        const isCurrent = currentTrack?.id === track.id;
                        const gradient = getGradient(track.id);
                        return (
                            <div key={track.id} className={`group relative flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all ${isCurrent ? 'bg-white/10' : ''}`} onClick={() => isCurrent && isPlaying ? pause() : playTrack(track, tracks)}>
                                {/* Dynamic Gradient Art */}
                                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                                    <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="text-white drop-shadow-md" />
                                </div>
                                
                                <div className="flex-grow min-w-0">
                                    {editingTrackId === track.id ? (
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white w-1/2" />
                                            <input value={editForm.artist} onChange={e => setEditForm({...editForm, artist: e.target.value})} className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-gray-300 w-1/3" />
                                            <button onClick={saveEdit} className="text-green-400 text-xs font-bold">SAVE</button>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className={`font-bold truncate ${isCurrent ? 'text-purple-400' : 'text-white'}`}>{track.title}</h3>
                                            <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                        </>
                                    )}
                                </div>

                                <div className="hidden group-hover:flex items-center gap-2">
                                    <button onClick={(e) => handleEditClick(e, track)} className="p-2 text-gray-500 hover:text-white bg-black/40 rounded-full"><Icon name="edit" /></button>
                                </div>
                                <div className="w-24 h-8 opacity-30"><StaticWaveform trackId={track.id} color={isCurrent ? '#a855f7' : '#525252'} /></div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};
export default MusicLibraryModal;