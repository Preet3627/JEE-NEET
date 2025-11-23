
import React, { useState, useEffect } from 'react';
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
        toggleFullScreenPlayer,
        notchSettings,
        playDjDrop
    } = useMusicPlayer();
    
    const [isHovered, setIsHovered] = useState(false);
    const [autoExpand, setAutoExpand] = useState(false);
    
    // Auto-expand briefly on track change
    useEffect(() => {
        if (currentTrack) {
            setAutoExpand(true);
            const t = setTimeout(() => setAutoExpand(false), 3000);
            return () => clearTimeout(t);
        }
    }, [currentTrack]);

    const artworkSrc = currentTrack?.coverArtUrl;
    const isExpanded = isHovered || autoExpand;

    // Determine Position Class
    const positionClass = notchSettings.position === 'top' ? 'top-4' : 'bottom-24 md:bottom-8';
    
    // Determine Size constraints
    const maxWidth = notchSettings.size === 'small' ? 'max-w-sm' : notchSettings.size === 'medium' ? 'max-w-lg' : 'max-w-2xl';

    if (!currentTrack) {
        return (
             <div className={`fixed left-1/2 -translate-x-1/2 z-50 ${positionClass}`}>
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full shadow-lg px-4 py-2 backdrop-blur-xl flex items-center justify-center gap-3 cursor-pointer transition-all hover:bg-white/10" onClick={onOpenLibrary}>
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                        <Icon name="music" className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-xs font-bold text-gray-300">Library</span>
                </div>
            </div>
        );
    }
    
    return (
        <div 
            className={`fixed left-1/2 -translate-x-1/2 z-50 ${positionClass} transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]`}
            style={{ width: isExpanded ? `${notchSettings.width}%` : 'auto', maxWidth: isExpanded ? '90%' : '200px' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`bg-black/90 border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-xl flex items-center overflow-hidden relative group cursor-pointer ${isExpanded ? 'px-4 py-3 gap-4 w-full' : 'px-2 py-2 gap-3 w-auto'}`}>
                
                {/* Mini Visualizer Background */}
                <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-overlay w-full h-full">
                     <MusicVisualizerWidget />
                </div>

                {/* Album Art */}
                <div className="relative z-10 flex-shrink-0" onClick={toggleFullScreenPlayer}>
                    {artworkSrc ? (
                        <img src={artworkSrc} alt="art" className={`rounded-full object-cover transition-all duration-500 ${isExpanded ? 'w-14 h-14' : 'w-10 h-10'} ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '10s' }} />
                    ) : (
                        <div className={`rounded-full bg-gray-800 flex items-center justify-center transition-all ${isExpanded ? 'w-14 h-14' : 'w-10 h-10'}`}>
                            <Icon name="music" className="text-gray-500" />
                        </div>
                    )}
                </div>

                {/* Track Info & Controls (Expanded) */}
                <div className={`flex-grow flex items-center justify-between overflow-hidden transition-all duration-500 ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'}`}>
                    <div className="flex-grow min-w-0 mr-4" onClick={toggleFullScreenPlayer}>
                        <p className="font-bold text-white truncate text-base">{currentTrack.title}</p>
                        <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                         <button onClick={(e) => { e.stopPropagation(); playDjDrop(); }} className="p-2 text-xs font-bold text-yellow-400 bg-yellow-400/10 rounded hover:bg-yellow-400/20" title="DJ Drop">DROP</button>
                         <button onClick={(e) => { e.stopPropagation(); prevTrack(); }} className="p-1 text-gray-400 hover:text-white"><Icon name="arrow-left" className="w-5 h-5" /></button>
                         <button onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }} className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform">
                            <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); nextTrack(); }} className="p-1 text-gray-400 hover:text-white"><Icon name="arrow-right" className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Mini State Indicators (When Collapsed) */}
                {!isExpanded && isPlaying && (
                    <div className="flex gap-1 items-center h-4 mr-2">
                        <div className="w-1 bg-cyan-500 animate-pulse h-full rounded-full"></div>
                        <div className="w-1 bg-purple-500 animate-pulse h-2/3 rounded-full [animation-delay:0.1s]"></div>
                        <div className="w-1 bg-green-500 animate-pulse h-1/2 rounded-full [animation-delay:0.2s]"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MusicPlayerWidget;
