import React from 'react';
import { StudentData } from '../../types';
import Icon from '../Icon';

interface ReadingHoursWidgetProps {
  student: StudentData;
}

const ReadingHoursWidget: React.FC<ReadingHoursWidgetProps> = ({ student }) => {
  const sessions = student.STUDY_SESSIONS;

  const totalSeconds = sessions.reduce((acc, session) => acc + session.duration, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  const totalQuestions = sessions.reduce((acc, session) => acc + session.questions_solved, 0);

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
        Study Stats
      </h2>
      <div className="space-y-4">
        <div className="bg-gray-900 p-3 rounded-lg flex items-center gap-4">
            <Icon name="stopwatch" className="w-8 h-8 text-cyan-400 flex-shrink-0" />
            <div>
                <p className="text-sm text-gray-400">Total Study Time</p>
                <p className="text-2xl font-bold text-white">{totalHours} <span className="text-base">hrs</span></p>
            </div>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg flex items-center gap-4">
            <Icon name="check" className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
                <p className="text-sm text-gray-400">Questions Solved</p>
                <p className="text-2xl font-bold text-white">{totalQuestions}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingHoursWidget;
