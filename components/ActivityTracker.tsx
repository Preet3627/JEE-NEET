


import React from 'react';
import { ActivityData } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface ActivityTrackerProps {
    activities: ActivityData[];
}

const ActivityTracker: React.FC<ActivityTrackerProps> = ({ activities }) => {
    const { t } = useLocalization();

    if (activities.length === 0) {
        return null;
    }

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-cyan-400 tracking-widest uppercase mb-6">
                {t({ EN: "Activity Progress", GU: "પ્રવૃત્તિની પ્રગતિ" })}
            </h2>
            <div className="space-y-4">
                {activities.map(activity => (
                    <div key={activity.ID}>
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-sm font-medium text-gray-300">{t(activity.CARD_TITLE)}</h3>
                            <p className="text-sm font-bold text-cyan-400">{activity.STATUS}%</p>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div 
                                className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500" 
                                style={{ width: `${activity.STATUS}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActivityTracker;