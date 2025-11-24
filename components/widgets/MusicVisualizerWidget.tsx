

import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';
import Icon from '../Icon';

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

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameId.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const r = barHeight + (25 * (i/bufferLength));
                const g = 250 * (i/bufferLength);
                const b = 50;
                
                canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
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
    
    return <canvas ref={canvasRef} width="300" height="40" className="w-full h-10" />;
};

export default MusicVisualizerWidget;