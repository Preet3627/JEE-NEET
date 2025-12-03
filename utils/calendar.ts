
import { ScheduleItem, ExamData } from '../types';

// Helper to format date to ICS format (YYYYMMDDTHHMMSSZ)
const toICSDate = (date: Date): string => {
    return date.toISOString().replace(/-|:|\.\d+/g, '') + 'Z'; // Always use Z for UTC time
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
    // Create a date for "today" at 00:00:00 UTC to avoid local timezone issues for comparison
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const currentDayIndex = todayUTC.getUTCDay();

    let dayDifference = targetDayIndex - currentDayIndex;
    if (dayDifference < 0) dayDifference += 7; // Target day is in the next week

    const nextDate = new Date(todayUTC); // Start from today's UTC date
    nextDate.setUTCDate(todayUTC.getUTCDate() + dayDifference);
    return nextDate;
};

export const exportCalendar = (items: ScheduleItem[], exams: ExamData[], studentName: string): void => {
    const calendarEvents: string[] = [];

    // Process Schedule Items
    items
        .filter(item => 'TIME' in item && item.TIME)
        .forEach(item => {
            const timedItem = item as any;
            const [hours, minutes] = timedItem.TIME.split(':').map(Number);
            let startDate: Date;
            let recurrenceRule = '';

            if (timedItem.date) {
                // If specific date, use it. Set time to 00:00:00 UTC to then set specific hours.
                startDate = new Date(Date.UTC(new Date(timedItem.date).getFullYear(), new Date(timedItem.date).getMonth(), new Date(timedItem.date).getDate()));
            } else {
                startDate = getNextDateForDay(timedItem.DAY.EN);
            }
            
            startDate.setUTCHours(hours, minutes, 0, 0); // Set UTC hours/minutes

            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

            if (timedItem.isRecurring && !timedItem.date) { // Only recur if no specific date
                const recurrenceUntil = new Date(startDate);
                recurrenceUntil.setFullYear(recurrenceUntil.getFullYear() + 2); // 2 years max recurrence
                recurrenceRule = `RRULE:FREQ=WEEKLY;UNTIL=${toICSDate(recurrenceUntil)}`;
            }

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
            calendarEvents.push(eventParts.join('\r\n') + '\r\n');
        });
    
    // Process Exams Logic
    exams.forEach(exam => {
        const [hours, minutes] = exam.time.split(':').map(Number);
        // Set to 00:00:00 UTC then apply hours/minutes
        const startDate = new Date(Date.UTC(new Date(exam.date).getFullYear(), new Date(exam.date).getMonth(), new Date(exam.date).getDate()));
        startDate.setUTCHours(hours, minutes, 0, 0); // Set UTC hours/minutes
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Default 3 hours for exam
        
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
        calendarEvents.push(eventParts.join('\r\n') + '\r\n');
    });

    const calendarParts: string[] = [
        'BEGIN:VCALENDAR\r\n',
        'VERSION:2.0\r\n',
        'PRODID:-//JEE Scheduler Pro//EN\r\n',
        'CALSCALE:GREGORIAN\r\n',
        'METHOD:PUBLISH\r\n',
        ...calendarEvents, // Add all generated events
        'END:VCALENDAR\r\n'
    ];
    
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
