import React, { useMemo } from 'react';
import { StudentData, StudySession, ResultData } from '../types';
import Icon from './Icon';

interface ZUstatProps {
    student: StudentData;
}

const ZUstat: React.FC<ZUstatProps> = ({ student }) => {
    const { STUDY_SESSIONS = [], RESULTS = [], SCHEDULE_ITEMS = [] } = student;

    // --- Statistics Calculation ---
    const totalStudyTime = useMemo(() => {
        return STUDY_SESSIONS.reduce((acc, session) => acc + (session.duration || 0), 0);
    }, [STUDY_SESSIONS]);

    const totalQuestionsSolved = useMemo(() => {
        return STUDY_SESSIONS.reduce((acc, session) => acc + (session.questions_solved || 0), 0);
    }, [STUDY_SESSIONS]);

    const averageMockScore = useMemo(() => {
        if (RESULTS.length === 0) return 0;
        const totalScore = RESULTS.reduce((acc, result) => {
            const [score] = result.SCORE.split('/').map(Number);
            return acc + (isNaN(score) ? 0 : score);
        }, 0);
        return Math.round(totalScore / RESULTS.length);
    }, [RESULTS]);

    const subjectDistribution = useMemo(() => {
        const dist: Record<string, number> = { PHYSICS: 0, CHEMISTRY: 0, MATHS: 0 };
        SCHEDULE_ITEMS.forEach(item => {
            if (item.type === 'HOMEWORK' || item.type === 'ACTION') {
                const subject = item.SUBJECT_TAG.EN.toUpperCase();
                if (subject in dist) {
                    dist[subject]++;
                }
            }
        });
        return dist;
    }, [SCHEDULE_ITEMS]);

    const totalTasks = Object.values(subjectDistribution).reduce((a, b) => a + b, 0) || 1;

    // --- Helper Components for Charts ---

    const ProgressBar: React.FC<{ value: number, max: number, color: string, label: string }> = ({ value, max, color, label }) => {
        const percentage = Math.min(100, Math.max(0, (value / max) * 100));
        return (
            <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-300">{label}</span>
                    <span className="text-gray-400">{value} / {max}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                    />
                </div>
            </div>
        );
    };

    const StatCard: React.FC<{ title: string, value: string | number, icon: string, color: string }> = ({ title, value, icon, color }) => (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-${color}-500/20 text-${color}-400`}>
                <Icon name={icon as any} className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
                <p className="text-xl font-bold text-white">{value}</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Study Hours" value={Math.round(totalStudyTime / 60)} icon="stopwatch" color="cyan" />
                <StatCard title="Questions Solved" value={totalQuestionsSolved} icon="book-open" color="purple" />
                <StatCard title="Avg. Mock Score" value={averageMockScore} icon="trophy" color="yellow" />
                <StatCard title="Total Assignments" value={SCHEDULE_ITEMS.filter(i => i.type === 'HOMEWORK').length} icon="check-circle" color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subject Distribution */}
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm lg:col-span-1">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Icon name="pie-chart" className="w-5 h-5 text-cyan-400" />
                        Subject Load
                    </h3>
                    <div className="space-y-4">
                        <ProgressBar value={subjectDistribution.PHYSICS} max={totalTasks} color="#3b82f6" label="Physics" />
                        <ProgressBar value={subjectDistribution.CHEMISTRY} max={totalTasks} color="#ec4899" label="Chemistry" />
                        <ProgressBar value={subjectDistribution.MATHS} max={totalTasks} color="#f59e0b" label="Mathematics" />
                    </div>
                </div>

                {/* Recent Performance / Weaknesses */}
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm lg:col-span-2">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Icon name="bulb" className="w-5 h-5 text-purple-400" />
                        Focus Areas (Weaknesses)
                    </h3>
                    {student.CONFIG.WEAK && student.CONFIG.WEAK.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {student.CONFIG.WEAK.map((weakness, idx) => (
                                <span key={idx} className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                                    {typeof weakness === 'string' ? weakness : (weakness as any).topic}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">No specific weaknesses recorded yet. Keep practicing!</p>
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-700/50">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h4>
                        <div className="space-y-2">
                            {STUDY_SESSIONS.slice(0, 3).map((session, i) => (
                                <div key={i} className="flex justify-between items-center text-sm p-2 rounded bg-gray-900/30">
                                    <span className="text-gray-400">{new Date(session.date).toLocaleDateString()}</span>
                                    <span className="text-gray-300">{Math.round(session.duration / 60)}h Study</span>
                                    <span className="text-cyan-400">{session.questions_solved} Qs</span>
                                </div>
                            ))}
                            {STUDY_SESSIONS.length === 0 && <p className="text-gray-500 text-xs text-center py-2">No recent study sessions.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ZUstat;
