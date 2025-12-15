
import React, { useRef, useEffect } from 'react';
import { useMusicPlayer } from '../../context/MusicPlayerContext';

interface MusicVisualizerWidgetProps {
    height?: number;
    barCount?: number;
    color?: string;
}

const MusicVisualizerWidget: React.FC<MusicVisualizerWidgetProps> = ({ height = 40, barCount, color }) => {
    const { analyser, isPlaying } = useMusicPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Handle "off" state visualization if needed, or just clear
        const canvasCtx = canvas.getContext('2d'); // Removed alpha: false to allow transparent bg if needed
        if (!canvasCtx) return;

        if (!analyser || !isPlaying) {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw a flat line or something to indicate ready
            canvasCtx.fillStyle = color || 'rgba(255, 255, 255, 0.2)';
            canvasCtx.fillRect(0, canvas.height - 2, canvas.width, 2);
            return;
        }

        analyser.fftSize = 128; // Lower resolution for performance
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isPlaying) return; // Stop drawing if paused

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            // Adjust bar count to fit width if specified, or use full buffer
            const barsToRender = barCount || bufferLength;
            const step = Math.ceil(bufferLength / barsToRender);
            const barWidth = (canvas.width / barsToRender);

            let x = 0;

            for (let i = 0; i < barsToRender; i++) {
                // Average out the step range for smoother bars if downsampling
                let value = 0;
                for (let j = 0; j < step; j++) {
                    value += dataArray[(i * step) + j] || 0;
                }
                value = value / step;

                // Scale height to fit canvas
                const percent = value / 255;
                const barHeight = Math.max((percent * 0.6) * canvas.height, 2); // Ensure at least 2px high


                if (color) {
                    canvasCtx.fillStyle = color;
                } else {
                    const r = (barHeight / canvas.height) * 255 + 50;
                    const g = 250 - (i / barsToRender) * 100;
                    const b = 255;
                    canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
                }

                // Center bars vertically for "waveform" look if desired, or bottom aligned.
                // Let's stick to bottom aligned for now as it's standard.
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

                x += barWidth;
            }

            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [analyser, isPlaying, height, barCount, color]);

    return (
        <canvas
            ref={canvasRef}
            height={height}
            className="w-full h-full"
            style={{ display: 'block' }} // Remove inline-block gap
        />
    );
};

export default MusicVisualizerWidget;

