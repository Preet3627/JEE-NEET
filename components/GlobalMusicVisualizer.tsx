
import React, { useRef, useEffect, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import Icon from './Icon';

const GlobalMusicVisualizer: React.FC = () => {
    const { analyser, isPlaying, currentTrack, notchSettings, nextTrack, prevTrack, play, pause, visualizerSettings } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const hueOffsetRef = useRef<number>(0);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser || !isPlaying) {
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        analyser.fftSize = 64; // Very low resolution for "blobby" dynamic island look
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw a simplified waveform or bars centered
            const barCount = 5;
            const spacing = 4; // Increased spacing for smaller bars
            const totalBarWidth = 4; // Fixed small width
            const center = canvas.width / 2;
            
            // Colors based on settings
            let fillStyle = '#ffffff'; // Default white like iOS
            if (visualizerSettings.colorMode === 'rgb') {
                hueOffsetRef.current = (hueOffsetRef.current + 1) % 360;
                fillStyle = `hsl(${hueOffsetRef.current}, 80%, 60%)`;
            } else if (visualizerSettings.colorMode === 'album') {
                fillStyle = '#3b82f6'; // Blue-ish fallback
            }

            ctx.fillStyle = fillStyle;

            // Mirrored bars from center
            for (let i = 0; i < 3; i++) {
                // Get bass/mid values
                const value = dataArray[i * 2]; 
                const height = Math.max(3, (value / 255) * canvas.height * 0.8); // Smaller max height
                const y = (canvas.height - height) / 2;
                
                // Center bar
                if (i === 0) {
                    ctx.beginPath();
                    ctx.roundRect(center - totalBarWidth/2, y, totalBarWidth, height, 10);
                    ctx.fill();
                } else {
                    // Side bars
                    const xRight = center + (i * (totalBarWidth + spacing)) - totalBarWidth/2;
                    const xLeft = center - (i * (totalBarWidth + spacing)) - totalBarWidth/2;
                    
                    ctx.beginPath();
                    ctx.roundRect(xRight, y, totalBarWidth, height, 10);
                    ctx.roundRect(xLeft, y, totalBarWidth, height, 10);
                    ctx.fill();
                }
            }
            
            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [analyser, isPlaying, visualizerSettings]);

    if (!isPlaying || notchSettings.enabled === false) return null;

    const isMobile = notchSettings.size === 'small';
    
    // Expanded dimensions
    const expandedWidth = isMobile ? '94%' : '400px';
    const expandedHeight = '180px';
    
    // Collapsed dimensions - mimicking iPhone Dynamic Island
    const collapsedWidth = '126px'; 
    const collapsedHeight = '36px';

    const containerStyles: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: isExpanded ? expandedWidth : collapsedWidth,
        height: isExpanded ? expandedHeight : collapsedHeight,
        top: notchSettings.position === 'top' ? '12px' : 'auto',
        bottom: notchSettings.position === 'bottom' ? '20px' : 'auto',
        backgroundColor: 'black',
        borderRadius: isExpanded ? '32px' : '18px', // Squircle-ish
        zIndex: 9999,
        transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 0.3s',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
    };

    return (
        <div 
            style={containerStyles}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* Collapsed View */}
            <div className={`absolute inset-0 flex items-center justify-between px-2 transition-opacity duration-200 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <img src={currentTrack?.coverArtUrl} className="w-6 h-6 rounded-full object-cover" alt="art" />
                <div className="flex-grow h-full flex items-center justify-center mx-2 opacity-80">
                    <canvas ref={canvasRef} width="60" height="20" className="w-full h-2/3" />
                </div>
                <div className="w-6 h-6 flex items-center justify-center">
                     <div className="w-5 h-5 rounded-full border-2 border-cyan-500/50 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                     </div>
                </div>
            </div>

            {/* Expanded View */}
            <div className={`w-full h-full p-5 flex flex-col transition-opacity duration-300 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-4 mb-4">
                    <img src={currentTrack?.coverArtUrl} className="w-16 h-16 rounded-xl shadow-lg object-cover" alt="art" />
                    <div className="flex-grow min-w-0">
                        <p className="text-white font-bold text-lg truncate leading-tight">{currentTrack?.title}</p>
                        <p className="text-gray-400 text-sm truncate">{currentTrack?.artist}</p>
                    </div>
                    <div className="w-8 h-8 flex-shrink-0 text-cyan-400">
                        <Icon name="sound-wave" className="w-full h-full" />
                    </div>
                </div>
                
                {/* Progress Bar (Visual Only) */}
                <div className="w-full h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
                    <div className="h-full bg-white/90 rounded-full animate-pulse w-1/2"></div>
                </div>

                {/* Controls */}
                <div className="flex justify-center items-center gap-8">
                    <button onClick={(e) => { e.stopPropagation(); prevTrack(); }} className="text-white hover:text-gray-300 transition-transform active:scale-90">
                        <Icon name="arrow-left" className="w-8 h-8" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }} className="text-white hover:scale-110 transition-transform">
                        <Icon name={isPlaying ? "pause" : "play"} className="w-10 h-10 fill-current" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextTrack(); }} className="text-white hover:text-gray-300 transition-transform active:scale-90">
                        <Icon name="arrow-right" className="w-8 h-8" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalMusicVisualizer;
