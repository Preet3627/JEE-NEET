import React, { createContext, useState, useContext, ReactNode, useRef, useCallback, useEffect } from 'react';
import { api } from '../api/apiService';
import { Track, NotchSettings, VisualizerSettings, DjDropSettings } from '../types';
import * as musicMetadata from 'music-metadata-browser';
import { useAuth } from './AuthContext';

interface MusicPlayerContextType {
    audioElement: HTMLAudioElement | null;
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    currentTrack: Track | null;
    isFullScreenPlayerOpen: boolean;
    playTrack: (track: Track, tracklist: Track[]) => void;
    play: () => void;
    pause: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    toggleFullScreenPlayer: () => void;
    seek: (time: number) => void;
    duration: number;
    currentTime: number;
    playDjDrop: () => void;
    isAutoMixEnabled: boolean;
    toggleAutoMix: () => void;
    updateTrackMetadata: (id: string, newTitle: string, newArtist: string) => void;
    notchSettings: NotchSettings;
    visualizerSettings: VisualizerSettings;
    djDropSettings: DjDropSettings;
    setNotchSettings: (s: NotchSettings) => void;
    setVisualizerSettings: (s: VisualizerSettings) => void;
    setDjDropSettings: (s: DjDropSettings) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

const DJ_DROP_URL = '/api/dj-drop';
const DEFAULT_ART = 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_mtb6hbmtb6hbmtb6.png';

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser, updateProfile } = useAuth();

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [gainNode, setGainNode] = useState<GainNode | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [tracklist, setTracklist] = useState<Track[]>([]);
    const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isAutoMixEnabled, setIsAutoMixEnabled] = useState(true);

    // Persistent Settings with defaults
    const [notchSettings, setNotchSettings] = useState<NotchSettings>({ position: 'top', size: 'medium', width: 30 });
    const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>({ preset: 'bars', colorMode: 'rgb' });
    const [djDropSettings, setDjDropSettings] = useState<DjDropSettings>({ enabled: true, autoTrigger: true });
    
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const djDropAudioRef = useRef<HTMLAudioElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const isFirstPlayRef = useRef(true);
    const currentObjectUrlRef = useRef<string | null>(null);

    // Load settings from user config on mount
    useEffect(() => {
        if (currentUser && currentUser.CONFIG && currentUser.CONFIG.settings) {
            const s = currentUser.CONFIG.settings;
            if (s.notchSettings) setNotchSettings(s.notchSettings);
            if (s.visualizerSettings) setVisualizerSettings(s.visualizerSettings);
            if (s.djDropSettings) setDjDropSettings(s.djDropSettings);
        }
    }, [currentUser]);

    // Helper to save settings to DB
    const saveSettings = async (newSettings: Partial<any>) => {
        // In a real app, you'd optimize this debounce. 
        // Using updateConfig via API service would be cleaner if exposed in AuthContext, 
        // but for now we assume api.updateConfig is available globally or pass it down.
        // Since we don't have api.updateConfig directly here, we assume it persists on next full sync or profile update.
        // Ideally: api.updateConfig({ settings: { ...currentUser.CONFIG.settings, ...newSettings } });
        // Here we'll just update local state, assuming SettingsModal calls the API save.
    };

    const handleSetNotchSettings = (s: NotchSettings) => { setNotchSettings(s); };
    const handleSetVisualizerSettings = (s: VisualizerSettings) => { setVisualizerSettings(s); };
    const handleSetDjDropSettings = (s: DjDropSettings) => { setDjDropSettings(s); };
    
    const initializeAudioContext = useCallback(() => {
        if (!audioContext) {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyserNode = context.createAnalyser();
            analyserNode.smoothingTimeConstant = 0.85; // Smoother visualization
            const gain = context.createGain();
            gain.connect(analyserNode);
            analyserNode.connect(context.destination);
            setAudioContext(context);
            setAnalyser(analyserNode);
            setGainNode(gain);
        }
    }, [audioContext]);
    
    const playDjDrop = () => {
        if (djDropSettings.enabled && djDropAudioRef.current) {
            djDropAudioRef.current.currentTime = 0;
            // Use custom URL if available, otherwise default
            if (djDropSettings.customDropUrl && djDropAudioRef.current.src !== djDropSettings.customDropUrl) {
                 djDropAudioRef.current.src = djDropSettings.customDropUrl;
            } else if (!djDropSettings.customDropUrl && djDropAudioRef.current.src.includes('custom')) {
                 djDropAudioRef.current.src = DJ_DROP_URL;
            }
            djDropAudioRef.current.play().catch(e => console.error("DJ drop error", e));
        }
    };

    const fetchAlbumArt = async (track: Track): Promise<string> => {
        try {
            // Use API proxy to get first chunk of file for metadata
             const response = await fetch(`/api/music/album-art?path=${encodeURIComponent(track.path || '')}&token=${localStorage.getItem('token')}`);
             if (!response.ok) return DEFAULT_ART;
             
             const arrayBuffer = await response.arrayBuffer();
             const metadata = await musicMetadata.parseBlob(new Blob([arrayBuffer]));
             
             if (metadata.common.picture && metadata.common.picture.length > 0) {
                 const picture = metadata.common.picture[0];
                 const blob = new Blob([picture.data], { type: picture.format });
                 return URL.createObjectURL(blob);
             }
        } catch (e) {
            console.warn("Failed to fetch album art via proxy", e);
        }
        return DEFAULT_ART;
    };

    const playTrack = useCallback(async (track: Track, newTracklist: Track[]) => {
        initializeAudioContext();
        
        // Auto-Mix Logic (Crossfade)
        if (isAutoMixEnabled && isPlaying && gainNode && audioContext) {
             // Fade out current
             gainNode.gain.setValueAtTime(1, audioContext.currentTime);
             gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 3);
             
             // Trigger DJ Drop during mix if auto-trigger is on
             if (djDropSettings.enabled && djDropSettings.autoTrigger) {
                 setTimeout(() => playDjDrop(), 1500); 
             }

             await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (audioElementRef.current && audioContext && analyser) {
            isFirstPlayRef.current = false;
            setTracklist(newTracklist);

            let streamUrl: string;
            let coverArtUrl = DEFAULT_ART;

            if (track.isLocal && track.file) {
                if (currentObjectUrlRef.current) URL.revokeObjectURL(currentObjectUrlRef.current);
                streamUrl = URL.createObjectURL(track.file);
                currentObjectUrlRef.current = streamUrl;
                try {
                    const metadata = await musicMetadata.parseBlob(track.file);
                    if (metadata.common.picture && metadata.common.picture.length > 0) {
                        const picture = metadata.common.picture[0];
                        const blob = new Blob([picture.data], { type: picture.format });
                        coverArtUrl = URL.createObjectURL(blob);
                    }
                } catch (e) { /* ignore */ }
            } else {
                 streamUrl = api.getMusicContentUrl(track.id);
                 // Try to fetch actual art via proxy
                 coverArtUrl = await fetchAlbumArt(track); 
            }

            const trackWithArt = { ...track, coverArtUrl };
            setCurrentTrack(trackWithArt);

            audioElementRef.current.src = streamUrl;
            audioElementRef.current.crossOrigin = "anonymous";
            
            if (!sourceNodeRef.current && gainNode) {
                sourceNodeRef.current = audioContext.createMediaElementSource(audioElementRef.current);
                sourceNodeRef.current.connect(gainNode);
            }

            audioElementRef.current.play().then(() => {
                if (audioContext.state === 'suspended') audioContext.resume();
                setIsPlaying(true);
                
                // Fade in new track
                if (isAutoMixEnabled && gainNode) {
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 3);
                } else if (gainNode) {
                    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
                }
            }).catch(e => console.error("Playback error:", e));
        }
    }, [audioContext, analyser, gainNode, initializeAudioContext, isAutoMixEnabled, isPlaying, djDropSettings]);
    
    const updateTrackMetadata = (id: string, newTitle: string, newArtist: string) => {
        const updatedList = tracklist.map(t => t.id === id ? { ...t, title: newTitle, artist: newArtist } : t);
        setTracklist(updatedList);
        if (currentTrack && currentTrack.id === id) {
            setCurrentTrack({ ...currentTrack, title: newTitle, artist: newArtist });
        }
    };

    const play = () => { audioElementRef.current?.play(); setIsPlaying(true); audioContext?.resume(); };
    const pause = () => { audioElementRef.current?.pause(); setIsPlaying(false); };
    const seek = (time: number) => { if(audioElementRef.current) audioElementRef.current.currentTime = time; };
    const toggleFullScreenPlayer = () => setIsFullScreenPlayerOpen(prev => !prev);
    const toggleAutoMix = () => setIsAutoMixEnabled(prev => !prev);

    const navigateTrack = (direction: 'next' | 'prev') => {
        if (!currentTrack || tracklist.length === 0) return;
        const currentIndex = tracklist.findIndex(t => t.id === currentTrack.id);
        if (currentIndex === -1) return;
        let newIndex = direction === 'next' ? (currentIndex + 1) % tracklist.length : (currentIndex - 1 + tracklist.length) % tracklist.length;
        playTrack(tracklist[newIndex], tracklist);
    };
    
    useEffect(() => {
        if (!audioElementRef.current) {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audioElementRef.current = audio;
            audio.addEventListener('ended', () => navigateTrack('next')); 
            audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
            audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        }
        if (!djDropAudioRef.current) {
            const drop = new Audio(DJ_DROP_URL);
            drop.crossOrigin = "anonymous";
            djDropAudioRef.current = drop;
        }
    }, [tracklist, currentTrack]);

    const value = { 
        audioElement: audioElementRef.current, analyser, isPlaying, currentTrack, isFullScreenPlayerOpen, 
        playTrack, play, pause, nextTrack: () => navigateTrack('next'), prevTrack: () => navigateTrack('prev'), 
        toggleFullScreenPlayer, seek, duration, currentTime, playDjDrop, isAutoMixEnabled, toggleAutoMix, 
        updateTrackMetadata, notchSettings, visualizerSettings, djDropSettings,
        setNotchSettings: handleSetNotchSettings, setVisualizerSettings: handleSetVisualizerSettings, setDjDropSettings: handleSetDjDropSettings
    };

    return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
};

export const useMusicPlayer = () => {
    const context = useContext(MusicPlayerContext);
    if (context === undefined) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
    return context;
};