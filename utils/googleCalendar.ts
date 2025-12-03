

import { ScheduleItem } from "../types";

declare const gapi: any;

const getNextDateForDay = (dayString: string): Date => {
    const days: { [key: string]: number } = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
        'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };
    const targetDayIndex = days[dayString.toUpperCase()];
    const now = new Date();
    const currentDayIndex = now.getDay();
    let dayDifference = targetDayIndex - currentDayIndex;
    if (dayDifference < 0) {
        dayDifference += 7;
    }
    const nextDate = new Date();
    nextDate.setDate(now.getDate() + dayDifference);
    return nextDate;
};


// Helper to transform our task into a Google Calendar Event
const transformTaskToEvent = (task: ScheduleItem) => {
    if (!('TIME' in task && task.TIME)) {
        return null; // Can't schedule events without a time
    }

    const [hours, minutes] = task.TIME.split(':').map(Number);
    let startDate: Date;
    let recurrence: string[] | undefined = undefined; // Default to non-recurring

    // Handle one-off events that have a specific date
    if ('date' in task && task.date) {
        startDate = new Date(`${task.date}T00:00:00`); // Use a neutral time to avoid timezone shifts
        // No recurrence for specific-date events
    } else {
        startDate = getNextDateForDay(task.DAY.EN);
        // Only set recurrence if it's explicitly recurring and not a specific date
        if ('isRecurring' in task && task.isRecurring) {
            recurrence = ['RRULE:FREQ=WEEKLY'];
        }
    }
    
    startDate.setHours(hours, minutes, 0, 0);

    // Default 1 hour duration
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = {
        'summary': task.CARD_TITLE.EN,
        'description': task.FOCUS_DETAIL.EN,
        'start': {
            'dateTime': startDate.toISOString(),
            'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        'end': {
            'dateTime': endDate.toISOString(),
            'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        'recurrence': recurrence,
        'reminders': {
            'useDefault': false,
            'overrides': [
                { 'method': 'popup', 'minutes': 30 },
            ],
        },
    };
    return event;
};


export const createEvent = async (task: ScheduleItem): Promise<string> => {
    const event = transformTaskToEvent(task);
    if (!event) throw new Error("Task cannot be scheduled without a time.");

    const request = gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': event,
    });

    const response = await request;
    return response.result.id;
};

export const updateEvent = async (eventId: string, task: ScheduleItem): Promise<string> => {
    const event = transformTaskToEvent(task);
    if (!event) throw new Error("Task cannot be scheduled without a time.");

    const request = gapi.client.calendar.events.update({
        'calendarId': 'primary',
        'eventId': eventId,
        'resource': event,
    });

    const response = await request;
    return response.result.id;
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    if (!eventId) return;
    const request = gapi.client.calendar.events.delete({
        'calendarId': 'primary',
        'eventId': eventId,
    });
    await request;
};
