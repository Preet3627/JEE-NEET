
import React, { useState, useEffect } from 'react';
import { Config, FlashcardDeck, DashboardWidgetItem } from '../types';
import Icon from './Icon';

interface SettingsModalProps {
  settings: Config['settings'];
  decks: FlashcardDeck[];
  driveLastSync?: string;
  isCalendarSyncEnabled?: boolean;
  calendarLastSync?: string;
  onClose: () => void;
  onSave: (settings: Partial<Config['settings'] & { geminiApiKey?: string; isCalendarSyncEnabled?: boolean }>) => void;
  onExportToIcs: () => void;
  googleAuthStatus: 'signed_in' | 'signed_out' | 'loading' | 'unconfigured';
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onBackupToDrive: () => void;
  onRestoreFromDrive: () => void;
  onApiKeySet: () => void;
  onOpenAssistantGuide: () => void;
  onOpenAiGuide: () => void;
  onClearAllSchedule: () => void;
  onToggleEditLayout?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { settings, decks, driveLastSync, isCalendarSyncEnabled, calendarLastSync, onClose, onSave, onExportToIcs, googleAuthStatus, onGoogleSignIn, onGoogleSignOut, onBackupToDrive, onRestoreFromDrive, onApiKeySet, onOpenAssistantGuide, onOpenAiGuide, onClearAllSchedule, onToggleEditLayout } = props;
  const [accentColor, setAccentColor] = useState(settings.accentColor || '#0891b2');
  const [blurEnabled, setBlurEnabled] = useState(settings.blurEnabled !== false);
  const [mobileLayout, setMobileLayout] = useState(settings.mobileLayout || 'standard');
  const [forceOfflineMode, setForceOfflineMode] = useState(settings.forceOfflineMode || false);
  const [perQuestionTime, setPerQuestionTime] = useState(settings.perQuestionTime || 180);
  const [showAiChat, setShowAiChat] = useState(settings.showAiChatAssistant !== false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [calendarSync, setCalendarSync] = useState(isCalendarSyncEnabled || false);
  const [examType, setExamType] = useState(settings.examType || 'JEE');
  const [theme, setTheme] = useState(settings.theme || 'default');
  
  const WIDGET_KEYS = ['countdown', 'dailyInsight', 'quote', 'music', 'subjectAllocation', 'scoreTrend', 'flashcards', 'readingHours', 'todaysAgenda', 'upcomingExams', 'homework', 'visualizer', 'weather', 'clock'];
  const LAYOUT_PRESETS: Record<'default' | 'focus' | 'compact', string[]> = {
    default: WIDGET_KEYS,
    focus: ['countdown', 'dailyInsight', 'todaysAgenda', 'upcomingExams', 'scoreTrend', 'homework'],
    compact: ['todaysAgenda', 'scoreTrend', 'subjectAllocation', 'readingHours', 'flashcards', 'upcomingExams'],
  };

  const getPresetFromLayout = (layout: DashboardWidgetItem[] | undefined): 'default' | 'focus' | 'compact' => {
    if (!layout) return 'default';
    const sortedLayoutIds = layout.map(item => item.id).sort();
    if (JSON.stringify(sortedLayoutIds) === JSON.stringify([...LAYOUT_PRESETS.focus].sort())) return 'focus';
    if (JSON.stringify(sortedLayoutIds) === JSON.stringify([...LAYOUT_PRESETS.compact].sort())) return 'compact';
    return 'default';
  };

  const [dashboardLayoutPreset, setDashboardLayoutPreset] = useState<'default' | 'focus' | 'compact'>(getPresetFromLayout(settings.dashboardLayout));
  const [dashboardFlashcardDeckIds, setDashboardFlashcardDeckIds] = useState(settings.dashboardFlashcardDeckIds || []);
  const [musicPlayerLayout, setMusicPlayerLayout] = useState(settings.musicPlayerWidgetLayout || 'minimal');
  
  const [bgImage, setBgImage] = useState(settings.dashboardBackgroundImage || '');
  const [transparency, setTransparency] = useState(settings.dashboardTransparency ?? 50);

  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const settingsToSave: Partial<Config['settings'] & { geminiApiKey?: string; isCalendarSyncEnabled?: boolean }> = { 
        accentColor, 
        blurEnabled, 
        mobileLayout: mobileLayout as 'standard' | 'toolbar', 
        forceOfflineMode, 
        perQuestionTime,
        showAiChatAssistant: showAiChat,
        isCalendarSyncEnabled: calendarSync,
        examType: examType as 'JEE' | 'NEET',
        theme: theme as 'default' | 'liquid-glass' | 'midnight',
        dashboardLayout: LAYOUT_PRESETS[dashboardLayoutPreset].map(id => ({ id })),
        dashboardFlashcardDeckIds,
        musicPlayerWidgetLayout: musicPlayerLayout as 'minimal' | 'expanded',
        dashboardBackgroundImage: bgImage,
        dashboardTransparency: transparency,
    };
    if (geminiApiKey.trim()) {
        settingsToSave.geminiApiKey = geminiApiKey.trim();
        onSave(settingsToSave);
        onApiKeySet();
    } else {
        onSave(settingsToSave);
    }
    handleClose();
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";
  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses} overflow-hidden flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        
        {/* MacOS Traffic Light Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
            <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">System Settings</span>
        </div>

        <div className="p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Google Integration Section */}
            <div>
                <h3 className="text-base font-bold text-gray-300 mb-3">Google Integration</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Account Status</span>
                        {googleAuthStatus === 'signed_in' ? (
                            <button type="button" onClick={onGoogleSignOut} className="text-xs bg-red-600/20 text-red-400 px-3 py-1.5 rounded-md border border-red-600/50 hover:bg-red-600/30">Disconnect</button>
                        ) : (
                            <button type="button" onClick={onGoogleSignIn} className="text-xs bg-cyan-600/20 text-cyan-400 px-3 py-1.5 rounded-md border border-cyan-600/50 hover:bg-cyan-600/30">Connect Google</button>
                        )}
                    </div>

                    {googleAuthStatus === 'signed_in' && (
                        <>
                            <div className="flex justify-between items-center border-t border-gray-700/50 pt-3">
                                <div>
                                    <p className="text-sm font-bold text-white">Google Drive Backup</p>
                                    <p className="text-xs text-gray-500">{driveLastSync ? `Last sync: ${new Date(driveLastSync).toLocaleDateString()}` : 'Not synced yet'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={onBackupToDrive} className="p-2 text-gray-400 hover:text-white" title="Backup now"><Icon name="upload" /></button>
                                    <button type="button" onClick={onRestoreFromDrive} className="p-2 text-gray-400 hover:text-white" title="Restore"><Icon name="upload" className="transform rotate-180" /></button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center border-t border-gray-700/50 pt-3">
                                <div>
                                    <p className="text-sm font-bold text-white">Google Calendar Sync</p>
                                    <p className="text-xs text-gray-500">{isCalendarSyncEnabled ? 'Active' : 'Disabled'}</p>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={calendarSync} 
                                    onChange={(e) => setCalendarSync(e.target.checked)} 
                                    className="w-5 h-5 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-700/50"></div>

            {/* Documentation Section */}
            <div>
                <h3 className="text-base font-bold text-gray-300 mb-3">Guides & Help</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={onOpenAssistantGuide} className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 border border-gray-700">
                        <Icon name="message" className="w-4 h-4" /> Voice Commands
                    </button>
                    <button type="button" onClick={onOpenAiGuide} className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 border border-gray-700">
                        <Icon name="book-open" className="w-4 h-4" /> AI Agent Guide
                    </button>
                </div>
            </div>

            <div className="border-t border-gray-700/50"></div>

            {/* Dashboard & Appearance */}
            <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-300">Dashboard & Appearance</h3>
                
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400">Background Image URL</label>
                        <input value={bgImage} onChange={e => setBgImage(e.target.value)} className={inputClass + " text-sm py-1"} placeholder="https://example.com/bg.jpg" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 flex justify-between">
                            Widget Transparency
                            <span>{transparency}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={transparency} 
                            onChange={e => setTransparency(Number(e.target.value))} 
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                        />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-bold text-gray-400">Default Layout</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        {(['default', 'focus', 'compact'] as const).map(layout => (
                            <button key={layout} type="button" onClick={() => setDashboardLayoutPreset(layout)} className={`p-2 rounded-lg border-2 ${dashboardLayoutPreset === layout ? 'border-cyan-500' : 'border-transparent'}`}>
                                <div className={`h-16 bg-gray-900/50 rounded-md p-1.5 flex gap-1.5 ${layout === 'focus' ? 'flex-col' : ''} ${layout === 'compact' ? 'flex-wrap' : ''}`}>
                                    <div className={`rounded-sm bg-cyan-500/50 ${layout === 'focus' ? 'w-full h-1/2' : 'w-1/2 h-full'}`}></div>
                                    <div className={`rounded-sm bg-purple-500/50 ${layout === 'focus' ? 'w-full h-1/2' : 'w-1/2 h-full'}`}></div>
                                </div>
                                <p className="text-xs mt-1 text-gray-300 capitalize">{layout}</p>
                            </button>
                        ))}
                    </div>
                    {onToggleEditLayout && (
                        <button type="button" onClick={() => { onToggleEditLayout(); handleClose(); }} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-lg transform transition hover:scale-[1.02]">
                            <Icon name="dashboard" className="w-5 h-5" /> Open Layout Editor
                        </button>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-700/50"></div>
            
            <div>
                <h3 className="text-base font-bold text-gray-300">AI Settings</h3>
                <div className="mt-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <p className="text-sm font-semibold text-cyan-400">Gemini API Key</p>
                    <p className="text-xs text-gray-400 mb-2">Provide your own key to use AI features. Your key is stored securely.</p>
                    <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} className={inputClass} placeholder="Enter new API key to update" />
                    {settings.hasGeminiKey && !geminiApiKey && <p className="text-xs text-green-400 mt-1">API key is configured.</p>}
                </div>
            </div>
            
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[var(--accent-color)] to-[var(--gradient-purple)] text-white">Save</button>
            </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
