
import React, { useState, useEffect } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';
import MusicVisualizerWidget from './MusicVisualizerWidget';

const DynamicIsland: React.FC = () => {
    const { currentTrack, isPlaying, play, pause, nextTrack, prevTrack, toggleFullScreenPlayer } = useMusicPlayer();
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-collapse when track changes or after interaction timeout could be added here

    if (!currentTrack) return null;

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[120] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] 
                ${isExpanded
                    ? 'w-[92vw] max-w-[400px] h-48 rounded-[2.5rem]'
                    : 'w-[200px] h-[36px] rounded-full hover:w-[220px] hover:h-[40px] hover:translate-y-1'
                }
                ${isHovered && !isExpanded ? 'shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'shadow-xl'}
                bg-black border border-white/10 overflow-hidden cursor-pointer select-none`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={toggleExpand}
        >
            {/* Background Blur/Glow for visual flair */}
            <div className={`absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20 opacity-50 pointer-events-none transition-opacity duration-500 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}></div>

            {/* Collapsed State Content */}
            <div className={`absolute inset-0 flex items-center justify-between px-2 transition-all duration-300 ${isExpanded ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>

                {/* Left: Album Art Thumb */}
                <div className="flex items-center gap-2.5 overflow-hidden pl-1">
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 animate-spin-slow">
                        {currentTrack.coverArtUrl ? (
                            <img src={currentTrack.coverArtUrl} alt="Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-600"></div>
                        )}
                    </div>
                </div>

                {/* Center: Visualizer (The 'Voice' of the island) */}
                <div className="flex-grow flex justify-center items-center h-full px-2">
                    {isPlaying ? (
                        <div className="h-3 w-full max-w-[60px] flex items-center justify-center opacity-80">
                            <MusicVisualizerWidget height={12} barCount={6} color="#22d3ee" gap={2} />
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Paused</span>
                    )}
                </div>

                {/* Right: Small Animated Icon or Time */}
                <div className="pr-2 flex items-center">
                    <Icon name="music" className={`w-3 h-3 text-cyan-500 ${isPlaying ? 'animate-pulse' : 'opacity-30'}`} />
                </div>
            </div>

            {/* Expanded State Content */}
            <div className={`absolute inset-0 p-6 flex flex-col justify-between transition-all duration-500 ease-out delay-75 ${isExpanded ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-4 blur-sm pointer-events-none'}`}>

                {/* Top Row: Art & Track Info */}
                <div className="flex gap-5 items-center">
                    <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-2xl shrink-0 transition-transform duration-500 ${isPlaying ? 'scale-100 rotate-0' : 'scale-95 rotate-0'}`}>
                        {currentTrack.coverArtUrl ? (
                            <img src={currentTrack.coverArtUrl} alt="Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/5">
                                <Icon name="music" className="text-gray-600 w-6 h-6" />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-white text-lg leading-tight truncate">{currentTrack.title}</h3>
                        </div>
                        <p className="text-sm text-gray-400 truncate font-medium">{currentTrack.artist || 'Unknown Artist'}</p>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleFullScreenPlayer(); setIsExpanded(false); }}>
                        <Icon name="expand" className="w-4 h-4 text-white" />
                    </div>
                </div>

                {/* Middle Row: Progress / Visualizer */}
                <div className="w-full h-12 flex items-center justify-center my-1 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-40 blur-xl">
                        <div className="w-full h-1 bg-cyan-500/50"></div>
                    </div>
                    <MusicVisualizerWidget height={40} barCount={20} color="#06b6d4" gap={3} />
                </div>

                {/* Bottom Row: Controls */}
                <div className="flex justify-center items-center gap-8">
                    <button
                        onClick={(e) => { e.stopPropagation(); prevTrack(); }}
                        className="text-gray-400 hover:text-white transition-all transform hover:-translate-x-1"
                    >
                        <Icon name="arrow-left" className="w-7 h-7" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shadow-lg hover:shadow-cyan-500/50"
                    >
                        <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6 fill-current" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); nextTrack(); }}
                        className="text-gray-400 hover:text-white transition-all transform hover:translate-x-1"
                    >
                        <Icon name="arrow-right" className="w-7 h-7" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DynamicIsland;
