import React, { useState, useMemo } from 'react';
import { StudentData, StudySession } from '../../types';

interface ReadingHoursWidgetProps {
  student: StudentData;
  onLogStudySession?: (session: Omit<StudySession, 'date'> & { date: string }) => Promise<void>;
}

const ReadingHoursWidget: React.FC<ReadingHoursWidgetProps> = ({ student, onLogStudySession }) => {
  const [sessionDuration, setSessionDuration] = useState<string>(''); // Input as string

  // Calculate total reading hours from student data
  const totalReadingHours = useMemo(() => {
    if (!student.STUDY_SESSIONS) return 0;
    const totalconds = student.STUDY_SESSIONS.reduce((acc, session) => acc + session.duration, 0);
    return totalconds / 3600; // Convert seconds to hours
  }, [student.STUDY_SESSIONS]);

  const handleLogReading = async () => {
    const durationHours = parseFloat(sessionDuration);
    if (!isNaN(durationHours) && durationHours > 0) {
      if (onLogStudySession) {
        try {
          // Create a new study session object
          // Note: This is an inferred structure. 
          // Ideally we'd have more details, but for a simple "log hours" widget, we assume it's a generic session.
          const newSession = {
            date: new Date().toISOString().split('T')[0],
            duration: durationHours * 3600, // Convert hours to seconds
            questions_solved: 0,
            questions_skipped: []
          };
          await onLogStudySession(newSession);
          setSessionDuration(''); // Clear the input field
          alert('Session logged successfully!');
        } catch (error) {
          console.error("Failed to log session:", error);
          alert('Failed to log session. Please try again.');
        }
      } else {
        // Fallback for when no handler is provided (though in this app it seems it should be)
        alert('Logging is not connected in this view.');
      }
    } else {
      alert('Please enter a valid positive number for reading duration.');
    }
  };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--accent-color)] tracking-wider uppercase">Reading Hours</h3>
          <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">Total Time</span>
        </div>

        <div className="text-center py-2">
          <p className="text-5xl font-bold text-white tracking-tight">{totalReadingHours.toFixed(2)}</p>
          <p className="text-sm text-gray-400 mt-2 font-medium">Hours Logged</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-700/30">
        <input
          type="number"
          step="0.1"
          placeholder="Add hours..."
          className="w-full px-3 py-2 text-sm text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
          value={sessionDuration}
          onChange={(e) => setSessionDuration(e.target.value)}
        />
        <button
          onClick={handleLogReading}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 flex-shrink-0"
        >
          Log
        </button>
      </div>
    </div>
  );
};

export default ReadingHoursWidget;