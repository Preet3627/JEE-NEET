
import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

const GlobalMusicVisualizer: React.FC = () => {
    const { analyser, isPlaying } = useMusicPlayer();
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
            return;
        }

        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        analyser.fftSize = 128; // Resolution of bars
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameId.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate dimensions - optimize for visual appeal
            const barsToDraw = Math.floor(bufferLength * 0.75); 
            const barWidth = (canvas.width / barsToDraw);
            let x = 0;
            
            // Increment color cycle for RGB shuffle effect
            hueOffsetRef.current = (hueOffsetRef.current + 0.5) % 360;

            for (let i = 0; i < barsToDraw; i++) {
                // Scale bar height to canvas, boosting sensitivity
                const value = dataArray[i];
                const percent = value / 255;
                const barHeight = Math.max(4, Math.pow(percent, 1.5) * canvas.height * 0.95);
                
                // RGB Color Shuffle Logic
                const hue = (hueOffsetRef.current + (i * 5)) % 360;
                
                // Create vibrant neon colors
                canvasCtx.fillStyle = `hsl(${hue}, 90%, 60%)`;
                
                // Add a subtle glow effect
                canvasCtx.shadowBlur = 15;
                canvasCtx.shadowColor = `hsl(${hue}, 100%, 50%)`;

                // Draw rounded bar centered vertically
                const y = (canvas.height - barHeight) / 2;
                
                canvasCtx.beginPath();
                // Use roundRect if available, else fallback to rect
                if (typeof canvasCtx.roundRect === 'function') {
                    canvasCtx.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
                } else {
                    canvasCtx.rect(x + 1, y, barWidth - 2, barHeight);
                }
                canvasCtx.fill();

                x += barWidth;
            }
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [analyser, isPlaying]);

    if (!isPlaying) {
        return null;
    }

    return (
        <div 
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] global-visualizer-notch"
          style={{
            width: '280px',
            height: '42px',
            backgroundColor: 'rgba(10, 10, 12, 0.7)',
            borderRadius: '21px',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
            transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: isPlaying ? 1 : 0,
            transform: isPlaying ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, -20px) scale(0.9)',
            pointerEvents: 'none'
          }}
        >
            <canvas ref={canvasRef} width="248" height="28" />
        </div>
    );
};

export default GlobalMusicVisualizer;
