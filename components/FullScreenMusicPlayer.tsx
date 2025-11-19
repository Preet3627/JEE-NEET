import React, { useRef, useEffect } from 'react';
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
        analyser,
        seek,
        duration,
        currentTime,
        playDjDrop
    } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser || !isPlaying) {
            if(canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            // FIX: `requestAnimationFrame` requires a callback argument. Passed the `draw` function to create the animation loop.
            animationFrameId.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = 4;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i];
                
                const hue = (i / bufferLength) * 120 + 180;
                canvasCtx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 2;
            }
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [analyser, isPlaying]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!currentTrack) return null;

    return (
        <div className="fixed inset-0 bg-black z-[90] flex flex-col p-4 md:p-8 safe-padding-top safe-padding-bottom safe-padding-left safe-padding-right animate-fadeIn">
            <div className="fullscreen-player-bg" style={{ backgroundImage: `url(${currentTrack.coverArtUrl})` }}></div>
            
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0">
                <button onClick={toggleFullScreenPlayer} className="p-2 rounded-full hover:bg-white/10 text-gray-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="text-center">
                    <p className="text-xs uppercase text-gray-400">Playing from Album</p>
                    <p className="font-semibold text-white">{currentTrack.album}</p>
                </div>
                <button className="p-2 rounded-full hover:bg-white/10 text-gray-300"><Icon name="ellipsis" /></button>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col items-center justify-center text-center py-4">
                <img src={currentTrack.coverArtUrl} alt={currentTrack.title} className="w-64 h-64 md:w-80 md:h-80 rounded-lg shadow-2xl object-cover" />
                <h2 className="text-3xl font-bold text-white mt-8">{currentTrack.title}</h2>
                <p className="text-lg text-gray-400">{currentTrack.artist}</p>
            </div>

            {/* Visualizer & Controls */}
            <div className="flex-shrink-0">
                 <div className="w-full h-24 mb-4">
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                {/* Progress Bar */}
                <div className="space-y-1">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={(e) => seek(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                    />
                    <div className="flex justify-between text-xs text-gray-400 font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="flex justify-around items-center mt-4">
                    <button onClick={playDjDrop} className="p-3 text-gray-300 hover:text-white" title="Play DJ Drop">
                        <Icon name="sound-wave" className="w-6 h-6" />
                    </button>
                    <button onClick={prevTrack} className="p-3 text-gray-300 hover:text-white"><Icon name="arrow-left" className="w-8 h-8" /></button>
                    <button onClick={isPlaying ? pause : play} className="p-5 bg-white text-black rounded-full shadow-lg">
                        <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8" />
                    </button>
                    <button onClick={nextTrack} className="p-3 text-gray-300 hover:text-white"><Icon name="arrow-right" className="w-8 h-8" /></button>
                    <button className="p-3 text-gray-300 hover:text-white"><Icon name="cards" className="w-6 h-6" /></button>
                </div>
            </div>
        </div>
    );
};

export default FullScreenMusicPlayer;