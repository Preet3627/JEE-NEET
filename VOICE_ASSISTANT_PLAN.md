# Gemini Voice Assistant & API Key Management - Implementation Plan

## Overview

This implementation will:
1. ✅ Remove global AI API key dependency
2. ✅ Require users to provide their own Gemini API key
3. ✅ Integrate Gemini Voice Assistant (PWA compatible)
4. ✅ Ensure app works natively without any AI

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    JEE-NEET Scheduler                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Core App (Works Without AI)              │   │
│  │  - Schedule Management                           │   │
│  │  - Offline Storage                               │   │
│  │  - Manual Practice                               │   │
│  │  - Flashcards                                    │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Optional: User's Gemini API Key               │   │
│  │  (Stored locally, never sent to our server)      │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │         AI Features (Optional)                   │   │
│  │  - Voice Assistant                               │   │
│  │  - Question Generation                           │   │
│  │  - Smart Parsing                                 │   │
│  │  - Doubt Solving                                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Remove Global API Key ✅
- Remove server-side Gemini API key
- Update API endpoints to require user key
- Add validation for user-provided keys

### Phase 2: User API Key Management ✅
- Add API key input in settings
- Store key locally (encrypted)
- Validate key before use
- Show AI features only when key is valid

### Phase 3: Gemini Voice Assistant ✅
- Integrate Web Speech API
- Connect to Gemini API directly from browser
- Add voice commands
- Add text-to-speech responses

### Phase 4: PWA Enhancements ✅
- Add voice assistant to PWA
- Implement wake word detection
- Add voice shortcuts
- Optimize for mobile

## Security Considerations

1. **API Key Storage**:
   - Store in localStorage (encrypted)
   - Never send to our server
   - Clear on logout

2. **Direct API Calls**:
   - Call Gemini API directly from browser
   - Use CORS-enabled endpoints
   - Implement rate limiting client-side

3. **Privacy**:
   - Voice data processed by Google (user's choice)
   - No voice data stored on our servers
   - User controls when to use voice

## Files to Create/Modify

### New Files:
1. `utils/geminiVoice.ts` - Voice assistant logic
2. `components/VoiceAssistant.tsx` - Voice UI component
3. `utils/apiKeyManager.ts` - API key management
4. `hooks/useVoiceAssistant.ts` - Voice assistant hook

### Modified Files:
1. `api/apiService.ts` - Update to use user API key
2. `components/SettingsModal.tsx` - Add API key input
3. `App.tsx` - Add voice assistant
4. `context/AuthContext.tsx` - Store API key preference

