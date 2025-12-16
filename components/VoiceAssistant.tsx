import React, { useState, useEffect } from 'react';
import { useVoiceAssistant } from '../utils/geminiVoice';
import { useAPIKey } from '../utils/apiKeyManager';
import Icon from './Icon';

interface VoiceAssistantProps {
    onCommand?: (action: string, params: any) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onCommand }) => {
    const {
        isListening,
        isSpeaking,
        isSupported,
        lastEvent,
        startListening,
        stopListening,
        stopSpeaking,
        getHistory,
        getCommands
    } = useVoiceAssistant();

    const { hasKey } = useAPIKey();
    const [isOpen, setIsOpen] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [showCommands, setShowCommands] = useState(false);

    // Handle voice events
    useEffect(() => {
        if (!lastEvent) return;

        switch (lastEvent.type) {
            case 'recognized':
                setTranscript(lastEvent.data.transcript);
                break;
            case 'response':
                setResponse(lastEvent.data.response);
                break;
            case 'command':
                if (onCommand) {
                    onCommand(lastEvent.data.action, lastEvent.data.params);
                }
                break;
        }
    }, [lastEvent, onCommand]);

    const handleToggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            setTranscript('');
            setResponse('');
            startListening();
        }
    };

    const handleStopSpeaking = () => {
        stopSpeaking();
    };

    if (!isSupported) {
        return null; // Don't show if not supported
    }

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isListening
                        ? 'bg-red-500 animate-pulse'
                        : isSpeaking
                            ? 'bg-blue-500 animate-pulse'
                            : hasKey
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                                : 'bg-gray-600'
                    } hover:scale-110 active:scale-95`}
                title={hasKey ? 'Voice Assistant' : 'Set API key to use voice assistant'}
            >
                {isListening ? (
                    <div className="w-4 h-4 bg-white rounded-full animate-ping" />
                ) : isSpeaking ? (
                    <Icon name="sound-wave" className="w-6 h-6 text-white" />
                ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
            </button>

            {/* Voice Assistant Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${hasKey ? 'bg-green-400' : 'bg-red-400'} ${isListening || isSpeaking ? 'animate-pulse' : ''}`} />
                            <h3 className="text-white font-bold">Gemini Assistant</h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/80 hover:text-white"
                        >
                            <Icon name="close" className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                        {!hasKey ? (
                            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                                <p className="text-yellow-200 text-sm">
                                    ⚠️ Please set your Gemini API key in Settings to use voice features
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Status */}
                                <div className="bg-gray-900/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Status</p>
                                    <p className="text-white font-semibold">
                                        {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '✅ Ready'}
                                    </p>
                                </div>

                                {/* Transcript */}
                                {transcript && (
                                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                                        <p className="text-xs text-purple-300 mb-1">You said:</p>
                                        <p className="text-white text-sm">{transcript}</p>
                                    </div>
                                )}

                                {/* Response */}
                                {response && (
                                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                        <p className="text-xs text-blue-300 mb-1">Gemini:</p>
                                        <p className="text-white text-sm">{response}</p>
                                    </div>
                                )}

                                {/* Commands */}
                                <div>
                                    <button
                                        onClick={() => setShowCommands(!showCommands)}
                                        className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-2"
                                    >
                                        <Icon name={showCommands ? 'chevron-down' : 'arrow-right'} className="w-4 h-4" />
                                        Available Commands
                                    </button>

                                    {showCommands && (
                                        <div className="mt-2 space-y-2">
                                            {getCommands().map((cmd, idx) => (
                                                <div key={idx} className="bg-gray-900/30 rounded p-2">
                                                    <p className="text-xs text-gray-400">{cmd.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Controls */}
                    {hasKey && (
                        <div className="p-4 border-t border-white/10 flex gap-2">
                            <button
                                onClick={handleToggleListening}
                                disabled={isSpeaking}
                                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${isListening
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isListening ? '⏹️ Stop' : '🎤 Start Listening'}
                            </button>

                            {isSpeaking && (
                                <button
                                    onClick={handleStopSpeaking}
                                    className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all"
                                >
                                    🔇 Stop Speaking
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default VoiceAssistant;
