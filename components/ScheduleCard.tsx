import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScheduleItem, HomeworkData, ScheduleCardData } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import Icon from './Icon';

interface ScheduleCardProps {
  cardData: ScheduleItem;
  onDelete: (id: string) => void;
  onEdit: (item: ScheduleItem) => void;
  onMoveToNextDay: (id: string) => void;
  onStar: (id: string) => void;
  onStartPractice: (homework: HomeworkData) => void;
  onStartReviewSession: (deckId: string) => void;
  onCompleteTask: (task: ScheduleCardData) => void;
  onMarkDoubt?: (topic: string, q_id: string) => void;
  isSubscribed: boolean;
  isPast: boolean; // Prop to indicate if the card is visually "past"
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const ScheduleCard: React.FC<ScheduleCardProps> = (props) => {
    const { cardData, onDelete, onEdit, onMoveToNextDay, onStar, onStartPractice, onStartReviewSession, onCompleteTask, onMarkDoubt, isSubscribed, isPast, isSelectMode, isSelected, onSelect } = props;
    const { t } = useLocalization();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [countdownProgress, setCountdownProgress] = useState(100);
    const menuRef = useRef<HTMLDivElement>(null);

    const isManageable = cardData.type === 'ACTION' || cardData.type === 'HOMEWORK';
    const { CARD_TITLE, SUBJECT_TAG, FOCUS_DETAIL, type, isStarred } = cardData;

    const canCopyCommand = cardData.type === 'ACTION' && 'ACTION_COMMAND' in cardData && !!cardData.ACTION_COMMAND;
    const canStartPractice = cardData.type === 'HOMEWORK';
    const isFlashcardReview = cardData.type === 'ACTION' && cardData.SUB_TYPE === 'FLASHCARD_REVIEW' && !!cardData.deckId;
    const isDeepDive = cardData.type === 'ACTION' && cardData.SUB_TYPE === 'DEEP_DIVE';
    
    // External link detection
    const externalLink = 'externalLink' in cardData ? cardData.externalLink : null;
    
    const showActionsFooter = canCopyCommand || canStartPractice || isFlashcardReview || isDeepDive || externalLink;
    const isSynced = 'googleEventId' in cardData && !!cardData.googleEventId;

    const gradient = 'gradient' in cardData ? cardData.gradient : undefined;
    const imageUrl = 'imageUrl' in cardData ? cardData.imageUrl : undefined;

    const isToday = useMemo(() => {
        const today = new Date();
        const todayName = today.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();
        if ('date' in cardData && cardData.date) {
            // Compare date strings directly for simplicity, assuming YYYY-MM-DD
            return cardData.date === today.toISOString().split('T')[0];
        }
        return cardData.DAY.EN.toUpperCase() === todayName;
    }, [cardData]);

    useEffect(() => {
        if (!isToday || !('TIME' in cardData) || !cardData.TIME) {
            setCountdownProgress(100);
            return;
        }
        const updateProgress = () => {
            const now = new Date();
            const [hours, minutes] = cardData.TIME!.split(':').map(Number); // Use non-null assertion as checked above
            const startTime = new Date();
            startTime.setHours(hours, minutes, 0, 0);
            
            // Start countdown 8 hours before task time
            const countdownStart = new Date(startTime.getTime() - 8 * 60 * 60 * 1000);

            if (now.getTime() > startTime.getTime()) {
                setCountdownProgress(0); // Task has passed
                return;
            }
            if (now.getTime() < countdownStart.getTime()) {
                setCountdownProgress(100); // Task is far in the future
                return;
            }

            const totalDuration = startTime.getTime() - countdownStart.getTime();
            const elapsed = now.getTime() - countdownStart.getTime();
            const progress = 100 - (elapsed / totalDuration) * 100;
            setCountdownProgress(Math.max(0, progress));
        };
        updateProgress();
        const interval = setInterval(updateProgress, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [cardData, isToday]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCopy = (text?: string) => {
      if (!text) return;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleCardClick = () => {
        if (isSelectMode) onSelect(cardData.ID);
    };

    const backgroundStyle: React.CSSProperties = {};
    let containerClasses = "rounded-lg p-5 transition-all duration-300 relative backdrop-blur-sm group overflow-hidden";
    if (imageUrl) {
        backgroundStyle.backgroundImage = `url(${imageUrl})`;
        backgroundStyle.backgroundSize = 'cover';
        backgroundStyle.backgroundPosition = 'center';
        containerClasses += " border-0 shadow-lg";
    } else if (gradient) {
        containerClasses += ` bg-gradient-to-br ${gradient} border-0 shadow-md`;
    } else {
        containerClasses += " bg-gray-800/50 border border-gray-700/80 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10";
    }
    if (isPast) containerClasses += " opacity-60";
    if (isSelectMode) containerClasses += " cursor-pointer";
    if (isSelected) containerClasses += " ring-2 ring-cyan-500";

  return (
    <div className={containerClasses} style={backgroundStyle} onClick={handleCardClick}>
      {imageUrl && <div className="absolute inset-0 bg-black/60 z-0"></div>}
      <div className="relative z-10 flex flex-col h-full">
          {isToday && countdownProgress < 100 && !imageUrl && !gradient && (
              <div className="absolute top-0 left-0 h-full w-full border-2 border-[var(--accent-color)] rounded-lg pointer-events-none" style={{ clipPath: `inset(0 ${100 - countdownProgress}% 0 0)` }}></div>
          )}
          
          {isSynced && !isSelectMode && <div className="absolute -top-1 -left-1" title="Synced with Google Calendar"><Icon name="calendar" className="w-4 h-4 text-green-400" /></div>}
          
          {isSelectMode && (
              <div className="absolute -top-1 -left-1">
                  <input type="checkbox" checked={isSelected} onChange={() => onSelect(cardData.ID)} className="w-5 h-5 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500" />
              </div>
          )}

          {isManageable && !isSelectMode && (
              <div className="absolute -top-1 -right-1 flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onStar(cardData.ID); }} className="text-gray-400 hover:text-yellow-400 p-1.5 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icon name="star" className={`w-5 h-5 ${isStarred ? 'text-yellow-400 fill-current' : ''}`} />
                  </button>
                  <div ref={menuRef}>
                      <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="text-gray-400 hover:text-white p-1.5 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon name="ellipsis" className="w-5 h-5" />
                      </button>
                      {isMenuOpen && (
                          <div className={`popup-menu ${isMenuOpen ? 'popup-enter' : 'popup-exit'} absolute right-0 mt-2 w-48 bg-gray-900/95 border border-gray-700 rounded-lg shadow-lg backdrop-blur-xl z-20`} onClick={e => e.stopPropagation()}>
                              <ul className="py-1">
                                  <li><button onClick={() => { onEdit(cardData); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"><Icon name="edit" className="w-4 h-4" /> Edit Task</button></li>
                                  <li><button onClick={() => { onMoveToNextDay(cardData.ID); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"><Icon name="forward" className="w-4 h-4" /> Move to Next Day</button></li>
                                  <li><button onClick={() => { onDelete(cardData.ID); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-700/50"><Icon name="trash" className="w-4 h-4" /> Delete Task</button></li>
                              </ul>
                          </div>
                      )}
                  </div>
              </div>
          )}

          <div className="flex-grow">
              <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${imageUrl || gradient ? 'bg-black/40 text-white border-white/20' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'} border`}>
                      {t(SUBJECT_TAG)}
                  </span>
                  {'TIME' in cardData && cardData.TIME && <span className="text-sm font-mono text-gray-300 font-semibold bg-black/20 px-1 rounded">{cardData.TIME}</span>}
              </div>
              <h3 className="text-lg font-bold text-white my-2 flex items-center gap-2 flex-wrap shadow-black drop-shadow-md">
                <span>{t(CARD_TITLE)}</span>
                {type === 'HOMEWORK' && cardData.category && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/40 text-white border border-purple-500/30">{cardData.category}</span>
                )}
              </h3>
              <p className="text-sm text-gray-300 mb-3 line-clamp-3">{t(FOCUS_DETAIL)}</p>
               {type === 'HOMEWORK' && 'Q_RANGES' in cardData && (
                <div className="text-xs font-mono text-cyan-200 space-y-1">
                  <span className="font-semibold text-gray-400">Questions:</span>
                  <div className="flex flex-wrap gap-2">
                    {cardData.Q_RANGES.split(';').map((range, idx) => <span key={idx} className="bg-black/40 px-2 py-1 rounded border border-white/10">{range.replace(/@p(\d+)/, ' (p. $1)')}</span>)}
                  </div>
                </div>
              )}
          </div>

           {showActionsFooter && !isSelectMode && (
             <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex gap-2">
                  {isDeepDive && <button onClick={() => onCompleteTask(cardData as ScheduleCardData)} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-md bg-green-600/90 hover:bg-green-500 transition-colors shadow-lg"><Icon name="check" className="w-4 h-4" /> Complete</button>}
                  {isFlashcardReview && <button onClick={() => onStartReviewSession((cardData as ScheduleCardData).deckId!)} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-md bg-yellow-600/90 hover:bg-yellow-500 transition-colors shadow-lg"><Icon name="cards" className="w-4 h-4" /> Review</button>}
                  {canStartPractice && <button onClick={() => onStartPractice(cardData as HomeworkData)} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-md bg-purple-600/90 hover:bg-purple-500 transition-colors shadow-lg"><Icon name="stopwatch" className="w-4 h-4" /> Practice</button>}
                  {canCopyCommand && 'ACTION_COMMAND' in cardData && (
                    <button onClick={() => handleCopy(cardData.ACTION_COMMAND)} className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-md bg-gray-700/80 hover:bg-gray-600 transition-colors shadow-lg"><Icon name={copied ? "check" : "copy"} className={`w-4 h-4 ${copied ? 'text-green-400' : ''}`} /> {copied ? 'Copied!' : 'Cmd'}</button>
                  )}
                  {externalLink && (
                      <a href={externalLink} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-md bg-blue-600/90 hover:bg-blue-500 transition-colors shadow-lg text-white no-underline">
                          <Icon name="forward" className="w-4 h-4" /> Open App
                      </a>
                  )}
                </div>
             </div>
           )}
      </div>
    </div>
  );
};

export default ScheduleCard;