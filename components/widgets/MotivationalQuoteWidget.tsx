
import React from 'react';

interface MotivationalQuoteWidgetProps {
    quote: string;
}

const MotivationalQuoteWidget: React.FC<MotivationalQuoteWidgetProps> = ({ quote }) => {
    return (
        <div className="bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm text-center">
            <p className="text-lg font-medium text-gray-300 italic">"{quote}"</p>
        </div>
    );
};

export default MotivationalQuoteWidget;
