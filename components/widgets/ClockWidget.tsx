
import React, { useState, useEffect } from 'react';

const ClockWidget: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col items-center justify-center">
            <h2 className="text-4xl font-mono font-bold text-white tracking-wider">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h2>
            <p className="text-sm text-cyan-400 font-semibold mt-1">
                {time.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
        </div>
    );
};

export default ClockWidget;