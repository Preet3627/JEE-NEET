import React from 'react';
import { ScheduleItem } from '../../types';
import Icon from '../Icon';
import { useLocalization } from '../../context/LocalizationContext';

interface TodaysAgendaWidgetProps {
  items: ScheduleItem[];
  onStar: (id: string) => void;
}

const TodaysAgendaWidget: React.FC<TodaysAgendaWidgetProps> = ({ items, onStar }) => {
  const { t } = useLocalization();
  const todayName = new Date().toLocaleString('en-us', { weekday: 'long' }).toUpperCase();
  
  const todaysItems = items
    .filter(item => item.DAY && item.DAY.EN && item.DAY.EN.toUpperCase() === todayName && (item.type === 'ACTION' || item.type === 'HOMEWORK'))
    .sort((a, b) => {
        const aTime = 'TIME' in a && a.TIME ? a.TIME : '23:59';
        const bTime = 'TIME' in b && b.TIME ? b.TIME : '23:59';
        return aTime.localeCompare(bTime);
    });

  const starredItems = items.filter(item => item.isStarred && item.DAY.EN.toUpperCase() !== todayName);
  const agendaItems = [...todaysItems, ...starredItems];

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-[var(--accent-color)] tracking-widest uppercase mb-4">
        Today's Agenda
      </h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {agendaItems.length > 0 ? (
          agendaItems.map(item => (
            <div key={item.ID} className="bg-gray-900/70 p-3 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-sm">{t(item.CARD_TITLE)}</p>
                <p className="text-xs text-gray-400">
                  {'TIME' in item && item.TIME ? item.TIME : ''}
                  {item.DAY.EN.toUpperCase() !== todayName && ` (${item.DAY.EN.substring(0,3)})`}
                </p>
              </div>
              <button onClick={() => onStar(item.ID)} title="Remove from Today's Focus" className="text-gray-400 hover:text-yellow-400 p-1.5 rounded-full">
                <Icon name="star" className={`w-5 h-5 ${item.isStarred ? 'text-yellow-400 fill-current' : ''}`} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-gray-500 py-8">Nothing scheduled for today. Star a task to add it here!</p>
        )}
      </div>
    </div>
  );
};

export default TodaysAgendaWidget;
