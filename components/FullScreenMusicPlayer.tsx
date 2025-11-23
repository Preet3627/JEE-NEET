
import React, { useRef, useEffect, useState } from 'react';
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
        currentTime
    } = useMusicPlayer();
    
    const [bgGradient, setBgGradient] = useState('from-gray-900 to-black');

    // Simple effect to change gradient based on track ID (simulating album art extraction)
    useEffect(() => {
        if(!currentTrack) return;
        const colors = [
            'from-blue-900 to-black',
            'from-purple-900 to-black',
            'from-red-900 to-black',
            'from-green-900 to-black',
            'from-orange-900 to-black',
            'from-pink-900 to-black',
        ];
        // Deterministic random color based on title length
        const colorIndex = currentTrack.title.length % colors.length;
        setBgGradient(colors[colorIndex]);
    }, [currentTrack]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!currentTrack) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col bg-gradient-to-b ${bgGradient} animate-fadeIn overflow-hidden`}>
            
            {/* Close Button */}
            <div className="absolute top-6 left-6 z-20">
                <button onClick={toggleFullScreenPlayer} className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center p-8 relative">
                {/* Moving Art Animation */}
                <div className={`relative w-72 h-72 md:w-96 md:h-96 rounded-xl shadow-2xl transition-transform duration-[10000ms] ease-in-out ${isPlaying ? 'scale-105' : 'scale-100'}`}>
                    <img 
                        src={currentTrack.coverArtUrl || 'https://via.placeholder.com/400'} 
                        alt="Album Art" 
                        className="w-full h-full object-cover rounded-xl shadow-black/50 shadow-2xl"
                        style={{
                            animation: isPlaying ? 'breathe 8s infinite ease-in-out' : 'none'
                        }}
                    />
                </div>

                <div className="mt-12 text-center w-full max-w-md">
                    <h2 className="text-3xl font-bold text-white mb-2 truncate">{currentTrack.title}</h2>
                    <p className="text-lg text-gray-400 truncate">{currentTrack.artist}</p>
                </div>
            </div>

            {/* Controls Container */}
            <div className="w-full bg-black/30 backdrop-blur-xl pb-12 pt-6 px-8 rounded-t-3xl border-t border-white/5">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-2 group">
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={(e) => seek(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white hover:h-2 transition-all"
                        />
                        <div className="flex justify-between text-xs font-medium text-gray-400 font-mono">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Playback Buttons */}
                    <div className="flex justify-between items-center">
                        <button className="p-2 text-gray-400 hover:text-white"><Icon name="shuffle" className="w-5 h-5" /></button>
                        
                        <div className="flex items-center gap-8">
                            <button onClick={prevTrack} className="p-2 text-white hover:text-gray-300 transition-transform active:scale-90"><Icon name="arrow-left" className="w-8 h-8" /></button>
                            <button onClick={isPlaying ? pause : play} className="p-6 bg-white text-black rounded-full shadow-xl hover:scale-105 transition-transform active:scale-95">
                                <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8 fill-current" />
                            </button>
                            <button onClick={nextTrack} className="p-2 text-white hover:text-gray-300 transition-transform active:scale-90"><Icon name="arrow-right" className="w-8 h-8" /></button>
                        </div>

                        <button className="p-2 text-gray-400 hover:text-white"><Icon name="sound-wave" className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes breathe {
                    0% { transform: scale(1) translateY(0px); }
                    50% { transform: scale(1.02) translateY(-10px); }
                    100% { transform: scale(1) translateY(0px); }
                }
            `}</style>
        </div>
    );
};

export default FullScreenMusicPlayer;
