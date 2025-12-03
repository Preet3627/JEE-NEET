
import React, { useState, useEffect, useRef } from 'react';
import { StudentData, ScheduleItem, ActivityData, Config, StudySession, HomeworkData, ExamData, ResultData, DoubtData, FlashcardDeck, Flashcard, StudyMaterialItem, ScheduleCardData, PracticeQuestion, ActiveTab, DashboardWidgetItem } from '../types';
import ScheduleList from './ScheduleList';
import Icon, { IconName } from './Icon';
import CommunityDashboard from './CommunityDashboard';
import PlannerView from './PlannerView';
import MistakeManager from './MistakeManager';
import TodaysAgendaWidget from './widgets/TodaysAgendaWidget';
import ReadingHoursWidget from './widgets/ReadingHoursWidget';
import ScoreTrendWidget from './widgets/MarksAnalysisWidget';
import { CustomPracticeModal } from './CustomPracticeModal';
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
import CustomWidget from './widgets/CustomWidget';
import PracticeLauncherWidget from './widgets/PracticeLauncherWidget';
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
    // FIX: Add setDeepLinkAction to props
    setDeepLinkAction: React.Dispatch<React.SetStateAction<any>>;
    // FIX: Add openModal and closeModal to props
    openModal: (modalId: string, setter: React.Dispatch<React.SetStateAction<boolean>> | ((val: any) => void), initialValue?: any) => void;
    closeModal: (modalId: string) => void;

    // Direct modal state setters and getters passed from App.tsx
    isCreateModalOpen: boolean; setIsCreateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isAiParserModalOpen: boolean; setisAiParserModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isPracticeModalOpen: boolean; setIsPracticeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSettingsModalOpen: boolean; setIsSettingsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingTask: ScheduleItem | null; setEditingTask: React.Dispatch<React.SetStateAction<ScheduleItem | null>>;
    viewingTask: ScheduleItem | null; setViewingTask: React.Dispatch<React.SetStateAction<ScheduleItem | null>>;
    practiceTask: HomeworkData | null; setPracticeTask: React.Dispatch<React.SetStateAction<HomeworkData | null>>;
    aiPracticeTest: { questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null; setAiPracticeTest: React.Dispatch<React.SetStateAction<{ questions: PracticeQuestion[], answers: Record<string, string | string[]> } | null>>;
    isEditWeaknessesModalOpen: boolean; setIsEditWeaknessesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isLogResultModalOpen: boolean; setLogResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    initialScoreForModal: string | undefined; setInitialScoreForModal: React.Dispatch<React.SetStateAction<string | undefined>>;
    initialMistakesForModal: string | undefined; setInitialMistakesForModal: React.Dispatch<React.SetStateAction<string | undefined>>;
    isEditResultModalOpen: boolean; setEditResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingResult: ResultData | null; setEditingResult: React.Dispatch<React.SetStateAction<ResultData | null>>;
    isExamModalOpen: boolean; setIsExamModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingExam: ExamData | null; setEditingExam: React.Dispatch<React.SetStateAction<ExamData | null>>;
    isAiMistakeModalOpen: boolean; setAiMistakeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    viewingReport: ResultData | null; setViewingReport: React.Dispatch<React.SetStateAction<ResultData | null>>;
    isAssistantGuideOpen: boolean; setAssistantGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isAiGuideModalOpen: boolean; setAiGuideModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSearchOpen: boolean; setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
    searchInitialQuery: string | null; setSearchInitialQuery: React.Dispatch<React.SetStateAction<string | null>>;
    isSelectMode: boolean; setIsSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
    selectedTaskIds: string[]; setSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
    isMoveModalOpen: boolean; setMoveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isAiChatOpen: boolean; setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
    aiChatHistory: { role: string; parts: { text: string }[] }[]; setAiChatHistory: React.Dispatch<React.SetStateAction<{ role: string; parts: { text: string }[] }[]>>;
    showAiChatFab: boolean; setShowAiChatFab: React.Dispatch<React.SetStateAction<boolean>>;
    isAiChatLoading: boolean; setIsAiChatLoading: React.Dispatch<React.SetStateAction<boolean>>;
    isAiDoubtSolverOpen: boolean; setIsAiDoubtSolverOpen: React.Dispatch<React.SetStateAction<boolean>>; // FIX: Destructure setIsAiDoubtSolverOpen
    isCreateDeckModalOpen: boolean; setCreateDeckModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isAiFlashcardModalOpen: boolean; setIsAiFlashcardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingDeck: FlashcardDeck | null; setEditingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    viewingDeck: FlashcardDeck | null; setViewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    isCreateCardModalOpen: boolean; setCreateCardModalOpen: React.Dispatch<React.SetStateAction<boolean>>; // FIX: Add setCreateCardModalOpen
    editingCard: Flashcard | null; setEditingCard: React.Dispatch<React.SetStateAction<Flashcard | null>>;
    reviewingDeck: FlashcardDeck | null; setReviewingDeck: React.Dispatch<React.SetStateAction<FlashcardDeck | null>>;
    viewingFile: StudyMaterialItem | null; setViewingFile: React.Dispatch<React.SetStateAction<StudyMaterialItem | null>>;
    isMusicLibraryOpen: boolean; setIsMusicLibraryOpen: (val: boolean) => void; // Use function for toggle
    analyzingMistake: number | null; setAnalyzingMistake: React.Dispatch<React.SetStateAction<number | null>>;
    handleMoveSelected: (taskIds: string[], newDate: string) => void;
    handleSaveDeck: (deck: FlashcardDeck) => void;
    handleDeleteCard: (deckId: string, cardId: string) => void;
    handleSaveCard: (deckId: string, card: Flashcard) => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = (props) => {
    const { 
        student, onSaveTask, onSaveBatchTasks, onDeleteTask, onToggleMistakeFixed, onUpdateConfig, onLogStudySession, 
        onUpdateWeaknesses, onLogResult, onAddExam, onUpdateExam, onDeleteExam, onExportToIcs, onBatchImport, 
        googleAuthStatus, onGoogleSignIn, onGoogleSignOut, onBackupToDrive, onRestoreFromDrive, allDoubts, 
        onPostDoubt, onPostSolution, deepLinkAction, setDeepLinkAction, openModal, closeModal, // FIX: Destructure openModal and closeModal
        
        // Destructure all modal state setters and getters
        isCreateModalOpen, setIsCreateModalOpen,
        isAiParserModalOpen, setisAiParserModalOpen,
        isPracticeModalOpen, setIsPracticeModalOpen,
        isSettingsModalOpen, setIsSettingsModalOpen,
        editingTask, setEditingTask,
        viewingTask, setViewingTask,
        practiceTask, setPracticeTask,
        aiPracticeTest, setAiPracticeTest,
        isEditWeaknessesModalOpen, setIsEditWeaknessesModalOpen,
        isLogResultModalOpen, setLogResultModalOpen,
        initialScoreForModal, setInitialScoreForModal,
        initialMistakesForModal, setInitialMistakesForModal,
        isEditResultModalOpen, setEditResultModalOpen,
        editingResult, setEditingResult,
        isExamModalOpen, setIsExamModalOpen,
        editingExam, setEditingExam,
        isAiMistakeModalOpen, setAiMistakeModalOpen,
        viewingReport, setViewingReport,
        isAssistantGuideOpen, setAssistantGuideOpen,
        isAiGuideModalOpen, setAiGuideModalOpen,
        isSearchOpen, setIsSearchOpen,
        searchInitialQuery, setSearchInitialQuery,
        isSelectMode, setIsSelectMode,
        selectedTaskIds, setSelectedTaskIds,
        isMoveModalOpen, setMoveModalOpen,
        isAiChatOpen, setAiChatOpen,
        aiChatHistory, setAiChatHistory,
        showAiChatFab, setShowAiChatFab,
        isAiChatLoading, setIsAiChatLoading,
        isAiDoubtSolverOpen, setIsAiDoubtSolverOpen, // FIX: Destructure setIsAiDoubtSolverOpen
        isCreateDeckModalOpen, setCreateDeckModalOpen,
        isAiFlashcardModalOpen, setIsAiFlashcardModalOpen,
        editingDeck, setEditingDeck,
        viewingDeck, setViewingDeck,
        isCreateCardModalOpen, setCreateCardModalOpen, // FIX: Destructure setCreateCardModalOpen
        editingCard, setEditingCard,
        reviewingDeck, setReviewingDeck,
        viewingFile, setViewingFile,
        isMusicLibraryOpen, setIsMusicLibraryOpen,
        analyzingMistake, setAnalyzingMistake,
        handleMoveSelected, handleSaveDeck, handleDeleteCard, handleSaveCard, // FIX: Destructure new handlers
    } = props;
    const { refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
    const [scheduleView, setScheduleView] = useState<'upcoming' | 'past'>('upcoming');
    
    // Modals & Features State
    // These states are now controlled by App.tsx and passed as props, but some internal state is still needed
    // Local state for dashboard widgets
    const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetItem[]>([]); // FIX: Remove duplicate declaration
    const dragItemRef = useRef<number | null>(null); // FIX: Remove duplicate declaration
    const dragOverItemRef = useRef<number | null>(null); // FIX: Remove duplicate declaration

    // Layout Editor State
    const [isEditLayoutMode, setIsEditLayoutMode] = useState(false);
    
    const useToolbarLayout = window.innerWidth < 768 && student.CONFIG.settings.mobileLayout === 'toolbar';
    const taskItems = student.SCHEDULE_ITEMS;
    const activityItems = student.SCHEDULE_ITEMS.filter(item => item.type === 'ACTIVITY') as ActivityData[];


    useEffect(() => {
        if (student.CONFIG.settings.dashboardLayout) {
            setDashboardWidgets(student.CONFIG.settings.dashboardLayout);
        } else {
            // Default layout
            const defaultWidgets = ['clock', 'practice', 'dailyInsight', 'quote', 'music', 'subjectAllocation', 'scoreTrend', 'flashcards', 'readingHours', 'todaysAgenda', 'upcomingExams', 'homework', 'visualizer', 'weather', 'countdown'];
            setDashboardWidgets(defaultWidgets.map(id => ({ id })));
        }
    }, [student.CONFIG.settings.dashboardLayout]);

    // --- Handlers ---
    // handleSaveDeck is now passed from App.tsx, remove local definition.
    // handleDataImport now uses setDeepLinkAction from props
    const handleDataImport = (data: any) => {
        // Check for custom widgets
        if (data.custom_widget) {
            const newWidgetId = `custom_${Date.now()}`;
            const newCustomWidget = { id: newWidgetId, ...data.custom_widget };
            
            const currentCustomWidgets = student.CONFIG.customWidgets || [];
            onUpdateConfig({ 
                customWidgets: [...currentCustomWidgets, newCustomWidget],
                settings: {
                    ...student.CONFIG.settings,
                    dashboardLayout: [...dashboardWidgets, { id: newWidgetId }]
                }
            });
            alert("New Custom Widget Added to Dashboard!");
            closeModal('AIParserModal'); // Use closeModal
            return;
        }
        
        // Check for flashcard decks
        if (data.flashcard_deck) {
            // Ensure IDs
            const newDeck = {
                ...data.flashcard_deck,
                id: `deck_${Date.now()}`,
                isLocked: false,
                cards: (data.flashcard_deck.cards || []).map((c: any, i: number) => ({ ...c, id: `card_${Date.now()}_${i}` }))
            };
            handleSaveDeck(newDeck); // Use handleSaveDeck from props
            alert(`Imported new deck: ${newDeck.name}`);
            closeModal('AIParserModal'); // Use closeModal
            return;
        }

        setDeepLinkAction(data); // FIX: Use setDeepLinkAction from props
        closeModal('AIParserModal'); // Use closeModal
    };

    const handleEditClick = (item: ScheduleItem) => { setEditingTask(item); openModal('CreateEditTaskModal', setIsCreateModalOpen); }; // Use openModal
    const handleAiPracticeTest = (data: any) => { setAiPracticeTest(data); closeModal('AIParserModal'); setTimeout(() => openModal('CustomPracticeModal', setIsPracticeModalOpen), 300); }; // Use closeModal, openModal
    const handleCompleteTask = (task: ScheduleCardData) => { onDeleteTask(task.ID); };
    const handleStarTask = (taskId: string) => { const task = student.SCHEDULE_ITEMS.find(t => t.ID === taskId); if (task) onSaveTask({ ...task, isStarred: !task.isStarred }); };
    const handleStartPractice = (homework: HomeworkData) => { setPracticeTask(homework); openModal('CustomPracticeModal', setIsPracticeModalOpen); }; // Use openModal
    const handleSaveWeakness = (newWeakness: string) => { const updatedWeaknesses = [...new Set([...student.CONFIG.WEAK, newWeakness])]; onUpdateWeaknesses(updatedWeaknesses); };
    const handleApiKeySet = () => { if (!student.CONFIG.settings.hasGeminiKey) openModal('AIChatPopup', setAiChatOpen); setShowAiChatFab(true); }; // Use openModal
    const handleAiChatMessage = async (prompt: string, imageBase64?: string) => {
        const newHistory = [...aiChatHistory, { role: 'user', parts: [{ text: prompt }] }];
        setAiChatHistory(newHistory);
        setIsAiChatLoading(true);
        try {
            const result = await api.aiChat({ 
                history: newHistory, 
                prompt, 
                imageBase64,
                domain: window.location.origin 
            });
            setAiChatHistory(prev => [...prev, result]);
        } catch (error: any) {
            setAiChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${error.message}` }] }]);
        } finally {
            setIsAiChatLoading(false);
        }
    };
    const handleToggleSelectMode = () => { setIsSelectMode(prev => !prev); setSelectedTaskIds([]); };
    const handleTaskSelect = (taskId: string) => { setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]); };
    // handleMoveSelected is now passed from App.tsx, remove local definition.
    const handleDeleteSelected = async () => { 
        if (selectedTaskIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} selected tasks?`)) return;
        try {
            await api.deleteBatchTasks(selectedTaskIds);
            refreshUser();
            alert(`Deleted ${selectedTaskIds.length} tasks.`);
            setIsSelectMode(false);
            setSelectedTaskIds([]);
        } catch (error: any) {
            alert(`Failed to delete tasks: ${error.message}`);
        }
    };
    const handleClearAllSchedule = async () => { 
        if(!window.confirm("Are you sure you want to clear all your schedule items? This cannot be undone.")) return;
        try {
            await api.clearAllSchedule();
            refreshUser();
            alert("All schedule items cleared.");
        } catch (error: any) {
            alert(`Failed to clear schedule: ${error.message}`);
        }
    };
    const handleEditResult = (result: ResultData) => { setEditingResult(result); openModal('EditResultModal', setEditResultModalOpen); }; // Use openModal
    const onUpdateResult = async (result: ResultData) => { await api.updateResult(result); refreshUser(); }; // Refresh after update
    const onDeleteResult = async (resultId: string) => { await api.deleteResult(resultId); refreshUser(); }; // Refresh after delete
    const handleDeleteDeck = async (deckId: string) => {
        if (!window.confirm("Are you sure you want to delete this deck and all its cards?")) return;
        const newDecks = student.CONFIG.flashcardDecks?.filter(d => d.id !== deckId) || [];
        onUpdateConfig({ flashcardDecks: newDecks });
        alert("Deck deleted.");
    };
    // handleSaveCard is now passed from App.tsx, remove local definition.
    // handleDeleteCard is now passed from App.tsx, remove local definition.
    const handleStartReviewSession = (deckId: string) => { const deck = student.CONFIG.flashcardDecks?.find(d => d.id === deckId); if (deck) setReviewingDeck(deck); openModal('FlashcardReviewModal', setReviewingDeck, deck); }; // Use openModal
    const handleSearchAction = (action: string, data?: any) => {
        switch (action) {
            case 'create_task': setEditingTask(null); openModal('CreateEditTaskModal', setIsCreateModalOpen); break; // Use openModal
            case 'practice': openModal('CustomPracticeModal', setIsPracticeModalOpen); break; // Use openModal
            case 'log_result': openModal('LogResultModal', setLogResultModalOpen); break; // Use openModal
            case 'analyze_mistake': openModal('AIMistakeAnalysisModal', setAiMistakeModalOpen); break; // Use openModal
            case 'edit_task': setEditingTask(data); openModal('CreateEditTaskModal', setIsCreateModalOpen); break; // Use openModal
            case 'edit_exam': setEditingExam(data); openModal('CreateEditExamModal', setIsExamModalOpen); break; // Use openModal
            case 'view_deck': setViewingDeck(data); openModal('DeckViewModal', setViewingDeck, data); break; // Use openModal
            default: break;
        }
    };
    
    // DND Handlers for dashboard widgets
    // FIX: Remove duplicate declarations
    // const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetItem[]>([]); 
    // const dragItemRef = useRef<number | null>(null);
    // const dragOverItemRef = useRef<number | null>(null);

    const handleDragStart = (index: number) => { dragItemRef.current = index; };
    const handleDragEnter = (index: number) => { dragOverItemRef.current = index; };
    const handleDragEnd = () => {
        if (dragItemRef.current !== null && dragOverItemRef.current !== null) {
            const newWidgets = [...dashboardWidgets];
            const draggedItem = newWidgets[dragItemRef.current];
            newWidgets.splice(dragItemRef.current, 1);
            newWidgets.splice(dragOverItemRef.current, 0, draggedItem);
            setDashboardWidgets(newWidgets);
            onUpdateConfig({ settings: { ...student.CONFIG.settings, dashboardLayout: newWidgets } });
        }
        dragItemRef.current = null;
        dragOverItemRef.current = null;
    };

    const handleRemoveWidget = (id: string) => {
        const newWidgets = dashboardWidgets.filter(w => w.id !== id);
        setDashboardWidgets(newWidgets);
        onUpdateConfig({ settings: { ...student.CONFIG.settings, dashboardLayout: newWidgets } });
    };

    const handleToggleMinimizeWidget = (id: string) => {
        const newWidgets = dashboardWidgets.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w);
        setDashboardWidgets(newWidgets);
        onUpdateConfig({ settings: { ...student.CONFIG.settings, dashboardLayout: newWidgets } });
    };

    const renderDashboardContent = () => {
        const widgetComponents: Record<string, React.ReactNode> = {
            'clock': <ClockWidget items={student.SCHEDULE_ITEMS} />,
            'countdown': <CountdownWidget items={student.SCHEDULE_ITEMS} />,
            'dailyInsight': <DailyInsightWidget weaknesses={student.CONFIG.WEAK} exams={student.EXAMS} />,
            'quote': <MotivationalQuoteWidget quote="The expert in anything was once a beginner." />,
            'music': <MusicPlayerWidget onOpenLibrary={() => openModal('MusicLibraryModal', setIsMusicLibraryOpen, true)} />, // Use openModal
            'practice': <PracticeLauncherWidget onLaunch={() => openModal('CustomPracticeModal', setIsPracticeModalOpen)} />, // Use openModal
            'subjectAllocation': <SubjectAllocationWidget items={student.SCHEDULE_ITEMS} />,
            'scoreTrend': <ScoreTrendWidget results={student.RESULTS} />,
            'flashcards': <InteractiveFlashcardWidget 
                student={student} 
                onUpdateConfig={onUpdateConfig} 
                onReviewDeck={handleStartReviewSession}
                onAddCard={() => {
                    const deck = (student.CONFIG.flashcardDecks && student.CONFIG.flashcardDecks.length > 0) ? student.CONFIG.flashcardDecks[0] : null;
                    if(deck) {
                        setViewingDeck(deck);
                        setEditingCard(null);
                        openModal('CreateEditFlashcardModal', setCreateCardModalOpen); // Use openModal
                    } else {
                        alert("Please create a deck first.");
                    }
                }}
                onOpenDeck={(deckId) => {
                    const deck = student.CONFIG.flashcardDecks?.find(d => d.id === deckId);
                    if(deck) openModal('DeckViewModal', setViewingDeck, deck); // Use openModal
                }}
            />,
            'readingHours': <ReadingHoursWidget student={student} />,
            'todaysAgenda': <TodaysAgendaWidget items={student.SCHEDULE_ITEMS} onStar={handleStarTask} />,
            'upcomingExams': <UpcomingExamsWidget exams={student.EXAMS} />,
            'homework': <HomeworkWidget items={student.SCHEDULE_ITEMS} onStartPractice={handleStartPractice} />,
            'visualizer': <MusicVisualizerWidget />,
            'weather': <WeatherWidget />,
        };

        // Add Custom Widgets dynamically
        student.CONFIG.customWidgets?.forEach(cw => {
            widgetComponents[cw.id] = <CustomWidget title={cw.title} content={cw.content} />;
        });

        const bgImage = student.CONFIG.settings.dashboardBackgroundImage;
        const transparency = student.CONFIG.settings.dashboardTransparency ?? 50;

        return (
            <div className="relative min-h-screen p-4 rounded-2xl overflow-hidden transition-all duration-500">
                {bgImage && (
                    <div 
                        className="absolute inset-0 z-0 bg-cover bg-center opacity-30" 
                        style={{ backgroundImage: `url(${bgImage})` }}
                    />
                )}
                
                <div className="relative z-10 mb-4 flex justify-end">
                    <button 
                        onClick={() => setIsEditLayoutMode(!isEditLayoutMode)} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-full flex items-center gap-2 transition-colors shadow-lg backdrop-blur-md ${isEditLayoutMode ? 'bg-green-600 text-white' : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'}`}
                    >
                        <Icon name={isEditLayoutMode ? 'check' : 'edit'} className="w-3 h-3" /> {isEditLayoutMode ? 'Done' : 'Edit Layout'}
                    </button>
                </div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min">
                    {dashboardWidgets.map((item, index) => {
                        const widget = widgetComponents[item.id];
                        if (!widget) return null;
                        
                        const isLarge = ['countdown', 'dailyInsight', 'quote', 'clock'].includes(item.id) || item.wide;
                        const isTall = item.tall; // Use new tall property
                        const isMinimized = item.minimized;

                        return (
                            <div 
                                key={item.id} 
                                className={`${isLarge ? 'md:col-span-2' : ''} ${isTall ? 'row-span-2' : ''} transition-all duration-300 widget-container ${isMinimized ? 'widget-minimized' : ''} ${isEditLayoutMode ? 'cursor-move ring-2 ring-dashed ring-cyan-500/50 rounded-xl scale-95' : ''}`}
                                draggable={isEditLayoutMode}
                                onDragStart={() => handleDragStart(index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                style={{
                                    '--glass-bg': `rgba(30, 30, 35, ${1 - (transparency / 100)})`,
                                    '--glass-border': `rgba(255, 255, 255, 0.1)`
                                } as React.CSSProperties}
                            >
                                {/* MacOS Traffic Light Header */}
                                <div className="flex items-center gap-1.5 p-2 pl-3 mb-1 window-controls absolute top-2 left-2 z-20">
                                    <div onClick={() => handleRemoveWidget(item.id)} className="traffic-light traffic-red cursor-pointer shadow-md"></div>
                                    <div onClick={() => handleToggleMinimizeWidget(item.id)} className="traffic-light traffic-yellow cursor-pointer shadow-md"></div>
                                    <div onClick={() => { /* Maximize logic later */ }} className="traffic-light traffic-green cursor-pointer shadow-md"></div>
                                </div>
                                
                                <div className={`h-full pt-8 ${isMinimized ? 'opacity-50' : ''}`}>
                                    {widget}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
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
          <button onClick={() => openModal('UniversalSearch', setIsSearchOpen, true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white" title="Search (Cmd+K)">
            <Icon name="search" className="w-4 h-4" />
          </button>
          <button onClick={() => openModal('AIParserModal', setisAiParserModalOpen, true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 flex items-center gap-2 text-sm font-semibold" title="AI Import">
            <Icon name="gemini" className="w-4 h-4" /> AI Import
          </button>
          <button onClick={() => openModal('CustomPracticeModal', setIsPracticeModalOpen, true)} className="p-2.5 rounded-lg bg-purple-600/50 hover:bg-purple-600" title="Custom Practice"><Icon name="stopwatch" /></button>
          <button onClick={() => openModal('SettingsModal', setIsSettingsModalOpen, true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700"><Icon name="settings" /></button>
          <button onClick={() => { setEditingTask(null); openModal('CreateEditTaskModal', setIsCreateModalOpen, true); }} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]">
            <Icon name="plus" /> Create
          </button>
        </div>
      </div>
    );

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
                                onMoveSelected={() => openModal('MoveTasksModal', setMoveModalOpen, true)} // Use openModal
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
                return <StudyMaterialView student={student} onUpdateConfig={onUpdateConfig} onViewFile={viewingFile => openModal('FileViewerModal', setViewingFile, viewingFile)} />;
            case 'flashcards':
                return <FlashcardManager 
                            decks={student.CONFIG.flashcardDecks || []}
                            onAddDeck={() => { setEditingDeck(null); openModal('CreateEditDeckModal', setCreateDeckModalOpen, true); }}
                            onEditDeck={(deck) => { setEditingDeck(deck); openModal('CreateEditDeckModal', setCreateDeckModalOpen, true); }}
                            onDeleteDeck={handleDeleteDeck}
                            onViewDeck={viewingDeck => openModal('DeckViewModal', setViewingDeck, viewingDeck)}
                            onStartReview={handleStartReviewSession}
                            onGenerateWithAI={() => openModal('AIGenerateFlashcardsModal', setIsAiFlashcardModalOpen, true)}
                        />;
            case 'exams':
                return <ExamsView exams={student.EXAMS} onAdd={() => { setEditingExam(null); openModal('CreateEditExamModal', setIsExamModalOpen, true); }} onEdit={(exam) => { setEditingExam(exam); openModal('CreateEditExamModal', setIsExamModalOpen, true); }} onDelete={onDeleteExam} />;
            case 'performance':
                 return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <div className="flex justify-end gap-4">
                                <button onClick={() => openModal('AIMistakeAnalysisModal', setAiMistakeModalOpen, true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600"><Icon name="book-open" /> Analyze Mistake with AI</button>
                                <button onClick={() => openModal('LogResultModal', setLogResultModalOpen, true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)]"><Icon name="plus" /> Log Mock Result</button>
                            </div>
                            {student.RESULTS.length > 0 ? [...student.RESULTS].reverse().map(result => (<MistakeManager key={result.ID} result={result} onToggleMistakeFixed={onToggleMistakeFixed} onViewAnalysis={viewingReport => openModal('TestReportModal', setViewingReport, viewingReport)} onEdit={handleEditResult} onDelete={onDeleteResult} />)) : <p className="text-gray-500 text-center py-10">No results recorded.</p>}
                        </div>
                        <div className="space-y-8">
                             <PerformanceMetrics score={student.CONFIG.SCORE} weaknesses={student.CONFIG.WEAK} onEditWeaknesses={() => openModal('EditWeaknessesModal', setIsEditWeaknessesModalOpen, true)} />
                             <AchievementsWidget student={student} allDoubts={allDoubts} />
                        </div>
                    </div>
                );
            case 'doubts':
                return <CommunityDashboard student={student} allDoubts={allDoubts} onPostDoubt={onPostDoubt} onPostSolution={onPostSolution} onAskAi={() => openModal('AIDoubtSolverModal', setIsAiDoubtSolverOpen, true)} />;
            default:
                return null;
        }
    };

    return (
        <main className={`mt-8 ${useToolbarLayout ? 'pb-24' : ''}`}>
            <UniversalSearch 
                isOpen={isSearchOpen}
                onClose={() => { closeModal('UniversalSearch'); setSearchInitialQuery(null); }} // Use closeModal
                onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
                onAction={handleSearchAction}
                scheduleItems={student.SCHEDULE_ITEMS}
                exams={student.EXAMS}
                decks={student.CONFIG.flashcardDecks || []}
                initialQuery={searchInitialQuery || undefined}
            />

            {showAiChatFab && !isAiChatOpen && (
                <button 
                    onClick={() => openModal('AIChatPopup', setAiChatOpen, true)} // Use openModal
                    className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-110 active:scale-95 animate-pulse"
                    title="Open AI Assistant"
                >
                    <Icon name="gemini" className="w-8 h-8"/>
                </button>
            )}
            
            {useToolbarLayout ? (
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold capitalize text-white font-sf-display">{activeTab}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => openModal('SettingsModal', setIsSettingsModalOpen, true)} className="p-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700"><Icon name="settings" /></button>
                    </div>
                </div>
            ) : <TopTabBar />}

            <div key={activeTab} className="tab-content-enter">
              {renderContent()}
            </div>

            {/* Modals are rendered in App.tsx now, but their state setters/getters are passed down */}
        </main>
    );
};

export default StudentDashboard;
