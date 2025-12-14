import React from 'react';
import Icon from './Icon';
import { ActiveTab, IconName } from '../types';

// FIX: Removed local ActiveTab type definition.

interface BottomToolbarProps {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    onFabClick: () => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ activeTab, setActiveTab, onFabClick }) => {
    const navItems: {id: ActiveTab, icon: IconName, label: string}[] = [
        { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
        { id: 'schedule', icon: 'schedule', label: 'Schedule' },
        { id: 'planner', icon: 'planner', label: 'Planner' },
        { id: 'material', icon: 'book-open', label: 'Material' },
        { id: 'flashcards', icon: 'cards', label: 'Flashcards' },
        { id: 'exams', icon: 'trophy', label: 'Exams' },
        { id: 'performance', icon: 'performance', label: 'Stats' },
        { id: 'doubts', icon: 'community', label: 'Doubts' },
    ];
    
    // Split items for centered FAB
    const leftItems = navItems.slice(0, 4);
    const rightItems = navItems.slice(4);

    const NavButton: React.FC<{ item: typeof navItems[0] }> = ({ item }) => (
        <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center w-14 h-16 flex-shrink-0 transition-colors ${activeTab === item.id ? 'text-[var(--accent-color)]' : 'text-gray-400 hover:text-white'}`}
        >
            <Icon name={item.icon} className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">{item.label}</span>
        </button>
    );

    return (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-gray-900/70 border-t border-[var(--glass-border)] backdrop-blur-lg z-40 md:hidden h-16"
          style={{ paddingBottom: 'var(--safe-area-inset-bottom)' }}
        >
            <div className="flex justify-around items-center h-full max-w-7xl mx-auto px-1">
                {leftItems.map((item) => <NavButton key={item.id} item={item} />)}
                
                <button 
                    onClick={onFabClick}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)] flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-110 active:scale-100"
                >
                    <Icon name="plus" className="w-8 h-8" />
                </button>

                {rightItems.map((item) => <NavButton key={item.id} item={item} />)}
            </div>
        </div>
    );
};

export default BottomToolbar;