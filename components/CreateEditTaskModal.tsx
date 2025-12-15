
import React, { useState, useEffect, useCallback } from 'react';
import { ScheduleItem, ScheduleCardData, HomeworkData, FlashcardDeck } from '../types';
import Icon from './Icon';
import AIGenerateAnswerKeyModal from './AIGenerateAnswerKeyModal';
import { useAuth } from '../context/AuthContext';

interface CreateEditTaskModalProps {
  task: ScheduleItem | null;
  viewOnly?: boolean;
  onClose: () => void;
  onSave: (task: ScheduleItem) => void;
  decks: FlashcardDeck[];
  onDelete?: (taskId: string) => void;
  animationOrigin?: { x: string, y: string };
}

type TaskType = 'ACTION' | 'HOMEWORK' | 'FLASHCARD_REVIEW';

const parseAnswers = (text: string): Record<string, string> => {
  const answers: Record<string, string> = {};
  if (!text) return answers;

  // Check for key-value pair format first
  if (/[:=,;\n]/.test(text)) {
    const entries = text.split(/[,;\n]/);
    entries.forEach(entry => {
      const parts = entry.split(/[:=]/);
      if (parts.length === 2) {
        const qNum = parts[0].trim();
        const answer = parts[1].trim();
        if (qNum && answer) {
          answers[qNum] = answer;
        }
      }
    });
  } else {
    // Assume space-separated list for questions 1, 2, 3...
    const answerList = text.trim().split(/\s+/);
    answerList.forEach((answer, index) => {
      if (answer) {
        answers[(index + 1).toString()] = answer;
      }
    });
  }
  return answers;
};

const formatAnswers = (answers?: Record<string, string | string[]>): string => {
  if (!answers) return '';
  return Object.entries(answers).map(([q, a]) => `${q}:${Array.isArray(a) ? a.join(',') : a}`).join('\n');
};

const CreateEditTaskModal: React.FC<CreateEditTaskModalProps> = ({ task, viewOnly = false, onClose, onSave, decks, onDelete, animationOrigin }) => {
  const { currentUser } = useAuth();
  const theme = currentUser?.CONFIG.settings.theme;

  const getInitialTaskType = (): TaskType => {
    if (!task) return 'ACTION';
    if (task.type === 'HOMEWORK') return 'HOMEWORK';
    if (task.type === 'ACTION' && task.SUB_TYPE === 'FLASHCARD_REVIEW') return 'FLASHCARD_REVIEW';
    return 'ACTION';
  };

  const getInitialTime = () => {
    if (task && 'TIME' in task && task.TIME) return task.TIME;
    if (task && task.type === 'HOMEWORK') return '';
    const initialType = getInitialTaskType();
    if (initialType === 'HOMEWORK') return '';
    return '20:00';
  };

  const [taskType, setTaskType] = useState<TaskType>('ACTION');
  const [formData, setFormData] = useState({
    title: '',
    details: '',
    subject: 'PHYSICS',
    time: '20:00',
    day: new Date().toLocaleString('en-us', { weekday: 'long' }).toUpperCase(),
    date: '',
    qRanges: '',
    category: 'Custom',
    deckId: '',
    answers: '',
    gradient: '',
    imageUrl: '',
    externalLink: '',
  });
  const [smartInputValue, setSmartInputValue] = useState('');

  // Smart Parsing Logic
  const handleSmartInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSmartInputValue(val);

    // Basic heuristic parsing
    const lowerVal = val.toLowerCase();

    // Subject detection
    let newSubject = formData.subject;
    if (lowerVal.includes('physics') || lowerVal.includes('phy')) newSubject = 'PHYSICS';
    else if (lowerVal.includes('math') || lowerVal.includes('calc')) newSubject = 'MATHS';
    else if (lowerVal.includes('chem')) newSubject = 'CHEMISTRY';

    // Type detection
    let newType = taskType;
    if (lowerVal.includes('homework') || lowerVal.includes('hw') || lowerVal.includes('assignment')) newType = 'HOMEWORK';
    else if (lowerVal.includes('review') || lowerVal.includes('flashcard')) newType = 'FLASHCARD_REVIEW';
    else if (lowerVal.includes('study') || lowerVal.includes('read')) newType = 'ACTION';

    // Time extraction (simple HH:MM)
    let newTime = formData.time;
    const timeMatch = val.match(/(\d{1,2}:\d{2})/);
    if (timeMatch) newTime = timeMatch[1];

    setFormData(prev => ({
      ...prev,
      title: val, // Use full input as title for now
      subject: newSubject,
      time: newTime
    }));
    setTaskType(newType);
  };


  // Initialize form data only when task ID changes (not on every render)
  // Using task?.ID instead of task to prevent re-initialization when task object reference changes
  useEffect(() => {
    if (task) {
      setTaskType(getInitialTaskType());
      setFormData({
        title: task.CARD_TITLE.EN,
        details: task.FOCUS_DETAIL.EN,
        subject: task.SUBJECT_TAG.EN,
        time: getInitialTime(),
        day: task.DAY.EN.toUpperCase(),
        date: 'date' in task && task.date ? task.date : '',
        qRanges: task.type === 'HOMEWORK' ? task.Q_RANGES : '',
        category: task.type === 'HOMEWORK' ? task.category || 'Custom' : 'Custom',
        deckId: task.type === 'ACTION' && task.SUB_TYPE === 'FLASHCARD_REVIEW' ? task.deckId || '' : (decks.length > 0 ? decks[0].id : ''),
        answers: task.type === 'HOMEWORK' ? formatAnswers(task.answers as Record<string, string>) : '',
        gradient: 'gradient' in task && task.gradient ? task.gradient : '',
        imageUrl: 'imageUrl' in task && task.imageUrl ? task.imageUrl : '',
        externalLink: 'externalLink' in task && task.externalLink ? task.externalLink : '',
      });
    } else {
      setTaskType('ACTION');
      setFormData({
        title: '',
        details: '',
        subject: 'PHYSICS',
        time: '20:00',
        day: new Date().toLocaleString('en-us', { weekday: 'long' }).toUpperCase(),
        date: '',
        qRanges: '',
        category: 'Custom',
        deckId: decks.length > 0 ? decks[0].id : '',
        answers: '',
        gradient: '',
        imageUrl: '',
        externalLink: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.ID]);

  const [isExiting, setIsExiting] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Safety check for bubbling events in some browsers
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }

    const isEditing = !!task;
    let finalTask: ScheduleItem;

    const dayData = formData.date ? { EN: new Date(`${formData.date}T12:00:00Z`).toLocaleString('en-us', { weekday: 'long', timeZone: 'UTC' }).toUpperCase(), GU: "" } : { EN: formData.day, GU: "" };
    const dateData = formData.date ? { date: formData.date } : {};

    const commonData = {
      ...dateData,
      CARD_TITLE: { EN: formData.title, GU: "" },
      FOCUS_DETAIL: { EN: formData.details, GU: "" },
      SUBJECT_TAG: { EN: formData.subject.toUpperCase(), GU: "" },
      gradient: formData.gradient || undefined,
      imageUrl: formData.imageUrl || undefined,
      externalLink: formData.externalLink || undefined,
      googleEventId: isEditing && task && 'googleEventId' in task ? task.googleEventId : undefined,
    };

    if (taskType === 'HOMEWORK') {
      finalTask = {
        ID: isEditing && task.type === 'HOMEWORK' ? task.ID : `H${Date.now()}`,
        type: 'HOMEWORK',
        isUserCreated: true,
        DAY: dayData,
        ...commonData,
        Q_RANGES: formData.qRanges,
        TIME: formData.time || undefined,
        category: formData.category as HomeworkData['category'],
        answers: parseAnswers(formData.answers),
      } as HomeworkData;
    } else {
      finalTask = {
        ID: isEditing && task.type === 'ACTION' ? task.ID : `A${Date.now()}`,
        type: 'ACTION',
        SUB_TYPE: taskType === 'FLASHCARD_REVIEW' ? 'FLASHCARD_REVIEW' : 'DEEP_DIVE',
        isUserCreated: true,
        DAY: dayData,
        ...commonData,
        TIME: formData.time,
        deckId: taskType === 'FLASHCARD_REVIEW' ? formData.deckId : undefined,
      } as ScheduleCardData;
    }

    try {
      onSave(finalTask);
      // Use setTimeout to ensure save completes before closing
      setTimeout(() => handleClose(), 100);
    } catch (error) {
      console.error("Error saving task:", error);
    }

    // Prevent any default form behavior
    return false;
  };

  const handleDeleteTask = () => {
    if (onDelete && task) {
      if (window.confirm('Are you sure you want to delete this task?')) {
        onDelete(task.ID);
        handleClose();
      }
    }
  };

  const animationClasses = theme === 'liquid-glass' ? (isExiting ? 'genie-out' : 'genie-in') : (isExiting ? 'modal-exit' : 'modal-enter');
  const contentAnimationClasses = theme === 'liquid-glass' ? '' : (isExiting ? 'modal-content-exit' : 'modal-content-enter');

  // New Design System Classes
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1";
  const inputClass = "w-full bg-gray-900/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-md hover:bg-gray-900/60";
  const selectClass = "appearance-none w-full bg-gray-900/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all backdrop-blur-md hover:bg-gray-900/60 cursor-pointer";

  const ViewField: React.FC<{ label: string, value?: string, icon?: string }> = ({ label, value, icon }) => (
    value ? (
      <div className="bg-white/5 border border-white/5 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2">
          {icon && <Icon name={icon as any} className="w-3 h-3" />}
          {label}
        </p>
        <p className="text-gray-200 font-medium">{value}</p>
      </div>
    ) : null
  );

  const ModalShell: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div
      className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`}
      style={{ '--clip-origin-x': animationOrigin?.x, '--clip-origin-y': animationOrigin?.y } as React.CSSProperties}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-2xl bg-[#0f1115]/90 border border-white/10 rounded-3xl shadow-2xl ${contentAnimationClasses} max-h-[90vh] overflow-hidden flex flex-col relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-cyan-900/10 to-transparent">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            <p className="text-sm text-gray-400 mt-1">Manage your schedule and tasks efficiently</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer (if viewing) */}
        {viewOnly && task && (
          <div className="p-6 border-t border-white/5 bg-gray-900/50 flex justify-end gap-3">
            <button onClick={handleClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-300 hover:bg-white/5 transition-colors">Close</button>
            {onDelete && <button onClick={handleDeleteTask} className="px-6 py-2.5 rounded-xl font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Delete</button>}
            {task.type === 'HOMEWORK' && <button className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Start Task</button>}
          </div>
        )}
      </div>
    </div>
  );

  if (viewOnly && task) {
    return (
      <ModalShell title="Task Overview">
        <div className="p-6 space-y-4">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner ${task.SUBJECT_TAG.EN === 'PHYSICS' ? 'bg-purple-500/20 text-purple-400' :
                task.SUBJECT_TAG.EN === 'CHEMISTRY' ? 'bg-yellow-500/20 text-yellow-400' :
                  task.SUBJECT_TAG.EN === 'MATHS' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                {task.SUBJECT_TAG.EN[0]}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{task.CARD_TITLE.EN}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 uppercase tracking-wider">{task.type.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-400">{task.DAY.EN}</span>
                </div>
              </div>
            </div>
          </div>

          <ViewField label="Details" value={task.FOCUS_DETAIL.EN} icon="align-left" />

          <div className="grid grid-cols-2 gap-4">
            <ViewField label="Date" value={('date' in task && task.date) ? new Date(task.date).toLocaleDateString() : task.DAY.EN} icon="calendar" />
            {'TIME' in task && <ViewField label="Time" value={task.TIME} icon="clock" />}
          </div>

          {task.type === 'HOMEWORK' && <ViewField label="Questions" value={task.Q_RANGES} icon="list" />}
        </div>
      </ModalShell>
    );
  }

  return (
    <>
      <ModalShell title={task ? 'Edit Task' : 'Create Task'}>
        <div className="p-6 space-y-6">

          {/* Smart Input (Only for new tasks or explicit usage) */}
          {!task && (
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Icon name="sparkles" className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
              <input
                className="w-full bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-cyan-500/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 shadow-lg shadow-cyan-900/10 transition-all font-medium"
                placeholder="Smart Input: 'Maths homework tomorrow at 5pm'..."
                value={smartInputValue}
                onChange={handleSmartInputChange}
              />
              <div className="absolute top-full left-0 mt-2 w-full text-xs text-gray-500 px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                AI-free smart parsing active
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Subject</label>
                  <div className="relative">
                    <select required value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className={selectClass}>
                      <option value="PHYSICS">Physics</option>
                      <option value="CHEMISTRY">Chemistry</option>
                      <option value="MATHS">Maths</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                      <Icon name="chevron-down" className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Task Type</label>
                  <div className="relative">
                    <select value={taskType} onChange={e => setTaskType(e.target.value as TaskType)} className={selectClass}>
                      <option value="ACTION">Study Session</option>
                      <option value="HOMEWORK">Homework</option>
                      <option value="FLASHCARD_REVIEW">Flashcard Review</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                      <Icon name="chevron-down" className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Repeating Day / Date</label>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <select required value={formData.day} onChange={e => setFormData({ ...formData, day: e.target.value, date: '' })} className={`${selectClass} ${formData.date ? 'opacity-50' : ''}`} disabled={!!formData.date}>
                        {daysOfWeek.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                      </select>
                    </div>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className={`${inputClass} w-auto`} title="Specific Date" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Time</label>
                  <input type="time" required={taskType !== 'HOMEWORK'} value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-4 pt-2">
              <div>
                <label className={labelClass}>Title</label>
                <input required autoComplete="off" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputClass} placeholder="e.g. Chapter 4 Integration" />
              </div>

              <div>
                <label className={labelClass}>Focus Details</label>
                <textarea required rows={3} autoComplete="off" value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} className={`${inputClass} resize-none`} placeholder="What specific topics or problems?"></textarea>
              </div>
            </div>

            {/* Type Specific Fields */}
            {taskType === 'HOMEWORK' && (
              <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-4 animate-fade-in">
                <label className={labelClass}>Question Ranges</label>
                <input value={formData.qRanges} onChange={e => setFormData({ ...formData, qRanges: e.target.value })} className={inputClass} placeholder="e.g. 1-10, 15, 20-25" />
                <p className="text-[10px] text-gray-500 mt-1 ml-1">Comma separated ranges</p>
              </div>
            )}

            {taskType === 'FLASHCARD_REVIEW' && decks.length > 0 && (
              <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 animate-fade-in">
                <label className={labelClass}>Select Deck</label>
                <select value={formData.deckId} onChange={e => setFormData({ ...formData, deckId: e.target.value })} className={selectClass}>
                  {decks.map(deck => (
                    <option key={deck.id} value={deck.id}>{deck.name} ({deck.cards.length} cards)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Advanced / Optional Toggles could go here */}

            {/* Footer Actions */}
            <div className="pt-6 flex items-center justify-between border-t border-white/5 mt-6">
              {onDelete && task ? (
                <button type="button" onClick={handleDeleteTask} className="text-red-400 hover:text-red-300 text-sm font-semibold px-2 py-1 transition-colors">Delete Task</button>
              ) : <div></div>}

              <div className="flex gap-3">
                <button type="button" onClick={handleClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  {task ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </ModalShell>

      {/* Answer Key Generation Modal placeholder if needed */}
      {isAiKeyModalOpen && (
        <AIGenerateAnswerKeyModal
          onClose={() => setIsAiKeyModalOpen(false)}
          onKeyGenerated={(key) => setFormData(prev => ({ ...prev, answers: key }))}
        />
      )}
    </>
  );
};

export default CreateEditTaskModal;
