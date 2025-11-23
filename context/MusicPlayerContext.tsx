
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
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

// Updated to use the local proxy to avoid CORS issues
const DJ_DROP_URL = '/api/dj-drop';

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
    const [isAutoMixEnabled, setIsAutoMixEnabled] = useState(false);
    
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
            
            // Chain: Source -> Gain -> Analyser -> Destination
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
            djDropAudioRef.current.play().catch(e => console.error("DJ drop playback error:", e));
        }
    };

    const playTrack = useCallback(async (track: Track, newTracklist: Track[]) => {
        initializeAudioContext();
        
        // Basic Auto-Mix Logic: Fade Out if playing and enabled
        if (isAutoMixEnabled && isPlaying && gainNode && audioContext) {
             // Ramp volume down over 1.5 seconds
             gainNode.gain.setValueAtTime(1, audioContext.currentTime);
             gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5);
             
             // Wait for fade out before switching
             await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (audioElementRef.current && audioContext && analyser) {
            
            if (!isFirstPlayRef.current && !isAutoMixEnabled) {
                playDjDrop(); // Only play drop if manual switch or no automix
            }
            isFirstPlayRef.current = false;
            
            setTracklist(newTracklist);

            let streamUrl: string;
            let coverArtUrl = 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png'; // Default art

            if (track.isLocal && track.file) {
                if (currentObjectUrlRef.current) {
                    URL.revokeObjectURL(currentObjectUrlRef.current);
                }
                streamUrl = URL.createObjectURL(track.file);
                currentObjectUrlRef.current = streamUrl;

                try {
                    const metadata = await musicMetadata.parseBlob(track.file);
                    if (metadata.common.picture && metadata.common.picture.length > 0) {
                        const picture = metadata.common.picture[0];
                        const blob = new Blob([picture.data], { type: picture.format });
                        coverArtUrl = URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.warn("Could not parse metadata for local file", e);
                }

            } else {
                 // Use the proxy endpoint to handle Nextcloud auth/CORS
                 streamUrl = api.getMusicContentUrl(track.id);
                 coverArtUrl = api.getMusicContentUrl(track.coverArt);
            }

            const trackWithArtUrl = { ...track, coverArtUrl };
            setCurrentTrack(trackWithArtUrl);

            audioElementRef.current.src = streamUrl;
            audioElementRef.current.crossOrigin = "anonymous";
            
            // Connect source if not already connected
            if (!sourceNodeRef.current && gainNode) {
                sourceNodeRef.current = audioContext.createMediaElementSource(audioElementRef.current);
                sourceNodeRef.current.connect(gainNode);
            }

            audioElementRef.current.play().then(() => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                setIsPlaying(true);
                
                // Auto-Mix: Fade In
                if (isAutoMixEnabled && gainNode) {
                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 1.5);
                } else if (gainNode) {
                    gainNode.gain.setValueAtTime(1, audioContext.currentTime); // Instant volume for normal play
                }

            }).catch(e => console.error("Audio playback error:", e));
        }
    }, [audioContext, analyser, gainNode, initializeAudioContext, isAutoMixEnabled, isPlaying]);
    
    const play = () => {
        if (audioElementRef.current) {
            audioElementRef.current.play();
            setIsPlaying(true);
            if (audioContext?.state === 'suspended') {
                audioContext.resume();
            }
        }
    };

    const pause = () => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            setIsPlaying(false);
        }
    };

    const seek = (time: number) => {
        if (audioElementRef.current) {
            audioElementRef.current.currentTime = time;
        }
    };
    
    const navigateTrack = (direction: 'next' | 'prev') => {
        if (!currentTrack || tracklist.length === 0) return;
        
        const currentIndex = tracklist.findIndex(t => t.id === currentTrack.id);
        if (currentIndex === -1) return;
        
        let newIndex;
        if (direction === 'next') {
            newIndex = (currentIndex + 1) % tracklist.length;
        } else {
            newIndex = (currentIndex - 1 + tracklist.length) % tracklist.length;
        }
        playTrack(tracklist[newIndex], tracklist);
    };

    const nextTrack = useCallback(() => navigateTrack('next'), [currentTrack, tracklist, playTrack]);
    const prevTrack = () => navigateTrack('prev');

    const toggleFullScreenPlayer = () => {
        setIsFullScreenPlayerOpen(prev => !prev);
    };
    
    const toggleAutoMix = () => {
        setIsAutoMixEnabled(prev => !prev);
    };

    useEffect(() => {
        if (!audioElementRef.current) {
            const audio = new Audio();
            audioElementRef.current = audio;
            audio.addEventListener('ended', nextTrack);
            audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
            audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        }
        if (!djDropAudioRef.current) {
            const drop = new Audio(DJ_DROP_URL);
            drop.crossOrigin = "anonymous";
            djDropAudioRef.current = drop;
        }
        
        const audio = audioElementRef.current;
        return () => {
            if (audio) {
                audio.removeEventListener('ended', nextTrack);
                audio.removeEventListener('timeupdate', () => {});
                audio.removeEventListener('loadedmetadata', () => {});
            }
             if (currentObjectUrlRef.current) {
                URL.revokeObjectURL(currentObjectUrlRef.current);
            }
        };
    }, [nextTrack]);


    const value = { 
        audioElement: audioElementRef.current, 
        analyser, 
        isPlaying, 
        currentTrack, 
        isFullScreenPlayerOpen, 
        playTrack, 
        play, 
        pause, 
        nextTrack, 
        prevTrack, 
        toggleFullScreenPlayer, 
        seek, 
        duration, 
        currentTime, 
        playDjDrop,
        isAutoMixEnabled,
        toggleAutoMix
    };

    return (
        <MusicPlayerContext.Provider value={value}>
            {children}
        </MusicPlayerContext.Provider>
    );
};

export const useMusicPlayer = (): MusicPlayerContextType => {
    const context = useContext(MusicPlayerContext);
    if (context === undefined) {
        throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
    }
    return context;
};
