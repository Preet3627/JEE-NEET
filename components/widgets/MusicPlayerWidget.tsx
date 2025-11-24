
import React from 'react';
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
    } = useMusicPlayer();
    
    // Ensure the widget has minimum height even when empty
    const containerClass = "bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-4 backdrop-blur-sm h-full min-h-[10rem] flex flex-col justify-between relative overflow-hidden group";

    if (!currentTrack) {
        return (
            <div 
                className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full min-h-[10rem] flex flex-col items-center justify-center text-center cursor-pointer group hover:border-cyan-500/50 transition-all"
                onClick={onOpenLibrary}
            >
                <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4 border-2 border-dashed border-gray-700 group-hover:border-cyan-500/50 transition-colors shadow-lg">
                    <Icon name="music" className="w-8 h-8 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <h3 className="font-bold text-white text-sm">Music Library</h3>
                <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-200 transition-colors">Tap to open</p>
            </div>
        );
    }
    
    return (
        <div className={containerClass}>
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                 {currentTrack.coverArtUrl && <img src={currentTrack.coverArtUrl} alt="" className="w-full h-full object-cover blur-3xl" />}
            </div>

            <div className="relative z-10 flex items-start justify-between">
                 <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={toggleFullScreenPlayer}>
                    <img src={currentTrack.coverArtUrl} alt="art" className={`w-12 h-12 rounded-lg object-cover shadow-md ${isPlaying ? 'animate-pulse' : ''}`} />
                    <div className="min-w-0">
                        <p className="font-bold text-white truncate text-sm">{currentTrack.title}</p>
                        <p className="text-xs text-gray-300 truncate">{currentTrack.artist}</p>
                    </div>
                </div>
                <button onClick={onOpenLibrary} className="p-1.5 rounded-full bg-black/30 text-gray-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100">
                    <Icon name="music" className="w-4 h-4" />
                </button>
            </div>

            <div className="relative z-10 mt-4">
                <div className="h-10 -mx-4 -mb-2 opacity-70">
                    <MusicVisualizerWidget />
                </div>
                <div className="flex justify-between items-center bg-black/40 p-1 rounded-full mt-2 backdrop-blur-md border border-white/5">
                    <button onClick={prevTrack} className="p-2 text-gray-300 hover:text-white transition-colors rounded-full"><Icon name="arrow-left" className="w-5 h-5" /></button>
                    <button onClick={isPlaying ? pause : play} className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg">
                        <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 fill-current" />
                    </button>
                    <button onClick={nextTrack} className="p-2 text-gray-300 hover:text-white transition-colors rounded-full"><Icon name="arrow-right" className="w-5 h-5" /></button>
                </div>
            </div>
        </div>
    );
};

export default MusicPlayerWidget;
