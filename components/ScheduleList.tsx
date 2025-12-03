


import React from 'react';
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
    onMarkDoubt?: (topic: string, q_id: string) => void; // Optional for now
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
    const todayIndex = (new Date().getDay() + 6) % 7; // Monday is 0, Sunday is 6

    const filteredItems = items.filter(item => {
        const cardDayIndex = daysOfWeek.indexOf(item.DAY.EN.toUpperCase());
        if (view === 'upcoming') {
            return cardDayIndex >= todayIndex;
        } else { // 'past'
            return cardDayIndex < todayIndex;
        }
    });

    const sortedItems = [...filteredItems].sort((a, b) => {
        const aDayIndex = daysOfWeek.indexOf(a.DAY.EN.toUpperCase());
        const bDayIndex = daysOfWeek.indexOf(b.DAY.EN.toUpperCase());

        // Sort by day first
        if (aDayIndex !== bDayIndex) {
            return view === 'upcoming' 
                ? aDayIndex - bDayIndex // Ascending for upcoming days
                : bDayIndex - aDayIndex; // Descending for past days
        }

        // If on the same day, sort by time (always ascending)
        const aTime = 'TIME' in a && a.TIME ? a.TIME : '23:59';
        const bTime = 'TIME' in b && b.TIME ? b.TIME : '23:59';
        return aTime.localeCompare(bTime);
    });
    
    const TabButton: React.FC<{ tabId: 'upcoming' | 'past'; children: React.ReactNode; }> = ({ tabId, children }) => (
        <button onClick={() => onViewChange(tabId)} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${view === tabId ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
            {children}
        </button>
    );


    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-cyan-400 tracking-widest uppercase">
                    {t({ EN: "Weekly Schedule", GU: "સાપ્તાહિક શેડ્યૂલ" })}
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={onToggleSelectMode} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isSelectMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                        {isSelectMode ? 'Cancel' : 'Select'}
                    </button>
                    <div className="flex items-center gap-2 p-1 rounded-lg bg-gray-900/50">
                        <TabButton tabId="upcoming">Upcoming</TabButton>
                        <TabButton tabId="past">History</TabButton>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                {sortedItems.length > 0 ? (
                    sortedItems.map(card => {
                        return (
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
                                isPast={false}
                                isSelectMode={isSelectMode}
                                isSelected={selectedTaskIds.includes(card.ID)}
                                onSelect={onTaskSelect}
                             />
                        )
                    })
                ) : (
                    <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-700 rounded-lg">
                        <p className="font-semibold">{view === 'upcoming' ? "No upcoming tasks for this week." : "No past tasks found."}</p>
                        <p className="text-sm">{view === 'upcoming' ? 'Click "Create Task" to add a new study session.' : 'Completed tasks from previous days will appear here.'}</p>
                    </div>
                )}
            </div>
            
            {isSelectMode && (
                <div className="sticky bottom-4 mt-4 w-full flex justify-center">
                    <div className="bg-gray-900/80 border border-gray-700 backdrop-blur-lg rounded-full shadow-lg p-2 flex items-center gap-2 animate-scaleIn">
                        <span className="text-sm font-semibold text-white px-3">{selectedTaskIds.length} selected</span>
                        <button onClick={onMoveSelected} disabled={selectedTaskIds.length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Icon name="calendar" className="w-4 h-4" /> Move
                        </button>
                        <button onClick={onDeleteSelected} disabled={selectedTaskIds.length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Icon name="trash" className="w-4 h-4" /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScheduleList;