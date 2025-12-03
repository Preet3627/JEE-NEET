

import React, { useState } from 'react';
import { StudentData, ScheduleItem, HomeworkData, ScheduleCardData } from '../types';
import Icon from './Icon';
import AIGuide from './AIGuide';
import { MessagingModal } from './MessagingModal';
import CreateEditTaskModal from './CreateEditTaskModal';
import AIParserModal from './AIParserModal';
import { api } from '../api/apiService';
import { useAuth } from '../context/AuthContext';

interface TeacherDashboardProps {
    students: StudentData[];
    onToggleUnacademySub: (sid: string) => void;
    onDeleteUser: (sid: string) => void;
    onAddTeacher?: (teacherData: any) => void;
    onBroadcastTask: (task: ScheduleItem, examType: 'JEE' | 'NEET' | 'ALL') => void;
    openModal: (modalId: string, setStateTrue: React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void), initialValue?: any) => void; // New prop
    closeModal: (modalId: string) => void; // New prop
    // New props for controlling specific modal states
    isCreateModalOpen: boolean; setIsCreateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isAiParserModalOpen: boolean; setisAiParserModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isMessagingModalOpen: boolean; setMessagingModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // FIX: Changed to mandatory
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ students, onToggleUnacademySub, onDeleteUser, onAddTeacher, onBroadcastTask, openModal, closeModal, setIsCreateModalOpen, setisAiParserModalOpen, isCreateModalOpen, isAiParserModalOpen, isMessagingModalOpen, setMessagingModalOpen }) => {
    const { loginWithToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'grid' | 'broadcast' | 'guide'>('grid');
    const [messagingStudent, setMessagingStudent] = useState<StudentData | null>(null);
    const [broadcastTarget, setBroadcastTarget] = useState<'ALL' | 'JEE' | 'NEET'>('ALL');

    const TabButton: React.FC<{ tabId: string; children: React.ReactNode; }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId as any)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === tabId ? 'text-cyan-400 border-cyan-400' : 'text-gray-400 border-transparent hover:text-white'}`}
        >
            {children}
        </button>
    );

    const handleBroadcastSave = (task: ScheduleItem) => {
        const taskWithUniqueId = { ...task, ID: `${task.type.charAt(0)}${Date.now()}` };
        if (window.confirm(`Are you sure you want to send this task to all ${broadcastTarget} students?`)) {
            onBroadcastTask(taskWithUniqueId, broadcastTarget);
            closeModal('CreateEditTaskModal'); // Use closeModal
        }
    };
    
    const handleAIBroadcastSave = (data: any) => {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error("Received invalid data format from AI.");
            }
            
            const createLocalizedString = (text: string) => ({ EN: text || '', GU: '' });

            // Robustly extract schedules array
            const schedules = Array.isArray(data.schedules) ? data.schedules : (data.schedule ? [data.schedule] : []);

            if (schedules.length === 0) {
                 alert("No valid 'schedules' array found in AI response. Please check the Guide.");
                 return;
            }

            const tasksToBroadcast: ScheduleItem[] = schedules.map((s: any): ScheduleItem | null => {
                // Basic validation
                if (!s.title) return null;

                if (s.type === 'HOMEWORK' || (s.q_ranges)) {
                    let parsedAnswers = s.answers;
                    if (typeof parsedAnswers === 'string') {
                        try { parsedAnswers = JSON.parse(parsedAnswers); } catch { parsedAnswers = {}; }
                    }
                    
                    return {
                        ID: `H_AI_${Date.now()}_${Math.random()}`, 
                        type: 'HOMEWORK', 
                        isUserCreated: true, 
                        DAY: createLocalizedString(s.day || 'MONDAY'),
                        CARD_TITLE: createLocalizedString(s.title), 
                        FOCUS_DETAIL: createLocalizedString(s.detail || s.description || ''),
                        SUBJECT_TAG: createLocalizedString(s.subject?.toUpperCase() || 'GENERAL'), 
                        Q_RANGES: s.q_ranges || '', 
                        TIME: s.time,
                        answers: parsedAnswers || {}
                    } as HomeworkData;
                } 
                
                // Default to ACTION
                return {
                    ID: `A_AI_${Date.now()}_${Math.random()}`, 
                    type: 'ACTION', 
                    SUB_TYPE: 'DEEP_DIVE', 
                    isUserCreated: true,
                    DAY: createLocalizedString(s.day || 'MONDAY'), 
                    TIME: s.time || '09:00', 
                    CARD_TITLE: createLocalizedString(s.title),
                    FOCUS_DETAIL: createLocalizedString(s.detail || s.description || ''), 
                    SUBJECT_TAG: createLocalizedString(s.subject?.toUpperCase() || 'GENERAL')
                } as ScheduleCardData;

            }).filter((item): item is ScheduleItem => item !== null);

            if (tasksToBroadcast.length === 0) {
                alert("No valid tasks could be parsed from the AI output.");
                return;
            }

            if(window.confirm(`Broadcast ${tasksToBroadcast.length} tasks to ${broadcastTarget} students?`)) {
                tasksToBroadcast.forEach(task => onBroadcastTask(task, broadcastTarget));
                closeModal('AIParserModal'); // Use closeModal
                // setIsAIBroadcastModalOpen(false); // No longer needed, as modal state is global
                alert("Broadcast queued successfully.");
            }
        } catch (error: any) {
            alert(`Error processing data: ${error.message}`);
        }
    };
    
    const handleClearData = async (student: StudentData) => {
        const confirmation = window.prompt(`Type "${student.sid}" to confirm clearing ALL data for ${student.fullName}. This is irreversible.`);
        if (confirmation === student.sid) {
            try {
                // FIX: `api.clearStudentData` needs to be defined in `apiService.ts`
                await api.clearStudentData(student.sid);
                alert("Data cleared.");
            } catch (error: any) {
                alert(`Failed: ${error.message}`);
            }
        }
    };

    const handleImpersonate = async (sid: string) => {
        if (window.confirm(`Log in as ${sid}? You will be logged out of Admin.`)) {
            try {
                // FIX: `api.impersonateStudent` needs to be defined in `apiService.ts`
                const { token } = await api.impersonateStudent(sid);
                loginWithToken(token);
            } catch (error: any) {
                alert(`Impersonation failed: ${error.message}`);
            }
        }
    };

    return (
        <main className="mt-8">
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-6">
                    <TabButton tabId="grid"><div className="flex items-center gap-2"><Icon name="users" /> Student Grid</div></TabButton>
                    <TabButton tabId="broadcast"><div className="flex items-center gap-2"><Icon name="send" /> Broadcast</div></TabButton>
                    <TabButton tabId="guide"><div className="flex items-center gap-2"><Icon name="book-open" /> AI Guide</div></TabButton>
                </nav>
            </div>
            <div className="mt-6">
                {activeTab === 'grid' && <StudentGrid students={students} onToggleSub={()=>{}} onDeleteUser={onDeleteUser} onStartMessage={(student) => { setMessagingStudent(student); openModal('MessagingModal', setMessagingModalOpen, true); }} onClearData={handleClearData} onImpersonate={handleImpersonate} />}
                {activeTab === 'broadcast' && <BroadcastManager onOpenModal={() => openModal('CreateEditTaskModal', setIsCreateModalOpen, true)} onOpenAIModal={() => openModal('AIParserModal', setisAiParserModalOpen, true)} target={broadcastTarget} setTarget={setBroadcastTarget} />}
                {activeTab === 'guide' && <AIGuide />}
            </div>

            {/* Modals are handled by App.tsx now */}
        </main>
    );
};

const StudentGrid: React.FC<{ students: StudentData[], onToggleSub: (sid: string) => void, onDeleteUser: (sid: string) => void, onStartMessage: (student: StudentData) => void, onClearData: (student: StudentData) => void, onImpersonate: (sid: string) => void }> = ({ students, onDeleteUser, onStartMessage, onClearData, onImpersonate }) => {
    const isOnline = (lastSeen?: string) => {
        if (!lastSeen) return false;
        return (new Date().getTime() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
    };
    
    return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {students.map(student => (
            <div key={student.sid} className="bg-gray-800/70 p-4 rounded-lg border border-gray-700">
                 <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img src={student.profilePhoto} alt={student.fullName} className="w-12 h-12 rounded-full object-cover" />
                            {isOnline(student.last_seen) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" title="Online"></div>}
                        </div>
                        <div>
                           <h3 className="font-bold text-white">{student.fullName}</h3>
                           <p className="text-sm text-gray-400">{student.sid}</p>
                        </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${student.CONFIG.settings.examType === 'NEET' ? 'bg-green-800 text-green-300' : 'bg-cyan-800 text-cyan-300'}`}>
                        {student.CONFIG.settings.examType || 'N/A'}
                    </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => onImpersonate(student.sid)} className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded"><Icon name="login" className="w-3.5 h-3.5"/> Login As</button>
                    <button onClick={() => onStartMessage(student)} className="w-full flex items-center justify-center gap-2 bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-semibold py-1.5 px-3 rounded"><Icon name="message" className="w-3.5 h-3.5"/> Message</button>
                    <button onClick={() => handleClearData(student)} className="w-full bg-yellow-800 hover:bg-yellow-700 text-white text-xs font-semibold py-1.5 px-3 rounded">Reset</button>
                    <button onClick={() => onDeleteUser(student.sid)} className="w-full bg-red-800 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded">Delete</button>
                </div>
            </div>
        ))}
    </div>
);
}

const BroadcastManager: React.FC<{ onOpenModal: () => void, onOpenAIModal: () => void, target: 'ALL' | 'JEE' | 'NEET', setTarget: (target: 'ALL' | 'JEE' | 'NEET') => void }> = ({ onOpenModal, onOpenAIModal, target, setTarget }) => (
    <div className="bg-gray-800/70 p-6 rounded-lg border border-gray-700 max-w-2xl mx-auto text-center">
        <Icon name="send" className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
        <h3 className="font-bold text-white text-lg mb-2">Broadcast a Task</h3>
        <p className="text-sm text-gray-400 mb-4">Send tasks, homework, or announcements to all students or specific groups.</p>
        
        <div className="mb-4">
            <label className="text-sm font-bold text-gray-400 mb-2 block">Target Group</label>
            <div className="flex justify-center gap-2 p-1 rounded-full bg-gray-900/50 max-w-xs mx-auto">
                {(['ALL', 'JEE', 'NEET'] as const).map(type => (
                    <button 
                        key={type}
                        onClick={() => setTarget(type)}
                        className={`flex-1 text-center text-xs font-semibold py-1.5 rounded-full transition-colors ${target === type ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onOpenModal} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600 shadow-lg">
                <Icon name="plus" /> Manual Create
            </button>
            <button onClick={onOpenAIModal} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--gradient-cyan)] to-[var(--gradient-purple)] shadow-lg">
                <Icon name="upload" /> AI Import
            </button>
        </div>
    </div>
);

export default TeacherDashboard;