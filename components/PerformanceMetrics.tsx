


import React from 'react';
import { useLocalization } from '../context/LocalizationContext';
// FIX: Corrected import path for mockData.
import { uiTextData } from '../data/mockData';
import Icon from './Icon';

interface PerformanceMetricsProps {
    score: string;
    weaknesses: string[];
    onEditWeaknesses: () => void;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ score, weaknesses, onEditWeaknesses }) => {
  const { t } = useLocalization();
  const [currentScore, totalScore] = score.split('/');

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full">
      <h2 className="text-xl font-semibold text-cyan-400 tracking-widest uppercase mb-6">
        {t(uiTextData.CURRENT_STATUS_TITLE)}
      </h2>
      
      <div className="space-y-6">
        <div className="bg-gray-900 p-4 rounded-lg border-l-4 border-cyan-500">
          <p className="text-sm text-gray-400">{t(uiTextData.CURRENT_SCORE)}</p>
          <p className="text-3xl font-bold text-white">{currentScore} <span className="text-lg text-gray-400">/ {totalScore}</span></p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-cyan-400 tracking-widest uppercase">
              {t(uiTextData.WEAKNESS_TITLE)}
            </h3>
            <button onClick={onEditWeaknesses} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white">
                <Icon name="edit" className="w-4 h-4"/>
            </button>
          </div>
          <ul className="space-y-2">
            {weaknesses.length > 0 ? weaknesses.map((weakness, index) => (
              <li key={index} className="flex items-center bg-gray-900 p-3 rounded-md">
                <svg className="w-5 h-5 text-cyan-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <span className="text-gray-300">{weakness}</span>
              </li>
            )) : <p className="text-sm text-gray-500 text-center py-4">No weaknesses logged. Add them manually or after a mock test.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;