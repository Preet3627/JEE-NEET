import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem } from '../../types';
import Icon from '../Icon';

const getNextTask = (items: ScheduleItem[]): (ScheduleItem & { scheduledTime: Date }) | null => {
    const now = new Date();
    const today = now.getDay(); // 0 for Sunday, 1 for Monday, etc.
    
    const upcomingTasks = items
        .map(item => {
            if (!('TIME' in item) || !item.TIME) return null;

            const [hours, minutes] = item.TIME.split(':').map(Number);
            let taskDate = new Date();

            if ('date' in item && item.date) {
                // One-off event
                taskDate = new Date(`${item.date}T00:00:00`);
            } else {
                // Repeating weekly event
                const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
                const taskDayIndex = days.indexOf(item.DAY.EN.toUpperCase());
                if (taskDayIndex === -1) return null;

                let dayDifference = taskDayIndex - today;
                // If the day is today but time has passed, schedule for next week
                if (dayDifference < 0 || (dayDifference === 0 && (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)))) {
                    dayDifference += 7;
                }
                taskDate.setDate(now.getDate() + dayDifference);
            }
            
            taskDate.setHours(hours, minutes, 0, 0);

            // Ensure we are only looking at future tasks
            if (taskDate < now) return null;

            return { ...item, scheduledTime: taskDate };
        })
        .filter((item): item is Extract<ScheduleItem, { TIME?: any }> & { scheduledTime: Date } => !!item)
        .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    return upcomingTasks[0] || null;
};


const CountdownWidget: React.FC<{ items: ScheduleItem[] }> = ({ items }) => {
    const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
    const nextTask = useMemo(() => getNextTask(items), [items]);

    const TOTAL_COUNTDOWN_SECONDS = 8 * 60 * 60; // Countdown ring visualization starts 8 hours before

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
                <Icon name="check" className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-white">All Clear!</h3>
                <p className="text-sm text-gray-400">No upcoming tasks scheduled.</p>
            </div>
        )
    }

    const { days, hours, minutes, seconds, totalSeconds } = timeRemaining;
    const progress = Math.max(0, Math.min(1, totalSeconds / TOTAL_COUNTDOWN_SECONDS));
    const activeSegments = Math.ceil(progress * 24);

    const timeDisplay = totalSeconds > 86400 // More than a day
        ? `${days}d ${hours}h`
        : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return (
        <div className="relative aspect-square w-full max-w-[280px] mx-auto flex items-center justify-center group transition-transform duration-300 hover:scale-[1.03] active:scale-100 cursor-pointer" title={`Next: ${nextTask.CARD_TITLE.EN}`}>
            {/* Segments */}
            <div className="absolute inset-[5%]">
                {Array.from({ length: 24 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-full h-full"
                        style={{ transform: `rotate(${i * 15}deg)` }}
                    >
                        <div
                            className={`absolute top-0 left-1/2 -translate-x-1/2 w-[10px] h-[20px] rounded-sm transition-all duration-500 ${i < activeSegments ? 'segment-active' : 'segment-inactive'}`}
                        />
                    </div>
                ))}
            </div>

            {/* Glass Ring */}
            <div className="absolute inset-0 border-[3px] border-white/10 rounded-full backdrop-blur-sm shadow-inner flex items-center justify-center">
                 <div className="w-[90%] h-[90%] bg-transparent rounded-full border border-white/5"></div>
            </div>
            
             {/* Steel Rivets */}
            {[45, 135, 225, 315].map(deg => (
                <div key={deg} className="absolute w-1.5 h-1.5 bg-gray-400 rounded-full border border-gray-600 shadow-md"
                    style={{
                        top: '50%', left: '50%',
                        transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-460%)`
                    }}
                />
            ))}

            {/* Main Body */}
            <div className="relative w-[78%] aspect-square bg-gray-700 rounded-full shadow-2xl flex items-center justify-center overflow-hidden">
                {/* Brushed metal effect */}
                <svg width="100%" height="100%" className="absolute inset-0">
                    <defs>
                        <filter id="brushed-metal">
                            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
                            <feDiffuseLighting in="SourceGraphic" result="light" lightingColor="white">
                                <feDistantLight azimuth="45" elevation="60" />
                            </feDiffuseLighting>
                            <feComposite in="light" in2="SourceAlpha" operator="in" />
                        </filter>
                        <linearGradient id="metal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#888" />
                            <stop offset="50%" stopColor="#BBB" />
                            <stop offset="100%" stopColor="#888" />
                        </linearGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#metal-gradient)" />
                    <rect width="100%" height="100%" fill="black" opacity="0.4" filter="url(#brushed-metal)" />
                </svg>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.2)_0%,_rgba(0,0,0,0.4)_100%)]"></div>
                
                {/* Aperture lines SVG */}
                <svg viewBox="0 0 200 200" className="absolute w-[100%] h-[100%] text-gray-400/30 group-hover:text-gray-300/50 transition-colors duration-300">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    {[0, 40, 80, 120, 160, 200, 240, 280, 320].map(angle => (
                         <path 
                            key={angle}
                            d="M 100 100 C 180 20, 180 180, 100 100"
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            transform={`rotate(${angle} 100 100)`}
                            className="group-hover:stroke-cyan-300/50 transition-all"
                            style={{ filter: "url(#glow)" }}
                         />
                    ))}
                </svg>

                {/* Digital Display */}
                <div className="relative z-10 text-center bg-black/50 backdrop-blur-sm p-2 rounded-md border-2 border-white/5 shadow-inner">
                    <div
                        className="font-mono text-2xl md:text-3xl font-bold text-cyan-300 tracking-wider"
                        style={{ textShadow: '0 0 5px #06b6d4, 0 0 10px #06b6d4' }}
                    >
                        {timeDisplay}
                    </div>
                    <div className="text-[10px] text-gray-300 uppercase tracking-[0.2em] mt-1">
                        Next Schedule
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CountdownWidget;