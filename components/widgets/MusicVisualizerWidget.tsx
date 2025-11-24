
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

        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        // Reduce resolution for performance, but keep visual fidelity ok
        analyser.fftSize = 256; 
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                // Simplified color calculation to reduce lag
                // A simple gradient based on height or index is faster than string interpolation per frame per bar
                // But for now we stick to rgb but pre-calculate common values if possible.
                // Here we just do it inline but optimized.
                
                const r = barHeight + 50;
                const g = 250 - i * 2;
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
    
    return <canvas ref={canvasRef} width="300" height="40" className="w-full h-10" />;
};

export default MusicVisualizerWidget;
