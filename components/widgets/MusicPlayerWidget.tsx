import React from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';

interface MusicPlayerWidgetProps {
  onOpenLibrary: () => void;
  layout?: 'minimal' | 'expanded';
}

const MusicPlayerWidget: React.FC<MusicPlayerWidgetProps> = ({ onOpenLibrary, layout = 'minimal' }) => {
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
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center">
                 <Icon name="music" className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white">Music Player</h3>
                <button onClick={onOpenLibrary} className="mt-2 text-sm text-cyan-400 hover:underline">
                    Open Library
                </button>
            </div>
        );
    }
    
    if (layout === 'minimal') {
        return (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-4 backdrop-blur-sm flex items-center gap-4">
                <button onClick={toggleFullScreenPlayer} className="flex-shrink-0">
                    {artworkSrc ? (
                        <img src={artworkSrc} alt={currentTrack.album || 'album art'} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center">
                            <Icon name="music" className="w-8 h-8 text-gray-500" />
                        </div>
                    )}
                </button>
                <div className="flex-grow overflow-hidden cursor-pointer" onClick={toggleFullScreenPlayer}>
                    <p className="font-bold text-white truncate">{currentTrack.title}</p>
                    <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
                </div>
                 <button onClick={isPlaying ? pause : play} className="p-3 text-white bg-cyan-600/50 rounded-full hover:bg-cyan-500/50 transition-colors flex-shrink-0">
                    <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5" />
                </button>
            </div>
        )
    }

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center">
            <button onClick={toggleFullScreenPlayer} className="w-full">
                {artworkSrc ? (
                    <img src={artworkSrc} alt={currentTrack.album || 'album art'} className="w-32 h-32 rounded-lg object-cover mx-auto mb-4" />
                ) : (
                    <div className="w-32 h-32 rounded-lg bg-gray-800 flex items-center justify-center mx-auto mb-4">
                        <Icon name="music" className="w-16 h-16 text-gray-500" />
                    </div>
                )}
            </button>
            <p className="font-bold text-lg text-white truncate">{currentTrack.title}</p>
            <p className="text-sm text-gray-400 truncate">{currentTrack.artist} - {currentTrack.album}</p>
            <div className="flex justify-center items-center gap-4 mt-4">
                <button onClick={prevTrack} className="p-3 text-gray-300 hover:text-white"><Icon name="arrow-left" className="w-5 h-5" /></button>
                 <button onClick={isPlaying ? pause : play} className="p-4 text-white bg-cyan-600 rounded-full hover:bg-cyan-500 transition-colors">
                    <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6" />
                </button>
                <button onClick={nextTrack} className="p-3 text-gray-300 hover:text-white"><Icon name="arrow-right" className="w-5 h-5" /></button>
            </div>
        </div>
    );
};

export default MusicPlayerWidget;