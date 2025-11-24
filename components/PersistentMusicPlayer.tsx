import React from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import Icon from './Icon';

const PersistentMusicPlayer: React.FC = () => {
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
    
    if (!currentTrack) {
        return null;
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    return (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-gray-900/70 border-t border-[var(--glass-border)] backdrop-blur-lg z-40 md:hidden h-20"
          style={{ paddingBottom: 'var(--safe-area-inset-bottom)' }}
        >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-white/10">
              <div className="bg-cyan-400 h-full" style={{ width: `${progress}%` }}></div>
            </div>
            
            <div className="flex items-center h-full px-2 gap-3">
                <button onClick={toggleFullScreenPlayer} className="flex-shrink-0">
                    <img src={currentTrack.coverArtUrl} alt={currentTrack.title} className="w-14 h-14 rounded-md object-cover" />
                </button>
                <div onClick={toggleFullScreenPlayer} className="flex-grow min-w-0 cursor-pointer">
                    <p className="font-semibold text-white truncate text-sm">{currentTrack.title}</p>
                    <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={prevTrack} className="p-2 text-gray-300 hover:text-white"><Icon name="arrow-left" /></button>
                    <button onClick={isPlaying ? pause : play} className="p-3 text-white bg-cyan-600 rounded-full hover:bg-cyan-500">
                        <Icon name={isPlaying ? "pause" : "play"} />
                    </button>
                    <button onClick={nextTrack} className="p-2 text-gray-300 hover:text-white"><Icon name="arrow-right" /></button>
                </div>
            </div>
        </div>
    );
};

export default PersistentMusicPlayer;