import React, { createContext, useState, useContext, ReactNode, useRef, useCallback, useEffect } from 'react';
import { api } from '../api/apiService';
import { Track } from '../types';
import * as musicMetadata from 'music-metadata-browser';

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
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

const DJ_DROP_URL = '/api/dj-drop';
const DEFAULT_ART = 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_mtb6hbmtb6hbmtb6.png';

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
    
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const djDropAudioRef = useRef<HTMLAudioElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const isFirstPlayRef = useRef(true);
    const currentObjectUrlRef = useRef<string | null>(null);
    
    const initializeAudioContext = useCallback(() => {
        if (!audioContext) {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyserNode = context.createAnalyser();
            const gain = context.createGain();
            gain.connect(analyserNode);
            analyserNode.connect(context.destination);
            setAudioContext(context);
            setAnalyser(analyserNode);
            setGainNode(gain);
        }
    }, [audioContext]);
    
    const playDjDrop = () => {
        if (djDropAudioRef.current) {
            djDropAudioRef.current.currentTime = 0;
            djDropAudioRef.current.play().catch(e => console.error("DJ drop error", e));
        }
    };

    const playTrack = useCallback(async (track: Track, newTracklist: Track[]) => {
        initializeAudioContext();
        
        if (isAutoMixEnabled && isPlaying && gainNode && audioContext) {
             gainNode.gain.setValueAtTime(1, audioContext.currentTime);
             gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);
             await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (audioElementRef.current && audioContext && analyser) {
            if (!isFirstPlayRef.current && !isAutoMixEnabled) {
                playDjDrop();
            }
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
                 coverArtUrl = DEFAULT_ART; 
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
                if (isAutoMixEnabled && gainNode) {
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 2);
                } else if (gainNode) {
                    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
                }
            }).catch(e => console.error("Playback error:", e));
        }
    }, [audioContext, analyser, gainNode, initializeAudioContext, isAutoMixEnabled, isPlaying]);
    
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
            audioElementRef.current = audio;
            audio.addEventListener('ended', () => navigateTrack('next')); // Autoplay next
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
        toggleFullScreenPlayer, seek, duration, currentTime, playDjDrop, isAutoMixEnabled, toggleAutoMix, updateTrackMetadata 
    };

    return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
};

export const useMusicPlayer = () => {
    const context = useContext(MusicPlayerContext);
    if (context === undefined) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
    return context;
};