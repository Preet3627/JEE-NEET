# Critical Issues Fix Plan

## Issues Identified:

1. **Manual/Homework MCQ Start Practice Button Not Working**
2. **Server Says Saved But Nothing Actually Saves**
3. **Missing SQL Tables Auto-Creation**
4. **Need Massive Database Management System**
5. **On-Device AI Mode with Offline Support**
6. **Logged-in Users Get Backend Offline Error Instead of Offline Experience**
7. **Login Screen Shows #dashboard in URL**

## Solutions:

### 1. Fix Manual/Homework Practice Button

**Problem**: The `handleStartPractice` function in `CustomPracticeModal` tries to generate AI questions even for manual homework, which fails if AI is unavailable.

**Solution**: Allow manual practice to start without AI generation when answer key is provided.

### 2. Fix Server Save Issues

**Problem**: API calls succeed but data doesn't persist in database.

**Solution**: 
- Add database transaction handling
- Implement proper error logging
- Add data validation before save
- Implement auto-retry mechanism

### 3. Auto-Create Missing SQL Tables

**Solution**: Create database migration system that checks and creates missing tables on startup.

### 4. Implement Offline-First Architecture

**Solution**:
- Use IndexedDB for local storage
- Implement sync queue for offline operations
- Add conflict resolution
- Background sync when online

### 5. On-Device AI Mode

**Solution**:
- Integrate TensorFlow.js or ONNX Runtime
- Use lightweight models for offline inference
- Fallback to cloud AI when online

### 6. Fix Offline Experience for Logged-in Users

**Solution**:
- Detect network status properly
- Use cached data when offline
- Show offline indicator instead of error
- Queue operations for later sync

### 7. Fix Login Screen URL

**Solution**: Remove hash routing or implement proper routing without #dashboard

## Implementation Files:

- `utils/offlineManager.ts` - Offline data management
- `utils/dbManager.ts` - IndexedDB wrapper
- `utils/aiOffline.ts` - On-device AI
- `api/apiService.ts` - Enhanced with offline support
- `server/dbMigrations.ts` - Auto table creation
- Backend API improvements

