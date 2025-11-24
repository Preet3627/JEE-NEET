

import React, { useEffect, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import Icon from './Icon';

const FullScreenMusicPlayer: React.FC = () => {
    const { 
        currentTrack, 
        isPlaying, 
        play, 
        pause, 
        nextTrack, 
        prevTrack, 
        toggleFullScreenPlayer,
        seek,
        duration,
        currentTime,
        isAutoMixEnabled,
        toggleAutoMix
    } = useMusicPlayer();
    
    const [bgGradient, setBgGradient] = useState('from-gray-900 to-black');

    // Simple effect to change gradient based on track title hash
    useEffect(() => {
        if(!currentTrack) return;
        const colors = [
            'from-slate-900 to-black',
            'from-zinc-900 to-black',
            'from-stone-900 to-black',
            'from-blue-950 to-black',
            'from-indigo-950 to-black',
            'from-purple-950 to-black',
        ];
        // Deterministic random color based on title length
        const colorIndex = currentTrack.title.length % colors.length;
        setBgGradient(colors[colorIndex]);
    }, [currentTrack]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return isNaN(m) ? '0:00' : `${m}:${s}`;
    };

    if (!currentTrack) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col bg-gradient-to-b ${bgGradient} animate-fadeIn overflow-hidden transition-colors duration-1000`}>
            
            {/* Close Button */}
            <div className="absolute top-6 left-6 z-20">
                <button onClick={toggleFullScreenPlayer} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all hover:rotate-90">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center p-8 relative">
                {/* Background Glow */}
                <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_60%)]"></div>

                {/* Moving Art Animation */}
                <div className={`relative w-72 h-72 md:w-96 md:h-96 rounded-2xl shadow-2xl transition-transform duration-[800ms] cubic-bezier(0.34, 1.56, 0.64, 1) ${isPlaying ? 'scale-100' : 'scale-90 opacity-80'}`}>
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
            </div>

            {/* Controls Container */}
            <div className="w-full bg-black/20 backdrop-blur-2xl pb-12 pt-8 px-8 rounded-t-[3rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="max-w-2xl mx-auto space-y-8">
                    {/* Progress Bar */}
                    <div className="space-y-3 group">
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={(e) => seek(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:h-2 transition-all"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 font-mono tracking-widest">
                            <span>{formatTime(currentTime)}</span>
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
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
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