
import React, { useState, useEffect } from 'react';
import { Config, FlashcardDeck, DashboardWidgetItem, NotchSettings, VisualizerSettings } from '../types';
import Icon from './Icon';
import { useMusicPlayer } from '../context/MusicPlayerContext';

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
  onTogglePushNotifications: (enabled: boolean) => void;
  pushNotificationsEnabled: boolean;
  isVapidKeyAvailable: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { settings, decks, driveLastSync, isCalendarSyncEnabled, calendarLastSync, onClose, onSave, onExportToIcs, googleAuthStatus, onGoogleSignIn, onGoogleSignOut, onBackupToDrive, onRestoreFromDrive, onApiKeySet, onOpenAssistantGuide, onOpenAiGuide, onClearAllSchedule, onToggleEditLayout, onTogglePushNotifications, pushNotificationsEnabled, isVapidKeyAvailable } = props;
  
  const { setNotchSettings, setVisualizerSettings, notchSettings: currentNotch, visualizerSettings: currentVis } = useMusicPlayer();

  const [accentColor, setAccentColor] = useState(settings.accentColor || '#0891b2');
  const [blurEnabled, setBlurEnabled] = useState(settings.blurEnabled !== false);
  const [mobileLayout, setMobileLayout] = useState(settings.mobileLayout || 'toolbar');
  const [forceOfflineMode, setForceOfflineMode] = useState(settings.forceOfflineMode || false);
  const [perQuestionTime, setPerQuestionTime] = useState(settings.perQuestionTime || 180);
  const [showAiChat, setShowAiChat] = useState(settings.showAiChatAssistant !== false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [calendarSync, setCalendarSync] = useState(isCalendarSyncEnabled || false);
  const [examType, setExamType] = useState(settings.examType || 'JEE');
  const [theme, setTheme] = useState(settings.theme || 'default');
  
  const [notchEnabled, setNotchEnabled] = useState(currentNotch.enabled !== false);
  const [notchPos, setNotchPos] = useState<NotchSettings['position']>(currentNotch.position);
  const [notchSize, setNotchSize] = useState<NotchSettings['size']>(currentNotch.size);
  const [notchWidth, setNotchWidth] = useState<number>(currentNotch.width);
  const [visPreset, setVisPreset] = useState<VisualizerSettings['preset']>(currentVis.preset);
  const [visColor, setVisColor] = useState<VisualizerSettings['colorMode']>(currentVis.colorMode);

  const [bgImage, setBgImage] = useState(settings.dashboardBackgroundImage || '');
  const [transparency, setTransparency] = useState(settings.dashboardTransparency ?? 50);

  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setNotchSettings({ position: notchPos, size: notchSize, width: notchWidth, enabled: notchEnabled });
    setVisualizerSettings({ preset: visPreset, colorMode: visColor });

    const settingsToSave: Partial<Config['settings'] & { geminiApiKey?: string; isCalendarSyncEnabled?: boolean }> = { 
        accentColor: accentColor || '#0891b2', 
        blurEnabled, 
        mobileLayout: mobileLayout as 'standard' | 'toolbar', 
        forceOfflineMode, 
        perQuestionTime,
        showAiChatAssistant: showAiChat,
        isCalendarSyncEnabled: calendarSync,
        examType: examType as 'JEE' | 'NEET',
        theme: theme as 'default' | 'liquid-glass' | 'midnight',
        dashboardBackgroundImage: bgImage,
        dashboardTransparency: transparency,
        notchSettings: { position: notchPos, size: notchSize, width: notchWidth, enabled: notchEnabled },
        visualizerSettings: { preset: visPreset, colorMode: visColor }
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

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  const inputClass = "w-full px-4 py-2 mt-1 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500";

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses} overflow-hidden flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
            <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">Settings</span>
        </div>

        <div className="p-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            
            <div>
                <h3 className="text-base font-bold text-gray-300">Music Player & Visuals</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-400">Enable Notch Visualizer</label>
                        <input type="checkbox" checked={notchEnabled} onChange={e => setNotchEnabled(e.target.checked)} className="w-4 h-4 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500" />
                    </div>
                    {notchEnabled && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400">Notch Position</label>
                                    <select value={notchPos} onChange={e => setNotchPos(e.target.value as any)} className={inputClass + " py-1 text-xs"}>
                                        <option value="top">Top</option>
                                        <option value="bottom">Bottom</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400">Size Constraint</label>
                                    <select value={notchSize} onChange={e => setNotchSize(e.target.value as any)} className={inputClass + " py-1 text-xs"}>
                                        <option value="small">Small (Phone)</option>
                                        <option value="medium">Medium</option>
                                        <option value="large">Large (Tablet)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 flex justify-between">Notch Width <span>{notchWidth}%</span></label>
                                <input type="range" min="20" max="90" value={notchWidth} onChange={e => setNotchWidth(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg accent-cyan-500" />
                            </div>
                        </>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400">Visualizer Style</label>
                            <select value={visPreset} onChange={e => setVisPreset(e.target.value as any)} className={inputClass + " py-1 text-xs"}>
                                <option value="bars">Bars</option>
                                <option value="wave">Wave</option>
                                <option value="circle">Circle</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400">Color Mode</label>
                            <select value={visColor} onChange={e => setVisColor(e.target.value as any)} className={inputClass + " py-1 text-xs"}>
                                <option value="rgb">RGB Cycle</option>
                                <option value="album">Album Match</option>
                                <option value="mono">Mono</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700/50"></div>

            <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-300">Appearance</h3>
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400">Mobile Layout</label>
                        <select value={mobileLayout} onChange={e => setMobileLayout(e.target.value as 'standard' | 'toolbar')} className={inputClass + " text-sm py-1"}>
                            <option value="toolbar">Bottom Toolbar (Simplified)</option>
                            <option value="standard">Standard Tab Bar</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400">Background URL</label>
                        <input value={bgImage} onChange={e => setBgImage(e.target.value)} className={inputClass + " text-sm py-1"} placeholder="https://..." />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 flex justify-between">Widget Transparency <span>{transparency}%</span></label>
                        <input type="range" min="0" max="100" value={transparency} onChange={e => setTransparency(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg accent-cyan-500" />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-gray-400">Theme Preset</label>
                        <select value={theme} onChange={e => setTheme(e.target.value as 'default' | 'liquid-glass' | 'midnight')} className={inputClass + " text-sm py-1"}>
                            <option value="default">Default Dark</option>
                            <option value="liquid-glass">Liquid Glass</option>
                            <option value="midnight">Midnight</option>
                        </select>
                    </div>
                </div>

                {onToggleEditLayout && (
                    <button type="button" onClick={() => { onToggleEditLayout(); handleClose(); }} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-lg transform transition hover:scale-[1.02]">
                        <Icon name="dashboard" className="w-5 h-5" /> Layout Editor
                    </button>
                )}
            </div>

            <div className="border-t border-gray-700/50"></div>
            
            <div>
                <h3 className="text-base font-bold text-gray-300 mb-2">Integrations & Sync</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                    <div className="flex justify-between items-center">
                         <span className="text-sm text-gray-300">Google Account</span>
                         {googleAuthStatus === 'signed_in' ? 
                            <button type="button" onClick={onGoogleSignOut} className="text-xs text-red-400 border border-red-500/50 px-2 py-1 rounded hover:bg-red-500/20">Disconnect</button> :
                            <button type="button" onClick={onGoogleSignIn} className="text-xs text-cyan-400 border border-cyan-500/50 px-2 py-1 rounded hover:bg-cyan-500/20">Connect</button>
                         }
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-300">Auto-Sync to Google Calendar</label>
                        <input type="checkbox" checked={calendarSync} onChange={e => setCalendarSync(e.target.checked)} className="w-4 h-4 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500" />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className={`text-sm text-gray-300 ${!isVapidKeyAvailable ? 'opacity-50' : ''}`} title={!isVapidKeyAvailable ? 'Push notifications are not configured by the administrator.' : ''}>Push Notifications</label>
                        <input 
                            type="checkbox" 
                            checked={pushNotificationsEnabled} 
                            onChange={e => onTogglePushNotifications(e.target.checked)} 
                            disabled={!isVapidKeyAvailable}
                            className="w-4 h-4 rounded text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!isVapidKeyAvailable ? 'Push notifications are not configured by the administrator.' : ''}
                        />
                    </div>
                    
                    <button type="button" onClick={onExportToIcs} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-600">
                        <Icon name="calendar" className="w-4 h-4" /> Export Calendar (.ics)
                    </button>

                    <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} className={inputClass} placeholder="Gemini API Key" />
                </div>
            </div>

            <div className="border-t border-gray-700/50"></div>

            <div>
                <h3 className="text-base font-bold text-gray-300 mb-2">Help & Guides</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={onOpenAssistantGuide} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors text-center h-full">
                        <Icon name="gemini" className="w-6 h-6 text-cyan-400" />
                        <span className="text-xs font-bold text-gray-200">Voice Commands</span>
                    </button>
                    <button type="button" onClick={onOpenAiGuide} className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors text-center h-full">
                        <Icon name="book-open" className="w-6 h-6 text-purple-400" />
                        <span className="text-xs font-bold text-gray-200">AI Data Guide</span>
                    </button>
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
