import React, { useMemo } from 'react';

interface StaticWaveformProps {
  trackId: string;
  width?: number;
  height?: number;
  barCount?: number;
  color?: string;
}

const StaticWaveform: React.FC<StaticWaveformProps> = ({ 
  trackId, 
  width = 200, 
  height = 40, 
  barCount = 50, 
  color = "#16a34a" 
}) => {

  const bars = useMemo(() => {
    // A simple pseudo-random number generator based on the track ID
    let seed = 0;
    for (let i = 0; i < trackId.length; i++) {
      seed = (seed + trackId.charCodeAt(i)) % 10000;
    }
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: barCount }, () => {
      const randomValue = random();
      const barHeight = Math.max(2, randomValue * height);
      return {
        height: barHeight,
        y: (height - barHeight) / 2
      };
    });
  }, [trackId, height, barCount]);

  const barWidth = 2;
  const barSpacing = 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={i * (barWidth + barSpacing)}
          y={bar.y}
          width={barWidth}
          height={bar.height}
          fill={color}
          rx="1"
        />
      ))}
    </svg>
  );
};

export default StaticWaveform;