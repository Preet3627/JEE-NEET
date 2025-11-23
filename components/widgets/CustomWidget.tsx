import React from 'react';
import { renderMarkdown } from '../../utils/markdownParser';

interface CustomWidgetProps {
    title: string;
    content: string;
}

const CustomWidget: React.FC<CustomWidgetProps> = ({ title, content }) => {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-xl h-full overflow-hidden flex flex-col">
            <h2 className="text-lg font-bold text-cyan-400 tracking-wide mb-3 border-b border-white/10 pb-2 truncate">
                {title}
            </h2>
            <div 
                className="text-sm text-gray-300 prose prose-invert prose-sm break-words overflow-y-auto pr-2 custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        </div>
    );
};

export default CustomWidget;