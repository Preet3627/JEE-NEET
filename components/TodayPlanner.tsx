
import React, { useMemo } from 'react';
import { ScheduleItem } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import Icon from './Icon';

interface TodayPlannerProps {
    items: ScheduleItem[];
    onEdit: (item: ScheduleItem) => void;
}

const TodayPlanner: React.FC<TodayPlannerProps> = ({ items, onEdit }) => {
    const { t } = useLocalization();

    // Derived state for today's date info
    const { todayName, todayDateString, formattedDate } = useMemo(() => {
        const date = new Date();
        return {
            todayName: date.toLocaleString('en-us', { weekday: 'long' }).toUpperCase(),
            todayDateString: date.toISOString().split('T')[0],
            formattedDate: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        };
    }, []);

    // Robust Memoized Filter
    const todaysItems = useMemo(() => {
        if (!Array.isArray(items)) return [];

        return items
            .filter(item => {
                // Safety Checks
                if (!item) return false;

                // Check for specific date override
                if ('date' in item && item.date) {
                    return item.date === todayDateString;
                }

                // Check for repeating day
                if (item.DAY && item.DAY.EN) {
                    return item.DAY.EN.toUpperCase() === todayName;
                }

                return false;
            })
            .sort((a, b) => {
                const timeA = 'TIME' in a && a.TIME ? a.TIME : '23:59';
                const timeB = 'TIME' in b && b.TIME ? b.TIME : '23:59';
                return timeA.localeCompare(timeB);
            });
    }, [items, todayName, todayDateString]);

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl shadow-2xl p-8 backdrop-blur-xl transition-all duration-300">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-2 flex items-center gap-3">
                        Today's Plan
                        <span className="bg-gradient-to-r from-red-500 to-orange-500 text-transparent bg-clip-text text-xl font-bold tracking-normal align-middle px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10">Live</span>
                    </h2>
                    <p className="text-gray-400 font-medium text-lg flex items-center gap-2">
                        <Icon name="calendar" className="w-5 h-5 opacity-70" />
                        {formattedDate}
                    </p>
                </div>

                {todaysItems.length > 0 && (
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white">{todaysItems.length}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tasks Remaining</p>
                    </div>
                )}
            </div>

            {/* Timeline / List */}
            {todaysItems.length > 0 ? (
                <div className="space-y-6 relative ml-4 md:ml-6 border-l-2 border-white/10 pl-6 md:pl-8 pb-4">
                    {todaysItems.map((item, index) => {
                        const hasTime = 'TIME' in item && !!item.TIME;
                        const subject = item.SUBJECT_TAG?.EN || 'General';

                        // Subject Colors
                        let subjectColorClass = 'bg-gray-500 text-gray-100';
                        if (subject === 'PHYSICS') subjectColorClass = 'bg-purple-600 text-white';
                        else if (subject === 'CHEMISTRY') subjectColorClass = 'bg-yellow-500 text-black';
                        else if (subject === 'MATHS') subjectColorClass = 'bg-blue-600 text-white';

                        return (
                            <div key={item.ID} className="relative group perspective-1000">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[39px] md:-left-[47px] top-6 w-5 h-5 rounded-full border-4 border-[#0f1115] ${hasTime ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-gray-600'}`}></div>

                                <div
                                    className="bg-gray-800/40 border border-white/5 hover:border-white/10 rounded-2xl p-5 hover:bg-gray-800/60 transition-all duration-300 hover:transform hover:translate-x-2 shadow-sm hover:shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-5 items-start md:items-center"
                                >
                                    {/* Gradient accent bar */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${subjectColorClass} opacity-80`}></div>

                                    {/* Time Column */}
                                    <div className="w-full md:w-24 flex-shrink-0 flex md:flex-col items-center justify-between md:justify-center gap-2 pr-4 md:border-r border-white/5">
                                        {hasTime ? (
                                            <>
                                                <p className="font-mono text-2xl font-bold text-white tracking-tight">{item.TIME}</p>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Scheduled</span>
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="clock" className="w-6 h-6 text-gray-600 mb-1" />
                                                <p className="text-xs font-bold text-gray-500 uppercase">Anytime</p>
                                            </>
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${subjectColorClass} shadow-md`}>
                                                {subject}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-gray-400 border border-white/5 uppercase">
                                                {item.type.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-1.5 truncate group-hover:text-cyan-400 transition-colors">
                                            {t(item.CARD_TITLE)}
                                        </h3>
                                        <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                                            {t(item.FOCUS_DETAIL)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    {(item.type === 'ACTION' || item.type === 'HOMEWORK') && (
                                        <div className="flex-shrink-0 pl-2">
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95 group-hover:opacity-100 opacity-100 md:opacity-0 focus:opacity-100"
                                                title="Edit Task"
                                            >
                                                <Icon name="edit" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-400/20 to-emerald-600/20 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
                        <Icon name="check" className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">You're all clear!</h3>
                    <p className="text-gray-400 text-center max-w-sm">No tasks scheduled for today. Take a break or add a new session to get ahead.</p>
                </div>
            )}
        </div>
    );
};

export default TodayPlanner;