
import React from 'react';
import { ScheduleItem } from '../../types';
import Icon from '../Icon';

interface SubjectAllocationWidgetProps {
  items: ScheduleItem[];
}

const PieChart: React.FC<{ data: { label: string, value: number, color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return null;

    let cumulative = 0;
    const paths = data.map(item => {
        const startAngle = (cumulative / total) * 360;
        const endAngle = ((cumulative + item.value) / total) * 360;
        cumulative += item.value;

        const start = polarToCartesian(50, 50, 40, endAngle);
        const end = polarToCartesian(50, 50, 40, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        return `M 50,50 L ${start.x},${start.y} A 40,40 0 ${largeArcFlag} 0 ${end.x},${end.y} Z`;
    });

    function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {paths.map((d, i) => (
                <path key={i} d={d} fill={data[i].color} />
            ))}
        </svg>
    );
};

const SubjectAllocationWidget: React.FC<SubjectAllocationWidgetProps> = ({ items }) => {
    const subjectCounts = items.reduce((acc, item) => {
        if (item.SUBJECT_TAG && item.SUBJECT_TAG.EN) { // Add null/undefined check
            const subject = item.SUBJECT_TAG.EN.toUpperCase();
            if (['PHYSICS', 'CHEMISTRY', 'MATHS'].includes(subject)) {
                acc[subject] = (acc[subject] || 0) + 1;
            }
        }
        return acc;
    }, {} as Record<string, number>);

    const chartData = [
        { label: 'Physics', value: subjectCounts['PHYSICS'] || 0, color: '#0891b2' }, // cyan
        { label: 'Chemistry', value: subjectCounts['CHEMISTRY'] || 0, color: '#16a34a' }, // green
        { label: 'Maths', value: subjectCounts['MATHS'] || 0, color: '#ca8a04' }, // amber
    ];
    
    const totalTasks = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col">
            <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
                Subject Focus
            </h2>
            {totalTasks > 0 ? (
                <div className="flex-grow grid grid-cols-2 gap-4 items-center">
                    <div className="w-full h-full aspect-square max-w-[150px] mx-auto">
                        <PieChart data={chartData} />
                    </div>
                    <div className="space-y-2">
                        {chartData.map(item => (
                            <div key={item.label} className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                <span className="text-sm text-gray-300">{item.label}:</span>
                                <span className="ml-auto font-semibold text-white">{((item.value / totalTasks) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                 <div className="flex-grow flex flex-col justify-center items-center text-center">
                    <Icon name="schedule" className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-sm text-gray-500">No scheduled tasks this week. Add tasks to see your subject allocation.</p>
                </div>
            )}
        </div>
    );
};

export default SubjectAllocationWidget;