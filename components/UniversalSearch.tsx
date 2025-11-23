
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon, { IconName } from './Icon';
import { ScheduleItem, ExamData, FlashcardDeck } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface UniversalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (tab: string) => void;
    onAction: (action: string, data?: any) => void;
    scheduleItems: ScheduleItem[];
    exams: ExamData[];
    decks: FlashcardDeck[];
    initialQuery?: string;
}

interface SearchResult {
    id: string;
    type: 'ACTION' | 'NAVIGATION' | 'TASK' | 'EXAM' | 'DECK';
    title: string;
    subtitle?: string;
    icon: IconName;
    data?: any;
    keywords?: string[];
}

const UniversalSearch: React.FC<UniversalSearchProps> = ({ isOpen, onClose, onNavigate, onAction, scheduleItems, exams, decks, initialQuery }) => {
    const { t } = useLocalization();
    const [query, setQuery] = useState(initialQuery || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            if (initialQuery) setQuery(initialQuery);
        } else {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen, initialQuery]);

    const staticActions: SearchResult[] = [
        { id: 'act_create', type: 'ACTION', title: 'Create New Task', subtitle: 'Add a schedule item or homework', icon: 'plus', data: 'create_task', keywords: ['add', 'new', 'task', 'schedule', 'homework'] },
        { id: 'act_practice', type: 'ACTION', title: 'Start Practice Session', subtitle: 'Custom or AI generated quiz', icon: 'stopwatch', data: 'practice', keywords: ['quiz', 'test', 'exam', 'practice', 'mcq'] },
        { id: 'act_log', type: 'ACTION', title: 'Log Test Result', subtitle: 'Record a mock test score', icon: 'trophy', data: 'log_result', keywords: ['score', 'marks', 'result', 'test'] },
        { id: 'act_mistake', type: 'ACTION', title: 'Analyze Mistake', subtitle: 'Use AI to analyze an error', icon: 'gemini', data: 'analyze_mistake', keywords: ['ai', 'error', 'wrong', 'help'] },
        { id: 'nav_dash', type: 'NAVIGATION', title: 'Go to Dashboard', icon: 'dashboard', data: 'dashboard', keywords: ['home', 'main'] },
        { id: 'nav_schedule', type: 'NAVIGATION', title: 'Go to Schedule', icon: 'schedule', data: 'schedule', keywords: ['calendar', 'weekly'] },
        { id: 'nav_exams', type: 'NAVIGATION', title: 'Go to Exams', icon: 'trophy', data: 'exams', keywords: ['tests', 'upcoming'] },
        { id: 'nav_cards', type: 'NAVIGATION', title: 'Go to Flashcards', icon: 'cards', data: 'flashcards', keywords: ['deck', 'memory', 'revise'] },
        { id: 'nav_doubts', type: 'NAVIGATION', title: 'Community Doubts', icon: 'community', data: 'doubts', keywords: ['help', 'question', 'forum'] },
    ];

    const results = useMemo(() => {
        if (!query.trim()) return staticActions.slice(0, 5); // Show top actions by default

        const lowerQuery = query.toLowerCase();
        const filteredStatic = staticActions.filter(item => 
            item.title.toLowerCase().includes(lowerQuery) || 
            item.keywords?.some(k => k.includes(lowerQuery))
        );

        const taskResults: SearchResult[] = scheduleItems
            .filter(item => t(item.CARD_TITLE).toLowerCase().includes(lowerQuery) || item.SUBJECT_TAG.EN.toLowerCase().includes(lowerQuery))
            .slice(0, 5)
            .map(item => ({
                id: item.ID,
                type: 'TASK',
                title: t(item.CARD_TITLE),
                subtitle: `${item.SUBJECT_TAG.EN} • ${item.DAY.EN}`,
                icon: item.type === 'HOMEWORK' ? 'book-open' : 'schedule',
                data: item
            }));

        const examResults: SearchResult[] = exams
            .filter(exam => exam.title.toLowerCase().includes(lowerQuery))
            .slice(0, 3)
            .map(exam => ({
                id: exam.ID,
                type: 'EXAM',
                title: exam.title,
                subtitle: `Exam • ${new Date(exam.date).toLocaleDateString()}`,
                icon: 'trophy',
                data: exam
            }));

        const deckResults: SearchResult[] = decks
            .filter(deck => deck.name.toLowerCase().includes(lowerQuery) || deck.subject.toLowerCase().includes(lowerQuery))
            .slice(0, 3)
            .map(deck => ({
                id: deck.id,
                type: 'DECK',
                title: deck.name,
                subtitle: `Flashcards • ${deck.subject}`,
                icon: 'cards',
                data: deck
            }));

        return [...filteredStatic, ...taskResults, ...deckResults, ...examResults];
    }, [query, scheduleItems, exams, decks, t]);

    const handleSelect = (item: SearchResult) => {
        if (item.type === 'NAVIGATION') {
            onNavigate(item.data);
        } else if (item.type === 'ACTION') {
            onAction(item.data);
        } else if (item.type === 'TASK') {
            onAction('edit_task', item.data);
        } else if (item.type === 'EXAM') {
            onAction('edit_exam', item.data);
        } else if (item.type === 'DECK') {
            onAction('view_deck', item.data);
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) {
                handleSelect(results[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Auto-scroll to selected item
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onKeyDown={handleKeyDown}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            <div className="relative w-full max-w-2xl bg-[#0f1117] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[60vh]">
                <div className="flex items-center px-4 border-b border-gray-800">
                    <Icon name="search" className="w-5 h-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        className="w-full h-14 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 px-4 text-lg"
                        placeholder="Search actions, tasks, or files..."
                        autoComplete="off"
                    />
                    <div className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-1 hidden sm:block">ESC</div>
                </div>

                <ul ref={listRef} className="overflow-y-auto py-2">
                    {results.length > 0 ? (
                        results.map((item, index) => (
                            <li key={item.id}>
                                <button
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${index === selectedIndex ? 'bg-cyan-900/30 border-l-2 border-cyan-500' : 'hover:bg-gray-800/50 border-l-2 border-transparent'}`}
                                >
                                    <div className={`p-2 rounded-lg ${index === selectedIndex ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}>
                                        <Icon name={item.icon} className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-semibold ${index === selectedIndex ? 'text-white' : 'text-gray-300'}`}>{item.title}</p>
                                        {item.subtitle && <p className="text-xs text-gray-500">{item.subtitle}</p>}
                                    </div>
                                    {index === selectedIndex && (
                                        <Icon name="arrow-right" className="w-4 h-4 text-cyan-500 ml-auto" />
                                    )}
                                </button>
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-8 text-center text-gray-500">
                            <p>No results found for "{query}"</p>
                            <p className="text-xs mt-1">Try searching for "Homework", "Exam", or "Practice"</p>
                        </li>
                    )}
                </ul>
                
                <div className="bg-gray-900/80 border-t border-gray-800 px-4 py-2 text-[10px] text-gray-500 flex justify-between">
                    <span>Use arrow keys to navigate</span>
                    <span>Press Enter to select</span>
                </div>
            </div>
        </div>
    );
};

export default UniversalSearch;
