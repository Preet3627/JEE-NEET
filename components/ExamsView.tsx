import React from 'react';
import { ExamData } from '../types';
import Icon from './Icon';

interface ExamsViewProps {
  exams: ExamData[];
  onAdd: () => void;
  onEdit: (exam: ExamData) => void;
  onDelete: (examId: string) => void;
}

const ExamsView: React.FC<ExamsViewProps> = ({ exams, onAdd, onEdit, onDelete }) => {
  const sortedExams = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Upcoming Exams</h2>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
          <Icon name="plus" /> Add Exam
        </button>
      </div>

      <div className="space-y-4">
        {sortedExams.length > 0 ? (
          sortedExams.map(exam => {
            const isPast = exam.date < today;
            return (
              <div key={exam.ID} className={`bg-gray-800/50 rounded-lg border border-gray-700 p-4 transition-all group ${isPast ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">{exam.subject}</p>
                    <h3 className="text-lg font-bold text-white mt-1">{exam.title}</h3>
                    <p className="text-sm text-gray-400 mt-2">
                      <span className="font-semibold">Syllabus:</span> {exam.syllabus}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono font-bold text-lg text-white">
                      {new Date(exam.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-sm text-gray-400">{exam.time}</p>
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button onClick={() => onEdit(exam)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white"><Icon name="edit" className="w-4 h-4" /></button>
                        <button onClick={() => {if(window.confirm(`Are you sure you want to delete the exam "${exam.title}"?`)) onDelete(exam.ID)}} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700 hover:text-red-400"><Icon name="trash" className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-500 py-12 border-2 border-dashed border-gray-700 rounded-lg">
            <Icon name="trophy" className="w-12 h-12 mx-auto text-gray-600" />
            <p className="mt-4 font-semibold">No exams scheduled.</p>
            <p className="text-sm">Click "Add Exam" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamsView;
