import { StudentData, DoubtData, IconName } from '../types';

export interface Achievement {
    name: string;
    description: string;
    icon: IconName;
    unlocked: boolean;
}

export const calculateAchievements = (student: StudentData, allDoubts: DoubtData[]): Achievement[] => {
    const achievements: Omit<Achievement, 'unlocked'>[] = [
        { name: "First Steps", description: "Complete your first study session.", icon: 'play' },
        { name: "Scholar", description: "Log your first mock test result.", icon: 'trophy' },
        { name: "Prodigy", description: "Score over 200 in a mock test.", icon: 'star' },
        { name: "Perfectionist", description: "Score over 250 in a mock test.", icon: 'star' },
        { name: "Study Streak", description: "Log study sessions on 3 different days.", icon: 'streak' },
        { name: "Dedicated Learner", description: "Have 20 or more items in your schedule.", icon: 'schedule' },
        { name: "Weekend Warrior", description: "Log a study session on a Saturday or Sunday.", icon: 'calendar' },
        { name: "Flashcard Fanatic", description: "Create a flashcard deck with 20+ cards.", icon: 'cards' },
        { name: "Curious Mind", description: "Post your first doubt in the community forum.", icon: 'message' },
        { name: "Problem Solver", description: "Provide a solution to another student's doubt.", icon: 'fixed' },
        { name: "Community Helper", description: "Solve 3 or more doubts for others.", icon: 'users' }
    ];

    const studentSolutionsCount = allDoubts.reduce((count, doubt) => {
        return count + doubt.solutions.filter(sol => sol.user_sid === student.sid).length;
    }, 0);
    
    const studentDoubtsCount = allDoubts.filter(doubt => doubt.user_sid === student.sid).length;

    const uniqueStudyDays = new Set(student.STUDY_SESSIONS.map(s => s.date));

    return achievements.map(ach => {
        let unlocked = false;
        switch (ach.name) {
            case "First Steps":
                unlocked = student.STUDY_SESSIONS.length > 0;
                break;
            case "Scholar":
                unlocked = student.RESULTS.length > 0;
                break;
            case "Prodigy":
                unlocked = student.RESULTS.some(r => parseInt(r.SCORE.split('/')[0]) >= 200);
                break;
            case "Perfectionist":
                unlocked = student.RESULTS.some(r => parseInt(r.SCORE.split('/')[0]) >= 250);
                break;
            case "Study Streak":
                unlocked = uniqueStudyDays.size >= 3;
                break;
            case "Dedicated Learner":
                unlocked = student.SCHEDULE_ITEMS.length >= 20;
                break;
            case "Weekend Warrior":
                unlocked = student.STUDY_SESSIONS.some(s => {
                    const day = new Date(s.date).getDay();
                    return day === 0 || day === 6;
                });
                break;
            case "Flashcard Fanatic":
                unlocked = student.CONFIG.flashcardDecks?.some(d => d.cards.length >= 20) || false;
                break;
            case "Curious Mind":
                unlocked = studentDoubtsCount > 0;
                break;
            case "Problem Solver":
                unlocked = studentSolutionsCount > 0;
                break;
            case "Community Helper":
                unlocked = studentSolutionsCount >= 3;
                break;
        }
        return { ...ach, unlocked };
    });
};