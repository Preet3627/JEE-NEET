
import React, { useMemo } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import ScheduleCard from './ScheduleCard';
import { ScheduleItem, HomeworkData, ScheduleCardData } from '../types';
import Icon from './Icon';

interface ScheduleListProps {
    items: ScheduleItem[];
    onDelete: (id: string) => void;
    onEdit: (item: ScheduleItem) => void;
    onMoveToNextDay: (id: string) => void;
    onStar: (id: string) => void;
    onStartPractice: (homework: HomeworkData) => void;
    onStartReviewSession: (deckId: string) => void;
    onMarkDoubt?: (topic: string, q_id: string) => void;
    onCompleteTask: (task: ScheduleCardData) => void;
    isSubscribed: boolean;
    view: 'upcoming' | 'past';
    onViewChange: (view: 'upcoming' | 'past') => void;
    isSelectMode: boolean;
    selectedTaskIds: string[];
    onTaskSelect: (taskId: string) => void;
    onToggleSelectMode: () => void;
    onDeleteSelected: () => void;
    onMoveSelected: () => void;
}

const ScheduleList: React.FC<ScheduleListProps> = (props) => {
    const {
        items, onDelete, onEdit, onMoveToNextDay, onStar, onStartPractice,
        onStartReviewSession, onMarkDoubt, onCompleteTask, isSubscribed,
        view, onViewChange, isSelectMode, selectedTaskIds, onTaskSelect,
        onToggleSelectMode, onDeleteSelected, onMoveSelected
    } = props;
    const { t } = useLocalization();

    const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

    // Memoized filtered and sorted items for performance and safety
    const sortedItems = useMemo(() => {
        // Robust safety: Ensure items is an array
        if (!Array.isArray(items)) return [];

        const today = new Date();
        const todayIndex = (today.getDay() + 6) % 7; // Monday = 0, Sunday = 6
        const todayDateStr = today.toISOString().split('T')[0];

        // Filter items based on view and validity
        const filtered = items.filter(item => {
            if (!item || !item.DAY || !item.DAY.EN) return false;

            const isOneOff = 'date' in item && !!item.date;

            if (isOneOff) {
                // Handle one-off legacy dates or ISO dates
                const itemDate = item.date!;
                if (view === 'upcoming') {
                    return itemDate >= todayDateStr;
                } else {
                    return itemDate < todayDateStr;
                }
            } else {
                // Repeating items logic
                const dayName = item.DAY.EN.toUpperCase();
                const cardDayIndex = daysOfWeek.indexOf(dayName);
                if (cardDayIndex === -1) return false; // Invalid day name

                if (view === 'upcoming') {
                    return cardDayIndex >= todayIndex;
                } else {
                    return cardDayIndex < todayIndex;
                }
            }
        });

        // Sort items
        return filtered.sort((a, b) => {
            // Safety checks for sort keys
            const aDay = a.DAY?.EN?.toUpperCase() || '';
            const bDay = b.DAY?.EN?.toUpperCase() || '';

            const aDayIndex = daysOfWeek.indexOf(aDay);
            const bDayIndex = daysOfWeek.indexOf(bDay);

            // 1. Sort by Day Index if different (primary sort)
            if (aDayIndex !== bDayIndex) {
                return view === 'upcoming'
                    ? aDayIndex - bDayIndex
                    : bDayIndex - aDayIndex;
            }

            // 2. Sort by Time if days are same (secondary sort)
            const aTime = 'TIME' in a && a.TIME ? a.TIME : '23:59';
            const bTime = 'TIME' in b && b.TIME ? b.TIME : '23:59';
            return aTime.localeCompare(bTime);
        });
    }, [items, view]);


    const TabButton: React.FC<{ tabId: 'upcoming' | 'past'; label: string; icon: string }> = ({ tabId, label, icon }) => (
        <button
            onClick={() => onViewChange(tabId)}
            className={`
                flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300
                ${view === tabId
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 scale-105'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }
            `}
        >
            <Icon name={icon as any} className="w-4 h-4" />
            {label}
        </button>
    );


    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 relative z-10">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                            <Icon name="schedule" className="w-8 h-8" />
                        </span>
                        {t({ EN: "Weekly Schedule", GU: "સાપ્તાહિક શેડ્યૂલ" })}
                    </h2>
                    <p className="text-gray-400 mt-1 ml-1 text-sm font-medium">Manage your learning journey</p>
                </div>

                <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-2xl border border-white/5">
                    <TabButton tabId="upcoming" label="Upcoming" icon="calendar" />
                    <TabButton tabId="past" label="History" icon="clock" />
                </div>
            </div>

            {/* Selection Toolbar */}
            <div className="flex justify-end mb-6">
                <button
                    onClick={onToggleSelectMode}
                    className={`
                        flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all border
                        ${isSelectMode
                            ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20'
                            : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    <Icon name={isSelectMode ? "close" : "list"} className="w-4 h-4" />
                    {isSelectMode ? 'Cancel Selection' : 'Select Tasks'}
                </button>
            </div>


            {/* Content Display */}
            <div className="space-y-5 min-h-[300px]">
                {sortedItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-5">
                        {sortedItems.map(card => (
                            <ScheduleCard
                                key={card.ID}
                                cardData={card}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onMoveToNextDay={onMoveToNextDay}
                                onStar={onStar}
                                onStartPractice={onStartPractice}
                                onStartReviewSession={onStartReviewSession}
                                onMarkDoubt={onMarkDoubt}
                                onCompleteTask={onCompleteTask}
                                isSubscribed={isSubscribed}
                                isPast={view === 'past'}
                                isSelectMode={isSelectMode}
                                isSelected={selectedTaskIds.includes(card.ID)}
                                onSelect={onTaskSelect}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-white/5 rounded-3xl bg-white/5">
                        <div className="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                            <Icon name={view === 'upcoming' ? "calendar" : "clock"} className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-300 mb-2">
                            {view === 'upcoming' ? "All caught up!" : "No history found"}
                        </h3>
                        <p className="text-gray-500 max-w-xs mx-auto">
                            {view === 'upcoming'
                                ? 'No upcoming tasks scheduled for this week. Enjoy your free time or add a new task!'
                                : 'Completed tasks and past schedules will appear here.'
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Selection Actions */}
            {isSelectMode && selectedTaskIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
                    <div className="bg-[#0f1115] border border-gray-700 shadow-2xl rounded-2xl p-2 pl-4 flex items-center gap-4">
                        <span className="text-sm font-bold text-gray-300">
                            <span className="text-cyan-400">{selectedTaskIds.length}</span> selected
                        </span>
                        <div className="h-6 w-px bg-gray-800"></div>
                        <div className="flex gap-2">
                            <button onClick={onMoveSelected} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 active:scale-95 transition-all shadow-lg shadow-cyan-900/20">
                                <Icon name="move" className="w-4 h-4" /> Move
                            </button>
                            <button onClick={onDeleteSelected} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-900/20">
                                <Icon name="trash" className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScheduleList;