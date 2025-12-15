
import { ScheduleItem, FlashcardDeck, Flashcard } from '../types';

interface ParsedData {
    schedules?: ScheduleItem[];
    flashcard_deck?: FlashcardDeck;
    practice_test?: any;
    custom_widget?: any;
    error?: string;
}

export const simpleParse = (text: string): ParsedData => {
    const trimmed = text.trim();

    // 1. Try JSON Parsing
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const json = JSON.parse(trimmed);
            // Basic validation to check if it matches expected keys
            if (json.schedules || json.flashcard_deck || json.practice_test || json.custom_widget) {
                return json;
            }
            // If it's an array, assume it might be schedules or flashcards
            if (Array.isArray(json)) {
                // Heuristic: check first item
                if (json.length > 0) {
                    if (json[0].front && json[0].back) {
                        return {
                            flashcard_deck: {
                                id: `deck_${Date.now()}`,
                                name: 'Imported Deck',
                                subject: 'General',
                                isLocked: false,
                                cards: json.map((c: any, i: number) => ({ ...c, id: c.id || `card_${i}` }))
                            }
                        };
                    }
                    if (json[0].type && (json[0].type === 'ACTION' || json[0].type === 'HOMEWORK')) {
                        return { schedules: json };
                    }
                }
            }
        } catch (e) {
            // Ignore JSON error and fall back to text parsing
            console.log("JSON parse failed, trying text heuristics");
        }
    }

    // 2. Text Heuristics
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const schedules: ScheduleItem[] = [];
    const cards: Flashcard[] = [];

    // Flashcard Mode Detection (if many lines have separators like '|' or '?' followed by answer)
    const isFlashcardList = lines.every(l => l.includes('|') || l.includes(' - '));

    if (isFlashcardList && lines.length > 0) {
        lines.forEach((line, idx) => {
            const parts = line.includes('|') ? line.split('|') : line.split(' - ');
            if (parts.length >= 2) {
                cards.push({
                    id: `card_${Date.now()}_${idx}`,
                    front: parts[0].trim(),
                    back: parts[1].trim()
                });
            }
        });

        if (cards.length > 0) {
            return {
                flashcard_deck: {
                    id: `deck_${Date.now()}`,
                    name: 'Imported Deck',
                    subject: 'General',
                    isLocked: false,
                    cards: cards
                }
            };
        }
    }

    // Schedule Mode
    lines.forEach((line, idx) => {
        // Format: "Physics: Study Optics at 5pm" or "Maths: Exercise 1.2"
        // Regex to capture Subject (optional), Title, and Time (optional)
        // Matches: "Subject: Title" or "Title at Time"

        let subject = 'GENERAL';
        let title = line;
        let time = '';

        const subjectMatch = line.match(/^(Physics|Chemistry|Maths|Biology|English|History|General):\s*(.*)/i);
        if (subjectMatch) {
            subject = subjectMatch[1].toUpperCase();
            title = subjectMatch[2];
        }

        const timeMatch = title.match(/(.*)\s+(at|@)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        if (timeMatch) {
            title = timeMatch[1];
            let timeString = timeMatch[3].toLowerCase();
            // Normalize time to HH:MM if possible, otherwise keep string
            // Simple normalizer could be added here
            if (timeString.includes('pm') && !timeString.includes(':')) {
                const hour = parseInt(timeString.replace('pm', ''));
                if (hour < 12) time = `${hour + 12}:00`;
                else time = `${hour}:00`;
            } else if (timeString.includes('am') && !timeString.includes(':')) {
                const hour = parseInt(timeString.replace('am', ''));
                if (hour === 12) time = `00:00`;
                else time = `${hour.toString().padStart(2, '0')}:00`;
            } else {
                time = timeString.replace(/[a-z]/g, '').trim();
                if (!time.includes(':')) time = `${time.padStart(2, '0')}:00`;
            }
        }

        // Default time if not found
        if (!time) time = '09:00';

        schedules.push({
            ID: `S${Date.now()}_${idx}`,
            type: 'ACTION',
            SUB_TYPE: 'DEEP_DIVE',
            isUserCreated: true,
            DAY: { EN: new Date().toLocaleString('en-us', { weekday: 'long' }).toUpperCase(), GU: '' },
            TIME: time,
            SUBJECT_TAG: { EN: subject, GU: '' },
            CARD_TITLE: { EN: title.trim(), GU: '' },
            FOCUS_DETAIL: { EN: line, GU: '' }
        } as ScheduleItem);
    });

    if (schedules.length > 0) {
        return { schedules };
    }

    return { error: 'Could not parse text. Try "Subject: Task at Time" format.' };
};
