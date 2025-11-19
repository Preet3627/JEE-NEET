import React from 'react';
import { renderMarkdown } from '../../utils/markdownParser';

interface CustomWidgetProps {
    title: string;
    content: string;
}

const CustomWidget: React.FC<CustomWidgetProps> = ({ title, content }) => {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full">
            <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
                {title}
            </h2>
            <div 
                className="text-sm text-gray-300 prose prose-invert prose-sm break-words max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        </div>
    );
};

export default CustomWidget;
