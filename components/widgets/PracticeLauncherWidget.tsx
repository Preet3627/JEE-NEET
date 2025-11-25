import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Icon from '../Icon';

interface PracticeLauncherWidgetProps {
  onLaunch: () => void;
}

const PracticeLauncherWidget: React.FC<PracticeLauncherWidgetProps> = ({ onLaunch }) => {
  const { currentUser } = useAuth();
  const mistakesCount = currentUser?.RESULTS.reduce((acc, r) => acc + (r.MISTAKES?.length || 0) - (r.FIXED_MISTAKES?.length || 0), 0) || 0;

  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full min-h-[10rem] flex flex-col justify-between relative overflow-hidden group">
        {/* Replaced hardcoded image URL with CSS gradient for reliability */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-70 group-hover:opacity-90 transition-opacity duration-500"></div>

        <div className="relative z-10">
            <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                <Icon name="stopwatch" className="w-5 h-5 text-purple-400" />
                Practice
            </h2>
            <p className="text-xs text-gray-400 mt-1">Quick start a custom quiz.</p>
        </div>
        
        <div className="relative z-10 mt-4 flex flex-col gap-2">
             {mistakesCount > 0 && (
                <button onClick={onLaunch} className="flex-1 flex items-center justify-between p-2 bg-red-900/40 border border-red-500/30 rounded-lg hover:bg-red-900/60 transition-colors">
                    <span className="text-xs font-bold text-red-300 uppercase">Fix Mistakes</span>
                    <span className="font-black text-lg text-white">{mistakesCount}</span>
                </button>
             )}
            <button onClick={onLaunch} className="flex-1 p-3 bg-purple-600/80 border border-purple-500/30 rounded-lg text-center hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg">
                <Icon name="play" className="w-5 h-5 text-white"/>
                <span className="text-sm font-bold text-white">Start Session</span>
            </button>
        </div>
    </div>
  );
};

export default PracticeLauncherWidget;