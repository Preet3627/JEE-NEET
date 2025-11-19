import React from 'react';
import { ResultData } from '../../types';
import Icon from '../Icon';

interface ScoreTrendWidgetProps {
  results: ResultData[];
}

const ScoreTrendWidget: React.FC<ScoreTrendWidgetProps> = ({ results }) => {
  if (results.length < 2) { // Need at least 2 points to show a trend
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col justify-center items-center text-center">
            <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
                Score Trend
            </h2>
            <Icon name="trophy" className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-sm text-gray-500">Log at least two mock test results to see your progress trend here.</p>
        </div>
    );
  }

  const scores = results.map(r => parseInt(r.SCORE.split('/')[0]));
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const scoreRange = (maxScore - minScore) > 0 ? (maxScore - minScore) : 1;

  const points = scores.map((score, index) => {
    const x = (index / (scores.length - 1)) * 100;
    const y = 100 - ((score - minScore) / scoreRange) * 80 - 10; // Use 80% of height, with 10% padding
    return `${x},${y}`;
  }).join(' ');

  const latestResult = results[results.length - 1];
  const secondLatestResult = results[results.length - 2];
  const trend = parseInt(latestResult.SCORE.split('/')[0]) - parseInt(secondLatestResult.SCORE.split('/')[0]);

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase">
          Score Trend
        </h2>
         {trend !== null && (
         <div className={`flex items-center justify-center gap-1 text-sm font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)} pts
        </div>
      )}
      </div>
      <div className="relative h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'var(--accent-color)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent-color)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <polygon points={`0,100 ${points} 100,100`} fill="url(#scoreGradient)" />
          <polyline
            fill="none"
            stroke="var(--accent-color)"
            strokeWidth="2"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
};

export default ScoreTrendWidget;