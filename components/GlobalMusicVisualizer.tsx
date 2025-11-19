import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

const GlobalMusicVisualizer: React.FC = () => {
    const { analyser, isPlaying } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number>();

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

        analyser.fftSize = 128; // Lower resolution for a stylized look
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            // FIX: `requestAnimationFrame` requires a callback argument. Passed the `draw` function to create the animation loop.
            animationFrameId.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = 3;
            let barHeight;
            let x = 0;
            
            // We'll only use a portion of the frequency data for a cleaner look
            const barsToDraw = Math.floor(bufferLength * 0.7);

            for (let i = 0; i < barsToDraw; i++) {
                barHeight = Math.pow(dataArray[i] / 255, 2) * canvas.height;
                
                // Create a gradient color effect
                const hue = (i / barsToDraw) * 120 + 180; // From cyan to purple-ish
                canvasCtx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                
                canvasCtx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);

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

    if (!isPlaying) {
        return null;
    }

    return (
        <div 
          className="fixed left-1/2 -translate-x-1/2 z-[100] global-visualizer-notch"
          style={{
            width: '200px',
            height: '28px',
            backgroundColor: 'rgba(20, 20, 20, 0.8)',
            borderRadius: '14px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            transition: 'opacity 0.3s',
            opacity: isPlaying ? 1 : 0,
            pointerEvents: 'none'
          }}
        >
            <canvas ref={canvasRef} width="180" height="20" />
        </div>
    );
};

export default GlobalMusicVisualizer;