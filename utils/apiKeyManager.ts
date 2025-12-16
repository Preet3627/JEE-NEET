/**
 * API Key Manager
 * Manages user's personal Gemini API key
 * Keys are stored locally and NEVER sent to our server
 */

const API_KEY_STORAGE_KEY = 'user_gemini_api_key';
const API_KEY_ENCRYPTED_STORAGE_KEY = 'user_gemini_api_key_encrypted';

class APIKeyManager {
    private apiKey: string | null = null;
    private isValid: boolean = false;

    constructor() {
        this.loadKey();
    }

    /**
     * Simple encryption (XOR with a key)
     * Note: This is basic obfuscation, not true encryption
     * For production, consider using Web Crypto API
     */
    private encrypt(text: string): string {
        const key = 'JEE_NEET_SCHEDULER_2024'; // Obfuscation key
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
            encrypted += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(encrypted); // Base64 encode
    }

    /**
     * Simple decryption
     */
    private decrypt(encrypted: string): string {
        const key = 'JEE_NEET_SCHEDULER_2024';
        try {
            const decoded = atob(encrypted);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(
                    decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return decrypted;
        } catch (error) {
            console.error('Failed to decrypt API key:', error);
            return '';
        }
    }

    /**
     * Load API key from localStorage
     */
    private loadKey(): void {
        try {
            // Try encrypted storage first
            const encrypted = localStorage.getItem(API_KEY_ENCRYPTED_STORAGE_KEY);
            if (encrypted) {
                this.apiKey = this.decrypt(encrypted);
                return;
            }

            // Fallback to plain storage (for migration)
            const plain = localStorage.getItem(API_KEY_STORAGE_KEY);
            if (plain) {
                this.apiKey = plain;
                // Migrate to encrypted storage
                this.saveKey(plain);
                localStorage.removeItem(API_KEY_STORAGE_KEY);
            }
        } catch (error) {
            console.error('Failed to load API key:', error);
        }
    }

    /**
     * Save API key to localStorage (encrypted)
     */
    saveKey(key: string): void {
        if (!key || key.trim().length === 0) {
            this.clearKey();
            return;
        }

        this.apiKey = key.trim();
        const encrypted = this.encrypt(this.apiKey);
        localStorage.setItem(API_KEY_ENCRYPTED_STORAGE_KEY, encrypted);

        // Remove plain storage if exists
        localStorage.removeItem(API_KEY_STORAGE_KEY);

        console.log('API key saved (encrypted)');
    }

    /**
     * Get API key
     */
    getKey(): string | null {
        return this.apiKey;
    }

    /**
     * Check if API key is set
     */
    hasKey(): boolean {
        return this.apiKey !== null && this.apiKey.length > 0;
    }

    /**
     * Clear API key
     */
    clearKey(): void {
        this.apiKey = null;
        this.isValid = false;
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        localStorage.removeItem(API_KEY_ENCRYPTED_STORAGE_KEY);
        console.log('API key cleared');
    }

    /**
     * Validate API key by making a test request
     */
    async validateKey(key?: string): Promise<boolean> {
        const keyToValidate = key || this.apiKey;

        if (!keyToValidate) {
            this.isValid = false;
            return false;
        }

        try {
            // Make a simple test request to Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${keyToValidate}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: 'Hello'
                            }]
                        }]
                    })
                }
            );

            if (response.ok) {
                this.isValid = true;
                console.log('API key is valid');
                return true;
            } else {
                this.isValid = false;
                console.error('API key validation failed:', response.status);
                return false;
            }
        } catch (error) {
            this.isValid = false;
            console.error('API key validation error:', error);
            return false;
        }
    }

    /**
     * Check if key is valid (cached result)
     */
    isKeyValid(): boolean {
        return this.isValid;
    }

    /**
     * Make a request to Gemini API with user's key
     */
    async makeGeminiRequest(
        endpoint: string,
        data: any,
        options: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
        } = {}
    ): Promise<any> {
        if (!this.hasKey()) {
            throw new Error('NO_API_KEY');
        }

        const model = options.model || 'gemini-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...data,
                    generationConfig: {
                        temperature: options.temperature || 0.7,
                        maxOutputTokens: options.maxTokens || 2048,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Gemini API request failed:', error);
            throw error;
        }
    }

    /**
     * Generate text with Gemini
     */
    async generateText(prompt: string, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        const response = await this.makeGeminiRequest(
            'generateContent',
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            options
        );

        return response.candidates[0]?.content?.parts[0]?.text || '';
    }

    /**
     * Chat with Gemini (with history)
     */
    async chat(
        messages: Array<{ role: 'user' | 'model'; text: string }>,
        options?: {
            model?: string;
            temperature?: number;
        }
    ): Promise<string> {
        const contents = messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        const response = await this.makeGeminiRequest(
            'generateContent',
            { contents },
            options
        );

        return response.candidates[0]?.content?.parts[0]?.text || '';
    }

    /**
     * Generate content with image
     */
    async generateWithImage(
        prompt: string,
        imageBase64: string,
        options?: {
            model?: string;
        }
    ): Promise<string> {
        const response = await this.makeGeminiRequest(
            'generateContent',
            {
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imageBase64
                            }
                        }
                    ]
                }]
            },
            { ...options, model: options?.model || 'gemini-pro-vision' }
        );

        return response.candidates[0]?.content?.parts[0]?.text || '';
    }

    /**
     * Get API key info (for display)
     */
    getKeyInfo(): {
        hasKey: boolean;
        isValid: boolean;
        keyPreview: string;
    } {
        return {
            hasKey: this.hasKey(),
            isValid: this.isValid,
            keyPreview: this.apiKey
                ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
                : ''
        };
    }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager();

// Export React hook
import { useState, useEffect } from 'react';

export const useAPIKey = () => {
    const [hasKey, setHasKey] = useState(apiKeyManager.hasKey());
    const [isValid, setIsValid] = useState(apiKeyManager.isKeyValid());
    const [keyInfo, setKeyInfo] = useState(apiKeyManager.getKeyInfo());

    useEffect(() => {
        // Update state when key changes
        const updateState = () => {
            setHasKey(apiKeyManager.hasKey());
            setIsValid(apiKeyManager.isKeyValid());
            setKeyInfo(apiKeyManager.getKeyInfo());
        };

        // Listen for storage changes (if key is updated in another tab)
        window.addEventListener('storage', updateState);
        return () => window.removeEventListener('storage', updateState);
    }, []);

    const saveKey = async (key: string) => {
        apiKeyManager.saveKey(key);
        const valid = await apiKeyManager.validateKey();
        setHasKey(apiKeyManager.hasKey());
        setIsValid(valid);
        setKeyInfo(apiKeyManager.getKeyInfo());
        return valid;
    };

    const clearKey = () => {
        apiKeyManager.clearKey();
        setHasKey(false);
        setIsValid(false);
        setKeyInfo(apiKeyManager.getKeyInfo());
    };

    const validateKey = async () => {
        const valid = await apiKeyManager.validateKey();
        setIsValid(valid);
        return valid;
    };

    return {
        hasKey,
        isValid,
        keyInfo,
        saveKey,
        clearKey,
        validateKey,
        generateText: apiKeyManager.generateText.bind(apiKeyManager),
        chat: apiKeyManager.chat.bind(apiKeyManager),
        generateWithImage: apiKeyManager.generateWithImage.bind(apiKeyManager),
    };
};
