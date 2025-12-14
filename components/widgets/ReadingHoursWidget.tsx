import React, { useState, useEffect } from 'react';

const ReadingHoursWidget: React.FC = () => {
  const [totalReadingHours, setTotalReadingHours] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<string>(''); // Input as string

  useEffect(() => {
    // Load total reading hours from local storage on component mount
    const storedHours = localStorage.getItem('totalReadingHours');
    if (storedHours) {
      setTotalReadingHours(parseFloat(storedHours));
    }
  }, []);

  useEffect(() => {
    // Save total reading hours to local storage whenever it changes
    localStorage.setItem('totalReadingHours', totalReadingHours.toString());
  }, [totalReadingHours]);

  const handleLogReading = () => {
    const duration = parseFloat(sessionDuration);
    if (!isNaN(duration) && duration > 0) {
      setTotalReadingHours((prevHours) => prevHours + duration);
      setSessionDuration(''); // Clear the input field
    } else {
      alert('Please enter a valid positive number for reading duration.');
    }
  };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm h-full flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold text-[var(--accent-color)] tracking-wider uppercase mb-4">Reading Hours</h3>
        <div className="text-center">
            <p className="text-5xl font-bold text-white">{totalReadingHours.toFixed(2)}</p>
            <p className="text-sm text-gray-400 mt-1">Total Hours Logged</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 mt-4">
        <input
          type="number"
          step="0.1"
          placeholder="Log session (hrs)"
          className="w-full px-3 py-2 text-sm text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          value={sessionDuration}
          onChange={(e) => setSessionDuration(e.target.value)}
        />
        <button
          onClick={handleLogReading}
          className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 flex-shrink-0"
        >
          Log
        </button>
      </div>
    </div>
  );
};

export default ReadingHoursWidget;