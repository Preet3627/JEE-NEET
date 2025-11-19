
import React from 'react';
import { ExamData } from '../../types';
import Icon from '../Icon';

interface UpcomingExamsWidgetProps {
  exams: ExamData[];
}

const UpcomingExamsWidget: React.FC<UpcomingExamsWidgetProps> = ({ exams }) => {
  const today = new Date().toISOString().split('T')[0];
  
  const upcomingExams = exams
    .filter(exam => exam.date >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 2); // Show the next two exams

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
        Upcoming Exams
      </h2>
      <div className="space-y-4">
        {upcomingExams.length > 0 ? (
          upcomingExams.map(exam => (
            <div key={exam.ID} className="bg-gray-900/70 p-3 rounded-lg flex items-center gap-4">
               <div className="flex flex-col items-center justify-center text-center bg-gray-800 p-2 rounded-md w-16 flex-shrink-0">
                  <p className="font-mono font-bold text-lg text-white">
                      {new Date(exam.date).toLocaleDateString('en-GB', { day: '2-digit'})}
                    </p>
                    <p className="text-xs text-gray-400 uppercase">
                        {new Date(exam.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </p>
               </div>
               <div>
                  <p className="font-bold text-white text-sm">{exam.title}</p>
                  <p className="text-xs text-gray-400">{exam.subject} @ {exam.time}</p>
               </div>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-gray-500 py-8">
            <Icon name="trophy" className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            No upcoming exams scheduled.
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingExamsWidget;