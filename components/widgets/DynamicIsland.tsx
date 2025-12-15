import React, { useState, useEffect } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';
import MusicVisualizerWidget from './MusicVisualizerWidget';

const DynamicIsland: React.FC = () => {
    const { currentTrack, isPlaying, play, pause, nextTrack, prevTrack, toggleFullScreenPlayer } = useMusicPlayer();
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!currentTrack) return null;

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`fixed top-2 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-spring 
                ${isExpanded ? 'w-[90vw] max-w-sm h-32 rounded-[2rem]' : 'w-48 h-8 rounded-full'}
                ${isHovered && !isExpanded ? 'scale-105' : ''}
                bg-black border border-white/10 shadow-2xl overflow-hidden cursor-pointer`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={toggleExpand}
        >
            {/* Collapsed State */}
            <div className={`absolute inset-0 flex items-center justify-between px-3 transition-opacity duration-200 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-4 h-4 rounded ml-1 overflow-hidden">
                        {currentTrack.coverArtUrl ? (
                            <img src={currentTrack.coverArtUrl} alt="Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 animate-pulse"></div>
                        )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 h-full">
                        <span className="text-[10px] font-bold text-white leading-none truncate max-w-[80px]">{currentTrack.title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <MusicVisualizerWidget height={16} barCount={5} color="#06b6d4" />
                </div>
            </div>

            {/* Expanded State */}
            <div className={`absolute inset-0 p-4 flex flex-col justify-between transition-opacity duration-300 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shrink-0">
                        {currentTrack.coverArtUrl ? (
                            <img src={currentTrack.coverArtUrl} alt="Art" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                                <Icon name="music" className="text-white w-6 h-6" />
                            </div>
                        )}
                    </div>
                    <div className="flex-grow min-w-0 pr-6 relative">
                        <h3 className="font-bold text-white truncate text-sm">{currentTrack.title}</h3>
                        <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
                        <div className="absolute top-0 right-0 h-full w-12 pointer-events-none bg-gradient-to-l from-black to-transparent"></div>
                    </div>
                    <div className="h-8 w-8">
                        <MusicVisualizerWidget height={30} barCount={8} />
                    </div>
                </div>

                <div className="flex justify-between items-center px-4">
                    <button onClick={(e) => { e.stopPropagation(); prevTrack(); }} className="text-gray-400 hover:text-white transition-colors"><Icon name="arrow-left" className="w-6 h-6" /></button>
                    <button onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }} className="text-white hover:scale-110 transition-transform">
                        <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8 fill-current" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextTrack(); }} className="text-gray-400 hover:text-white transition-colors"><Icon name="arrow-right" className="w-6 h-6" /></button>
                </div>
            </div>
        </div>
    );
};

export default DynamicIsland;
