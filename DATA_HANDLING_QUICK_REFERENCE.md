# Data Handling Quick Reference

## Import Statements

```typescript
// For store actions
import { useAppStore } from './store/useAppStore';

// For utility functions
import { 
    validateScheduleItem,
    sanitizeScheduleItem,
    deduplicateScheduleItems,
    sortScheduleItemsByDate,
    filterTodayScheduleItems,
    filterUpcomingScheduleItems,
    mergeScheduleItems
} from './utils/dataHandlers';
```

## Common Operations

### 1. Add a Single Item

```typescript
const { addScheduleItem } = useAppStore();

addScheduleItem({
    ID: `A${Date.now()}`,
    type: 'ACTION',
    DAY: { EN: 'MONDAY', GU: '' },
    TIME: '14:00',
    CARD_TITLE: { EN: 'Study Physics', GU: '' },
    FOCUS_DETAIL: { EN: 'Chapter 5', GU: '' },
    SUBJECT_TAG: { EN: 'PHYSICS', GU: '' },
    SUB_TYPE: 'DEEP_DIVE',
    isUserCreated: true
});
```

### 2. Update an Item

```typescript
const { updateScheduleItem } = useAppStore();

updateScheduleItem('ITEM_ID', {
    TIME: '15:00',
    CARD_TITLE: { EN: 'Updated Title', GU: '' }
});
```

### 3. Delete an Item

```typescript
const { deleteScheduleItem } = useAppStore();

deleteScheduleItem('ITEM_ID');
```

### 4. Batch Add Items

```typescript
const { batchAddScheduleItems } = useAppStore();

const items = [item1, item2, item3];
batchAddScheduleItems(items);
```

### 5. Batch Delete Items

```typescript
const { batchDeleteScheduleItems } = useAppStore();

const ids = ['ID1', 'ID2', 'ID3'];
batchDeleteScheduleItems(ids);
```

### 6. Get Today's Items

```typescript
const { currentUser } = useAppStore();
const todayItems = filterTodayScheduleItems(currentUser.SCHEDULE_ITEMS);
```

### 7. Get Upcoming Items

```typescript
const { currentUser } = useAppStore();
const upcomingItems = filterUpcomingScheduleItems(currentUser.SCHEDULE_ITEMS);
```

### 8. Sort Items

```typescript
const { sortScheduleItems } = useAppStore();

sortScheduleItems(); // Sorts in-place
```

### 9. Clean Duplicates

```typescript
const { cleanupDuplicates } = useAppStore();

cleanupDuplicates(); // Removes all duplicates
```

### 10. Validate Before Adding

```typescript
import { validateScheduleItem } from './utils/dataHandlers';

if (validateScheduleItem(item)) {
    addScheduleItem(item);
} else {
    console.error('Invalid item');
}
```

## Exam Operations

```typescript
const { addExam, updateExam, deleteExam } = useAppStore();

// Add
addExam({
    ID: `E${Date.now()}`,
    title: 'JEE Main 2024',
    subject: 'FULL',
    date: '2024-01-15',
    time: '09:00',
    syllabus: 'Full syllabus'
});

// Update
updateExam('EXAM_ID', { time: '10:00' });

// Delete
deleteExam('EXAM_ID');
```

## Result Operations

```typescript
const { addResult, updateResult, deleteResult } = useAppStore();

// Add
addResult({
    ID: `R${Date.now()}`,
    DATE: '2024-01-15',
    SCORE: '270/300',
    MISTAKES: ['5', '12', '23']
});

// Update
updateResult('RESULT_ID', { 
    FIXED_MISTAKES: ['5'] 
});

// Delete
deleteResult('RESULT_ID');
```

## Flashcard Operations

```typescript
const { addFlashcardDeck, updateFlashcardDeck, deleteFlashcardDeck } = useAppStore();

// Add
addFlashcardDeck({
    id: `deck_${Date.now()}`,
    name: 'Physics Formulas',
    subject: 'Physics',
    cards: [
        { id: '1', front: 'F = ma', back: 'Newton\'s Second Law' }
    ],
    isLocked: false
});

// Update
updateFlashcardDeck('DECK_ID', { 
    name: 'Updated Name' 
});

// Delete
deleteFlashcardDeck('DECK_ID');
```

## Data Filtering Patterns

### Filter by Subject

```typescript
const { currentUser } = useAppStore();
const physicsItems = currentUser.SCHEDULE_ITEMS.filter(
    item => item.SUBJECT_TAG.EN === 'PHYSICS'
);
```

### Filter by Type

```typescript
const homeworkItems = currentUser.SCHEDULE_ITEMS.filter(
    item => item.type === 'HOMEWORK'
);
```

### Filter by Date Range

```typescript
const startDate = '2024-01-01';
const endDate = '2024-01-31';

const itemsInRange = currentUser.SCHEDULE_ITEMS.filter(item => {
    if ('date' in item && item.date) {
        return item.date >= startDate && item.date <= endDate;
    }
    return false;
});
```

### Filter Starred Items

```typescript
const starredItems = currentUser.SCHEDULE_ITEMS.filter(
    item => item.isStarred
);
```

## Error Handling

```typescript
try {
    addScheduleItem(newItem);
} catch (error) {
    console.error('Failed to add item:', error);
    // Handle error (show notification, etc.)
}
```

## Performance Tips

1. **Use batch operations** when adding/deleting multiple items
2. **Filter on the client side** for small datasets
3. **Memoize filtered results** in components
4. **Run cleanup on app start** to remove duplicates
5. **Sort only when needed** - sorting is expensive

## Common Pitfalls

❌ **DON'T** mutate state directly:
```typescript
currentUser.SCHEDULE_ITEMS.push(newItem); // BAD!
```

✅ **DO** use store actions:
```typescript
addScheduleItem(newItem); // GOOD!
```

❌ **DON'T** forget to validate:
```typescript
addScheduleItem(untrustedData); // BAD if data is from external source
```

✅ **DO** validate first:
```typescript
if (validateScheduleItem(untrustedData)) {
    addScheduleItem(untrustedData); // GOOD!
}
```

## Debugging

### Check for duplicates:
```typescript
const { currentUser } = useAppStore();
const ids = currentUser.SCHEDULE_ITEMS.map(i => i.ID);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
console.log('Duplicates:', duplicates);
```

### Check for invalid items:
```typescript
const invalid = currentUser.SCHEDULE_ITEMS.filter(
    item => !validateScheduleItem(item)
);
console.log('Invalid items:', invalid);
```

### Check data integrity:
```typescript
console.log('Schedule items:', currentUser.SCHEDULE_ITEMS.length);
console.log('Exams:', currentUser.EXAMS.length);
console.log('Results:', currentUser.RESULTS.length);
console.log('Flashcard decks:', currentUser.CONFIG.flashcardDecks?.length || 0);
```

## React Component Integration

```typescript
import { useAppStore } from './store/useAppStore';

function MyComponent() {
    // Select only what you need
    const scheduleItems = useAppStore(state => state.currentUser?.SCHEDULE_ITEMS || []);
    const addScheduleItem = useAppStore(state => state.addScheduleItem);
    
    const handleAdd = () => {
        addScheduleItem({
            // ... item data
        });
    };
    
    return (
        <div>
            {scheduleItems.map(item => (
                <div key={item.ID}>{item.CARD_TITLE.EN}</div>
            ))}
            <button onClick={handleAdd}>Add Item</button>
        </div>
    );
}
```

## TypeScript Tips

```typescript
// Type-safe updates
const updates: Partial<ScheduleItem> = {
    TIME: '15:00'
};
updateScheduleItem('ID', updates);

// Type guards
if (item.type === 'HOMEWORK') {
    // TypeScript knows item.Q_RANGES exists here
    console.log(item.Q_RANGES);
}
```
