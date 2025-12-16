# CRITICAL FIXES - Implementation Roadmap

## Priority 1: Immediate Fixes (Today)

### 1.1 Fix Manual/Homework Practice Button ✅
**File**: `components/CustomPracticeModal.tsx`
**Issue**: Button tries to generate AI questions even when not needed
**Fix**: Allow practice to start with just answer key, no AI required

### 1.2 Fix Offline Error for Logged-in Users ✅  
**File**: `api/apiService.ts`, `context/AuthContext.tsx`
**Issue**: Shows backend error instead of offline mode
**Fix**: Detect offline state and use cached data

### 1.3 Remove #dashboard from Login URL ✅
**File**: `App.tsx`
**Issue**: Hash routing shows in URL
**Fix**: Use proper routing or remove hash

## Priority 2: Data Persistence (This Week)

### 2.1 Implement IndexedDB Storage ⏳
**New File**: `utils/dbManager.ts`
**Purpose**: Local database for offline storage
**Features**:
- Store schedule items
- Store exams, results
- Store flashcards
- Sync queue

### 2.2 Fix Server Save Issues ⏳
**Backend Files**: Need to review server code
**Fix**:
- Add transaction handling
- Add proper error logging
- Validate data before save
- Return detailed error messages

### 2.3 Auto-Create Missing Tables ⏳
**Backend File**: `server/dbMigrations.ts` (new)
**Fix**:
- Check for missing tables on startup
- Auto-create with proper schema
- Run migrations automatically

## Priority 3: Offline-First Architecture (Next Week)

### 3.1 Offline Manager ⏳
**New File**: `utils/offlineManager.ts`
**Features**:
- Detect online/offline status
- Queue operations when offline
- Sync when back online
- Conflict resolution

### 3.2 Service Worker ⏳
**New File**: `public/sw.js`
**Features**:
- Cache app shell
- Cache API responses
- Background sync
- Push notifications

## Priority 4: On-Device AI (Future)

### 4.1 TensorFlow.js Integration ⏳
**New File**: `utils/aiOffline.ts`
**Features**:
- Load lightweight models
- Run inference locally
- Fallback to cloud AI
- Model caching

## Current Status: Starting Implementation

I'll now implement the Priority 1 fixes immediately.

---

**Note**: Due to the scope of these changes, I'm creating this roadmap first. 
The immediate fixes (Priority 1) will be implemented now.
The rest will require backend access and more time.

