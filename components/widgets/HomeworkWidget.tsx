import React from 'react';
import { ScheduleItem, HomeworkData } from '../../types';
import Icon from '../Icon';
import { useLocalization } from '../../context/LocalizationContext';

interface HomeworkWidgetProps {
  items: ScheduleItem[];
  onStartPractice: (homework: HomeworkData) => void;
}

const HomeworkWidget: React.FC<HomeworkWidgetProps> = ({ items, onStartPractice }) => {
  const { t } = useLocalization();
  const homeworkItems = items.filter(item => item.type === 'HOMEWORK') as HomeworkData[];
  
  if (homeworkItems.length === 0) {
      return null;
  }

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
        Homework
      </h2>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {homeworkItems.map(item => (
          <div key={item.ID} className="bg-gray-900/70 p-3 rounded-lg flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-white text-sm">{t(item.CARD_TITLE)}</p>
              <p className="text-xs text-gray-400">{item.DAY?.EN || ''}</p>
            </div>
            <button onClick={() => onStartPractice(item)} title="Start Practice Session" className="p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex-shrink-0">
              <Icon name="stopwatch" className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeworkWidget;
