
import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem } from '../../types';
import Icon from '../Icon';

const getNextTask = (items: ScheduleItem[]): (ScheduleItem & { scheduledTime: Date; TIME: string }) | null => {
    const now = new Date();
    const today = now.getDay(); 
    
    const upcomingTasks = items
        .map(item => {
            if (!('TIME' in item) || !item.TIME) return null;

            const [hours, minutes] = item.TIME.split(':').map(Number);
            let taskDate = new Date();

            if ('date' in item && item.date) {
                taskDate = new Date(`${item.date}T00:00:00`);
            } else {
                const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
                const taskDayIndex = days.indexOf(item.DAY.EN.toUpperCase());
                if (taskDayIndex === -1) return null;

                let dayDifference = taskDayIndex - today;
                if (dayDifference < 0 || (dayDifference === 0 && (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)))) {
                    dayDifference += 7;
                }
                taskDate.setDate(now.getDate() + dayDifference);
            }
            
            taskDate.setHours(hours, minutes, 0, 0);
            if (taskDate < now) return null;

            return { ...item, scheduledTime: taskDate, TIME: item.TIME } as ScheduleItem & { scheduledTime: Date; TIME: string };
        })
        .filter((item): item is ScheduleItem & { scheduledTime: Date; TIME: string } => !!item)
        .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    return upcomingTasks[0] || null;
};

const CountdownWidget: React.FC<{ items: ScheduleItem[] }> = ({ items }) => {
    const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
    const nextTask = useMemo(() => getNextTask(items), [items]);

    const TOTAL_COUNTDOWN_SECONDS = 8 * 60 * 60; 

    useEffect(() => {
        if (!nextTask) {
            setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const scheduledTime = new Date(nextTask.scheduledTime);
            const totalSecondsLeft = Math.max(0, Math.floor((scheduledTime.getTime() - now.getTime()) / 1000));

            if (totalSecondsLeft === 0) {
                clearInterval(interval);
            }
            
            setTimeRemaining({
                days: Math.floor(totalSecondsLeft / 86400),
                hours: Math.floor((totalSecondsLeft % 86400) / 3600),
                minutes: Math.floor((totalSecondsLeft % 3600) / 60),
                seconds: totalSecondsLeft % 60,
                totalSeconds: totalSecondsLeft,
            });
        }, 1000);

        return () => clearInterval(interval);

    }, [nextTask]);
    
    if (!nextTask) {
        return (
             <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center h-full flex flex-col justify-center items-center">
                <div className="w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mb-3 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                    <Icon name="check" className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-wider">All Clear</h3>
                <p className="text-xs text-cyan-300 uppercase tracking-widest mt-1">No pending tasks</p>
            </div>
        )
    }

    const { days, hours, minutes, seconds, totalSeconds } = timeRemaining;
    const progress = Math.max(0, Math.min(1, totalSeconds / TOTAL_COUNTDOWN_SECONDS));
    const rotationDeg = (1 - progress) * 360;

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-4 backdrop-blur-sm relative overflow-hidden group h-full flex flex-col justify-center" title={`Next: ${nextTask.CARD_TITLE.EN}`}>
            {/* Sci-Fi Background Elements */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.2)_0%,_transparent_70%)]"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

            <div className="relative flex flex-col items-center justify-center">
                {/* Outer HUD Ring */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="absolute w-full h-full animate-spin-slow" viewBox="0 0 100 100" style={{ animationDuration: '20s' }}>
                        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                        <path d="M50 2 A48 48 0 0 1 98 50" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="2" />
                        <path d="M50 98 A48 48 0 0 1 2 50" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="2" />
                    </svg>
                    
                    {/* Active Countdown Ring */}
                    <svg className="absolute w-[85%] h-[85%] transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                        <circle 
                            cx="50" cy="50" r="45" fill="none" 
                            stroke="#06b6d4" 
                            strokeWidth="6" 
                            strokeDasharray="283" 
                            strokeDashoffset={283 * progress}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-linear"
                            style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }}
                        />
                    </svg>

                    {/* Digital Time Display */}
                    <div className="flex flex-col items-center z-10">
                        <div className="font-mono text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(6,182,212,0.8)' }}>
                            {totalSeconds > 86400 ? (
                                <span>{days}<span className="text-sm text-cyan-400">d</span> {hours}<span className="text-sm text-cyan-400">h</span></span>
                            ) : (
                                <span>
                                    {hours.toString().padStart(2, '0')}:
                                    {minutes.toString().padStart(2, '0')}
                                    <span className="text-base text-cyan-400 font-normal ml-0.5">:{seconds.toString().padStart(2, '0')}</span>
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] mt-1 animate-pulse">
                            T-Minus
                        </div>
                    </div>
                </div>

                {/* Task Info */}
                <div className="mt-4 text-center w-full px-2">
                    <div className="h-[1px] w-1/2 bg-gradient-to-r from-transparent via-gray-500 to-transparent mx-auto mb-2"></div>
                    <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">Next Objective</p>
                    <p className="text-sm text-white font-medium truncate">{nextTask.CARD_TITLE.EN}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">{nextTask.TIME}</p>
                </div>
            </div>
        </div>
    );
};

export default CountdownWidget;
