// --- AFTER (safe audio creation)
import { useRef } from 'react';

const loggedAudioErrorsRef = useRef(new Set<string>());

useEffect(() => {
  try {
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
      audio.addEventListener('error', (e) => {
          const key = 'main-audio';
          if (!loggedAudioErrorsRef.current.has(key)) {
            loggedAudioErrorsRef.current.add(key);
            console.error("Audio playback error:", e);
          }
          setIsPlaying(false);
          setCurrentTrack(null);
          // Avoid noisy alerts, only show user friendly once if necessary
      });
    }
  } catch (err) {
    console.warn("Failed to initialize audio element:", err);
  }

  // DJ drop audio set up with safe guards
  try {
    if (!djDropAudioRef.current && DJ_DROP_URL) {
      const drop = new Audio(DJ_DROP_URL);
      drop.crossOrigin = "anonymous";
      djDropAudioRef.current = drop;
      drop.addEventListener('error', (e) => {
        const key = 'dj-drop';
        if (!loggedAudioErrorsRef.current.has(key)) {
          loggedAudioErrorsRef.current.add(key);
          console.error("DJ Drop audio error:", e);
        }
        // Don't throw; optionally disable DJ drop UI flag
      });
    }
  } catch (err) {
    console.warn('DJ Drop initialization failed:', err);
  }
}, [navigateTrack]);