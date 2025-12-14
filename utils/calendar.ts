
import { ScheduleItem, ExamData } from '../types';
import * as ics from 'ics';

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
    const events: ics.EventAttributes[] = [];

    // Process Schedule Items
    items
        .filter(item => 'TIME' in item && item.TIME)
        .forEach(item => {
            const timedItem = item as any;
            const [hours, minutes] = timedItem.TIME.split(':').map(Number);
            let startDate: Date;

            if (timedItem.date) {
                // If specific date, use it. Set time to 00:00:00 UTC to then set specific hours.
                startDate = new Date(Date.UTC(new Date(timedItem.date).getFullYear(), new Date(timedItem.date).getMonth(), new Date(timedItem.date).getDate()));
            } else {
                startDate = getNextDateForDay(timedItem.DAY.EN);
            }
            
            startDate.setUTCHours(hours, minutes, 0, 0); // Set UTC hours/minutes

            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

            let recurrenceRule: ics.RecurrenceRule | undefined = undefined;
            if (timedItem.isRecurring && !timedItem.date) { // Only recur if no specific date
                const recurrenceUntil = new Date(startDate);
                recurrenceUntil.setFullYear(recurrenceUntil.getFullYear() + 2); // 2 years max recurrence
                recurrenceRule = {
                    freq: 'WEEKLY',
                    until: recurrenceUntil.toISOString(),
                };
            }

            const summary = timedItem.CARD_TITLE.EN;
            
            // Deep Link Logic
            const action = timedItem.type === 'HOMEWORK' ? 'start_practice' : 'view_task';
            const deepLink = `https://jee.ponsrischool.in/?action=${action}&id=${timedItem.ID}`;
            
            // External App Link (Zoom, Unacademy, etc.)
            let externalLinkText = '';
            let locationUrl = deepLink; // Default location is the deep link
            
            if (timedItem.externalLink) {
                externalLinkText = `\n\n[EXTERNAL RESOURCE]: ${timedItem.externalLink}`;
                locationUrl = timedItem.externalLink; // Prioritize external link in location field for 1-click join
            }

            const description = `Details: ${timedItem.FOCUS_DETAIL.EN}\n\nOpen in App: ${deepLink}${externalLinkText}`;

            const event: ics.EventAttributes = {
                title: summary,
                start: [startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate(), startDate.getUTCHours(), startDate.getUTCMinutes()],
                end: [endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate(), endDate.getUTCHours(), endDate.getUTCMinutes()],
                description,
                url: locationUrl,
                location: locationUrl,
                alarms: [{ action: 'display', description: `Reminder: ${summary}`, trigger: { minutes: 15, before: true } }],
                uid: `${timedItem.ID}-${Date.now()}@jeeschedulerpro.com`,
                recurrenceRule: recurrenceRule ? `FREQ=${recurrenceRule.freq};UNTIL=${new Date(recurrenceRule.until).toISOString().replace(/-|:|\.\d+/g, '') + 'Z'}` : undefined,
                calName: 'JEE Scheduler Pro',
                productId: 'JEE-Scheduler-Pro/v3',
            };
            events.push(event);
        });
    
    // Process Exams Logic
    exams.forEach(exam => {
        const [hours, minutes] = exam.time.split(':').map(Number);
        const startDate = new Date(Date.UTC(new Date(exam.date).getFullYear(), new Date(exam.date).getMonth(), new Date(exam.date).getDate()));
        startDate.setUTCHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Default 3 hours for exam
        
        const summary = `EXAM: ${exam.title}`;
        const appLink = 'https://jee.ponsrischool.in/?action=view_exams';
        const description = `Syllabus: ${exam.syllabus}\n\nOpen App: ${appLink}`;

        const event: ics.EventAttributes = {
            title: summary,
            start: [startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate(), startDate.getUTCHours(), startDate.getUTCMinutes()],
            end: [endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate(), endDate.getUTCHours(), endDate.getUTCMinutes()],
            description,
            url: appLink,
            alarms: [{ action: 'display', description: `Exam Reminder: ${summary}`, trigger: { hours: 1, before: true } }],
            uid: `${exam.ID}@jeeschedulerpro.com`,
            calName: 'JEE Scheduler Pro',
            productId: 'JEE-Scheduler-Pro/v3',
        };
        events.push(event);
    });

    ics.createEvents(events, (error, value) => {
        if (error) {
            console.error("Failed to create calendar file:", error);
            alert("Sorry, there was an error creating the calendar file.");
            return;
        }
        
        try {
            const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
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
    });
};
