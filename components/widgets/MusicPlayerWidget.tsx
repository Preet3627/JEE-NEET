
import React, { useState } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';
import MusicVisualizerWidget from './MusicVisualizerWidget';

interface MusicPlayerWidgetProps {
  onOpenLibrary: () => void;
}

const MusicPlayerWidget: React.FC<MusicPlayerWidgetProps> = ({ onOpenLibrary }) => {
    const { 
        currentTrack, 
        isPlaying, 
        play, 
        pause,
        nextTrack,
        prevTrack,
        toggleFullScreenPlayer
    } = useMusicPlayer();
    
    const [isHovered, setIsHovered] = useState(false);
    
    const artworkSrc = currentTrack?.coverArtUrl;

    if (!currentTrack) {
        return (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full shadow-lg px-4 py-2 backdrop-blur-xl flex items-center justify-center gap-3 cursor-pointer transition-all hover:bg-white/10" onClick={onOpenLibrary}>
                 <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    <Icon name="music" className="w-4 h-4 text-gray-400" />
                 </div>
                <span className="text-xs font-bold text-gray-300">Library</span>
            </div>
        );
    }
    
    // Dynamic Island / Pill Style Widget
    return (
        <div 
            className={`bg-black/80 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl flex items-center transition-all duration-500 ease-out overflow-hidden relative group ${isHovered ? 'px-4 py-3 gap-4 w-full max-w-md' : 'px-2 py-2 gap-3 w-auto'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Mini Visualizer Background (Subtle) */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
                <MusicVisualizerWidget />
            </div>

            {/* Album Art / Icon */}
            <div className="relative z-10 flex-shrink-0 cursor-pointer" onClick={toggleFullScreenPlayer}>
                {artworkSrc ? (
                    <img src={artworkSrc} alt="art" className={`rounded-full object-cover transition-all duration-500 ${isHovered ? 'w-12 h-12' : 'w-8 h-8'} ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '10s' }} />
                ) : (
                    <div className={`rounded-full bg-gray-800 flex items-center justify-center transition-all ${isHovered ? 'w-12 h-12' : 'w-8 h-8'}`}>
                        <Icon name="music" className="text-gray-500" />
                    </div>
                )}
            </div>

            {/* Track Info - Only visible on hover/expand */}
            <div className={`flex-grow overflow-hidden transition-all duration-500 ${isHovered ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`} onClick={toggleFullScreenPlayer}>
                <p className="font-bold text-white truncate text-sm">{currentTrack.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{currentTrack.artist}</p>
            </div>

            {/* Controls - Mini vs Expanded */}
            <div className="relative z-10 flex items-center gap-2">
                 {isHovered && (
                     <button onClick={prevTrack} className="p-1 text-gray-400 hover:text-white"><Icon name="arrow-left" className="w-4 h-4" /></button>
                 )}
                 
                 <button onClick={isPlaying ? pause : play} className={`${isHovered ? 'p-2 bg-white text-black' : 'p-1 text-cyan-400'} rounded-full hover:scale-110 transition-transform shadow-lg`}>
                    <Icon name={isPlaying ? "pause" : "play"} className={isHovered ? "w-4 h-4" : "w-5 h-5"} />
                </button>

                {isHovered && (
                    <button onClick={nextTrack} className="p-1 text-gray-400 hover:text-white"><Icon name="arrow-right" className="w-4 h-4" /></button>
                )}
            </div>
            
            {/* Waveform Animation (Bars) for mini state */}
            {!isHovered && isPlaying && (
                <div className="flex gap-0.5 items-center h-3 mr-2">
                    <div className="w-0.5 bg-cyan-500 animate-pulse h-full"></div>
                    <div className="w-0.5 bg-purple-500 animate-pulse h-2/3 [animation-delay:0.1s]"></div>
                    <div className="w-0.5 bg-green-500 animate-pulse h-1/2 [animation-delay:0.2s]"></div>
                </div>
            )}
        </div>
    );
};

export default MusicPlayerWidget;
