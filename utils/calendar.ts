import { ScheduleItem, ExamData } from '../types';

// Helper to format date to ICS format (YYYYMMDDTHHMMSSZ)
const toICSDate = (date: Date): string => {
    // Note: toISOString() returns UTC time, which is what ICS 'Z' indicates.
    return date.toISOString().replace(/-|:|\.\d+/g, '');
};

// Helper to get the date of the next occurrence of a given day of the week
const getNextDateForDay = (dayString: string): Date => {
    const days: { [key: string]: number } = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
        'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };
    const targetDayIndex = days[dayString.toUpperCase()];

    if (targetDayIndex === undefined) {
        // Fallback for invalid day string, return now
        console.warn(`Invalid day string provided to getNextDateForDay: ${dayString}`);
        return new Date();
    }

    const now = new Date();
    const currentDayIndex = now.getDay();
    let dayDifference = targetDayIndex - currentDayIndex;

    // If the target day has already passed this week, schedule for next week.
    if (dayDifference < 0) {
        dayDifference += 7;
    }

    const nextDate = new Date();
    nextDate.setDate(now.getDate() + dayDifference);
    return nextDate;
};


export const exportCalendar = (items: ScheduleItem[], exams: ExamData[], studentName: string): void => {
    const calendarParts: string[] = [
        'BEGIN:VCALENDAR\r\n',
        'VERSION:2.0\r\n',
        'PRODID:-//JEE Scheduler Pro//EN\r\n',
    ];

    items
        .filter(item => 'TIME' in item && item.TIME)
        .forEach(item => {
            const timedItem = item as { DAY: { EN: string }, TIME: string, ID: string, CARD_TITLE: { EN: string }, FOCUS_DETAIL: { EN: string }, date?: string };

            const [hours, minutes] = timedItem.TIME.split(':').map(Number);
            let startDate: Date;

            if (timedItem.date) {
                startDate = new Date(`${timedItem.date}T00:00:00`);
            } else {
                startDate = getNextDateForDay(timedItem.DAY.EN);
            }
            
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

            const summary = timedItem.CARD_TITLE.EN.replace(/,/g, '\\,').replace(/;/g, '\\;');
            const appLink = `https://jee.ponsrischool.in/?action=view_task&id=${timedItem.ID}`;
            const description = `Open in App: ${appLink}\\n\\n${timedItem.FOCUS_DETAIL.EN}`.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

            const eventParts = [
                'BEGIN:VEVENT',
                `UID:${timedItem.ID}@jeeschedulerpro.com`,
                `DTSTAMP:${toICSDate(new Date())}`,
                `DTSTART:${toICSDate(startDate)}`,
                `DTEND:${toICSDate(endDate)}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${description}`,
                'BEGIN:VALARM',
                'TRIGGER:-PT15M',
                'ACTION:DISPLAY',
                `DESCRIPTION:Reminder: ${summary}`,
                'END:VALARM',
                'END:VEVENT'
            ];
            calendarParts.push(eventParts.join('\r\n') + '\r\n');
        });
    
    exams.forEach(exam => {
        const [hours, minutes] = exam.time.split(':').map(Number);
        const startDate = new Date(`${exam.date}T00:00:00`);
        startDate.setHours(hours, minutes, 0, 0);
        // Assume exam duration of 3 hours
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
        
        const summary = exam.title.replace(/,/g, '\\,').replace(/;/g, '\\;');
        const appLink = 'https://jee.ponsrischool.in/#/exams';
        const description = `Open in App: ${appLink}\\n\\nSyllabus: ${exam.syllabus}`.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

        const eventParts = [
            'BEGIN:VEVENT',
            `UID:${exam.ID}@jeeschedulerpro.com`,
            `DTSTAMP:${toICSDate(new Date())}`,
            `DTSTART:${toICSDate(startDate)}`,
            `DTEND:${toICSDate(endDate)}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description}`,
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