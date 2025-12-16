/**
 * Gemini Voice Assistant
 * PWA-compatible voice assistant using Web Speech API and Gemini
 */

import { apiKeyManager } from './apiKeyManager';

type VoiceCommand = {
    pattern: RegExp;
    action: (matches: RegExpMatchArray) => Promise<void> | void;
    description: string;
};

class GeminiVoiceAssistant {
    private recognition: SpeechRecognition | null = null;
    private synthesis: SpeechSynthesis | null = null;
    private isListening: boolean = false;
    private isSpeaking: boolean = false;
    private listeners: Set<(event: VoiceEvent) => void> = new Set();
    private commands: VoiceCommand[] = [];
    private conversationHistory: Array<{ role: 'user' | 'model'; text: string }> = [];

    constructor() {
        this.init();
    }

    /**
     * Initialize voice assistant
     */
    private init() {
        // Check for Web Speech API support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported in this browser');
            return;
        }

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        // Initialize Speech Synthesis
        this.synthesis = window.speechSynthesis;

        // Set up event listeners
        this.setupRecognitionListeners();

        // Register default commands
        this.registerDefaultCommands();

        console.log('Voice Assistant initialized');
    }

    /**
     * Setup recognition event listeners
     */
    private setupRecognitionListeners() {
        if (!this.recognition) return;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.emit({ type: 'listening', data: null });
            console.log('Voice recognition started');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.emit({ type: 'stopped', data: null });
            console.log('Voice recognition stopped');
        };

        this.recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            const confidence = event.results[0][0].confidence;

            console.log('Recognized:', transcript, 'Confidence:', confidence);
            this.emit({ type: 'recognized', data: { transcript, confidence } });

            // Process the command
            await this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.emit({ type: 'error', data: { error: event.error } });
            this.isListening = false;
        };
    }

    /**
     * Register default voice commands
     */
    private registerDefaultCommands() {
        // Create task
        this.registerCommand(
            /create (?:a )?(?:new )?task (?:for )?(.+)/i,
            async (matches) => {
                const taskName = matches[1];
                await this.speak(`Creating task: ${taskName}`);
                this.emit({ type: 'command', data: { action: 'create_task', params: { name: taskName } } });
            },
            'Create a task'
        );

        // Start practice
        this.registerCommand(
            /start practice|begin practice|practice (?:mode)?/i,
            async () => {
                await this.speak('Starting practice session');
                this.emit({ type: 'command', data: { action: 'start_practice', params: {} } });
            },
            'Start practice session'
        );

        // Show schedule
        this.registerCommand(
            /show (?:my )?schedule|what's (?:on )?(?:my )?schedule/i,
            async () => {
                await this.speak('Showing your schedule');
                this.emit({ type: 'command', data: { action: 'show_schedule', params: {} } });
            },
            'Show schedule'
        );

        // Ask question (general AI chat)
        this.registerCommand(
            /(?:hey gemini|ok gemini|gemini),? (.+)/i,
            async (matches) => {
                const question = matches[1];
                await this.askGemini(question);
            },
            'Ask Gemini a question'
        );
    }

    /**
     * Register a voice command
     */
    registerCommand(pattern: RegExp, action: (matches: RegExpMatchArray) => Promise<void> | void, description: string) {
        this.commands.push({ pattern, action, description });
    }

    /**
     * Process voice command
     */
    private async processCommand(transcript: string) {
        // Try to match with registered commands
        for (const command of this.commands) {
            const matches = transcript.match(command.pattern);
            if (matches) {
                try {
                    await command.action(matches);
                    return;
                } catch (error) {
                    console.error('Command execution error:', error);
                    await this.speak('Sorry, I encountered an error executing that command');
                }
            }
        }

        // If no command matched, treat as general question
        await this.askGemini(transcript);
    }

    /**
     * Ask Gemini a question
     */
    private async askGemini(question: string) {
        if (!apiKeyManager.hasKey()) {
            await this.speak('Please set up your Gemini API key in settings to use AI features');
            return;
        }

        try {
            this.emit({ type: 'thinking', data: null });

            // Add to conversation history
            this.conversationHistory.push({ role: 'user', text: question });

            // Get response from Gemini
            const response = await apiKeyManager.chat(this.conversationHistory, {
                temperature: 0.7
            });

            // Add response to history
            this.conversationHistory.push({ role: 'model', text: response });

            // Limit history to last 10 messages
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }

            // Speak the response
            await this.speak(response);

            this.emit({ type: 'response', data: { question, response } });
        } catch (error: any) {
            console.error('Gemini error:', error);
            if (error.message === 'NO_API_KEY') {
                await this.speak('Please set up your Gemini API key in settings');
            } else {
                await this.speak('Sorry, I encountered an error. Please try again');
            }
        }
    }

    /**
     * Start listening
     */
    startListening() {
        if (!this.recognition) {
            console.error('Speech recognition not available');
            return;
        }

        if (this.isListening) {
            console.log('Already listening');
            return;
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    /**
     * Speak text using TTS
     */
    async speak(text: string): Promise<void> {
        if (!this.synthesis) {
            console.error('Speech synthesis not available');
            return;
        }

        // Cancel any ongoing speech
        this.synthesis.cancel();

        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onstart = () => {
                this.isSpeaking = true;
                this.emit({ type: 'speaking', data: { text } });
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.emit({ type: 'spoke', data: { text } });
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                this.isSpeaking = false;
                resolve();
            };

            this.synthesis.speak(utterance);
        });
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
        }
    }

    /**
     * Check if currently listening
     */
    getIsListening(): boolean {
        return this.isListening;
    }

    /**
     * Check if currently speaking
     */
    getIsSpeaking(): boolean {
        return this.isSpeaking;
    }

    /**
     * Check if voice features are supported
     */
    isSupported(): boolean {
        return this.recognition !== null && this.synthesis !== null;
    }

    /**
     * Subscribe to voice events
     */
    on(callback: (event: VoiceEvent) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Emit event to listeners
     */
    private emit(event: VoiceEvent) {
        this.listeners.forEach(listener => listener(event));
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get conversation history
     */
    getHistory(): Array<{ role: 'user' | 'model'; text: string }> {
        return [...this.conversationHistory];
    }

    /**
     * Get available commands
     */
    getCommands(): Array<{ pattern: string; description: string }> {
        return this.commands.map(cmd => ({
            pattern: cmd.pattern.source,
            description: cmd.description
        }));
    }
}

// Voice event types
type VoiceEvent =
    | { type: 'listening'; data: null }
    | { type: 'stopped'; data: null }
    | { type: 'recognized'; data: { transcript: string; confidence: number } }
    | { type: 'thinking'; data: null }
    | { type: 'speaking'; data: { text: string } }
    | { type: 'spoke'; data: { text: string } }
    | { type: 'response'; data: { question: string; response: string } }
    | { type: 'command'; data: { action: string; params: any } }
    | { type: 'error'; data: { error: string } };

// Export singleton instance
export const voiceAssistant = new GeminiVoiceAssistant();

// Export React hook
import { useState, useEffect } from 'react';

export const useVoiceAssistant = () => {
    const [isListening, setIsListening] = useState(voiceAssistant.getIsListening());
    const [isSpeaking, setIsSpeaking] = useState(voiceAssistant.getIsSpeaking());
    const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
    const [isSupported, setIsSupported] = useState(voiceAssistant.isSupported());

    useEffect(() => {
        const unsubscribe = voiceAssistant.on((event) => {
            setLastEvent(event);

            if (event.type === 'listening') {
                setIsListening(true);
            } else if (event.type === 'stopped') {
                setIsListening(false);
            } else if (event.type === 'speaking') {
                setIsSpeaking(true);
            } else if (event.type === 'spoke') {
                setIsSpeaking(false);
            }
        });

        return unsubscribe;
    }, []);

    return {
        isListening,
        isSpeaking,
        isSupported,
        lastEvent,
        startListening: () => voiceAssistant.startListening(),
        stopListening: () => voiceAssistant.stopListening(),
        speak: (text: string) => voiceAssistant.speak(text),
        stopSpeaking: () => voiceAssistant.stopSpeaking(),
        clearHistory: () => voiceAssistant.clearHistory(),
        getHistory: () => voiceAssistant.getHistory(),
        getCommands: () => voiceAssistant.getCommands(),
        registerCommand: (pattern: RegExp, action: (matches: RegExpMatchArray) => Promise<void> | void, description: string) =>
            voiceAssistant.registerCommand(pattern, action, description),
    };
};

export type { VoiceEvent };
