import React from 'react';
import { ScheduleItem } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import Icon from './Icon';

interface TodayPlannerProps {
    items: ScheduleItem[];
    onEdit: (item: ScheduleItem) => void;
}

const TodayPlanner: React.FC<TodayPlannerProps> = ({ items, onEdit }) => {
    const { t } = useLocalization();
    const today = new Date();
    const todayName = today.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();
    const todayDateString = today.toISOString().split('T')[0];

    const todaysItems = items
        .filter(item => {
            const isDatedToday = 'date' in item && item.date === todayDateString;
            const isRepeatingToday = !('date' in item && item.date) && item.DAY.EN.toUpperCase() === todayName;
            return isDatedToday || isRepeatingToday;
        })
        .sort((a,b) => ('TIME' in a && a.TIME ? a.TIME : '23:59').localeCompare('TIME' in b && b.TIME ? b.TIME : '23:59'));

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-white mb-4">Today's Plan</h2>
            <p className="text-gray-400 mb-6">{today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

            {todaysItems.length > 0 ? (
                <div className="space-y-4">
                    {todaysItems.map(item => (
                        <div key={item.ID} className="bg-gray-800/50 p-4 rounded-lg flex items-center gap-4 group">
                            <div className="w-20 flex-shrink-0 text-center">
                                {'TIME' in item && item.TIME ? (
                                    <>
                                        <p className="font-mono text-lg font-bold text-white">{item.TIME}</p>
                                        <p className="text-xs text-gray-400">{item.SUBJECT_TAG.EN}</p>
                                    </>
                                ) : (
                                    <p className="text-sm font-semibold text-gray-500">All Day</p>
                                )}
                            </div>
                            <div className="flex-grow">
                                <h3 className="font-bold text-white">{t(item.CARD_TITLE)}</h3>
                                <p className="text-sm text-gray-400">{t(item.FOCUS_DETAIL)}</p>
                            </div>
                            {(item.type === 'ACTION' || item.type === 'HOMEWORK') && (
                                <button onClick={() => onEdit(item)} className="p-2 text-gray-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon name="edit" className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-700 rounded-lg">
                    <Icon name="check" className="w-12 h-12 mx-auto text-gray-600" />
                    <p className="mt-4 font-semibold">Nothing scheduled for today!</p>
                    <p className="text-sm">Enjoy your day or add a new task to your schedule.</p>
                </div>
            )}
        </div>
    );
};

export default TodayPlanner;