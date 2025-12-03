


import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import Icon from './Icon';
import ProfileModal from './ProfileModal';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
    user: { 
        name: string; 
        id: string; 
        profilePhoto?: string;
    };
    onLogout: () => void;
    backendStatus: 'checking' | 'online' | 'offline';
    isSyncing: boolean;
    onOpenProfile: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, backendStatus, isSyncing, onOpenProfile }) => {
    const { language, setLanguage, t } = useLocalization();
    const { currentUser } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const appTitle = t({EN: "JEE Scheduler Pro", GU: "JEE શેડ્યૂલર પ્રો"});

    const activeLangClasses = "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30";
    const inactiveLangClasses = "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50";

    const statusIndicator = {
        online: { class: 'bg-green-500', text: 'ONLINE', title: 'Connected to server' },
        offline: { class: 'bg-yellow-500', text: 'OFFLINE', title: 'Using cached data. Changes will sync when online.' },
        checking: { class: 'bg-gray-500 animate-pulse', text: '...', title: 'Checking connection' },
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const triggerSearch = () => {
        window.dispatchEvent(new Event('open-universal-search'));
    };

    return (
        <>
            <header className="sticky top-4 z-50 flex flex-col sm:flex-row justify-between items-center p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-lg mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider">
                        {appTitle}
                    </h1>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={triggerSearch}
                        className="p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors hidden sm:block"
                        title="Search (Cmd+K)"
                    >
                        <Icon name="search" className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1.5 p-1 rounded-full bg-gray-900/50">
                        <button onClick={() => setLanguage('EN')} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'EN' ? activeLangClasses : inactiveLangClasses}`}>EN</button>
                        <button onClick={() => setLanguage('GU')} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === 'GU' ? activeLangClasses : inactiveLangClasses}`}>GU</button>
                    </div>
                    <div className="h-6 w-px bg-gray-700"></div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300" title={statusIndicator[backendStatus].title}>
                        {isSyncing ? (
                            <>
                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></div>
                                <span>SYNCING...</span>
                            </>
                        ) : (
                            <>
                                <div className={`w-2.5 h-2.5 rounded-full ${statusIndicator[backendStatus].class}`}></div>
                                <span>{statusIndicator[backendStatus].text}</span>
                            </>
                        )}
                    </div>
                    
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 hover:bg-gray-700/50 p-1.5 rounded-lg transition-colors">
                            <img src={user.profilePhoto} alt={user.name} className="w-8 h-8 rounded-full object-cover border-2 border-cyan-500/50" />
                            <div className="hidden md:block text-left">
                                <p className="font-semibold text-sm text-white">{user.name}</p>
                                <p className="text-xs text-gray-400">{user.id}</p>
                            </div>
                        </button>
                        {isMenuOpen && (
                            <div className={`popup-menu ${isMenuOpen ? 'popup-enter' : 'popup-exit'} absolute right-0 mt-2 w-48 bg-gray-900/80 border border-gray-700 rounded-lg shadow-lg backdrop-blur-xl z-20`}>
                                <ul className="py-1">
                                    <li>
                                        <button onClick={() => { onOpenProfile(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50">
                                            <Icon name="user-plus" className="w-4 h-4" /> My Profile
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={onLogout} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-700/50">
                                            <Icon name="logout" className="w-4 h-4" /> Logout
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;