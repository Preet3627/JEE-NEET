
import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';

const MusicVisualizerWidget: React.FC = () => {
    const { analyser, isPlaying } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser || !isPlaying) {
             if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            return;
        }

        const canvasCtx = canvas.getContext('2d', { alpha: false }); // Optimized context
        if (!canvasCtx) return;

        analyser.fftSize = 128; // Lower resolution for performance
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isPlaying) return; // Stop drawing if paused

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = '#000000'; // Clear with solid color instead of clearRect for alpha false optimization
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                // Optimized static colors for performance
                // Use simpler gradient or solid color based on index
                const r = barHeight + 50;
                const g = 250 - i * 4;
                const b = 50;
                
                canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
            
            animationFrameId.current = requestAnimationFrame(draw);
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
    
    return <canvas ref={canvasRef} width="300" height="40" className="w-full h-10 rounded-lg" />;
};

export default MusicVisualizerWidget;
