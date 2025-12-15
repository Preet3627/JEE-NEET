
import React, { useState, useEffect } from 'react';
import { ScheduleItem } from './types';
import { useLocalization } from './context/LocalizationContext';
import Icon from './components/Icon';
import ScheduleCard from './components/ScheduleCard';

interface PlannerViewProps {
    items: ScheduleItem[];
    onEdit: (item: ScheduleItem) => void;
}

type ViewMode = 'weekly' | 'monthly' | 'list' | 'today';

const PlannerView: React.FC<PlannerViewProps> = ({ items, onEdit }) => {
    const { t } = useLocalization();
    const [viewMode, setViewMode] = useState<ViewMode>('today'); // Default to Today view
    const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

    // Placeholder functions explicitly typed
    const noop = () => { };
    const defaultOnSelect = () => { };
    const defaultOnStartPractice = () => { };
    const defaultOnStartReviewSession = () => { };
    const defaultOnCompleteTask = () => { };
    const defaultOnMarkDoubt = () => { };

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Create a clock for "now" line
        return () => clearInterval(timer);
    }, []);

    const filterItemsForToday = () => {
        const today = new Date();
        const todayName = today.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();
        const todayDateString = today.toISOString().split('T')[0];

        return items
            .filter(item => ('date' in item && item.date === todayDateString) || (!('date' in item && item.date) && item.DAY.EN.toUpperCase() === todayName))
            .sort((a, b) => ('TIME' in a && a.TIME ? a.TIME : '23:59').localeCompare('TIME' in b && b.TIME ? b.TIME : '23:59'));
    };

    const renderTodayTimeline = () => {
        const todaysItems = filterItemsForToday();

        return (
            <div className="relative pl-6 py-4 space-y-8 animate-fade-in-up">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent"></div>

                <div className="mb-6 flex items-center gap-3">
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Today's Timeline</h3>
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-gray-400 font-mono">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </div>

                {todaysItems.length > 0 ? todaysItems.map((item, index) => (
                    <div key={item.ID} className="relative pl-8 group">
                        {/* Time Marker */}
                        <div className="absolute left-[-5px] top-6 w-3 h-3 rounded-full bg-black border-2 border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)] z-10 group-hover:scale-125 transition-transform" />

                        <div className="mb-1 text-sm font-mono text-cyan-400 font-bold ml-1">
                            {'TIME' in item && item.TIME ? item.TIME : 'All Day'}
                        </div>

                        <div className="transform transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <ScheduleCard
                                cardData={item}
                                onDelete={noop}
                                onEdit={onEdit}
                                onMoveToNextDay={noop}
                                onStar={noop}
                                onStartPractice={defaultOnStartPractice}
                                onStartReviewSession={defaultOnStartReviewSession}
                                onCompleteTask={defaultOnCompleteTask}
                                onMarkDoubt={defaultOnMarkDoubt}
                                isSubscribed={false}
                                isPast={false}
                                isSelectMode={false}
                                isSelected={false}
                                onSelect={defaultOnSelect}
                            />
                        </div>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                        <Icon name="check-circle" className="w-16 h-16 text-gray-600 mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">No tasks for today</h3>
                        <p className="text-sm text-gray-500">Enjoy your free time!</p>
                    </div>
                )}
            </div>
        );
    };

    const renderWeeklyView = () => {
        const scheduleByDay: { [key: string]: ScheduleItem[] } = daysOfWeek.reduce((acc, day) => {
            acc[day] = items.filter(item => !('date' in item && item.date) && item.DAY.EN.toUpperCase() === day);
            return acc;
        }, {} as { [key: string]: ScheduleItem[] });

        return (
            <div className="grid grid-cols-1 gap-8 animate-fade-in">
                {daysOfWeek.map(day => (
                    <div key={day} className="relative">
                        <div className="sticky top-0 z-10 bg-[#0f1115]/80 backdrop-blur-md py-3 mb-2 flex items-center gap-4 border-b border-white/5">
                            <h3 className="text-xl font-bold text-white tracking-wide">{t({ EN: day, GU: day })}</h3>
                            <div className="h-px flex-grow bg-gradient-to-r from-white/10 to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {scheduleByDay[day] && scheduleByDay[day].length > 0 ? (
                                scheduleByDay[day]
                                    .sort((a, b) => ('TIME' in a && a.TIME ? a.TIME : '23:59').localeCompare('TIME' in b && b.TIME ? b.TIME : '23:59'))
                                    .map(item => (
                                        <div key={item.ID} className="relative group">
                                            <ScheduleCard
                                                cardData={item}
                                                onDelete={noop}
                                                onEdit={onEdit}
                                                onMoveToNextDay={noop}
                                                onStar={noop}
                                                onStartPractice={defaultOnStartPractice}
                                                onStartReviewSession={defaultOnStartReviewSession}
                                                onCompleteTask={defaultOnCompleteTask}
                                                onMarkDoubt={defaultOnMarkDoubt}
                                                isSubscribed={false}
                                                isPast={false}
                                                isSelectMode={false}
                                                isSelected={false}
                                                onSelect={defaultOnSelect}
                                            />
                                        </div>
                                    ))
                            ) : (
                                <div className="p-8 border border-white/5 border-dashed rounded-xl flex items-center justify-center text-gray-600 text-sm">
                                    No tasks
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderMonthlyView = () => {
        const now = new Date();
        const monthlySchedule: { [key: string]: ScheduleItem[] } = {};

        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            const dayName = date.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();

            const repeatingTasks = items.filter(item => !('date' in item && item.date) && item.DAY.EN.toUpperCase() === dayName);
            const datedTasks = items.filter(item => 'date' in item && item.date === dateString);

            const tasksForDay = [...repeatingTasks, ...datedTasks].sort((a, b) =>
                ('TIME' in a && a.TIME ? a.TIME : '23:59').localeCompare('TIME' in b && b.TIME ? "b.TIME" : '23:59')
            );

            if (tasksForDay.length > 0) {
                monthlySchedule[dateString] = tasksForDay;
            }
        }

        return (
            <div className="space-y-12 animate-fade-in">
                {Object.keys(monthlySchedule).map(dateString => (
                    <div key={dateString} className="relative">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-800 flex flex-col items-center justify-center border border-white/10">
                                <span className="text-xs text-gray-400 font-bold uppercase">{new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                <span className="text-xl font-bold text-white">{new Date(dateString).getDate()}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-300">
                                {new Date(dateString).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pl-4 border-l border-white/5 ml-6">
                            {monthlySchedule[dateString].map(item => (
                                <ScheduleCard
                                    key={item.ID}
                                    cardData={item}
                                    onDelete={noop}
                                    onEdit={onEdit}
                                    onMoveToNextDay={noop}
                                    onStar={noop}
                                    onStartPractice={defaultOnStartPractice}
                                    onStartReviewSession={defaultOnStartReviewSession}
                                    onCompleteTask={defaultOnCompleteTask}
                                    onMarkDoubt={defaultOnMarkDoubt}
                                    isSubscribed={false}
                                    isPast={false}
                                    isSelectMode={false}
                                    isSelected={false}
                                    onSelect={defaultOnSelect}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {Object.keys(monthlySchedule).length === 0 && <p className="text-center text-gray-500 py-10">No tasks found in the next 30 days based on your weekly template.</p>}
            </div>
        )
    };

    const renderListView = () => {
        const scheduleByDay = daysOfWeek.reduce((acc, day) => {
            const dayItems = items
                .filter(item => !('date' in item && item.date) && item.DAY.EN.toUpperCase() === day)
                .sort((a, b) => ('TIME' in a && a.TIME ? a.TIME : '23:59').localeCompare('TIME' in b && b.TIME ? b.TIME : '23:59'));
            if (dayItems.length > 0) {
                acc[day] = dayItems;
            }
            return acc;
        }, {} as { [key: string]: ScheduleItem[] });

        return (
            <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                {Object.keys(scheduleByDay).map(day => (
                    <div key={day} className="bg-[#14161a] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white tracking-wide">{day}</h3>
                            <span className="text-xs font-mono text-gray-500">{scheduleByDay[day].length} Tasks</span>
                        </div>
                        <div className="p-4 space-y-3">
                            {scheduleByDay[day].map(item => (
                                <div key={item.ID} className="flex gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                                    <div className="text-sm font-mono text-cyan-400 w-16 text-right pt-1">{'TIME' in item ? item.TIME : '--'}</div>
                                    <div className="flex-grow">
                                        <h4 className="text-white font-medium">{item.CARD_TITLE.EN}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-1">{item.FOCUS_DETAIL.EN}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-[10px] font-bold h-fit ${item.type === 'HOMEWORK' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-purple-900/30 text-purple-400'}`}>
                                        {item.type}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Tab Button Component with Icon
    const TabButton: React.FC<{ tabId: ViewMode, icon: string, label: string }> = ({ tabId, icon, label }) => (
        <button
            onClick={() => setViewMode(tabId)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${viewMode === tabId ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
            <Icon name={icon as any} className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-[#0f1115]">
            <div className="sticky top-0 z-30 bg-[#0f1115]/80 backdrop-blur-xl border-b border-white/5 pb-4 pt-2 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4">
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
                            <Icon name="calendar" className="w-6 h-6 text-white" />
                        </div>
                        Schedule
                    </h2>
                    <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#1a1d23] border border-white/5">
                        <TabButton tabId="today" icon="check-circle" label="Today" />
                        <TabButton tabId="weekly" icon="server" label="Weekly" />
                        <TabButton tabId="monthly" icon="calendar" label="Monthly" />
                        <TabButton tabId="list" icon="list" label="List" />
                    </div>
                </div>
            </div>

            <div className="px-4 pb-20">
                {viewMode === 'today' && renderTodayTimeline()}
                {viewMode === 'weekly' && renderWeeklyView()}
                {viewMode === 'monthly' && renderMonthlyView()}
                {viewMode === 'list' && renderListView()}
            </div>
        </div>
    );
};

export default PlannerView;