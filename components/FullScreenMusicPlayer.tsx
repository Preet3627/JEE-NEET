
import React, { useEffect, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import Icon from './Icon';

const FullScreenMusicPlayer: React.FC = () => {
    const { 
        currentTrack, isPlaying, play, pause, nextTrack, prevTrack, toggleFullScreenPlayer,
        seek, duration, currentTime, isAutoMixEnabled, toggleAutoMix, queue, removeFromQueue, toggleLibrary
    } = useMusicPlayer();
    
    const [bgGradient, setBgGradient] = useState('from-gray-900 to-black');
    const [localTime, setLocalTime] = useState(currentTime);
    const [isDragging, setIsDragging] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);

    useEffect(() => {
        if(!isDragging) setLocalTime(currentTime);
    }, [currentTime, isDragging]);

    useEffect(() => {
        if(!currentTrack) return;
        const colors = [
            'from-slate-900 to-black', 'from-zinc-900 to-black', 'from-stone-900 to-black',
            'from-blue-950 to-black', 'from-indigo-950 to-black', 'from-purple-950 to-black',
        ];
        const colorIndex = currentTrack.title.length % colors.length;
        setBgGradient(colors[colorIndex]);
    }, [currentTrack]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return isNaN(m) ? '0:00' : `${m}:${s}`;
    };

    const handleSeekStart = () => setIsDragging(true);
    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => setLocalTime(parseFloat(e.target.value));
    const handleSeekEnd = () => { seek(localTime); setIsDragging(false); };

    if (!currentTrack) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col bg-gradient-to-b ${bgGradient} animate-fadeIn overflow-hidden transition-colors duration-1000`}>
            
            {/* Header Controls */}
            <div className="absolute top-6 left-6 z-20 flex gap-4">
                <button onClick={toggleFullScreenPlayer} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all">
                    <Icon name="arrow-left" className="w-6 h-6" />
                </button>
                <button onClick={toggleLibrary} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all" title="Music Library">
                    <Icon name="music" className="w-6 h-6" />
                </button>
            </div>
            
            <div className="absolute top-6 right-6 z-20">
                 <button onClick={() => setIsQueueOpen(!isQueueOpen)} className={`p-3 rounded-full backdrop-blur-md transition-all ${isQueueOpen ? 'bg-cyan-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
                    <Icon name="schedule" className="w-6 h-6" />
                </button>
            </div>

            {/* Main Content or Queue */}
            <div className="flex-grow flex flex-col items-center justify-center p-8 relative">
                <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_60%)]"></div>

                {isQueueOpen ? (
                    <div className="w-full max-w-md h-full bg-black/40 rounded-2xl backdrop-blur-lg p-6 overflow-y-auto z-10 border border-white/10 custom-scrollbar">
                        <h3 className="text-xl font-bold text-white mb-4">Up Next</h3>
                        {queue.length === 0 ? (
                            <p className="text-gray-500 text-center py-10">Queue is empty</p>
                        ) : (
                            <ul className="space-y-2">
                                {queue.map((track, index) => (
                                    <li key={`${track.id}-${index}`} className="flex justify-between items-center p-3 rounded-lg bg-white/5 hover:bg-white/10">
                                        <div className="min-w-0">
                                            <p className="text-white font-semibold truncate">{track.title}</p>
                                            <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                        </div>
                                        <button onClick={() => removeFromQueue(index)} className="text-gray-500 hover:text-red-400 p-2"><Icon name="trash" className="w-4 h-4" /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <>
                        <div className={`relative w-64 h-64 md:w-96 md:h-96 rounded-2xl shadow-2xl transition-transform duration-[800ms] cubic-bezier(0.34, 1.56, 0.64, 1) ${isPlaying ? 'scale-100' : 'scale-90 opacity-80'}`}>
                            <img 
                                src={currentTrack.coverArtUrl || 'https://via.placeholder.com/400'} 
                                alt="Album Art" 
                                className="w-full h-full object-cover rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
                            />
                        </div>
                        <div className="mt-12 text-center w-full max-w-md">
                            <h2 className="text-3xl font-bold text-white mb-2 truncate tracking-tight">{currentTrack.title}</h2>
                            <p className="text-lg text-gray-400 truncate font-medium">{currentTrack.artist}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Controls Container */}
            <div className="w-full bg-black/20 backdrop-blur-2xl pb-12 pt-8 px-8 rounded-t-[3rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="max-w-2xl mx-auto space-y-8">
                    {/* Progress Bar */}
                    <div className="space-y-3 group">
                        <input
                            type="range" min="0" max={duration || 0} value={localTime}
                            onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
                            onChange={handleSeekChange} onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd}
                            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:h-2 transition-all"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 font-mono tracking-widest">
                            <span>{formatTime(localTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Playback Buttons */}
                    <div className="flex justify-between items-center">
                        <button 
                            onClick={toggleAutoMix}
                            className={`p-3 rounded-full transition-all ${isAutoMixEnabled ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-gray-500 hover:text-white'}`}
                            title={isAutoMixEnabled ? "Auto Mix On" : "Auto Mix Off"}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        
                        <div className="flex items-center gap-10">
                            <button onClick={prevTrack} className="p-2 text-white hover:text-gray-300 transition-transform active:scale-90 hover:-translate-x-1"><Icon name="arrow-left" className="w-10 h-10" /></button>
                            <button onClick={isPlaying ? pause : play} className="p-7 bg-white text-black rounded-full shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 transition-all active:scale-95">
                                <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8 fill-current" />
                            </button>
                            <button onClick={nextTrack} className="p-2 text-white hover:text-gray-300 transition-transform active:scale-90 hover:translate-x-1"><Icon name="arrow-right" className="w-10 h-10" /></button>
                        </div>

                        <button className="p-3 text-gray-500 hover:text-white transition-colors"><Icon name="sound-wave" className="w-6 h-6" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullScreenMusicPlayer;
