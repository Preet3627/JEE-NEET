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
    const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
    
    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await api.getMusicFiles('/');
                if (data && Array.isArray(data)) {
                    setTracks(data);
                } else {
                    setTracks([]);
                    throw new Error("Music service returned no data.");
                }
            } catch (err: any) {
                setError(err.error || "Failed to load music library. Check server configuration and .env file.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchLibrary();
    }, []);

    const handleLocalFiles = async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            const localTracks: Track[] = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i)) {
                    const file = await entry.getFile();
                    const nameParts = file.name.replace(/\.[^/.]+$/, "").split(' - ');
                    localTracks.push({
                        id: file.name, // Use file name as a unique ID for local files
                        title: nameParts.length > 1 ? nameParts[1] : nameParts[0],
                        artist: nameParts.length > 1 ? nameParts[0] : 'Unknown Artist',
                        album: 'Local Files',
                        track: '1',
                        coverArt: '',
                        duration: '0',
                        size: file.size.toString(),
                        isLocal: true,
                        file: file
                    });
                }
            }
            setTracks(prev => [...localTracks, ...prev.filter(t => !t.isLocal)]);
        } catch (err) {
            console.error("Error accessing local files:", err);
            alert("Could not access the folder. Please ensure you've granted permission.");
        }
    };
    
    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
    const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

    const filteredTracks = tracks.filter(track =>
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`} onClick={handleClose}>
            <div className={`w-full h-full max-w-6xl max-h-[90vh] bg-gray-900/50 border border-gray-700 rounded-xl shadow-2xl ${contentAnimationClasses} flex overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                
                {/* Main Content */}
                <div className="flex-grow flex flex-col bg-gray-800/30">
                    <header className="flex-shrink-0 p-4 border-b border-gray-700/50 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                           <button onClick={handleLocalFiles} className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white bg-green-600 flex items-center gap-2">
                             <Icon name="folder" /> Browse Local Files
                           </button>
                        </div>
                         <div className="relative">
                            <input
                                type="text"
                                placeholder="Search tracks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full max-w-xs px-4 py-1.5 text-sm bg-gray-900/50 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </header>
                    <main className="flex-grow overflow-y-auto p-4 space-y-2">
                        {isLoading && <div className="text-center text-gray-400 py-10">Loading Library...</div>}
                        {error && <div className="text-center text-red-400 py-10">{error}</div>}
                        {!isLoading && !error && (
                            filteredTracks.map(track => (
                                <div key={track.id} className={`w-full p-2 rounded-lg flex items-center gap-3 transition-colors ${currentTrack?.id === track.id ? 'bg-cyan-600/20' : 'bg-gray-800/50'}`}>
                                    <button onClick={() => playTrack(track, filteredTracks)} className="relative flex-shrink-0">
                                        <div className="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center">
                                            <Icon name="music" className="w-8 h-8 text-gray-500" />
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <Icon name={currentTrack?.id === track.id && isPlaying ? 'pause' : 'play'} className="w-8 h-8 text-white" />
                                        </div>
                                    </button>
                                    <div className="flex-grow min-w-0">
                                        <p className="font-semibold text-white truncate">{track.title}</p>
                                        <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                                    </div>
                                    <div className="flex-shrink-0 w-2/5">
                                        <StaticWaveform trackId={track.id} />
                                    </div>
                                    <div className="text-sm text-gray-400 font-mono flex-shrink-0">{track.duration}</div>
                                </div>
                            ))
                        )}
                         {!isLoading && filteredTracks.length === 0 && !error && (
                            <div className="text-center text-gray-500 py-10">No tracks found.</div>
                         )}
                    </main>
                </div>
                
                {/* Right Sidebar */}
                <div className="w-72 flex-shrink-0 bg-gray-900/30 border-l border-gray-700/50 p-4 overflow-y-auto">
                    <h3 className="font-bold text-white mb-4">Playlists</h3>
                    <div className="space-y-2">
                        {['My Favorites', 'Workout Mix', 'Study Focus'].map(name => (
                            <button key={name} className="w-full text-left p-2 rounded-md hover:bg-gray-700/50 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-700 rounded-md"></div>
                                <span className="text-sm text-gray-300">{name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicLibraryModal;
