

import React, { useState, useEffect } from 'react';
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
  animationOrigin?: { x: string, y: string };
}

type TaskType = 'ACTION' | 'HOMEWORK' | 'FLASHCARD_REVIEW';

const GRADIENT_PRESETS = [
    { name: 'None', value: '' },
    { name: 'Sunrise', value: 'from-orange-400 to-red-600' },
    { name: 'Ocean', value: 'from-cyan-500 to-blue-600' },
    { name: 'Nebula', value: 'from-purple-500 to-pink-600' },
    { name: 'Emerald', value: 'from-green-400 to-emerald-600' },
    { name: 'Midnight', value: 'from-gray-800 to-black' },
];

// FIX: Update parseAnswers to return Record<string, string | string[]>
const parseAnswers = (text: string): Record<string, string | string[]> => {
    const answers: Record<string, string | string[]> = {};
    if (!text) return answers;

    // Attempt to parse as full JSON first for arrays
    try {
        const jsonAttempt = JSON.parse(text);
        if (typeof jsonAttempt === 'object' && jsonAttempt !== null && !Array.isArray(jsonAttempt)) {
            // Validate that all values are string or string[]
            const isValidJson = Object.values(jsonAttempt).every(
                val => typeof val === 'string' || (Array.isArray(val) && val.every(item => typeof item === 'string'))
            );
            if (isValidJson) return jsonAttempt;
        }
    } catch (e) {
        // Not a direct JSON object, proceed with simpler parsing
    }

    // Check for key-value pair format (e.g., "1:A, 2:C")
    if (/[:=,;\n]/.test(text) && !text.includes(' ') ) { // Added !text.includes(' ') to differentiate from space separated list
        const entries = text.split(/[,;\n]/);
        entries.forEach(entry => {
            const parts = entry.split(/[:=]/); // Allow : or = as separator
            if (parts.length === 2) {
                const qNum = parts[0].trim();
                const answer = parts[1].trim();
                if (qNum && answer) answers[qNum] = answer;
            }
        });
    } else {
        // Assume space-separated list for questions 1, 2, 3... (e.g., "A C 12.5")
        const answerList = text.trim().split(/\s+/);
        answerList.forEach((answer, index) => {
            if (answer) answers[(index + 1).toString()] = answer;
        });
    }
    return answers;
};


// FIX: Update formatAnswers to accept Record<string, string | string[]>
const formatAnswers = (answers?: Record<string, string | string[]>): string => {
    if (!answers) return '';
    return Object.entries(answers).map(([q, a]) => {
        if (Array.isArray(a)) {
            return `${q}:[${a.join(',')}]`;
        }
        return `${q}:${a}`;
    }).join('\n');
};

const CreateEditTaskModal: React.FC<CreateEditTaskModalProps> = ({ task, viewOnly = false, onClose, onSave, decks, animationOrigin }) => {
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

  const [taskType, setTaskType] = useState<TaskType>(getInitialTaskType());
  const [formData, setFormData] = useState({
    title: task ? task.CARD_TITLE.EN : '',
    details: task ? task.FOCUS_DETAIL.EN : '',
    subject: task ? task.SUBJECT_TAG.EN : 'PHYSICS',
    time: getInitialTime(),
    day: task ? task.DAY.EN.toUpperCase() : new Date().toLocaleString('en-us', {weekday: 'long'}).toUpperCase(),
    date: task && 'date' in task ? task.date : '', 
    qRanges: task?.type === 'HOMEWORK' ? task.Q_RANGES : '',
    category: task?.type === 'HOMEWORK' ? task.category || 'Custom' : 'Custom',
    deckId: task?.type === 'ACTION' && task.SUB_TYPE === 'FLASHCARD_REVIEW' ? task.deckId : (decks.length > 0 ? decks[0].id : ''),
    answers: task?.type === 'HOMEWORK' ? formatAnswers(task.answers) : '',
    gradient: (task && 'gradient' in task) ? task.gradient : '',
    imageUrl: (task && 'imageUrl' in task) ? task.imageUrl : '',
    externalLink: (task && 'externalLink' in task) ? task.externalLink : '',
    isRecurring: (task && 'isRecurring' in task) ? !!task.isRecurring : false,
  });
  const [isExiting, setIsExiting] = useState(false);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, theme === 'liquid-glass' ? 500 : 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isEditing = !!task;
    let finalTask: ScheduleItem;
    
    const dayData = formData.date ? { EN: new Date(`${formData.date}T12:00:00Z`).toLocaleString('en-us', {weekday: 'long', timeZone: 'UTC'}).toUpperCase(), GU: "" } : { EN: formData.day, GU: "" };
    const dateData = formData.date ? { date: formData.date } : {};

    const baseData = {
        isUserCreated: true,
        DAY: dayData,
        ...dateData,
        CARD_TITLE: { EN: formData.title, GU: "" },
        FOCUS_DETAIL: { EN: formData.details, GU: "" },
        SUBJECT_TAG: { EN: formData.subject.toUpperCase(), GU: "" },
        TIME: formData.time || undefined,
        googleEventId: isEditing && 'googleEventId' in task ? task.googleEventId : undefined,
        gradient: formData.gradient,
        imageUrl: formData.imageUrl,
        externalLink: formData.externalLink,
        isRecurring: formData.isRecurring && !formData.date, // Only recur if no specific date
    };

    if (taskType === 'HOMEWORK') {
        finalTask = {
            ...baseData,
            ID: isEditing && task.type === 'HOMEWORK' ? task.ID : `H${Date.now()}`,
            type: 'HOMEWORK',
            Q_RANGES: formData.qRanges,
            category: formData.category as HomeworkData['category'],
            answers: parseAnswers(formData.answers),
        } as HomeworkData;
    } else { 
        finalTask = {
            ...baseData,
            ID: isEditing && task.type === 'ACTION' ? task.ID : `A${Date.now()}`,
            type: 'ACTION',
            SUB_TYPE: taskType === 'FLASHCARD_REVIEW' ? 'FLASHCARD_REVIEW' : 'DEEP_DIVE',
            deckId: taskType === 'FLASHCARD_REVIEW' ? formData.deckId : undefined,
        } as ScheduleCardData;
    }

    onSave(finalTask);
    handleClose();
  };

  const animationClasses = theme === 'liquid-glass' ? (isExiting ? 'genie-out' : 'genie-in') : (isExiting ? 'modal-exit' : 'modal-enter');
  const contentAnimationClasses = theme === 'liquid-glass' ? '' : (isExiting ? 'modal-content-exit' : 'modal-content-enter');
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-800/50 disabled:cursor-not-allowed";

  const ViewField: React.FC<{ label: string, value?: string }> = ({ label, value }) => (
    value ? <div><p className="text-sm font-bold text-gray-400">{label}</p><p className="text-gray-200 mt-1">{value}</p></div> : null
  );

  const ModalShell: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} style={{ '--clip-origin-x': animationOrigin?.x, '--clip-origin-y': animationOrigin?.y } as React.CSSProperties} onClick={handleClose}>
      <div className={`w-full max-w-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--modal-border-radius)] shadow-[var(--modal-shadow)] ${contentAnimationClasses} max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {/* MacOS Traffic Light Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
            <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">{title}</span>
        </div>

        <div className={`p-6 ${theme === 'liquid-glass' ? 'overflow-y-auto' : ''}`}>
          {theme !== 'liquid-glass' && <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );

  if (viewOnly && task) {
    return (
      <ModalShell title="Task Details">
          <div className="space-y-4">
            <ViewField label="Title" value={task.CARD_TITLE.EN} />
            <ViewField label="Details" value={task.FOCUS_DETAIL.EN} />
            <div className="grid grid-cols-2 gap-4">
                <ViewField label="Date" value={('date' in task && task.date) ? new Date(task.date).toLocaleDateString() : task.DAY.EN} />
                {'TIME' in task && <ViewField label="Time" value={task.TIME} />}
            </div>
            <ViewField label="Subject" value={task.SUBJECT_TAG.EN} />
            <ViewField label="External Link" value={(task as any).externalLink} />
            {task.type === 'HOMEWORK' && <ViewField label="Questions" value={task.Q_RANGES} />}
            
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
                {task.type === 'HOMEWORK' && <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Start Practice</button>}
            </div>
          </div>
      </ModalShell>
    );
  }

  return (
    <>
      <ModalShell title={task ? 'Edit Task' : 'Create New Task'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-400">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value as TaskType)} className={inputClass}>
                  <option value="ACTION">Study Session</option>
                  <option value="HOMEWORK">Homework</option>
                  <option value="FLASHCARD_REVIEW">Flashcard Review</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-400">Title</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} />
            </div>
             <div>
              <label className="text-sm font-bold text-gray-400">Details</label>
              <textarea required value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className={inputClass}></textarea>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-bold text-gray-400">Repeating Day</label>
                    <select required value={formData.day} onChange={e => setFormData({...formData, day: e.target.value, date: ''})} className={`${inputClass} disabled:opacity-50`} disabled={!!formData.date}>
                       {daysOfWeek.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                    </select>
                </div>
                <div><label className="text-sm font-bold text-gray-400">Or Specific Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={inputClass} /></div>
             </div>
             {!formData.date && (
                 <div className="flex items-center gap-2">
                     <input type="checkbox" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} className="w-4 h-4 rounded text-cyan-600 bg-gray-900 border-gray-600" />
                     <label className="text-sm text-gray-300">Repeat Weekly in Calendar (2 years)</label>
                 </div>
             )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div><label className="text-sm font-bold text-gray-400">Time</label><input type="time" required={taskType !== 'HOMEWORK'} value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className={inputClass} /></div>
                 <div>
                    <label className="text-sm font-bold text-gray-400">Subject</label>
                    <select required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className={inputClass}>
                        <option value="PHYSICS">Physics</option>
                        <option value="CHEMISTRY">Chemistry</option>
                        <option value="MATHS">Maths</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
             </div>
             
             {/* Customization & Linking */}
             <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 space-y-3">
                 <h4 className="text-sm font-bold text-cyan-400">Advanced</h4>
                 <div><label className="text-xs font-bold text-gray-400">External App Link</label><input value={formData.externalLink} onChange={e => setFormData({...formData, externalLink: e.target.value})} className={inputClass + " py-1 text-sm"} placeholder="https://zoom.us/..., https://unacademy.com/..." /></div>
                 <div><label className="text-xs font-bold text-gray-400">Background Image</label><input value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className={inputClass + " py-1 text-sm"} placeholder="https://example.com/image.jpg" /></div>
                 <div>
                    <label className="text-xs font-bold text-gray-400">Gradient</label>
                    <select value={formData.gradient} onChange={e => setFormData({...formData, gradient: e.target.value})} className={inputClass + " py-1 text-sm"}>
                        {GRADIENT_PRESETS.map(p => <option key={p.name} value={p.value}>{p.name}</option>)}
                    </select>
                 </div>
             </div>

            {taskType === 'HOMEWORK' && (
              <>
                <div><label className="text-sm font-bold text-gray-400">Question Ranges</label><input value={formData.qRanges} onChange={e => setFormData({...formData, qRanges: e.target.value})} className={inputClass} placeholder="e.g., Ex 1.1: 1-10; PYQs: 15-20" /></div>
                <div>
                  <label className="text-sm font-bold text-gray-400">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as 'Custom' | 'Level-1' | 'Level-2' | 'Classroom-Discussion' | 'PYQ'})} className={inputClass}>
                      <option value="Custom">Custom</option>
                      <option value="Level-1">Level-1</option>
                      <option value="Level-2">Level-2</option>
                      <option value="Classroom-Discussion">Classroom-Discussion</option>
                      <option value="PYQ">PYQ</option>
                  </select>
                </div>
                <div>
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-400">Answer Key</label>
                        <button type="button" onClick={() => setIsAiKeyModalOpen(true)} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"><Icon name="gemini" className="w-3 h-3" /> Generate with AI</button>
                    </div>
                  <textarea value={formData.answers} onChange={e => setFormData({...formData, answers: e.target.value})} className={`${inputClass} h-24 font-mono`} placeholder="1:A, 2:C OR A B C" />
                </div>
              </>
            )}
            
            {taskType === 'FLASHCARD_REVIEW' && (
              <div>
                <label className="text-sm font-bold text-gray-400">Flashcard Deck</label>
                <select required value={formData.deckId} onChange={e => setFormData({...formData, deckId: e.target.value})} className={`${inputClass} disabled:opacity-50`} disabled={decks.length === 0}>
                  {decks.length > 0 ? decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>) : <option>No decks available</option>}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
              <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">Save Task</button>
            </div>
          </form>
      </ModalShell>
      {isAiKeyModalOpen && <AIGenerateAnswerKeyModal onClose={() => setIsAiKeyModalOpen(false)} onKeyGenerated={(keyText) => setFormData(prev => ({ ...prev, answers: keyText }))} />}
    </>
  );
};

export default CreateEditTaskModal;