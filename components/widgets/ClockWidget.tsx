import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleItem } from '../../types';

interface ClockWidgetProps {
    items?: ScheduleItem[]; // Optional to detect next schedule for urgency
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ items }) => {
    const [time, setTime] = useState(new Date());
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            setTime(now);
            
            // Check for urgency: Is there a task within 1 minute?
            if (items) {
                const upcoming = items.find(item => {
                    if ('TIME' in item && item.TIME) {
                        const [h, m] = item.TIME.split(':').map(Number);
                        const taskDate = new Date();
                        taskDate.setHours(h, m, 0, 0);
                        const diff = taskDate.getTime() - now.getTime();
                        return diff > 0 && diff < 60000; // Less than 1 minute away
                    }
                    return false;
                });
                setIsUrgent(!!upcoming);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [items]);

    const seconds = time.getSeconds();
    const minutes = time.getMinutes();
    const hours = time.getHours();

    // Ring Calculations (Circumference = 2 * pi * r)
    // r=90 -> c=565 (Hours)
    // r=75 -> c=471 (Minutes)
    // r=60 -> c=377 (Seconds)
    
    const hourProgress = ((hours % 12) + minutes / 60) / 12;
    const minuteProgress = (minutes + seconds / 60) / 60;
    const secondProgress = seconds / 60;

    const hourDashOffset = 565 * (1 - hourProgress);
    const minuteDashOffset = 471 * (1 - minuteProgress);
    const secondDashOffset = 377 * (1 - secondProgress);

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-4 backdrop-blur-xl h-full flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-500">
            {/* Dynamic Background Glow */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${isUrgent ? 'bg-[radial-gradient(circle_at_center,_rgba(255,50,50,0.2)_0%,_transparent_70%)] animate-pulse' : 'bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.1)_0%,_transparent_70%)]'}`}></div>

            <div className={`relative w-48 h-48 flex items-center justify-center transform transition-transform duration-500 ${isUrgent ? 'scale-110' : 'group-hover:scale-105'}`}>
                
                <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 200 200">
                    {/* HOURS RING (Outer) */}
                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#0891b2" strokeWidth="6" 
                            strokeDasharray="565" strokeDashoffset={hourDashOffset} strokeLinecap="round" 
                            className="transition-[stroke-dashoffset] duration-1000 ease-linear" />

                    {/* MINUTES RING (Middle) */}
                    <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                    <circle cx="100" cy="100" r="75" fill="none" stroke="#7c3aed" strokeWidth="5" 
                            strokeDasharray="471" strokeDashoffset={minuteDashOffset} strokeLinecap="round" 
                            className="transition-[stroke-dashoffset] duration-1000 ease-linear" />

                    {/* SECONDS RING (Inner) */}
                    {/* If Urgent: Rotate continuously. Else: Fill progressively */}
                    <g className={isUrgent ? 'animate-spin origin-center' : ''} style={{ transformOrigin: '100px 100px', animationDuration: '1s' }}>
                        <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        <circle cx="100" cy="100" r="60" fill="none" stroke={isUrgent ? '#ef4444' : '#10b981'} strokeWidth="4" 
                                strokeDasharray={isUrgent ? '30 30' : '377'} strokeDashoffset={isUrgent ? 0 : secondDashOffset} strokeLinecap="round" 
                                className={!isUrgent ? "transition-[stroke-dashoffset] duration-1000 ease-linear" : ""} />
                    </g>
                </svg>

                {/* Digital Display */}
                <div className="z-10 flex flex-col items-center justify-center text-white">
                    <h2 className="text-3xl font-bold font-sf-display tracking-wider drop-shadow-lg">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </h2>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-[0.2em] mt-1">
                        {time.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }).toUpperCase()}
                    </p>
                    {isUrgent && <span className="text-[10px] font-bold text-red-500 animate-pulse mt-1">HURRY UP</span>}
                </div>
            </div>
        </div>
    );
};

export default ClockWidget;