
import { ScheduleItem, ExamData } from '../types';

// Helper to format date to ICS format (YYYYMMDDTHHMMSSZ)
const toICSDate = (date: Date): string => {
    return date.toISOString().replace(/-|:|\.\d+/g, '');
};

// Helper to get the next occurrence of a day
const getNextDateForDay = (dayString: string): Date => {
    const days: { [key: string]: number } = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
        'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };
    const targetDayIndex = days[dayString.toUpperCase()];
    if (targetDayIndex === undefined) return new Date();

    const now = new Date();
    const currentDayIndex = now.getDay();
    let dayDifference = targetDayIndex - currentDayIndex;
    // If today is the day, but the time has passed, usually we want next week, 
    // but for export, we'll stick to "next occurrence" logic which might include today if valid.
    // For simplicity here: if diff < 0, add 7.
    if (dayDifference < 0) dayDifference += 7;

    const nextDate = new Date();
    nextDate.setDate(now.getDate() + dayDifference);
    return nextDate;
};

export const exportCalendar = (items: ScheduleItem[], exams: ExamData[], studentName: string): void => {
    const calendarParts: string[] = [
        'BEGIN:VCALENDAR\r\n',
        'VERSION:2.0\r\n',
        'PRODID:-//JEE Scheduler Pro//EN\r\n',
        'CALSCALE:GREGORIAN\r\n',
        'METHOD:PUBLISH\r\n',
    ];

    items
        .filter(item => 'TIME' in item && item.TIME)
        .forEach(item => {
            const timedItem = item as any;
            const [hours, minutes] = timedItem.TIME.split(':').map(Number);
            let startDate: Date;
            let recurrenceRule = '';

            // LOGIC FIX: Only use RRULE if explicitly requested (isRecurring flag)
            // Otherwise, export as a single event for the immediate next occurrence.
            if (timedItem.date) {
                startDate = new Date(`${timedItem.date}T00:00:00`);
            } else {
                startDate = getNextDateForDay(timedItem.DAY.EN);
                
                if (timedItem.isRecurring) {
                    // Cap recursion at 2 years max to avoid "Whole Life" infinite clutter
                    const endDate = new Date();
                    endDate.setFullYear(endDate.getFullYear() + 2);
                    const untilDate = toICSDate(endDate).split('T')[0]; 
                    recurrenceRule = `RRULE:FREQ=WEEKLY;UNTIL=${untilDate}`;
                }
            }
            
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

            const summary = timedItem.CARD_TITLE.EN.replace(/,/g, '\\,').replace(/;/g, '\\;');
            
            // Deep Link Logic
            const action = timedItem.type === 'HOMEWORK' ? 'start_practice' : 'view_task';
            const deepLink = `https://jee.ponsrischool.in/?action=${action}&id=${timedItem.ID}`;
            
            // External App Link (Zoom, Unacademy, etc.)
            let externalLinkText = '';
            let locationUrl = deepLink; // Default location is the deep link
            
            if (timedItem.externalLink) {
                externalLinkText = `\\n\\n[EXTERNAL RESOURCE]: ${timedItem.externalLink}`;
                locationUrl = timedItem.externalLink; // Prioritize external link in location field for 1-click join
            }

            const description = `Details: ${timedItem.FOCUS_DETAIL.EN}\\n\\nOpen in App: ${deepLink}${externalLinkText}`
                .replace(/,/g, '\\,')
                .replace(/;/g, '\\;')
                .replace(/\n/g, '\\n');

            const eventParts = [
                'BEGIN:VEVENT',
                `UID:${timedItem.ID}-${Date.now()}@jeeschedulerpro.com`,
                `DTSTAMP:${toICSDate(new Date())}`,
                `DTSTART:${toICSDate(startDate)}`,
                `DTEND:${toICSDate(endDate)}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${description}`,
                `URL:${locationUrl}`,
                `LOCATION:${locationUrl}`,
                'BEGIN:VALARM',
                'TRIGGER:-PT15M',
                'ACTION:DISPLAY',
                `DESCRIPTION:Reminder: ${summary}`,
                'END:VALARM',
            ];

            if (recurrenceRule) {
                eventParts.push(recurrenceRule);
            }

            eventParts.push('END:VEVENT');
            calendarParts.push(eventParts.join('\r\n') + '\r\n');
        });
    
    // Exams Logic
    exams.forEach(exam => {
        const [hours, minutes] = exam.time.split(':').map(Number);
        const startDate = new Date(`${exam.date}T00:00:00`);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
        
        const summary = `EXAM: ${exam.title}`.replace(/,/g, '\\,').replace(/;/g, '\\;');
        const appLink = 'https://jee.ponsrischool.in/?action=view_exams';
        const description = `Syllabus: ${exam.syllabus}\\n\\nOpen App: ${appLink}`.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

        const eventParts = [
            'BEGIN:VEVENT',
            `UID:${exam.ID}@jeeschedulerpro.com`,
            `DTSTAMP:${toICSDate(new Date())}`,
            `DTSTART:${toICSDate(startDate)}`,
            `DTEND:${toICSDate(endDate)}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description}`,
            `URL:${appLink}`,
            'BEGIN:VALARM',
            'TRIGGER:-PT1H',
            'ACTION:DISPLAY',
            `DESCRIPTION:Exam Reminder: ${summary}`,
            'END:VALARM',
            'END:VEVENT'
        ];
        calendarParts.push(eventParts.join('\r\n') + '\r\n');
    });

    calendarParts.push('END:VCALENDAR\r\n');
    
    try {
        const blob = new Blob(calendarParts, { type: 'text/calendar;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${studentName.replace(/ /g, '_')}_schedule.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export calendar:", error);
        alert("Sorry, there was an error exporting the calendar file.");
    }
};
