
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StudentData, ScheduleItem, ActivityData, Config, StudySession, HomeworkData, ExamData, ResultData, DoubtData, FlashcardDeck, Flashcard, StudyMaterialItem, ScheduleCardData, PracticeQuestion, ActiveTab, DashboardWidgetItem } from '../types';
import ScheduleList from './ScheduleList';
import Icon, { IconName } from './Icon';
import CommunityDashboard from './CommunityDashboard';
import PlannerView from './PlannerView';
import MistakeManager from './MistakeManager';
import TodaysAgendaWidget from './widgets/TodaysAgendaWidget';
import ReadingHoursWidget from './widgets/ReadingHoursWidget';
import ScoreTrendWidget from './widgets/MarksAnalysisWidget';
import CustomPracticeModal from './CustomPracticeModal';
import HomeworkWidget from './widgets/HomeworkWidget';
import ActivityTracker from './ActivityTracker';
import PerformanceMetrics from './PerformanceMetrics';
import SettingsModal from './SettingsModal';
import BottomToolbar from './BottomToolbar';
import CreateEditTaskModal from './CreateEditTaskModal';
import ExamsView from './ExamsView';
import CreateEditExamModal from './CreateEditExamModal';
import LogResultModal from './LogResultModal';
import EditWeaknessesModal from './EditWeaknessesModal';
import AchievementsWidget from './widgets/AchievementsWidget';
import AIMistakeAnalysisModal from './AIMistakeAnalysisModal';
import AIParserModal from './AIParserModal';
import DailyInsightWidget from './widgets/DailyInsightWidget';
import AIChatPopup from './AIChatPopup';
import AIDoubtSolverModal from './AIDoubtSolverModal';
import { api } from '../api/apiService';
import SubjectAllocationWidget from './widgets/SubjectAllocationWidget';
import UpcomingExamsWidget from './widgets/UpcomingExamsWidget';
import TestReportModal from './TestReportModal';
import FlashcardManager from './flashcards/FlashcardManager';
import CreateEditDeckModal from './flashcards/CreateEditDeckModal';
import DeckViewModal from './flashcards/DeckViewModal';
import CreateEditFlashcardModal from './flashcards/CreateEditFlashcardModal';
import FlashcardReviewModal from './flashcards/FlashcardReviewModal';
import StudyMaterialView from './StudyMaterialView';
import FileViewerModal from './FileViewerModal';
import AIGenerateFlashcardsModal from './flashcards/AIGenerateFlashcardsModal';
import EditResultModal from './EditResultModal';
import MusicVisualizerWidget from './widgets/MusicVisualizerWidget';
import GoogleAssistantGuideModal from './GoogleAssistantGuideModal';
import DeepLinkConfirmationModal from './DeepLinkConfirmationModal';
import AIGuideModal from './AIGuideModal';
import { useAuth } from '../context/AuthContext';
import MoveTasksModal from './MoveTasksModal';
import TodayPlanner from './TodayPlanner';
import CountdownWidget from './widgets/CountdownWidget';
import InteractiveFlashcardWidget from './widgets/InteractiveFlashcardWidget';
import MotivationalQuoteWidget from './widgets/MotivationalQuoteWidget';
import MusicPlayerWidget from './widgets/MusicPlayerWidget';
import MusicLibraryModal from './MusicLibraryModal';
import WeatherWidget from './widgets/WeatherWidget';
import ClockWidget from './widgets/ClockWidget';
import UniversalSearch from './UniversalSearch';

interface StudentDashboardProps {
    student: StudentData;
    onSaveTask: (task: ScheduleItem) => void;
    onSaveBatchTasks: (tasks: ScheduleItem[]) => void;
    onDeleteTask: (taskId: string) => void;
    onToggleMistakeFixed: (resultId: string, mistake: string) => void;
    onUpdateConfig: (config: Partial<Config>) => void;
    onLogStudySession: (session: Omit<StudySession, 'date'>) => void;
    onUpdateWeaknesses: (weaknesses: string[]) => void;
    onLogResult: (result: ResultData) => void;
    onAddExam: (exam: ExamData) => void;
    onUpdateExam: (exam: ExamData) => void;
    onDeleteExam: (examId: string) => void;
    onExportToIcs: () => void;
    onBatchImport: (data: { schedules: ScheduleItem[], exams: ExamData[], results: ResultData[], weaknesses: string[] }) => void;
    googleAuthStatus: 'signed_in' | 'signed_out' | 'loading' | 'unconfigured';
    onGoogleSignIn: () => void;
    onGoogleSignOut: () => void;
    onBackupToDrive: () => void;
    onRestoreFromDrive: () => void;
    allDoubts: DoubtData[];
    onPostDoubt: (question: string, image?: string) => void;
    onPostSolution: (doubtId: string, solution: string, image?: string) => void;
    deepLinkAction: { action: string; data: any } | null;
}

const StudentDashboard: React.FC<StudentDashboardProps> = (props) => {
    const { student, onSaveTask, onSaveBatchTasks, onDeleteTask, onToggleMistakeFixed, onUpdateConfig, onLogStudySession, onUpdateWeaknesses, onLogResult, onAddExam, onUpdateExam, onDeleteExam, onExportToIcs, onBatchImport, googleAuthStatus, onGoogleSignIn, onGoogleSignOut, onBackupToDrive, onRestoreFromDrive, allDoubts, onPostDoubt, onPostSolution, deepLinkAction } = props;
    const { refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
    const [scheduleView, setScheduleView] = useState<'upcoming' | 'past'>('upcoming');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAiParserModalOpen, setisAiParserModalOpen] = useState(false);
    const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null);
    const [viewingTask, setViewingTask] = useState<ScheduleItem | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [practiceTask, setPracticeTask] = useState<HomeworkData | null>(null);
    const [isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen] = useState(false);
    const [isLogResultModalOpen, setIsLogResultModalOpen] = useState(false);
    const [initialScoreForModal, setInitialScoreForModal] = useState<string | undefined>();
    const [initialMistakesForModal, setInitialMistakesForModal] = useState<string | undefined>();
    const [isEditResultModalOpen, setIsEditResultModalOpen] = useState(false);
    const [editingResult, setEditingResult] = useState<ResultData | null>(null);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<ExamData | null>(null);
    const [isAiMistakeModalOpen, setIsAiMistakeModalOpen] = useState(false);
    const [viewingReport, setViewingReport] = useState<ResultData | null>(null);
    const [isAssistantGuideOpen, setIsAssistantGuideOpen] = useState(false);
    const [isAiGuideModalOpen, setIsAiGuideModalOpen] = useState(false);
    const [deepLinkData, setDeepLinkData] = useState<any | null>(null);
    const [isEditLayoutMode, setIsEditLayoutMode] = useState(false);
    
    // Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchInitialQuery, setSearchInitialQuery] = useState('');

    // Schedule management state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

    
    // AI Chat State
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [aiChatHistory, setAiChatHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
    const [showAiChatFab, setShowAiChatFab] = useState(student.CONFIG.settings.showAiChatAssistant !== false && !!student.CONFIG.settings.hasGeminiKey);
    const [isAiChatLoading, setIsAiChatLoading] = useState(false);
    const [aiPracticeTest, setAiPracticeTest] = useState<{ questions: PracticeQuestion[], answers: Record<string, string> } | null>(null);

    // AI Doubt Solver State
    const [isAiDoubtSolverOpen, setIsAiDoubtSolverOpen] = useState(false);

    // Flashcard State
    const [isCreateDeckModalOpen, setIsCreateDeckModalOpen] = useState(false);
    const [isAiFlashcardModalOpen, setIsAiFlashcardModalOpen] = useState(false);
    const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
    const [viewingDeck, setViewingDeck] = useState<FlashcardDeck | null>(null);
    const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
    const [reviewingDeck, setReviewingDeck] = useState<FlashcardDeck | null>(null);

    // Study Material State
    const [viewingFile, setViewingFile] = useState<StudyMaterialItem | null>(null);
    const [isMusicLibraryOpen, setIsMusicLibraryOpen] = useState(false);
    
    // Dashboard Layout State
    const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetItem[]>([]);
    const dragItemRef = useRef<number | null>(null);
    const dragOverItemRef = useRef<number | null>(null);


    useEffect(() => {
        if (student.CONFIG.settings.dashboardLayout) {
            setDashboardWidgets(student.CONFIG.settings.dashboardLayout);
        } else {
            // Default layout if not present
            const defaultWidgets = ['countdown', 'dailyInsight', 'quote', 'music', 'subjectAllocation', 'scoreTrend', 'flashcards', 'readingHours', 'todaysAgenda', 'upcomingExams', 'homework', 'visualizer', 'weather', 'clock'];
            setDashboardWidgets(defaultWidgets.map(id => ({ id })));
        }
    }, [student.CONFIG.settings.dashboardLayout]);

    // History management for tabs
    useEffect(() => {
        const getTabFromHash = () => {
            const hash = window.location.hash.replace('#/', '');
            const validTabs: ActiveTab[] = ['dashboard', 'schedule', 'today', 'planner', 'exams', 'performance', 'doubts', 'flashcards', 'material'];
            if (validTabs.includes(hash as ActiveTab)) {
                return hash as ActiveTab;
            }
            return null;
        };

        // On component mount, sync state with URL hash
        const initialTab = getTabFromHash();
        if (initialTab) {
            setActiveTab(initialTab);
        } else {
            // Set default hash without creating a history entry
            window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
        }

        const handlePopState = (event: PopStateEvent) => {
            const newTab = event.state?.tab || getTabFromHash() || 'dashboard';
            setActiveTab(newTab);
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []); 

    useEffect(() => {
        const currentHash = window.location.hash.replace('#/', '');
        if (activeTab !== currentHash) {
            window.history.pushState({ tab: activeTab }, '', `/#/${activeTab}`);
        }
    }, [activeTab]);
    
    // Deep Link Handling including Search
    useEffect(() => {
        if (deepLinkAction?.action === 'search') {
            setSearchInitialQuery(deepLinkAction.data.query || '');
            setIsSearchOpen(true);
        }
    }, [deepLinkAction]);

    // Global Search Shortcut (Cmd+K / Ctrl+K) and Event Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
        };
        
        const handleOpenSearchEvent = () => setIsSearchOpen(true);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-universal-search', handleOpenSearchEvent);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-universal-search', handleOpenSearchEvent);
        };
    }, []);

    const useToolbarLayout = student.CONFIG.settings.mobileLayout === 'toolbar' && isMobile;
    const taskItems = student.SCHEDULE_ITEMS.filter(item => item.type !== 'ACTIVITY');
    const activityItems = student.SCHEDULE_ITEMS.filter(item => item.type === 'ACTIVITY') as ActivityData[];
    
    const handleEditClick = (item: ScheduleItem) => { setEditingTask(item); setIsCreateModalOpen(true); };
    const handleDataImport = (structuredData: any) => { /* ... */ }; // Same as before
    const handleAiPracticeTest = (data: any) => { setAiPracticeTest(data); setisAiParserModalOpen(false); setTimeout(() => setIsPracticeModalOpen(true), 300); };
    const handleCompleteTask = (task: ScheduleCardData) => { onDeleteTask(task.ID); };
    const handleStarTask = (taskId: string) => { const task = student.SCHEDULE_ITEMS.find(t => t.ID === taskId); if (task) onSaveTask({ ...task, isStarred: !task.isStarred }); };
    const handleStartPractice = (homework: HomeworkData) => { setPracticeTask(homework); setIsPracticeModalOpen(true); };
    const handleSaveWeakness = (newWeakness: string) => { const updatedWeaknesses = [...new Set([...student.CONFIG.WEAK, newWeakness])]; onUpdateWeaknesses(updatedWeaknesses); };
    const handleApiKeySet = () => { if (!student.CONFIG.settings.hasGeminiKey) setIsAiChatOpen(true); setShowAiChatFab(true); };
    const handleAiChatMessage = async (prompt: string, imageBase64?: string) => { /* ... */ }; // Same
    const handleToggleSelectMode = () => { setIsSelectMode(prev => !prev); setSelectedTaskIds([]); };
    const handleTaskSelect = (taskId: string) => { setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]); };
    const handleDeleteSelected = async () => { /* ... */ };
    const handleMoveSelected = async (newDate: string) => { /* ... */ };
    const handleClearAllSchedule = async () => { /* ... */ };
    const handleEditResult = (result: ResultData) => { setEditingResult(result); setIsEditResultModalOpen(true); };
    const onUpdateResult = async (result: ResultData) => { await api.updateResult(result); };
    const onDeleteResult = async (resultId: string) => { await api.deleteResult(resultId); };
    const handleSaveDeck = (deck: FlashcardDeck) => { /* ... */ };
    const handleDeleteDeck = (deckId: string) => { /* ... */ };
    const handleSaveCard = (deckId: string, card: Flashcard) => { /* ... */ };
    const handleDeleteCard = (deckId: string, cardId: string) => { /* ... */ };
    const handleStartReviewSession = (deckId: string) => { const deck = student.CONFIG.flashcardDecks?.find(d => d.id === deckId); if (deck) setReviewingDeck(deck); };

    // Search Action Handler
    const handleSearchAction = (action: string, data?: any) => {
        switch (action) {
            case 'create_task': setEditingTask(null); setIsCreateModalOpen(true); break;
            case 'practice': setIsPracticeModalOpen(true); break;
            case 'log_result': setIsLogResultModalOpen(true); break;
            case 'analyze_mistake': setIsAiMistakeModalOpen(true); break;
            case 'edit_task': setEditingTask(data); setIsCreateModalOpen(true); break;
            case 'edit_exam': setEditingExam(data); setIsExamModalOpen(true); break;
            case 'view_deck': setViewingDeck(data); break;
            // Navigation handled by setActiveTab directly in UniversalSearch props
        }
    };

    
    // --- DND Logic ---
    const handleDragStart = (index: number) => {
        dragItemRef.current = index;
    };

    const handleDragEnter = (index: number) => {
        dragOverItemRef.current = index;
    };

    const handleDragEnd = () => {
        if (dragItemRef.current !== null && dragOverItemRef.current !== null) {
            const newWidgets = [...dashboardWidgets];
            const draggedItemContent = newWidgets[dragItemRef.current];
            newWidgets.splice(dragItemRef.current, 1);
            newWidgets.splice(dragOverItemRef.current, 0, draggedItemContent);
            setDashboardWidgets(newWidgets);
            
            // Save the new layout
            const newSettings = { ...student.CONFIG.settings, dashboardLayout: newWidgets };
            onUpdateConfig({ settings: newSettings });
        }
        dragItemRef.current = null;
        dragOverItemRef.current = null;
    };


    const TabButton: React.FC<{ tabId: ActiveTab; icon: IconName; children: React.ReactNode; }> = ({ tabId, icon, children }) => (
        <button onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === tabId ? 'text-[var(--accent-color)] border-[var(--accent-color)]' : 'text-gray-400 border-transparent hover:text-white'}`}>
            <Icon name={icon} className="w-4 h-4" /> {children}
        </button>
    );

    const TopTabBar = () => (
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[var(--glass-border)] mb-6 gap-4">
        <div className="flex items-center flex-wrap">
          <TabButton tabId="dashboard" icon="dashboard">Dashboard</TabButton>
          <TabButton tabId="today" icon="star">Today</TabButton>
          <TabButton tabId="schedule" icon="schedule">Schedule</TabButton>
          <TabButton tabId="material" icon="book-open">Study Material</TabButton>
          <TabButton tabId="flashcards" icon="cards">Flashcards</TabButton>
          <TabButton tabId="exams" icon="trophy">Exams</TabButton>
          <TabButton tabId="performance" icon="performance">Performance</TabButton>
          <TabButton tabId="doubts" icon="community">Doubts</TabButton>
        </div>
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <button onClick={() => setIsSearchOpen(true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white" title="Search (Cmd+K)">
            <Icon name="search" className="w-4 h-4" />
          </button>
          <button onClick={() => setisAiParserModalOpen(true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 flex items-center gap-2 text-sm font-semibold" title="AI Import">
            <Icon name="gemini" className="w-4 h-4" /> AI Import
          </button>
          <button onClick={() => setIsPracticeModalOpen(true)} className="p-2.5 rounded-lg bg-purple-600/50 hover:bg-purple-600" title="Custom Practice"><Icon name="stopwatch" /></button>
          <button onClick={() => setIsSettingsModalOpen(true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700"><Icon name="settings" /></button>
          <button onClick={() => { setEditingTask(null); setIsCreateModalOpen(true); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
            <Icon name="plus" /> Create
          </button>
        </div>
      </div>
    );
    
    // ... (renderDashboardContent remains same) ...
    const renderDashboardContent = () => {
        const widgetComponents: Record<string, React.ReactNode> = {
            'countdown': <CountdownWidget items={student.SCHEDULE_ITEMS} />,
            'dailyInsight': <DailyInsightWidget weaknesses={student.CONFIG.WEAK} exams={student.EXAMS} />,
            'quote': <MotivationalQuoteWidget quote="The expert in anything was once a beginner." />,
            'music': <MusicPlayerWidget onOpenLibrary={() => setIsMusicLibraryOpen(true)} />,
            'subjectAllocation': <SubjectAllocationWidget items={student.SCHEDULE_ITEMS} />,
            'scoreTrend': <ScoreTrendWidget results={student.RESULTS} />,
            'flashcards': <InteractiveFlashcardWidget student={student} onUpdateConfig={onUpdateConfig} />,
            'readingHours': <ReadingHoursWidget student={student} />,
            'todaysAgenda': <TodaysAgendaWidget items={student.SCHEDULE_ITEMS} onStar={handleStarTask} />,
            'upcomingExams': <UpcomingExamsWidget exams={student.EXAMS} />,
            'homework': <HomeworkWidget items={student.SCHEDULE_ITEMS} onStartPractice={handleStartPractice} />,
            'visualizer': <MusicVisualizerWidget />,
            'weather': <WeatherWidget />,
            'clock': <ClockWidget />,
        };

        const widgetSettings = student.CONFIG.settings.widgetSettings || {};
        const bgImage = student.CONFIG.settings.dashboardBackgroundImage;
        const transparency = student.CONFIG.settings.dashboardTransparency ?? 50;

        return (
            <div className="relative min-h-screen p-4 rounded-xl overflow-hidden transition-all duration-500">
                {bgImage && (
                    <div 
                        className="absolute inset-0 z-0 bg-cover bg-center opacity-30" 
                        style={{ backgroundImage: `url(${bgImage})` }}
                    />
                )}
                
                <div className="relative z-10 mb-4 flex justify-end">
                    <button 
                        onClick={() => setIsEditLayoutMode(!isEditLayoutMode)} 
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors ${isEditLayoutMode ? 'bg-green-600 text-white' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <Icon name={isEditLayoutMode ? 'check' : 'edit'} className="w-3 h-3" /> {isEditLayoutMode ? 'Done' : 'Edit Layout'}
                    </button>
                </div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {dashboardWidgets.map((item, index) => {
                        const widget = widgetComponents[item.id];
                        if (!widget) return null;
                        
                        const isLarge = ['countdown', 'dailyInsight', 'quote'].includes(item.id);
                        
                        return (
                            <div 
                                key={item.id} 
                                className={`${isLarge ? 'md:col-span-2' : ''} transition-transform ${isEditLayoutMode ? 'cursor-move hover:scale-[1.02] ring-2 ring-dashed ring-cyan-500/30 rounded-xl' : ''}`}
                                draggable={isEditLayoutMode}
                                onDragStart={() => handleDragStart(index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                style={{
                                    '--glass-bg': `rgba(17, 24, 39, ${1 - (transparency / 100)})`,
                                    '--glass-border': `rgba(55, 65, 81, ${1 - (transparency / 100)})`
                                } as React.CSSProperties}
                            >
                                {widget}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return renderDashboardContent();
            case 'today':
                return <TodayPlanner items={taskItems} onEdit={handleEditClick} />;
            case 'schedule':
                 return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <ActivityTracker activities={activityItems} />
                            <ScheduleList 
                                items={taskItems} 
                                onDelete={onDeleteTask} 
                                onEdit={handleEditClick} 
                                onMoveToNextDay={()=>{}} 
                                onStar={handleStarTask} 
                                onStartPractice={handleStartPractice} 
                                isSubscribed={student.CONFIG.UNACADEMY_SUB} 
                                onStartReviewSession={handleStartReviewSession}
                                onCompleteTask={handleCompleteTask}
                                view={scheduleView}
                                onViewChange={setScheduleView}
                                isSelectMode={isSelectMode}
                                selectedTaskIds={selectedTaskIds}
                                onTaskSelect={handleTaskSelect}
                                onToggleSelectMode={handleToggleSelectMode}
                                onDeleteSelected={handleDeleteSelected}
                                onMoveSelected={() => setIsMoveModalOpen(true)}
                            />
                        </div>
                        <div className="space-y-8">
                             <TodaysAgendaWidget items={student.SCHEDULE_ITEMS} onStar={handleStarTask} />
                             <HomeworkWidget items={student.SCHEDULE_ITEMS} onStartPractice={handleStartPractice} />
                        </div>
                    </div>
                 );
             case 'planner':
                return <PlannerView items={taskItems} onEdit={handleEditClick} />;
            case 'material':
                return <StudyMaterialView student={student} onUpdateConfig={onUpdateConfig} onViewFile={setViewingFile} />;
            case 'flashcards':
                return <FlashcardManager 
                            decks={student.CONFIG.flashcardDecks || []}
                            onAddDeck={() => { setEditingDeck(null); setIsCreateDeckModalOpen(true); }}
                            onEditDeck={(deck) => { setEditingDeck(deck); setIsCreateDeckModalOpen(true); }}
                            onDeleteDeck={handleDeleteDeck}
                            onViewDeck={setViewingDeck}
                            onStartReview={handleStartReviewSession}
                            onGenerateWithAI={() => setIsAiFlashcardModalOpen(true)}
                        />;
            case 'exams':
                return <ExamsView exams={student.EXAMS} onAdd={() => { setEditingExam(null); setIsExamModalOpen(true); }} onEdit={(exam) => { setEditingExam(exam); setIsExamModalOpen(true); }} onDelete={onDeleteExam} />;
            case 'performance':
                 return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <div className="flex justify-end gap-4">
                                <button onClick={() => setIsAiMistakeModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600"><Icon name="book-open" /> Analyze Mistake with AI</button>
                                <button onClick={() => setIsLogResultModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]"><Icon name="plus" /> Log Mock Result</button>
                            </div>
                            {student.RESULTS.length > 0 ? [...student.RESULTS].reverse().map(result => (<MistakeManager key={result.ID} result={result} onToggleMistakeFixed={onToggleMistakeFixed} onViewAnalysis={setViewingReport} onEdit={handleEditResult} onDelete={onDeleteResult} />)) : <p className="text-gray-500 text-center py-10">No results recorded.</p>}
                        </div>
                        <div className="space-y-8">
                             <PerformanceMetrics score={student.CONFIG.SCORE} weaknesses={student.CONFIG.WEAK} onEditWeaknesses={() => setIsEditWeaknessesModalOpen(true)} />
                             <AchievementsWidget student={student} allDoubts={allDoubts} />
                        </div>
                    </div>
                );
            case 'doubts':
                return <CommunityDashboard student={student} allDoubts={allDoubts} onPostDoubt={onPostDoubt} onPostSolution={onPostSolution} onAskAi={() => setIsAiDoubtSolverOpen(true)} />;
            default:
                return null;
        }
    };

    return (
        <main className={`mt-8 ${useToolbarLayout ? 'pb-24' : ''}`}>
            
            <UniversalSearch 
                isOpen={isSearchOpen}
                onClose={() => { setIsSearchOpen(false); setSearchInitialQuery(''); }}
                onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
                onAction={handleSearchAction}
                scheduleItems={student.SCHEDULE_ITEMS}
                exams={student.EXAMS}
                decks={student.CONFIG.flashcardDecks || []}
                initialQuery={searchInitialQuery}
            />

            {showAiChatFab && !isAiChatOpen && (
                <button 
                    onClick={() => setIsAiChatOpen(true)}
                    className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-110 active:scale-95"
                    title="Open AI Assistant"
                >
                    <Icon name="gemini" className="w-8 h-8"/>
                </button>
            )}
            
            {/* The main layout switcher: renders a simplified header for mobile toolbar view, or the full tab bar for desktop. */}
            {useToolbarLayout ? (
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold capitalize text-white">{activeTab}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSearchOpen(true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300" title="Search"><Icon name="search" className="w-5 h-5"/></button>
                        <button onClick={() => setIsPracticeModalOpen(true)} className="p-2.5 rounded-lg bg-purple-600/50 hover:bg-purple-600" title="Custom Practice"><Icon name="stopwatch" /></button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700" title="Settings"><Icon name="settings" /></button>
                    </div>
                </div>
            ) : <TopTabBar />}

            <div key={activeTab} className="tab-content-enter">
              {renderContent()}
            </div>

            {/* ... (All Modals remain mostly same, simplified for brevity) ... */}
            {isCreateModalOpen && <CreateEditTaskModal task={editingTask || viewingTask} viewOnly={!!viewingTask} onClose={() => { setIsCreateModalOpen(false); setEditingTask(null); setViewingTask(null); }} onSave={onSaveTask} decks={student.CONFIG.flashcardDecks || []} />}
            {isAiParserModalOpen && <AIParserModal onClose={() => setisAiParserModalOpen(false)} onDataReady={handleDataImport} onPracticeTestReady={handleAiPracticeTest} onOpenGuide={() => setIsAiGuideModalOpen(true)} examType={student.CONFIG.settings.examType} />}
            {isPracticeModalOpen && <CustomPracticeModal initialTask={practiceTask} aiPracticeTest={aiPracticeTest} onClose={() => { setIsPracticeModalOpen(false); setPracticeTask(null); setAiPracticeTest(null); }} onSessionComplete={(duration, solved, skipped) => onLogStudySession({ duration, questions_solved: solved, questions_skipped: skipped })} defaultPerQuestionTime={student.CONFIG.settings.perQuestionTime || 180} onLogResult={onLogResult} student={student} onUpdateWeaknesses={onUpdateWeaknesses} onSaveTask={onSaveTask} />}
            {isSettingsModalOpen && <SettingsModal settings={student.CONFIG.settings} decks={student.CONFIG.flashcardDecks || []} driveLastSync={student.CONFIG.driveLastSync} isCalendarSyncEnabled={student.CONFIG.isCalendarSyncEnabled} calendarLastSync={student.CONFIG.calendarLastSync} onClose={() => setIsSettingsModalOpen(false)} onSave={(newSettings) => { onUpdateConfig({ settings: { ...student.CONFIG.settings, ...newSettings } as any }); setIsSettingsModalOpen(false); }} onApiKeySet={handleApiKeySet} googleAuthStatus={googleAuthStatus} onGoogleSignIn={onGoogleSignIn} onGoogleSignOut={onGoogleSignOut} onBackupToDrive={onBackupToDrive} onRestoreFromDrive={onRestoreFromDrive} onExportToIcs={onExportToIcs} onOpenAssistantGuide={() => setIsAssistantGuideOpen(true)} onOpenAiGuide={() => setIsAiGuideModalOpen(true)} onClearAllSchedule={handleClearAllSchedule} />}
            {isEditWeaknessesModalOpen && <EditWeaknessesModal currentWeaknesses={student.CONFIG.WEAK} onClose={() => setIsEditWeaknessesModalOpen(false)} onSave={onUpdateWeaknesses} />}
            {isLogResultModalOpen && <LogResultModal onClose={() => {setIsLogResultModalOpen(false); setInitialScoreForModal(undefined); setInitialMistakesForModal(undefined);}} onSave={onLogResult} initialScore={initialScoreForModal} initialMistakes={initialMistakesForModal} />}
            {isEditResultModalOpen && editingResult && <EditResultModal result={editingResult} onClose={() => { setIsEditResultModalOpen(false); setEditingResult(null); }} onSave={onUpdateResult} />}
            {isExamModalOpen && <CreateEditExamModal exam={editingExam} onClose={() => { setIsExamModalOpen(false); setEditingExam(null); }} onSave={(exam) => editingExam ? onUpdateExam(exam) : onAddExam(exam)} />}
            {isAiMistakeModalOpen && <AIMistakeAnalysisModal onClose={() => setIsAiMistakeModalOpen(false)} onSaveWeakness={handleSaveWeakness} />}
            {isAiDoubtSolverOpen && <AIDoubtSolverModal onClose={() => setIsAiDoubtSolverOpen(false)} />}
            {isAiChatOpen && <AIChatPopup history={aiChatHistory} onSendMessage={handleAiChatMessage} onClose={() => setIsAiChatOpen(false)} isLoading={isAiChatLoading} />}
            {viewingReport && <TestReportModal result={viewingReport} onClose={() => setViewingReport(null)} onUpdateWeaknesses={onUpdateWeaknesses} student={student} onSaveDeck={handleSaveDeck} />}
            {isMoveModalOpen && <MoveTasksModal onClose={() => setIsMoveModalOpen(false)} onConfirm={handleMoveSelected} selectedCount={selectedTaskIds.length} />}
            {isMusicLibraryOpen && <MusicLibraryModal onClose={() => setIsMusicLibraryOpen(false)} />}
            {deepLinkData && (
                <DeepLinkConfirmationModal
                    data={deepLinkData}
                    onClose={() => setDeepLinkData(null)}
                    onConfirm={() => {
                        const importData = {
                            schedules: deepLinkData.schedules || [],
                            exams: deepLinkData.exams || [],
                            results: deepLinkData.results || [],
                            weaknesses: deepLinkData.weaknesses || [],
                        };
                        onBatchImport(importData);
                    }}
                />
            )}

            {/* Flashcard Modals */}
            {isCreateDeckModalOpen && <CreateEditDeckModal deck={editingDeck} onClose={() => { setIsCreateDeckModalOpen(false); setEditingDeck(null); }} onSave={handleSaveDeck} />}
            {isAiFlashcardModalOpen && <AIGenerateFlashcardsModal student={student} onClose={() => setIsAiFlashcardModalOpen(false)} onSaveDeck={handleSaveDeck} />}
            {viewingDeck && <DeckViewModal deck={viewingDeck} onClose={() => setViewingDeck(null)} onAddCard={() => { setEditingCard(null); setIsCreateCardModalOpen(true); }} onEditCard={(card) => { setEditingCard(card); setIsCreateCardModalOpen(true); }} onDeleteCard={(cardId) => handleDeleteCard(viewingDeck.id, cardId)} onStartReview={() => { setReviewingDeck(viewingDeck); setViewingDeck(null); }} />}
            {isCreateCardModalOpen && viewingDeck && <CreateEditFlashcardModal card={editingCard} deckId={viewingDeck.id} onClose={() => { setIsCreateCardModalOpen(false); setEditingCard(null); }} onSave={handleSaveCard} />}
            {reviewingDeck && <FlashcardReviewModal deck={reviewingDeck} onClose={() => setReviewingDeck(null)} />}
            
            {/* Study Material Modal */}
            {viewingFile && <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />}

            {/* Assistant & AI Guide Modals */}
            {isAssistantGuideOpen && <GoogleAssistantGuideModal onClose={() => setIsAssistantGuideOpen(false)} />}
            {isAiGuideModalOpen && <AIGuideModal onClose={() => setIsAiGuideModalOpen(false)} examType={student.CONFIG.settings.examType} />}
            
            {/* Renders the bottom toolbar only if the mobile layout is active. */}
            {useToolbarLayout && <BottomToolbar activeTab={activeTab} setActiveTab={setActiveTab} onFabClick={() => { setEditingTask(null); setIsCreateModalOpen(true); }} />}
        </main>
    );
};

export default StudentDashboard;
