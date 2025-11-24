
import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

const GlobalMusicVisualizer: React.FC = () => {
    const { analyser, isPlaying, notchSettings, visualizerSettings } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const hueOffsetRef = useRef<number>(0);

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

        analyser.fftSize = 256; 
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            hueOffsetRef.current = (hueOffsetRef.current + 1) % 360;

            if (visualizerSettings.preset === 'bars') {
                const barsToDraw = Math.floor(bufferLength * 0.6); 
                const barWidth = (canvas.width / barsToDraw);
                let x = 0;

                ctx.beginPath();
                for (let i = 0; i < barsToDraw; i++) {
                    const value = dataArray[i];
                    const percent = Math.min(1, Math.pow(value / 255, 1.5)); 
                    const barHeight = Math.max(2, percent * canvas.height * 0.9);
                    const y = (canvas.height - barHeight) / 2;

                    let fillStyle = '#fff';
                    if (visualizerSettings.colorMode === 'rgb') {
                        const hue = (hueOffsetRef.current + (i * 5)) % 360;
                        fillStyle = `hsl(${hue}, 90%, 60%)`;
                    } else if (visualizerSettings.colorMode === 'album') {
                         fillStyle = `hsl(${200 + (i * 2)}, 80%, 60%)`;
                    } else {
                         fillStyle = `rgba(255, 255, 255, ${0.3 + percent})`;
                    }
                    
                    ctx.fillStyle = fillStyle;
                    // Optimize: use rect instead of roundRect for better performance on some devices
                    ctx.fillRect(x, y, barWidth - 1, barHeight);
                    
                    x += barWidth;
                }
                ctx.fill();
            } else if (visualizerSettings.preset === 'wave') {
                 ctx.lineWidth = 2;
                 ctx.strokeStyle = visualizerSettings.colorMode === 'rgb' ? `hsl(${hueOffsetRef.current}, 100%, 50%)` : '#06b6d4';
                 ctx.beginPath();
                 const sliceWidth = canvas.width / bufferLength;
                 let x = 0;
                 for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * canvas.height / 2;
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

    const positionStyles: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: `${Math.max(20, Math.min(90, notchSettings.width))}%`,
        maxWidth: notchSettings.size === 'small' ? '300px' : notchSettings.size === 'medium' ? '500px' : '800px',
        height: notchSettings.size === 'small' ? '40px' : notchSettings.size === 'medium' ? '60px' : '80px',
        top: notchSettings.position === 'top' ? '20px' : 'auto',
        bottom: notchSettings.position === 'bottom' ? '20px' : 'auto',
        borderRadius: '30px',
        pointerEvents: 'none',
        zIndex: 90
    };

    return (
        <div style={positionStyles}>
             <canvas ref={canvasRef} width="400" height="60" className="w-full h-full" />
        </div>
    );
};

export default GlobalMusicVisualizer;
