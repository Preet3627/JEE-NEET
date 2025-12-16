# Data Handling Migration Checklist

## Phase 1: Setup & Testing (Immediate)

### ✅ Step 1: Review Documentation
- [ ] Read `DATA_HANDLING_SUMMARY.md`
- [ ] Review `DATA_HANDLING_IMPROVEMENTS.md`
- [ ] Bookmark `DATA_HANDLING_QUICK_REFERENCE.md`

### ✅ Step 2: Test New Utilities
- [ ] Import `useAppStore` in a test component
- [ ] Try `addScheduleItem()` with valid data
- [ ] Try `addScheduleItem()` with invalid data (should log error)
- [ ] Test `cleanupDuplicates()` function
- [ ] Test `sortScheduleItems()` function

### ✅ Step 3: Run Initial Cleanup
Add to your App.tsx or main component:
```typescript
useEffect(() => {
    const { cleanupDuplicates, sortScheduleItems } = useAppStore.getState();
    
    // Clean up any existing duplicates
    cleanupDuplicates();
    
    // Sort items for better organization
    sortScheduleItems();
    
    console.log('Data cleanup complete');
}, []);
```

## Phase 2: Gradual Migration (This Week)

### ✅ Step 4: Update Schedule Operations
Replace direct mutations with store actions:

**Find and replace:**
- [ ] `currentUser.SCHEDULE_ITEMS.push(item)` → `addScheduleItem(item)`
- [ ] `currentUser.SCHEDULE_ITEMS = [...items, newItem]` → `addScheduleItem(newItem)`
- [ ] Manual array updates → `updateScheduleItem(id, updates)`
- [ ] Manual array filters → `deleteScheduleItem(id)`

**Files to check:**
- [ ] `App.tsx`
- [ ] `StudentDashboard.tsx`
- [ ] `CreateEditTaskModal.tsx`
- [ ] `AIParserModal.tsx`

### ✅ Step 5: Update Exam Operations
- [ ] Replace direct EXAMS array mutations
- [ ] Use `addExam()`, `updateExam()`, `deleteExam()`

**Files to check:**
- [ ] `App.tsx`
- [ ] `ExamsView.tsx`
- [ ] `CreateEditExamModal.tsx`

### ✅ Step 6: Update Result Operations
- [ ] Replace direct RESULTS array mutations
- [ ] Use `addResult()`, `updateResult()`, `deleteResult()`

**Files to check:**
- [ ] `App.tsx`
- [ ] `LogResultModal.tsx`
- [ ] `MistakeManager.tsx`

### ✅ Step 7: Update Flashcard Operations
- [ ] Replace direct flashcardDecks mutations
- [ ] Use `addFlashcardDeck()`, `updateFlashcardDeck()`, `deleteFlashcardDeck()`

**Files to check:**
- [ ] `FlashcardManager.tsx`
- [ ] `CreateEditDeckModal.tsx`
- [ ] `AIGenerateFlashcardsModal.tsx`

## Phase 3: Optimization (Next Week)

### ✅ Step 8: Use Filtering Utilities
Replace custom filters with built-in utilities:

```typescript
// Before
const todayItems = items.filter(item => {
    const today = new Date().toISOString().split('T')[0];
    return item.date === today || item.DAY.EN === ...;
});

// After
import { filterTodayScheduleItems } from './utils/dataHandlers';
const todayItems = filterTodayScheduleItems(items);
```

**Files to check:**
- [ ] `TodayPlanner.tsx`
- [ ] `ScheduleList.tsx`
- [ ] `TodaysAgendaWidget.tsx`

### ✅ Step 9: Use Sorting Utilities
Replace custom sorting with built-in utilities:

```typescript
// Before
const sorted = [...items].sort((a, b) => ...complex logic...);

// After
import { sortScheduleItemsByDate } from './utils/dataHandlers';
const sorted = sortScheduleItemsByDate(items);
```

**Files to check:**
- [ ] `ScheduleList.tsx`
- [ ] `PlannerView.tsx`

### ✅ Step 10: Add Validation to Imports
Add validation to data import functions:

```typescript
// In AIParserModal.tsx
import { validateScheduleItem } from './utils/dataHandlers';

const validItems = parsedItems.filter(validateScheduleItem);
if (validItems.length !== parsedItems.length) {
    console.warn(`Filtered out ${parsedItems.length - validItems.length} invalid items`);
}
batchAddScheduleItems(validItems);
```

**Files to check:**
- [ ] `AIParserModal.tsx`
- [ ] `DeepLinkConfirmationModal.tsx`
- [ ] Any data import functions

## Phase 4: Testing & Verification (End of Week)

### ✅ Step 11: Test All Features
- [ ] Create new schedule items
- [ ] Edit existing items
- [ ] Delete items
- [ ] Batch import data
- [ ] Test with AI parser
- [ ] Test with non-AI parser
- [ ] Create exams
- [ ] Log results
- [ ] Create flashcard decks

### ✅ Step 12: Test Edge Cases
- [ ] Try adding invalid data
- [ ] Try adding duplicate items
- [ ] Import large datasets
- [ ] Test with empty data
- [ ] Test with malformed JSON

### ✅ Step 13: Performance Testing
- [ ] Check app startup time
- [ ] Monitor memory usage
- [ ] Test with 100+ schedule items
- [ ] Test filtering performance
- [ ] Test sorting performance

### ✅ Step 14: Data Integrity Check
Run these checks in console:

```typescript
const { currentUser } = useAppStore.getState();

// Check for duplicates
const ids = currentUser.SCHEDULE_ITEMS.map(i => i.ID);
const hasDuplicates = ids.length !== new Set(ids).size;
console.log('Has duplicates:', hasDuplicates);

// Check for invalid items
import { validateScheduleItem } from './utils/dataHandlers';
const invalid = currentUser.SCHEDULE_ITEMS.filter(i => !validateScheduleItem(i));
console.log('Invalid items:', invalid.length);

// Check data counts
console.log('Schedule items:', currentUser.SCHEDULE_ITEMS.length);
console.log('Exams:', currentUser.EXAMS.length);
console.log('Results:', currentUser.RESULTS.length);
```

## Phase 5: Cleanup & Documentation (Optional)

### ✅ Step 15: Remove Old Code
- [ ] Remove unused validation functions
- [ ] Remove manual deduplication code
- [ ] Remove custom sorting functions
- [ ] Clean up imports

### ✅ Step 16: Add Comments
Add comments to help other developers:

```typescript
// Using enhanced store action - automatically validates and deduplicates
addScheduleItem(newItem);
```

### ✅ Step 17: Update Team Documentation
- [ ] Share migration guide with team
- [ ] Update coding standards
- [ ] Add to onboarding docs

## Verification Checklist

After migration, verify:

- [ ] ✅ No TypeScript errors
- [ ] ✅ No console errors
- [ ] ✅ All features working
- [ ] ✅ No duplicate items
- [ ] ✅ Data properly sorted
- [ ] ✅ Validation working
- [ ] ✅ Import/export working
- [ ] ✅ Performance acceptable

## Rollback Plan

If issues occur:

1. **Immediate**: Comment out new code, revert to old methods
2. **Check**: Review console for specific errors
3. **Fix**: Address specific issues
4. **Test**: Verify fix works
5. **Continue**: Resume migration

## Common Issues & Solutions

### Issue: TypeScript errors after migration
**Solution**: Ensure you're importing from the correct paths:
```typescript
import { useAppStore } from './store/useAppStore';
import { validateScheduleItem } from './utils/dataHandlers';
```

### Issue: Data not updating in UI
**Solution**: Make sure you're using Zustand selectors correctly:
```typescript
const items = useAppStore(state => state.currentUser?.SCHEDULE_ITEMS || []);
```

### Issue: Validation rejecting valid data
**Solution**: Check console for specific validation errors and adjust data format

### Issue: Performance degradation
**Solution**: Use selective subscriptions and memoization:
```typescript
const items = useAppStore(state => state.currentUser?.SCHEDULE_ITEMS || []);
const memoizedItems = useMemo(() => filterTodayScheduleItems(items), [items]);
```

## Success Criteria

Migration is complete when:

- ✅ All direct mutations replaced with store actions
- ✅ All data operations use validation
- ✅ No duplicates in data
- ✅ Data properly sorted
- ✅ All tests passing
- ✅ No performance regressions
- ✅ Team trained on new system

## Timeline

- **Day 1**: Setup & Testing (Phase 1)
- **Days 2-3**: Schedule & Exam Operations (Phase 2, Steps 4-5)
- **Days 4-5**: Results & Flashcards (Phase 2, Steps 6-7)
- **Days 6-7**: Optimization (Phase 3)
- **Day 8**: Testing & Verification (Phase 4)
- **Day 9**: Cleanup (Phase 5)
- **Day 10**: Buffer for issues

## Need Help?

- 📖 Check `DATA_HANDLING_QUICK_REFERENCE.md`
- 📚 Review `DATA_HANDLING_IMPROVEMENTS.md`
- 🐛 Check console for validation errors
- 💬 Ask team for help

---

**Remember**: This is a gradual migration. Take your time, test thoroughly, and don't hesitate to rollback if needed!

Good luck! 🚀
