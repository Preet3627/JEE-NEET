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
    <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://media.istockphoto.com/id/1323933351/vector/hexagon-abstract-background-with-blue-and-purple-gradient-color-for-hi-tech-technology.jpg?s=612x612&w=0&k=20&c=K1aH1n1-Pj-S2o2aVyaW6vD0lVq-O9j7z2hfls2l-8I=')] bg-cover opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

        <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white tracking-wider flex items-center gap-3">
                <Icon name="stopwatch" className="w-6 h-6 text-purple-400" />
                Practice Center
            </h2>
            <p className="text-sm text-gray-400 mt-2">Generate a custom quiz or start a full mock test.</p>
        </div>
        
        <div className="relative z-10 mt-4 flex flex-col sm:flex-row gap-4">
             {mistakesCount > 0 && (
                <button onClick={onLaunch} className="flex-1 flex flex-col items-center justify-center p-4 bg-red-900/40 border border-red-500/30 rounded-lg text-center hover:bg-red-900/60 transition-colors">
                    <p className="font-black text-4xl text-white drop-shadow-lg">{mistakesCount}</p>
                    <p className="text-xs font-bold text-red-300 uppercase tracking-wider">Mistakes to Fix</p>
                </button>
             )}
            <button onClick={onLaunch} className="flex-1 p-4 bg-purple-600/50 border border-purple-500/30 rounded-lg text-center hover:bg-purple-600/70 transition-colors flex items-center justify-center gap-3">
                <Icon name="play" className="w-8 h-8 text-white"/>
                <span className="text-xl font-bold text-white">Launch</span>
            </button>
        </div>
    </div>
  );
};

export default PracticeLauncherWidget;
