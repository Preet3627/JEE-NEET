/**
 * Hybrid AI System
 * Intelligently switches between on-device AI and cloud AI
 * Provides seamless experience with smart fallback
 */

import { onDeviceAI } from './onDeviceAI';
import { apiKeyManager } from './apiKeyManager';
import { offlineManager } from './offlineManager';

type AIMode = 'on-device' | 'cloud' | 'hybrid';

class HybridAI {
    private mode: AIMode = 'hybrid';
    private preferOnDevice: boolean = true;

    constructor() {
        this.init();
    }

    /**
     * Initialize hybrid AI
     */
    private async init() {
        // Initialize on-device AI
        await onDeviceAI.init();
        console.log('Hybrid AI initialized');
    }

    /**
     * Set AI mode
     */
    setMode(mode: AIMode) {
        this.mode = mode;
        console.log('AI mode set to:', mode);
    }

    /**
     * Get current mode
     */
    getMode(): AIMode {
        return this.mode;
    }

    /**
     * Set preference for on-device AI
     */
    setPreferOnDevice(prefer: boolean) {
        this.preferOnDevice = prefer;
    }

    /**
     * Determine which AI to use
     */
    private shouldUseCloudAI(complexity: 'simple' | 'medium' | 'complex'): boolean {
        // Force on-device mode
        if (this.mode === 'on-device') {
            return false;
        }

        // Force cloud mode
        if (this.mode === 'cloud') {
            return apiKeyManager.hasKey() && offlineManager.isOnline();
        }

        // Hybrid mode logic
        if (!apiKeyManager.hasKey() || offlineManager.isOffline()) {
            return false; // Must use on-device
        }

        // Use cloud for complex tasks if available
        if (complexity === 'complex' && !this.preferOnDevice) {
            return true;
        }

        // Default to on-device for simple/medium tasks
        return false;
    }

    /**
     * Chat with AI (auto-selects best option)
     */
    async chat(message: string, options?: {
        complexity?: 'simple' | 'medium' | 'complex';
        forceCloud?: boolean;
        forceOnDevice?: boolean;
    }): Promise<{
        response: string;
        usedAI: 'on-device' | 'cloud';
        confidence?: number;
    }> {
        const complexity = options?.complexity || 'medium';

        // Force cloud if requested and available
        if (options?.forceCloud && apiKeyManager.hasKey() && offlineManager.isOnline()) {
            try {
                const response = await apiKeyManager.generateText(message);
                return { response, usedAI: 'cloud' };
            } catch (error) {
                console.error('Cloud AI failed, falling back to on-device:', error);
                // Fall through to on-device
            }
        }

        // Force on-device if requested
        if (options?.forceOnDevice || !this.shouldUseCloudAI(complexity)) {
            const response = await onDeviceAI.generateResponse(message);
            return { response, usedAI: 'on-device' };
        }

        // Try cloud first, fallback to on-device
        try {
            const response = await apiKeyManager.generateText(message);
            return { response, usedAI: 'cloud' };
        } catch (error) {
            console.error('Cloud AI failed, using on-device:', error);
            const response = await onDeviceAI.generateResponse(message);
            return { response, usedAI: 'on-device' };
        }
    }

    /**
     * Classify intent (always use on-device for speed)
     */
    async classifyIntent(text: string): Promise<{
        intent: string;
        confidence: number;
        entities?: any;
    }> {
        return onDeviceAI.classifyIntent(text);
    }

    /**
     * Generate questions (prefer cloud for quality)
     */
    async generateQuestions(topic: string, count: number, options?: {
        difficulty?: string;
        questionTypes?: string[];
    }): Promise<any> {
        if (!apiKeyManager.hasKey() || offlineManager.isOffline()) {
            throw new Error('Question generation requires cloud AI. Please add your API key and connect to the internet.');
        }

        try {
            const prompt = `Generate ${count} ${options?.difficulty || 'medium'} difficulty questions on ${topic} for JEE/NEET preparation. Include answers.`;
            const response = await apiKeyManager.generateText(prompt);
            return { questions: response, usedAI: 'cloud' };
        } catch (error) {
            throw new Error('Failed to generate questions: ' + (error as Error).message);
        }
    }

    /**
     * Analyze image (requires cloud AI)
     */
    async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
        if (!apiKeyManager.hasKey() || offlineManager.isOffline()) {
            throw new Error('Image analysis requires cloud AI. Please add your API key and connect to the internet.');
        }

        try {
            return await apiKeyManager.generateWithImage(prompt, imageBase64);
        } catch (error) {
            throw new Error('Failed to analyze image: ' + (error as Error).message);
        }
    }

    /**
     * Get study suggestions (hybrid approach)
     */
    async getStudySuggestions(subject: string, weaknesses?: string[]): Promise<string> {
        const complexity = weaknesses && weaknesses.length > 0 ? 'complex' : 'simple';

        const message = weaknesses && weaknesses.length > 0
            ? `I'm struggling with ${weaknesses.join(', ')} in ${subject}. Can you suggest a study plan?`
            : `Can you suggest study tips for ${subject}?`;

        const result = await this.chat(message, { complexity });
        return result.response;
    }

    /**
     * Solve doubt (prefer cloud for detailed explanations)
     */
    async solveDoubt(question: string, imageBase64?: string): Promise<{
        response: string;
        usedAI: 'on-device' | 'cloud';
    }> {
        // If image provided, must use cloud
        if (imageBase64) {
            if (!apiKeyManager.hasKey() || offlineManager.isOffline()) {
                return {
                    response: "Image-based doubt solving requires cloud AI. Please add your API key in settings.",
                    usedAI: 'on-device'
                };
            }

            try {
                const response = await this.analyzeImage(imageBase64, `Solve this problem: ${question}`);
                return { response, usedAI: 'cloud' };
            } catch (error) {
                return {
                    response: "Failed to analyze image. Please try again or use text-only mode.",
                    usedAI: 'on-device'
                };
            }
        }

        // Text-only doubt
        return this.chat(question, { complexity: 'complex' });
    }

    /**
     * Get AI capabilities
     */
    getCapabilities(): {
        onDevice: string[];
        cloud: string[];
        current: string[];
    } {
        const onDeviceCapabilities = [
            'Basic Q&A',
            'Intent classification',
            'Simple chat',
            'Study tips',
            'Motivation',
            'Command recognition'
        ];

        const cloudCapabilities = [
            'Advanced Q&A',
            'Question generation',
            'Image analysis',
            'Detailed explanations',
            'Complex problem solving',
            'Personalized study plans'
        ];

        const hasCloudAccess = apiKeyManager.hasKey() && offlineManager.isOnline();

        return {
            onDevice: onDeviceCapabilities,
            cloud: cloudCapabilities,
            current: hasCloudAccess
                ? [...onDeviceCapabilities, ...cloudCapabilities]
                : onDeviceCapabilities
        };
    }

    /**
     * Get AI status
     */
    getStatus(): {
        mode: AIMode;
        onDeviceReady: boolean;
        cloudAvailable: boolean;
        isOnline: boolean;
        hasApiKey: boolean;
    } {
        return {
            mode: this.mode,
            onDeviceReady: onDeviceAI.isReady(),
            cloudAvailable: apiKeyManager.hasKey() && offlineManager.isOnline(),
            isOnline: offlineManager.isOnline(),
            hasApiKey: apiKeyManager.hasKey()
        };
    }
}

// Export singleton instance
export const hybridAI = new HybridAI();

// Export React hook
import { useState, useEffect } from 'react';

export const useHybridAI = () => {
    const [status, setStatus] = useState(hybridAI.getStatus());
    const [capabilities, setCapabilities] = useState(hybridAI.getCapabilities());

    useEffect(() => {
        // Update status periodically
        const interval = setInterval(() => {
            setStatus(hybridAI.getStatus());
            setCapabilities(hybridAI.getCapabilities());
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return {
        status,
        capabilities,
        chat: (message: string, options?: any) => hybridAI.chat(message, options),
        classifyIntent: (text: string) => hybridAI.classifyIntent(text),
        generateQuestions: (topic: string, count: number, options?: any) =>
            hybridAI.generateQuestions(topic, count, options),
        analyzeImage: (imageBase64: string, prompt: string) =>
            hybridAI.analyzeImage(imageBase64, prompt),
        getStudySuggestions: (subject: string, weaknesses?: string[]) =>
            hybridAI.getStudySuggestions(subject, weaknesses),
        solveDoubt: (question: string, imageBase64?: string) =>
            hybridAI.solveDoubt(question, imageBase64),
        setMode: (mode: AIMode) => hybridAI.setMode(mode),
        setPreferOnDevice: (prefer: boolean) => hybridAI.setPreferOnDevice(prefer),
    };
};

export type { AIMode };
