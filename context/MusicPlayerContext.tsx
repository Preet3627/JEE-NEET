
import { useAuth } from './AuthContext';
import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { useServerStatus } from './ServerStatusContext';

interface MusicPlayerContextType {
    audioElement: HTMLAudioElement | null;
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    currentTrack: Track | null;
    isFullScreenPlayerOpen: boolean;
    isLibraryOpen: boolean;
    playTrack: (track: Track, tracklist: Track[]) => void;
    play: () => void;
    pause: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    toggleFullScreenPlayer: () => void;
    toggleLibrary: () => void;
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
    playlists: LocalPlaylist[];
    createPlaylist: (name: string) => void;
    addToPlaylist: (playlistId: string, track: Track) => void;
    queue: Track[];
    playNextInQueue: (track: Track) => void;
    addToQueue: (track: Track) => void;
    removeFromQueue: (index: number) => void;
    clearQueue: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

const DJ_DROP_URL = 'https://cloud.ponsrischool.in/index.php/s/K8MfJTSBE5zoZNC/download';
const DEFAULT_ART = 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_mtb6hbmtb6hbmtb6.png';

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { status } = useServerStatus();
    const globalDjDropUrl = status?.djDropUrl;

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [gainNode, setGainNode] = useState<GainNode | null>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [tracklist, setTracklist] = useState<Track[]>([]);
    const [queue, setQueue] = useState<Track[]>([]); // Queue System
    const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isAutoMixEnabled, setIsAutoMixEnabled] = useState(true);

    const [notchSettings, setNotchSettings] = useState<NotchSettings>({ position: 'top', size: 'medium', width: 30, enabled: true });
    const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>({ preset: 'bars', colorMode: 'rgb' });
    const [djDropSettings, setDjDropSettings] = useState<DjDropSettings>({ enabled: true, autoTrigger: true, crossfadeDuration: 3 }); // Default to 3 seconds
    
    const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);

    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const djDropAudioRef = useRef<HTMLAudioElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const currentObjectUrlRef = useRef<string | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);

    // Load settings from config on mount/update
    useEffect(() => {
        if (currentUser?.CONFIG?.settings) {
            const s = currentUser.CONFIG.settings;
            if (s.notchSettings) setNotchSettings(s.notchSettings);
            if (s.visualizerSettings) setVisualizerSettings(s.visualizerSettings);
            if (s.djDropSettings) setDjDropSettings(s.djDropSettings);
        }
        if (currentUser?.CONFIG?.localPlaylists) {
            setPlaylists(currentUser.CONFIG.localPlaylists);
        }
    }, [currentUser]);

    const handleSetNotchSettings = (s: NotchSettings) => setNotchSettings(s);
    const handleSetVisualizerSettings = (s: VisualizerSettings) => setVisualizerSettings(s);
    const handleSetDjDropSettings = (s: DjDropSettings) => setDjDropSettings(s);

    const createPlaylist = (name: string) => {
        setPlaylists(prev => [...prev, { id: `pl_${Date.now()}`, name, trackIds: [] }]);
    };

    const addToPlaylist = (playlistId: string, track: Track) => {
        setPlaylists(prev => prev.map(pl => pl.id === playlistId && !pl.trackIds.includes(track.id) ? { ...pl, trackIds: [...pl.trackIds, track.id] } : pl));
    };

    const addToQueue = (track: Track) => setQueue(prev => [...prev, track]);
    const playNextInQueue = (track: Track) => setQueue(prev => [track, ...prev]);
    const removeFromQueue = (index: number) => setQueue(prev => prev.filter((_, i) => i !== index));
    const clearQueue = () => setQueue([]);
    
    const toggleLibrary = () => setIsLibraryOpen(prev => !prev);

    const initializeAudioContext = useCallback(() => {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const context = new AudioContextClass();
            const analyserNode = context.createAnalyser();
            analyserNode.smoothingTimeConstant = 0.85;
            const gain = context.createGain();
            
            gain.connect(analyserNode);
            analyserNode.connect(context.destination);
            
            setAudioContext(context);
            setAnalyser(analyserNode);
            setGainNode(gain);
            
            // Setup Media Source immediately if audio element exists
            if(audioElementRef.current && !sourceNodeRef.current) {
                 // IMPORTANT: crossOrigin must be set BEFORE creating source
                 audioElementRef.current.crossOrigin = "anonymous";
                 try {
                    const source = context.createMediaElementSource(audioElementRef.current);
                    source.connect(gain);
                    sourceNodeRef.current = source;
                 } catch (e) {
                     console.warn("Could not attach media source (likely CORS issue)", e);
                 }
            }
        } else if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, [audioContext]);
    
    const playDjDrop = () => {
        if (djDropSettings.enabled && djDropAudioRef.current && gainNode && audioContext) {
            djDropAudioRef.current.currentTime = 0;
            const targetSrc = djDropSettings.customDropUrl || globalDjDropUrl || DJ_DROP_URL;
            if (djDropAudioRef.current.src !== targetSrc && !djDropAudioRef.current.src.endsWith(targetSrc)) {
                 djDropAudioRef.current.src = targetSrc;
            }

            const now = audioContext.currentTime;
            // Fast ducking
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
            
            djDropAudioRef.current.play().then(() => {
                 setTimeout(() => {
                     if (gainNode && audioContext) {
                        const restoreTime = audioContext.currentTime;
                        gainNode.gain.cancelScheduledValues(restoreTime);
                        gainNode.gain.setValueAtTime(0.1, restoreTime);
                        // Smooth restore
                        gainNode.gain.linearRampToValueAtTime(1.0, restoreTime + 1.0);
                     }
                 }, 1800); // Approx duration of drop
            }).catch(e => console.error("DJ drop play error", e));
        }
    };

    const updateMediaMetadata = (track: Track) => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album,
                artwork: [
                    { src: track.coverArt || DEFAULT_ART, sizes: '512x512', type: 'image/png' }
                ]
            });
            updateMediaPosition();
        }
    };

    const updateMediaPosition = () => {
        if ('mediaSession' in navigator && audioElementRef.current) {
            if (!isNaN(audioElementRef.current.duration) && !isNaN(audioElementRef.current.currentTime)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: audioElementRef.current.duration,
                        playbackRate: audioElementRef.current.playbackRate,
                        position: audioElementRef.current.currentTime,
                    });
                } catch (e) { 
                    // Ignore errors if metadata not fully loaded or infinite duration
                }
            }
        }
    };

    const fetchAlbumArt = async (track: Track): Promise<string> => {
        return DEFAULT_ART;
    };

    const playTrack = useCallback(async (track: Track, newTracklist: Track[]) => {
        initializeAudioContext();
        
        // Auto-Mix Crossfade Out
        if (isAutoMixEnabled && isPlaying && gainNode && audioContext) {
             const crossfadeTime = djDropSettings.crossfadeDuration || 3;
             const now = audioContext.currentTime;
             gainNode.gain.cancelScheduledValues(now);
             gainNode.gain.setValueAtTime(1, now);
             gainNode.gain.linearRampToValueAtTime(0, now + crossfadeTime); 
             
             if (djDropSettings.enabled && djDropSettings.autoTrigger) {
                 setTimeout(() => playDjDrop(), (crossfadeTime * 1000) / 2); // Play drop in the middle of crossfade
             }
             await new Promise(resolve => setTimeout(resolve, crossfadeTime * 1000));
        }

        if (audioElementRef.current) {
            setTracklist(newTracklist);

            let streamUrl = '';

            if (track.isLocal) {
                streamUrl = track.path;
            } else {
                 streamUrl = api.getMusicContentUrl(track.id);
            }

            const trackWithArt = { ...track, coverArt: track.coverArt || DEFAULT_ART };
            setCurrentTrack(trackWithArt);
            currentTrackIdRef.current = track.id;
            
            // CRITICAL: CORS for Visualizer
            audioElementRef.current.crossOrigin = "anonymous";
            audioElementRef.current.src = streamUrl;
            
            if (audioContext && !sourceNodeRef.current && gainNode) {
                try {
                    sourceNodeRef.current = audioContext.createMediaElementSource(audioElementRef.current);
                    sourceNodeRef.current.connect(gainNode);
                } catch(e) { console.warn("Source node error", e) }
            }

            audioElementRef.current.play().then(() => {
                if (audioContext?.state === 'suspended') audioContext.resume();
                setIsPlaying(true);
                
                if (isAutoMixEnabled && gainNode && audioContext) {
                    const crossfadeTime = djDropSettings.crossfadeDuration || 3;
                    const now = audioContext.currentTime;
                    gainNode.gain.cancelScheduledValues(now);
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(1, now + crossfadeTime);
                } else if (gainNode && audioContext) {
                    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
                }
                updateMediaMetadata(trackWithArt);
            }).catch(e => console.error("Playback error:", e));
        }
    }, [audioContext, analyser, gainNode, initializeAudioContext, isAutoMixEnabled, isPlaying, djDropSettings]);
    
    const updateTrackMetadata = (id: string, newTitle: string, newArtist: string) => {
        setTracklist(prev => prev.map(t => t.id === id ? { ...t, title: newTitle, artist: newArtist } : t));
        if (currentTrack?.id === id) {
            const updated = { ...currentTrack, title: newTitle, artist: newArtist };
            setCurrentTrack(updated);
            updateMediaMetadata(updated);
        }
    };

    const play = useCallback(() => { 
        initializeAudioContext();
        audioElementRef.current?.play(); 
        setIsPlaying(true); 
        if(currentTrack) updateMediaMetadata(currentTrack);
    }, [currentTrack, initializeAudioContext]);
    
    const pause = useCallback(() => { 
        audioElementRef.current?.pause(); 
        setIsPlaying(false); 
    }, []);
    
    const seek = useCallback((time: number) => { 
        if(audioElementRef.current) {
            audioElementRef.current.currentTime = time; 
            updateMediaPosition();
        }
    }, []);
    
    const toggleFullScreenPlayer = () => setIsFullScreenPlayerOpen(prev => !prev);
    const toggleAutoMix = () => setIsAutoMixEnabled(prev => !prev);

    const navigateTrack = useCallback((direction: 'next' | 'prev') => {
        // Check Queue first
        if (direction === 'next' && queue.length > 0) {
            const nextQ = queue[0];
            removeFromQueue(0);
            playTrack(nextQ, tracklist); // Keep current tracklist context
            return;
        }

        if (!currentTrack || tracklist.length === 0) return;
        const currentIndex = tracklist.findIndex(t => t.id === currentTrack.id);
        if (currentIndex === -1) return;
        let newIndex = direction === 'next' ? (currentIndex + 1) % tracklist.length : (currentIndex - 1 + tracklist.length) % tracklist.length;
        playTrack(tracklist[newIndex], tracklist);
    }, [currentTrack, tracklist, playTrack, queue]);
    
    useEffect(() => {
        if (!audioElementRef.current) {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audioElementRef.current = audio;
            audio.addEventListener('ended', () => navigateTrack('next')); 
            audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
            audio.addEventListener('loadedmetadata', () => {
                setDuration(audio.duration);
                updateMediaPosition();
            });
        }
        if (!djDropAudioRef.current) {
            const drop = new Audio(DJ_DROP_URL);
            drop.crossOrigin = "anonymous";
            djDropAudioRef.current = drop;
        }
    }, [navigateTrack]);

    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => play());
            navigator.mediaSession.setActionHandler('pause', () => pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => navigateTrack('prev'));
            navigator.mediaSession.setActionHandler('nexttrack', () => navigateTrack('next'));
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime) seek(details.seekTime);
            });
        }
    }, [play, pause, navigateTrack, seek]);

    const value = { 
        audioElement: audioElementRef.current, analyser, isPlaying, currentTrack, isFullScreenPlayerOpen, isLibraryOpen,
        playTrack, play, pause, nextTrack: () => navigateTrack('next'), prevTrack: () => navigateTrack('prev'), 
        toggleFullScreenPlayer, toggleLibrary, seek, duration, currentTime, playDjDrop, isAutoMixEnabled, toggleAutoMix, 
        updateTrackMetadata, notchSettings, visualizerSettings, djDropSettings, playlists, createPlaylist, addToPlaylist,
        setNotchSettings: handleSetNotchSettings, setVisualizerSettings: handleSetVisualizerSettings, setDjDropSettings: handleSetDjDropSettings,
        queue, addToQueue, playNextInQueue, removeFromQueue, clearQueue
    };

    return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
};

export const useMusicPlayer = () => {
    const context = useContext(MusicPlayerContext);
    if (context === undefined) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
    return context;
};
