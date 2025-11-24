
import React, { useRef, useEffect, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import Icon from './Icon';

const GlobalMusicVisualizer: React.FC = () => {
    const { analyser, isPlaying, currentTrack, notchSettings, visualizerSettings, nextTrack, prevTrack, play, pause } = useMusicPlayer();
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

        analyser.fftSize = 128; // Lower FFT size for smoother, chunkier bars suitable for small UI
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            hueOffsetRef.current = (hueOffsetRef.current + 0.5) % 360;

            if (visualizerSettings.preset === 'bars') {
                // Dynamic Island style bars: Centered, mirrored, rounded caps
                const barsToDraw = 12; // Fewer bars for cleaner look
                const spacing = 4;
                const totalWidth = canvas.width;
                const center = totalWidth / 2;
                const barWidth = 6;
                
                ctx.lineCap = 'round';

                for (let i = 0; i < barsToDraw; i++) {
                    const dataIndex = Math.floor(i * (bufferLength / barsToDraw)); 
                    const value = dataArray[dataIndex];
                    const percent = Math.max(0.1, Math.pow(value / 255, 1.8)); 
                    const barHeight = percent * (canvas.height * 0.8);
                    
                    let fillStyle = '#fff';
                    if (visualizerSettings.colorMode === 'rgb') {
                        fillStyle = `hsl(${hueOffsetRef.current + (i * 10)}, 100%, 60%)`;
                    } else if (visualizerSettings.colorMode === 'album') {
                         fillStyle = `hsl(${200 + (i * 5)}, 80%, 60%)`;
                    }

                    ctx.fillStyle = fillStyle;

                    // Right side
                    const xRight = center + (i * (barWidth + spacing)) + 2;
                    const y = (canvas.height - barHeight) / 2;
                    
                    ctx.beginPath();
                    ctx.roundRect(xRight, y, barWidth, barHeight, 3);
                    ctx.fill();

                    // Left side (Mirror)
                    const xLeft = center - ((i + 1) * (barWidth + spacing)) - 2;
                    ctx.beginPath();
                    ctx.roundRect(xLeft, y, barWidth, barHeight, 3);
                    ctx.fill();
                }
            } else if (visualizerSettings.preset === 'wave') {
                 ctx.lineWidth = 3;
                 ctx.strokeStyle = visualizerSettings.colorMode === 'rgb' ? `hsl(${hueOffsetRef.current}, 100%, 60%)` : '#22d3ee';
                 ctx.beginPath();
                 const sliceWidth = canvas.width / bufferLength;
                 let x = 0;
                 for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * canvas.height / 3) + (canvas.height / 6); // Center vertically more tightly
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                 }
                 ctx.lineTo(canvas.width, canvas.height / 2);
                 ctx.stroke();
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

    // Dynamic Island Styles
    const isMobile = notchSettings.size === 'small';
    
    const baseWidth = isExpanded 
        ? (isMobile ? '92%' : '400px') 
        : (isMobile ? '120px' : '160px');
        
    const baseHeight = isExpanded 
        ? '160px' 
        : (isMobile ? '35px' : '44px');

    const positionStyles: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: baseWidth,
        height: baseHeight,
        top: notchSettings.position === 'top' ? (isMobile ? '12px' : '20px') : 'auto',
        bottom: notchSettings.position === 'bottom' ? (isMobile ? '20px' : '30px') : 'auto',
        backgroundColor: '#000000',
        borderRadius: isExpanded ? '28px' : '100px',
        zIndex: 9999,
        transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Spring physics
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isExpanded ? 'flex-start' : 'center',
        cursor: 'pointer'
    };

    return (
        <div 
            style={positionStyles} 
            onMouseEnter={() => !isMobile && setIsExpanded(true)}
            onMouseLeave={() => !isMobile && setIsExpanded(false)}
            onClick={() => setIsExpanded(!isExpanded)}
        >
             {/* Collapsed State Content */}
             <div className={`w-full h-full absolute inset-0 flex items-center justify-between px-3 transition-opacity duration-300 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <img src={currentTrack?.coverArtUrl} className="w-5 h-5 rounded-full animate-spin-slow" alt="art" />
                <div className="flex-grow h-full flex items-center justify-center mx-2">
                    <canvas ref={canvasRef} width="100" height="30" className="w-full h-full opacity-80" />
                </div>
                <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse"></div>
                </div>
             </div>

             {/* Expanded State Content */}
             <div className={`w-full h-full flex flex-col p-4 transition-all duration-500 ${isExpanded ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-4 mb-4">
                    <img src={currentTrack?.coverArtUrl} className="w-14 h-14 rounded-xl shadow-lg object-cover" alt="art" />
                    <div className="flex-grow min-w-0">
                        <p className="text-white font-bold text-sm truncate">{currentTrack?.title}</p>
                        <p className="text-gray-400 text-xs truncate">{currentTrack?.artist}</p>
                    </div>
                    <div className="w-8 h-8">
                         <Icon name="sound-wave" className="text-cyan-400 animate-pulse" />
                    </div>
                </div>
                
                {/* Controls */}
                <div className="flex justify-between items-center w-full px-2">
                    <button onClick={(e) => { e.stopPropagation(); prevTrack(); }} className="text-white hover:text-cyan-400 transition-colors">
                        <Icon name="arrow-left" className="w-6 h-6" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : play(); }} className="text-white hover:scale-110 transition-transform">
                        <Icon name={isPlaying ? "pause" : "play"} className="w-8 h-8 fill-current" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextTrack(); }} className="text-white hover:text-cyan-400 transition-colors">
                        <Icon name="arrow-right" className="w-6 h-6" />
                    </button>
                </div>
             </div>
        </div>
    );
};

export default GlobalMusicVisualizer;
