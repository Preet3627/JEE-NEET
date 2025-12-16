import { ScheduleItem, ExamData, ResultData, FlashcardDeck, StudySession } from '../types';

/**
 * Data Validation Utilities
 * Ensures data integrity before processing
 */

export const validateScheduleItem = (item: any): item is ScheduleItem => {
    if (!item || typeof item !== 'object') return false;

    // Check required fields
    if (!item.ID || !item.type || !item.DAY || !item.CARD_TITLE || !item.SUBJECT_TAG) {
        console.warn('Invalid schedule item: missing required fields', item);
        return false;
    }

    // Validate type
    if (!['ACTION', 'HOMEWORK', 'ACTIVITY'].includes(item.type)) {
        console.warn('Invalid schedule item: invalid type', item.type);
        return false;
    }

    // Validate localized strings
    if (!item.DAY.EN || !item.CARD_TITLE.EN || !item.SUBJECT_TAG.EN) {
        console.warn('Invalid schedule item: missing localized strings', item);
        return false;
    }

    return true;
};

export const validateExam = (exam: any): exam is ExamData => {
    if (!exam || typeof exam !== 'object') return false;

    if (!exam.ID || !exam.title || !exam.subject || !exam.date || !exam.time) {
        console.warn('Invalid exam: missing required fields', exam);
        return false;
    }

    // Validate subject
    if (!['PHYSICS', 'CHEMISTRY', 'MATHS', 'BIOLOGY', 'FULL'].includes(exam.subject)) {
        console.warn('Invalid exam: invalid subject', exam.subject);
        return false;
    }

    return true;
};

export const validateResult = (result: any): result is ResultData => {
    if (!result || typeof result !== 'object') return false;

    if (!result.ID || !result.DATE || !result.SCORE || !Array.isArray(result.MISTAKES)) {
        console.warn('Invalid result: missing required fields', result);
        return false;
    }

    return true;
};

export const validateFlashcardDeck = (deck: any): deck is FlashcardDeck => {
    if (!deck || typeof deck !== 'object') return false;

    if (!deck.id || !deck.name || !deck.subject || !Array.isArray(deck.cards)) {
        console.warn('Invalid flashcard deck: missing required fields', deck);
        return false;
    }

    // Validate cards
    const validCards = deck.cards.every((card: any) =>
        card && card.id && card.front && card.back
    );

    if (!validCards) {
        console.warn('Invalid flashcard deck: invalid cards', deck);
        return false;
    }

    return true;
};

/**
 * Data Sanitization Utilities
 * Cleans and normalizes data
 */

export const sanitizeScheduleItem = (item: ScheduleItem): ScheduleItem => {
    const baseFields = {
        ID: item.ID.trim(),
        CARD_TITLE: {
            EN: item.CARD_TITLE.EN.trim(),
            GU: item.CARD_TITLE.GU?.trim() || ''
        },
        FOCUS_DETAIL: {
            EN: item.FOCUS_DETAIL.EN.trim(),
            GU: item.FOCUS_DETAIL.GU?.trim() || ''
        },
        SUBJECT_TAG: {
            EN: item.SUBJECT_TAG.EN.trim().toUpperCase(),
            GU: item.SUBJECT_TAG.GU?.trim() || ''
        },
        DAY: {
            EN: item.DAY.EN.trim().toUpperCase(),
            GU: item.DAY.GU?.trim() || ''
        },
        isUserCreated: item.isUserCreated,
        isStarred: item.isStarred,
        googleEventId: item.googleEventId?.trim() || undefined,
        date: item.date?.trim() || undefined,
        gradient: item.gradient?.trim() || undefined,
        imageUrl: item.imageUrl?.trim() || undefined,
        externalLink: item.externalLink?.trim() || undefined,
        isRecurring: item.isRecurring,
    };

    if (item.type === 'HOMEWORK') {
        return {
            ...baseFields,
            type: 'HOMEWORK',
            Q_RANGES: item.Q_RANGES,
            TIME: item.TIME?.trim() || undefined,
            category: item.category,
            answers: item.answers,
            solutions: item.solutions,
            practiceHistory: item.practiceHistory,
            flashcards: item.flashcards,
        };
    } else if (item.type === 'ACTIVITY') {
        return {
            ...baseFields,
            type: 'ACTIVITY',
            STATUS: item.STATUS,
        };
    } else {
        // ACTION type
        return {
            ...baseFields,
            type: 'ACTION',
            TIME: item.TIME?.trim() || undefined,
            SUB_TYPE: item.SUB_TYPE,
            deckId: item.deckId?.trim() || undefined,
        };
    }
};

/**
 * Data Deduplication Utilities
 * Removes duplicate entries based on ID
 */

export const deduplicateScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const seen = new Set<string>();
    return items.filter(item => {
        if (seen.has(item.ID)) {
            console.warn('Duplicate schedule item found:', item.ID);
            return false;
        }
        seen.add(item.ID);
        return true;
    });
};

export const deduplicateExams = (exams: ExamData[]): ExamData[] => {
    const seen = new Set<string>();
    return exams.filter(exam => {
        if (seen.has(exam.ID)) {
            console.warn('Duplicate exam found:', exam.ID);
            return false;
        }
        seen.add(exam.ID);
        return true;
    });
};

export const deduplicateResults = (results: ResultData[]): ResultData[] => {
    const seen = new Set<string>();
    return results.filter(result => {
        if (seen.has(result.ID)) {
            console.warn('Duplicate result found:', result.ID);
            return false;
        }
        seen.add(result.ID);
        return true;
    });
};

/**
 * Data Sorting Utilities
 * Sorts data by relevant criteria
 */

export const sortScheduleItemsByDate = (items: ScheduleItem[]): ScheduleItem[] => {
    const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    return [...items].sort((a, b) => {
        // First, sort by date if available
        if ('date' in a && a.date && 'date' in b && b.date) {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        }

        // If one has date and other doesn't, date comes first
        if ('date' in a && a.date) return -1;
        if ('date' in b && b.date) return 1;

        // Sort by day of week
        const dayA = daysOrder.indexOf(a.DAY.EN.toUpperCase());
        const dayB = daysOrder.indexOf(b.DAY.EN.toUpperCase());

        if (dayA !== dayB) return dayA - dayB;

        // Sort by time if same day
        const timeA = ('TIME' in a && a.TIME) ? a.TIME : '23:59';
        const timeB = ('TIME' in b && b.TIME) ? b.TIME : '23:59';

        return timeA.localeCompare(timeB);
    });
};

export const sortExamsByDate = (exams: ExamData[]): ExamData[] => {
    return [...exams].sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA.getTime() - dateB.getTime();
    });
};

export const sortResultsByDate = (results: ResultData[]): ResultData[] => {
    return [...results].sort((a, b) => {
        return new Date(b.DATE).getTime() - new Date(a.DATE).getTime(); // Most recent first
    });
};

/**
 * Data Filtering Utilities
 * Filters data based on criteria
 */

export const filterUpcomingScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todayName = now.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();

    return items.filter(item => {
        // If item has a specific date
        if ('date' in item && item.date) {
            return item.date >= today;
        }

        // If item is recurring (by day of week)
        // For simplicity, show all recurring items
        return true;
    });
};

export const filterPastScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return items.filter(item => {
        // Only show items with specific dates that are in the past
        if ('date' in item && item.date) {
            return item.date < today;
        }

        // Don't show recurring items in past view
        return false;
    });
};

export const filterTodayScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const todayName = now.toLocaleString('en-us', { weekday: 'long' }).toUpperCase();

    return items.filter(item => {
        // Check if item has a specific date matching today
        if ('date' in item && item.date) {
            return item.date === today;
        }

        // Check if item is scheduled for today's day of week
        return item.DAY.EN.toUpperCase() === todayName;
    });
};

/**
 * Data Merging Utilities
 * Safely merges data arrays
 */

export const mergeScheduleItems = (existing: ScheduleItem[], incoming: ScheduleItem[]): ScheduleItem[] => {
    const merged = [...existing];
    const existingIds = new Set(existing.map(item => item.ID));

    incoming.forEach(item => {
        if (!existingIds.has(item.ID)) {
            merged.push(item);
        } else {
            // Update existing item
            const index = merged.findIndex(e => e.ID === item.ID);
            if (index !== -1) {
                merged[index] = item;
            }
        }
    });

    return deduplicateScheduleItems(merged);
};

/**
 * Data Export/Import Utilities
 * Handles data serialization
 */

export const exportScheduleData = (items: ScheduleItem[]): string => {
    try {
        return JSON.stringify(items, null, 2);
    } catch (error) {
        console.error('Failed to export schedule data:', error);
        throw new Error('Failed to export data');
    }
};

export const importScheduleData = (jsonString: string): ScheduleItem[] => {
    try {
        const parsed = JSON.parse(jsonString);

        if (!Array.isArray(parsed)) {
            throw new Error('Invalid data format: expected array');
        }

        const validated = parsed.filter(validateScheduleItem);

        if (validated.length !== parsed.length) {
            console.warn(`Filtered out ${parsed.length - validated.length} invalid items`);
        }

        return validated.map(sanitizeScheduleItem);
    } catch (error) {
        console.error('Failed to import schedule data:', error);
        throw new Error('Failed to import data: ' + (error as Error).message);
    }
};
