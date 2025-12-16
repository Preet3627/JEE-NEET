/**
 * Android Gemini Voice Integration for PWA
 * Integrates with Android's native Gemini assistant
 */

class AndroidVoiceIntegration {
    private isAndroid: boolean = false;
    private supportsWebShare: boolean = false;
    private supportsWebIntent: boolean = false;

    constructor() {
        this.detectAndroid();
    }

    /**
     * Detect if running on Android
     */
    private detectAndroid() {
        const userAgent = navigator.userAgent.toLowerCase();
        this.isAndroid = /android/.test(userAgent);
        this.supportsWebShare = 'share' in navigator;

        // Check for Web Share Target API (for receiving shares)
        this.supportsWebIntent = 'serviceWorker' in navigator;

        console.log('Android detection:', {
            isAndroid: this.isAndroid,
            supportsWebShare: this.supportsWebShare,
            supportsWebIntent: this.supportsWebIntent
        });
    }

    /**
     * Check if running on Android
     */
    isRunningOnAndroid(): boolean {
        return this.isAndroid;
    }

    /**
     * Open Android Gemini app with query
     */
    async openGeminiApp(query: string): Promise<boolean> {
        if (!this.isAndroid) {
            console.warn('Not running on Android');
            return false;
        }

        try {
            // Try to open Gemini app using intent URL
            const geminiIntent = `intent://gemini.google.com/#Intent;scheme=https;package=com.google.android.apps.bard;end`;
            window.location.href = geminiIntent;

            // Fallback to web version after timeout
            setTimeout(() => {
                window.open(`https://gemini.google.com/app?q=${encodeURIComponent(query)}`, '_blank');
            }, 2000);

            return true;
        } catch (error) {
            console.error('Failed to open Gemini app:', error);
            return false;
        }
    }

    /**
     * Share text to Android apps (including Gemini)
     */
    async shareToAndroid(text: string, title?: string): Promise<boolean> {
        if (!this.supportsWebShare) {
            console.warn('Web Share API not supported');
            return false;
        }

        try {
            await navigator.share({
                title: title || 'Share to Gemini',
                text: text,
            });
            return true;
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Share failed:', error);
            }
            return false;
        }
    }

    /**
     * Request voice input from Android
     */
    async requestVoiceInput(): Promise<string | null> {
        // Use Web Speech API (works on Android Chrome)
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return null;
        }

        return new Promise((resolve) => {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            recognition.lang = 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                resolve(transcript);
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                resolve(null);
            };

            recognition.onend = () => {
                // If no result, resolve with null
            };

            try {
                recognition.start();
            } catch (error) {
                console.error('Failed to start recognition:', error);
                resolve(null);
            }
        });
    }

    /**
     * Add to home screen prompt (PWA install)
     */
    async promptInstallPWA(): Promise<boolean> {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA already installed');
            return false;
        }

        // Check for beforeinstallprompt event
        const deferredPrompt = (window as any).deferredPrompt;
        if (!deferredPrompt) {
            console.warn('Install prompt not available');
            return false;
        }

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('Install prompt outcome:', outcome);
            return outcome === 'accepted';
        } catch (error) {
            console.error('Install prompt failed:', error);
            return false;
        }
    }

    /**
     * Register for Android share target (receive shares)
     */
    registerShareTarget() {
        if (!this.supportsWebIntent) {
            console.warn('Service Worker not supported');
            return;
        }

        // This requires service worker and manifest.json configuration
        console.log('Share target registration requires service worker');

        // Listen for shared content
        if ('launchQueue' in window) {
            (window as any).launchQueue.setConsumer((launchParams: any) => {
                if (launchParams.targetURL) {
                    const url = new URL(launchParams.targetURL);
                    const sharedText = url.searchParams.get('text');
                    const sharedTitle = url.searchParams.get('title');

                    if (sharedText) {
                        this.handleSharedContent(sharedText, sharedTitle || undefined);
                    }
                }
            });
        }
    }

    /**
     * Handle shared content from Android
     */
    private handleSharedContent(text: string, title?: string) {
        console.log('Received shared content:', { text, title });

        // Dispatch custom event for app to handle
        window.dispatchEvent(new CustomEvent('android-share-received', {
            detail: { text, title }
        }));
    }

    /**
     * Request notification permission (Android)
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    }

    /**
     * Show notification (Android)
     */
    async showNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return;
        }

        if (Notification.permission !== 'granted') {
            await this.requestNotificationPermission();
        }

        if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                // Use service worker for persistent notifications
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, options);
            } else {
                // Fallback to regular notification
                new Notification(title, options);
            }
        }
    }

    /**
     * Vibrate device (Android)
     */
    vibrate(pattern: number | number[]): boolean {
        if ('vibrate' in navigator) {
            return navigator.vibrate(pattern);
        }
        return false;
    }

    /**
     * Get device info
     */
    getDeviceInfo(): {
        isAndroid: boolean;
        isPWA: boolean;
        supportsWebShare: boolean;
        supportsNotifications: boolean;
        supportsVibration: boolean;
    } {
        return {
            isAndroid: this.isAndroid,
            isPWA: window.matchMedia('(display-mode: standalone)').matches,
            supportsWebShare: this.supportsWebShare,
            supportsNotifications: 'Notification' in window,
            supportsVibration: 'vibrate' in navigator
        };
    }

    /**
     * Open app settings (Android)
     */
    openAppSettings() {
        if (this.isAndroid) {
            // Try to open app settings
            const settingsIntent = 'intent://settings#Intent;scheme=android-app;package=com.android.settings;end';
            window.location.href = settingsIntent;
        }
    }
}

// Export singleton instance
export const androidVoice = new AndroidVoiceIntegration();

// Export React hook
import { useState, useEffect } from 'react';

export const useAndroidVoice = () => {
    const [deviceInfo, setDeviceInfo] = useState(androidVoice.getDeviceInfo());
    const [sharedContent, setSharedContent] = useState<{ text: string; title?: string } | null>(null);

    useEffect(() => {
        // Register share target
        androidVoice.registerShareTarget();

        // Listen for shared content
        const handleSharedContent = (event: any) => {
            setSharedContent(event.detail);
        };

        window.addEventListener('android-share-received', handleSharedContent);

        // Update device info periodically
        const interval = setInterval(() => {
            setDeviceInfo(androidVoice.getDeviceInfo());
        }, 10000);

        return () => {
            window.removeEventListener('android-share-received', handleSharedContent);
            clearInterval(interval);
        };
    }, []);

    return {
        deviceInfo,
        sharedContent,
        isAndroid: deviceInfo.isAndroid,
        isPWA: deviceInfo.isPWA,
        openGeminiApp: (query: string) => androidVoice.openGeminiApp(query),
        shareToAndroid: (text: string, title?: string) => androidVoice.shareToAndroid(text, title),
        requestVoiceInput: () => androidVoice.requestVoiceInput(),
        promptInstallPWA: () => androidVoice.promptInstallPWA(),
        requestNotificationPermission: () => androidVoice.requestNotificationPermission(),
        showNotification: (title: string, options?: NotificationOptions) =>
            androidVoice.showNotification(title, options),
        vibrate: (pattern: number | number[]) => androidVoice.vibrate(pattern),
        clearSharedContent: () => setSharedContent(null),
    };
};
