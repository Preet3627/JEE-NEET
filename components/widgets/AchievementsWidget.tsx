import React from 'react';
import { StudentData, DoubtData } from '../../types';
import { useLocalization } from '../../context/LocalizationContext';
import Icon, { IconName } from '../Icon';
import { calculateAchievements, Achievement } from '../../utils/achievements';

interface AchievementsWidgetProps {
    student: StudentData;
    allDoubts: DoubtData[];
}

const AchievementBadge: React.FC<{ achievement: Achievement }> = ({ achievement }) => (
    <div className="relative group flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${achievement.unlocked ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-gray-700/30 border-gray-600/50'}`}>
            <Icon name={achievement.icon} className={`w-7 h-7 ${achievement.unlocked ? 'text-yellow-400' : 'text-gray-500'}`} />
        </div>
        <p className={`mt-1 text-xs font-semibold ${achievement.unlocked ? 'text-gray-200' : 'text-gray-500'}`}>{achievement.name}</p>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <p className="font-bold">{achievement.name}</p>
            <p>{achievement.description}</p>
            {!achievement.unlocked && <p className="text-yellow-400 text-center mt-1">[Locked]</p>}
        </div>
    </div>
);


const AchievementsWidget: React.FC<AchievementsWidgetProps> = ({ student, allDoubts }) => {
    const { t } = useLocalization();
    const achievements = calculateAchievements(student, allDoubts);
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase">
                    {t({ EN: "Achievements", GU: "સિદ્ધિઓ" })}
                </h2>
                <p className="text-sm font-bold text-yellow-400">{unlockedCount} / {achievements.length}</p>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
                {achievements.map(ach => <AchievementBadge key={ach.name} achievement={ach} />)}
            </div>
        </div>
    );
};

export default AchievementsWidget;