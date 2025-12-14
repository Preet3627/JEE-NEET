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
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">Reading Hours Tracker</h3>
      <p className="text-gray-700 mb-4">
        Total Reading Hours: <span className="font-bold">{totalReadingHours.toFixed(2)}</span>
      </p>
      <div className="flex items-center space-x-2 mb-4">
        <input
          type="number"
          step="0.1"
          placeholder="Enter session duration (hours)"
          className="p-2 border rounded-md w-full"
          value={sessionDuration}
          onChange={(e) => setSessionDuration(e.target.value)}
        />
        <button
          onClick={handleLogReading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus://ring-blue-500 focus:ring-opacity-50"
        >
          Log Reading
        </button>
      </div>
      {/* You can add more features here, e.g., a list of recent sessions, goals, etc. */}
    </div>
  );
};

export default ReadingHoursWidget;