
import React, { useState, useEffect } from 'react';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Track } from '../types';
import StaticWaveform from './StaticWaveform';

interface MusicLibraryModalProps {
  onClose: () => void;
}

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ onClose }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack, currentTrack, isPlaying, play, pause } = useMusicPlayer();
    
    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await api.getMusicFiles('/');
                if (data && Array.isArray(data)) {
                    // Filter for audio files only
                    const audioTracks = data.filter(f => f.name && f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i)).map(f => ({
                        id: f.path,
                        title: f.name.replace(/\.[^/.]+$/, ""),
                        artist: 'Unknown Artist', 
                        album: 'Nextcloud',
                        track: '1',
                        coverArt: '', 
                        duration: '--:--',
                        size: f.size.toString(),
                        path: f.path,
                        isLocal: false
                    }));
                    setTracks(audioTracks);
                } else {
                    setTracks([]);
                }
            } catch (err: any) {
                setError(err.error || "Failed to load music library. Ensure WebDAV is configured.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchLibrary();
    }, []);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    const handlePlay = (track: Track) => {
        if (currentTrack?.id === track.id) {
            if (isPlaying) pause();
            else play();
        } else {
            playTrack(track, tracks);
        }
    };

    const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
    const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

    const filteredTracks = tracks.filter(track =>
        track.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-lg ${animationClasses}`} onClick={handleClose}>
            <div className={`w-full h-full max-w-5xl max-h-[85vh] bg-[#121212] border border-gray-800 rounded-xl shadow-2xl ${contentAnimationClasses} flex overflow-hidden flex-col`} onClick={(e) => e.stopPropagation()}>
                
                {/* Header like Hearthis.at */}
                <header className="flex-shrink-0 p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-gray-900 to-black relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-pink-600/10 pointer-events-none"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white transform rotate-3">
                            <Icon name="music" className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Cloud Library</h2>
                            <p className="text-xs text-gray-400 font-mono">NEXTCLOUD • WEBDAV</p>
                        </div>
                    </div>
                    <div className="relative w-full md:w-auto z-10">
                        <input
                            type="text"
                            placeholder="Search tracks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-72 px-4 py-2.5 pl-10 text-sm bg-gray-800/50 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 transition-all hover:bg-gray-800"
                        />
                        <Icon name="search" className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                    </div>
                </header>

                {/* Main Content List */}
                <main className="flex-grow overflow-y-auto p-0 bg-[#0a0a0a] custom-scrollbar">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                            <p>Syncing...</p>
                        </div>
                    )}
                    
                    {error && <div className="text-center text-red-400 py-10">{error}</div>}
                    
                    {!isLoading && !error && (
                        <div className="divide-y divide-gray-800/50">
                            {filteredTracks.map((track, index) => {
                                const isCurrent = currentTrack?.id === track.id;
                                return (
                                    <div key={track.id} className={`group flex items-center gap-4 p-4 hover:bg-gray-800/40 transition-all duration-200 cursor-pointer ${isCurrent ? 'bg-gray-800/60 border-l-4 border-orange-500 pl-3' : ''}`} onClick={() => handlePlay(track)}>
                                        {/* Play Button & Art */}
                                        <div className="relative flex-shrink-0 w-12 h-12 group-hover:scale-105 transition-transform">
                                            <div className={`w-full h-full rounded-md bg-gradient-to-br ${isCurrent ? 'from-orange-500 to-pink-600' : 'from-gray-800 to-gray-700'} flex items-center justify-center shadow-lg border border-white/5`}>
                                                <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                                            </div>
                                        </div>

                                        {/* Track Info */}
                                        <div className="flex-grow min-w-0 flex flex-col justify-center">
                                            <div className="flex justify-between items-baseline mb-1.5">
                                                <h3 className={`text-base font-bold truncate ${isCurrent ? 'text-orange-400' : 'text-white group-hover:text-orange-200'}`}>
                                                    {track.title}
                                                </h3>
                                                <span className="text-[10px] text-gray-600 font-mono bg-black/20 px-1.5 py-0.5 rounded border border-white/5">{(parseInt(track.size) / 1024 / 1024).toFixed(1)} MB</span>
                                            </div>
                                            
                                            {/* Waveform Visualization (Simulated) */}
                                            <div className="h-6 w-full opacity-40 group-hover:opacity-80 transition-opacity">
                                                <StaticWaveform trackId={track.id} color={isCurrent ? '#fb923c' : '#525252'} height={24} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {!isLoading && filteredTracks.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <Icon name="music" className="w-16 h-16 mb-4 opacity-20" />
                            <p>No matching tracks found.</p>
                        </div>
                    )}
                </main>
                
                <footer className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
                    <p className="text-xs text-gray-500 font-mono">{filteredTracks.length} FILES • WEBDAV CONNECTED</p>
                    <button onClick={handleClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold rounded-lg transition-colors">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MusicLibraryModal;
