import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { DashboardWidgetItem } from '../../types';

interface WidgetSelectorModalProps {
  currentLayout: DashboardWidgetItem[];
  onSaveLayout: (newLayout: DashboardWidgetItem[]) => void;
  onClose: () => void;
}

// Define all available widgets here
const ALL_AVAILABLE_WIDGETS: { id: string; name: string; icon: string; defaultWide?: boolean; defaultTall?: boolean }[] = [
  { id: 'clock', name: 'Clock', icon: 'clock' },
  { id: 'countdown', name: 'Countdown', icon: 'timer', defaultWide: true }, // Often looks good wider
  { id: 'dailyInsight', name: 'Daily Insight', icon: 'bulb', defaultWide: true },
  { id: 'quote', name: 'Motivational Quote', icon: 'quote', defaultWide: true },
  { id: 'music', name: 'Music Player', icon: 'music', defaultWide: true },
  { id: 'practice', name: 'Practice Launcher', icon: 'stopwatch' },
  { id: 'subjectAllocation', name: 'Subject Allocation', icon: 'pie-chart' },
  { id: 'scoreTrend', name: 'Score Trend', icon: 'chart-line' },
  { id: 'flashcards', name: 'Flashcards', icon: 'cards' },
  { id: 'readingHours', name: 'Reading Hours', icon: 'book' },
  { id: 'todaysAgenda', name: 'Today\'s Agenda', icon: 'calendar', defaultWide: true },
  { id: 'upcomingExams', name: 'Upcoming Exams', icon: 'trophy', defaultWide: true },
  { id: 'homework', name: 'Homework', icon: 'clipboard' },
  { id: 'visualizer', name: 'Music Visualizer', icon: 'eye' },
  { id: 'weather', name: 'Weather', icon: 'cloud' },
  { id: 'achievements', name: 'Achievements', icon: 'star' },
  // Custom widgets will be handled dynamically if needed, not hardcoded here
];

const WidgetSelectorModal: React.FC<WidgetSelectorModalProps> = ({ currentLayout, onSaveLayout, onClose }) => {
  const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(
    new Set(currentLayout.map(w => w.id))
  );

  const handleToggleWidget = (widgetId: string) => {
    setSelectedWidgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(widgetId)) {
        newSet.delete(widgetId);
      } else {
        newSet.add(widgetId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    const newLayout: DashboardWidgetItem[] = ALL_AVAILABLE_WIDGETS
      .filter(widget => selectedWidgets.has(widget.id))
      .map(widget => {
        // Preserve existing properties if widget was already in layout
        const existingWidget = currentLayout.find(item => item.id === widget.id);
        return {
          id: widget.id,
          wide: existingWidget?.wide ?? widget.defaultWide ?? false,
          tall: existingWidget?.tall ?? widget.defaultTall ?? false,
          minimized: existingWidget?.minimized ?? false,
        };
      });
    onSaveLayout(newLayout);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-md w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Manage Widgets</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {ALL_AVAILABLE_WIDGETS.map(widget => (
            <div
              key={widget.id}
              className={`flex items-center p-3 rounded-lg border transition-all duration-200 cursor-pointer ${selectedWidgets.has(widget.id)
                  ? 'bg-cyan-600/30 border-cyan-500 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50 hover:border-gray-600'
              }`}
              onClick={() => handleToggleWidget(widget.id)}
            >
              <Icon name={widget.icon as any} className="w-5 h-5 mr-3" />
              <span className="font-semibold">{widget.name}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Save Layout</button>
        </div>
      </div>
    </div>
  );
};

export default WidgetSelectorModal;
