
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    if (!audioContext && (window.AudioContext || (window as any).webkitAudioContext)) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
};

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.start(ctx.currentTime);

    gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration);
};

export const playNextSound = () => playTone(440, 0.1, 'sine');
export const playSkipSound = () => playTone(330, 0.1, 'triangle');
export const playStopSound = () => playTone(220, 0.2, 'square');
export const playMarkSound = () => playTone(660, 0.08, 'triangle');
export const playTimesUpSound = () => {
    playTone(880, 0.1, 'sawtooth');
    setTimeout(() => playTone(880, 0.1, 'sawtooth'), 150);
};

type VibrationPattern = 'click' | 'error' | 'finish' | 'warning';

export const vibrate = (pattern: VibrationPattern) => {
    if ('vibrate' in navigator) {
        switch (pattern) {
            case 'click':
                navigator.vibrate(50);
                break;
            case 'error':
                navigator.vibrate([100, 50, 100]);
                break;
            case 'finish':
                navigator.vibrate(200);
                break;
            case 'warning':
                navigator.vibrate([100, 50, 100, 50, 100]); // A distinct warning pattern
                break;
        }
    }
};