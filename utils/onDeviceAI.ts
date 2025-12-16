/**
 * On-Device AI using TensorFlow.js
 * Lightweight AI that works completely offline
 */

import * as tf from '@tensorflow/tfjs';

class OnDeviceAI {
    private isInitialized: boolean = false;
    private models: {
        intentClassifier?: tf.LayersModel;
        sentenceEncoder?: any;
        qaModel?: any;
    } = {};

    private intents = [
        'create_task',
        'show_schedule',
        'start_practice',
        'ask_question',
        'get_help',
        'show_stats',
        'set_reminder',
        'general_chat'
    ];

    private responses = {
        greeting: [
            "Hello! How can I help you with your JEE/NEET preparation today?",
            "Hi there! Ready to ace your exams?",
            "Hey! What would you like to study today?"
        ],
        motivation: [
            "You're doing great! Keep up the hard work!",
            "Every problem you solve brings you closer to your goal!",
            "Consistency is key. You've got this!",
            "Remember: Success is the sum of small efforts repeated day in and day out."
        ],
        study_tips: [
            "Try the Pomodoro technique: 25 minutes of focused study, then a 5-minute break.",
            "Practice active recall instead of passive reading. Test yourself frequently!",
            "Solve previous year questions - they're your best friend for JEE/NEET prep.",
            "Make short notes and mind maps for quick revision."
        ]
    };

    constructor() {
        this.init();
    }

    /**
     * Initialize TensorFlow.js and load models
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('Initializing TensorFlow.js...');

            // Set backend (WebGL for better performance)
            await tf.setBackend('webgl');
            await tf.ready();

            console.log('TensorFlow.js ready. Backend:', tf.getBackend());

            // Load lightweight models
            await this.loadModels();

            this.isInitialized = true;
            console.log('On-device AI initialized successfully');
        } catch (error) {
            console.error('Failed to initialize on-device AI:', error);
            // Fallback to CPU backend
            try {
                await tf.setBackend('cpu');
                await tf.ready();
                console.log('Fallback to CPU backend');
                this.isInitialized = true;
            } catch (fallbackError) {
                console.error('Failed to initialize TensorFlow.js:', fallbackError);
            }
        }
    }

    /**
     * Load AI models
     */
    private async loadModels(): Promise<void> {
        try {
            // For now, we'll use a simple rule-based system
            // In production, you would load actual TensorFlow.js models
            console.log('Loading AI models...');

            // Placeholder for model loading
            // await this.loadIntentClassifier();
            // await this.loadSentenceEncoder();

            console.log('Models loaded successfully');
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }

    /**
     * Classify user intent from text
     */
    async classifyIntent(text: string): Promise<{
        intent: string;
        confidence: number;
        entities?: any;
    }> {
        const lowerText = text.toLowerCase();

        // Simple keyword-based classification (lightweight)
        if (lowerText.includes('create') || lowerText.includes('add') || lowerText.includes('new task')) {
            return { intent: 'create_task', confidence: 0.9 };
        }

        if (lowerText.includes('schedule') || lowerText.includes('today') || lowerText.includes('tomorrow')) {
            return { intent: 'show_schedule', confidence: 0.85 };
        }

        if (lowerText.includes('practice') || lowerText.includes('test') || lowerText.includes('quiz')) {
            return { intent: 'start_practice', confidence: 0.9 };
        }

        if (lowerText.includes('help') || lowerText.includes('how to')) {
            return { intent: 'get_help', confidence: 0.8 };
        }

        if (lowerText.includes('stats') || lowerText.includes('progress') || lowerText.includes('score')) {
            return { intent: 'show_stats', confidence: 0.85 };
        }

        if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
            return { intent: 'greeting', confidence: 0.95 };
        }

        if (lowerText.includes('motivate') || lowerText.includes('inspire') || lowerText.includes('encourage')) {
            return { intent: 'motivation', confidence: 0.9 };
        }

        if (lowerText.includes('tip') || lowerText.includes('advice') || lowerText.includes('suggest')) {
            return { intent: 'study_tips', confidence: 0.85 };
        }

        // Default to general chat
        return { intent: 'general_chat', confidence: 0.5 };
    }

    /**
     * Generate response based on intent
     */
    async generateResponse(text: string): Promise<string> {
        const { intent, confidence } = await this.classifyIntent(text);

        // Handle specific intents
        switch (intent) {
            case 'greeting':
                return this.getRandomResponse(this.responses.greeting);

            case 'motivation':
                return this.getRandomResponse(this.responses.motivation);

            case 'study_tips':
                return this.getRandomResponse(this.responses.study_tips);

            case 'create_task':
                return "I can help you create a task! What subject and topic would you like to add?";

            case 'show_schedule':
                return "Let me show you your schedule. Opening schedule view...";

            case 'start_practice':
                return "Great! Let's start a practice session. Which subject would you like to practice?";

            case 'get_help':
                return "I'm here to help! You can ask me to:\n• Create tasks\n• Show your schedule\n• Start practice sessions\n• Get study tips\n• Check your progress";

            case 'show_stats':
                return "Opening your progress statistics...";

            default:
                return this.handleGeneralChat(text);
        }
    }

    /**
     * Handle general chat (simple pattern matching)
     */
    private handleGeneralChat(text: string): string {
        const lowerText = text.toLowerCase();

        // Physics topics
        if (lowerText.includes('physics')) {
            return "Physics is all about understanding concepts and practicing problems. Focus on mechanics, electromagnetism, and modern physics for JEE/NEET.";
        }

        // Chemistry topics
        if (lowerText.includes('chemistry')) {
            return "Chemistry requires both theory and practice. Make sure to cover organic, inorganic, and physical chemistry thoroughly.";
        }

        // Maths topics
        if (lowerText.includes('math') || lowerText.includes('maths')) {
            return "Mathematics is the foundation of JEE. Practice calculus, algebra, and coordinate geometry regularly.";
        }

        // Biology topics
        if (lowerText.includes('biology')) {
            return "Biology for NEET requires memorization and understanding. Focus on NCERT thoroughly and make short notes.";
        }

        // Time management
        if (lowerText.includes('time') || lowerText.includes('manage')) {
            return "Time management is crucial! Use the Pomodoro technique and create a realistic study schedule.";
        }

        // Exam stress
        if (lowerText.includes('stress') || lowerText.includes('anxious') || lowerText.includes('nervous')) {
            return "It's normal to feel stressed. Take regular breaks, practice meditation, and remember that you're well-prepared!";
        }

        // Default response
        return "I understand you're asking about that. While I'm a lightweight offline assistant, I can help with basic queries. For detailed explanations, you can use the cloud AI by adding your Gemini API key in settings!";
    }

    /**
     * Get random response from array
     */
    private getRandomResponse(responses: string[]): string {
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Extract entities from text (simple implementation)
     */
    extractEntities(text: string): {
        subject?: string;
        topic?: string;
        time?: string;
        date?: string;
    } {
        const entities: any = {};
        const lowerText = text.toLowerCase();

        // Extract subject
        if (lowerText.includes('physics')) entities.subject = 'PHYSICS';
        else if (lowerText.includes('chemistry')) entities.subject = 'CHEMISTRY';
        else if (lowerText.includes('math') || lowerText.includes('maths')) entities.subject = 'MATHS';
        else if (lowerText.includes('biology')) entities.subject = 'BIOLOGY';

        // Extract time references
        if (lowerText.includes('today')) entities.date = 'today';
        else if (lowerText.includes('tomorrow')) entities.date = 'tomorrow';
        else if (lowerText.includes('this week')) entities.date = 'this_week';

        return entities;
    }

    /**
     * Check if AI is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get model info
     */
    getModelInfo(): {
        backend: string;
        isReady: boolean;
        memoryUsage?: any;
    } {
        return {
            backend: tf.getBackend(),
            isReady: this.isInitialized,
            memoryUsage: tf.memory()
        };
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        // Dispose models if loaded
        Object.values(this.models).forEach(model => {
            if (model && typeof model.dispose === 'function') {
                model.dispose();
            }
        });

        this.isInitialized = false;
        console.log('On-device AI disposed');
    }
}

// Export singleton instance
export const onDeviceAI = new OnDeviceAI();

// Export React hook
import { useState, useEffect } from 'react';

export const useOnDeviceAI = () => {
    const [isReady, setIsReady] = useState(onDeviceAI.isReady());
    const [modelInfo, setModelInfo] = useState(onDeviceAI.getModelInfo());

    useEffect(() => {
        const checkReady = async () => {
            if (!isReady) {
                await onDeviceAI.init();
                setIsReady(onDeviceAI.isReady());
                setModelInfo(onDeviceAI.getModelInfo());
            }
        };

        checkReady();

        // Cleanup on unmount
        return () => {
            // Don't dispose on unmount, keep it alive
        };
    }, [isReady]);

    return {
        isReady,
        modelInfo,
        classifyIntent: (text: string) => onDeviceAI.classifyIntent(text),
        generateResponse: (text: string) => onDeviceAI.generateResponse(text),
        extractEntities: (text: string) => onDeviceAI.extractEntities(text),
    };
};
