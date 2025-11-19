import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/apiService';
import Icon from '../Icon';
import { motivationalQuotes } from '../../data/motivationalQuotes';
import { ExamData } from '../../types';

interface DailyInsightWidgetProps {
    weaknesses: string[];
    exams: ExamData[];
}

const DailyInsightWidget: React.FC<DailyInsightWidgetProps> = ({ weaknesses, exams }) => {
    const [insight, setInsight] = useState<{ quote: string; insight: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const getNearestUpcomingExamSyllabus = useCallback(() => {
        const today = new Date();
        const upcomingExams = exams
            .filter(exam => new Date(exam.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return upcomingExams.length > 0 ? upcomingExams[0].syllabus : undefined;
    }, [exams]);

    const fetchInsight = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const syllabus = getNearestUpcomingExamSyllabus();
            const result = await api.getDailyInsight({ weaknesses, syllabus });
            setInsight(result);
        } catch (err) {
            console.error(err);
            const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
            setInsight({ quote: randomQuote, insight: "Keep pushing forward! Every small step counts towards your big goal." });
            setError('Could not load AI insight, showing a quote instead.');
        } finally {
            setIsLoading(false);
        }
    }, [weaknesses, getNearestUpcomingExamSyllabus]);


    useEffect(() => {
        fetchInsight();
    }, [fetchInsight]);

    return (
        <div className="bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
            {isLoading && (
                <div className="flex items-center justify-center h-24">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {error && <p className="text-center text-xs text-yellow-500 mb-2">{error}</p>}
            {insight && (
                <div className="space-y-4">
                    <p className="text-lg font-medium text-gray-300 italic text-center">"{insight.quote}"</p>
                    <div className="border-t border-gray-700/50 my-4"></div>
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                         <div className="flex justify-between items-center mb-2">
                             <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                                <Icon name="gemini" className="w-4 h-4" /> Tip of the Day
                            </h4>
                            <button onClick={fetchInsight} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" title="Get new tip">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" />
                                </svg>
                            </button>
                         </div>
                        <p className="text-sm text-gray-300">{insight.insight}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyInsightWidget;