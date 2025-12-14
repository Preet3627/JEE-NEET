import React, { useRef, useEffect } from 'react';
import { VisualizerSettings } from '../types';

interface FullScreenVisualizerProps {
    analyser: AnalyserNode | null;
    visualizerSettings: VisualizerSettings;
    isPlaying: boolean;
    albumColor?: string; // Add albumColor prop
}

const FullScreenVisualizer: React.FC<FullScreenVisualizerProps> = ({ analyser, visualizerSettings, isPlaying, albumColor }) => {
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

        // Set canvas dimensions
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        analyser.fftSize = 1024; // Higher resolution for full screen
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let fillStyle = '#ffffff'; // Default white
            if (visualizerSettings.colorMode === 'rgb') {
                hueOffsetRef.current = (hueOffsetRef.current + 1) % 360;
                fillStyle = `hsl(${hueOffsetRef.current}, 80%, 60%)`;
            } else if (visualizerSettings.colorMode === 'album') {
                // Use passed dominant color if available
                fillStyle = albumColor || '#3b82f6'; // Blue-ish fallback
            }

            switch (visualizerSettings.preset) {
                case 'bars':
                    const barWidth = (canvas.width / bufferLength) * 2.5;
                    let x = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const barHeight = dataArray[i] / 2;
                        ctx.fillStyle = fillStyle;
                        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                        x += barWidth + 1;
                    }
                    break;
                case 'wave':
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = fillStyle;
                    ctx.beginPath();
                    const sliceWidth = canvas.width * 1.0 / bufferLength;
                    x = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        const y = v * canvas.height / 2;
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        x += sliceWidth;
                    }
                    ctx.lineTo(canvas.width, canvas.height / 2);
                    ctx.stroke();
                    break;
                case 'circle':
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const radius = Math.min(centerX, centerY) * 0.4; // Max radius
                    ctx.strokeStyle = fillStyle;
                    ctx.lineWidth = 3;

                    for (let i = 0; i < bufferLength; i++) {
                        const barHeight = dataArray[i] / 2;
                        const angle = (i / bufferLength) * Math.PI * 2;
                        const x1 = centerX + radius * Math.cos(angle);
                        const y1 = centerY + radius * Math.sin(angle);
                        const x2 = centerX + (radius + barHeight / 2) * Math.cos(angle);
                        const y2 = centerY + (radius + barHeight / 2) * Math.sin(angle);
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                    break;
                default:
                    break;
            }
            
            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [analyser, isPlaying, visualizerSettings, albumColor]); // Added albumColor to dependency array

    if (!isPlaying) return null;

    return (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 opacity-50" />
    );
};

export default FullScreenVisualizer;