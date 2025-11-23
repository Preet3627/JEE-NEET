
import React from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';

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
    
    const artworkSrc = currentTrack?.coverArtUrl;

    if (!currentTrack) {
        return (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center h-full flex flex-col justify-center items-center group cursor-pointer" onClick={onOpenLibrary}>
                 <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors mb-3">
                    <Icon name="music" className="w-6 h-6 text-gray-400" />
                 </div>
                <h3 className="text-sm font-bold text-white">No Music Playing</h3>
                <button className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
                    Open Library
                </button>
            </div>
        );
    }
    
    // Minimized / Compact Widget Mode
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-4 backdrop-blur-sm flex flex-col gap-3 h-full relative overflow-hidden group">
            {/* Background Blur of Art */}
            <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500" 
                 style={{ backgroundImage: `url(${artworkSrc})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px)' }}></div>
            
            <div className="relative z-10 flex items-center gap-4 flex-grow cursor-pointer" onClick={toggleFullScreenPlayer}>
                <div className="flex-shrink-0 relative">
                    {artworkSrc ? (
                        <img src={artworkSrc} alt="art" className={`w-14 h-14 rounded-lg object-cover shadow-md ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '10s' }} />
                    ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-800 flex items-center justify-center">
                            <Icon name="music" className="w-8 h-8 text-gray-500" />
                        </div>
                    )}
                </div>
                <div className="flex-grow overflow-hidden">
                    <p className="font-bold text-white truncate text-sm">{currentTrack.title}</p>
                    <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
                </div>
            </div>

            <div className="relative z-10 flex justify-between items-center border-t border-white/10 pt-2">
                 <button onClick={prevTrack} className="p-2 text-gray-400 hover:text-white"><Icon name="arrow-left" className="w-4 h-4" /></button>
                 <button onClick={isPlaying ? pause : play} className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors shadow-lg">
                    <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5" />
                </button>
                <button onClick={nextTrack} className="p-2 text-gray-400 hover:text-white"><Icon name="arrow-right" className="w-4 h-4" /></button>
            </div>
        </div>
    );
};

export default MusicPlayerWidget;
