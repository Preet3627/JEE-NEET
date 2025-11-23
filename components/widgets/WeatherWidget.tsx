
import React from 'react';
import Icon from '../Icon';

const WeatherWidget: React.FC = () => {
    // Simulate weather for now since we don't have a geo/weather API key configured by default
    // In a real production app, use navigator.geolocation and OpenWeatherMap API
    const temp = 28;
    const condition = 'Clear Sky';
    
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl"></div>
            <Icon name="book-open" className="w-12 h-12 text-yellow-400 mb-2" /> 
            {/* Ideally use a weather icon here, reusing existing icons for now */}
            
            <h3 className="text-3xl font-bold text-white">{temp}°C</h3>
            <p className="text-sm text-gray-300">{condition}</p>
            <p className="text-xs text-gray-500 mt-2">Location: India</p>
        </div>
    );
};

export default WeatherWidget;