
import { StudentData, UiText, ScheduleItem } from '../types';

// Mock uiTextData
export const uiTextData: UiText = {
  LANGUAGE: 'EN',
  APP_TITLE: { EN: "JEE Scheduler Pro", GU: "JEE શેડ્યૂલર પ્રો" },
  CURRENT_STATUS_TITLE: { EN: "Current Status", GU: "વર્તમાન સ્થિતિ" },
  CURRENT_SCORE: { EN: "Current Score", GU: "વર્તમાન સ્કોર" },
  TARGET_SCORE: { EN: "Target Score", GU: "લક્ષ્યાંક સ્કોર" },
  WEAKNESS_TITLE: { EN: "Priority Weaknesses", GU: "પ્રાથમિકતા નબળાઈઓ" },
  SCHEDULE_TITLE: { EN: "Weekly Schedule", GU: "સાપ્તાહિક શેડ્યૂલ" },
  ACTION_BUTTONS: {
    SET_ALARM: { EN: "Set Alarm", GU: "એલાર્મ સેટ કરો" },
    COPY_CMD: { EN: "Copy Command", GU: "આદેશની નકલ કરો" }
  }
};

// Mock Schedule Items for a student
const mockScheduleItems: ScheduleItem[] = [
  {
    ID: "A101",
    DAY: { EN: "MONDAY", GU: "સોમવાર" },
    TIME: "19:00",
    CARD_TITLE: { EN: "Physics: Rotational Motion", GU: "ભૌતિકશાસ્ત્ર: રોટેશનલ ગતિ" },
    FOCUS_DETAIL: { EN: "Practice problems on torque and angular momentum.", GU: "ટોર્ક અને કોણીય વેગમાન પર સમસ્યાઓનો અભ્યાસ કરો." },
    SUBJECT_TAG: { EN: "PHYSICS", GU: "ભૌતિકશાસ્ત્ર" },
    type: 'ACTION',
    SUB_TYPE: 'DEEP_DIVE',
    isUserCreated: false
  },
  {
    ID: "H101",
    DAY: { EN: "TUESDAY", GU: "મંગળવારે" },
    CARD_TITLE: { EN: "Maths: Integration", GU: "ગણિત: એકીકરણ" },
    SUBJECT_TAG: { EN: "MATHS", GU: "ગણિત" },
    FOCUS_DETAIL: { EN: "Complete exercises from the textbook.", GU: "પાઠ્યપુસ્તકમાંથી કસરતો પૂર્ણ કરો." },
    Q_RANGES: "Ex 7.1: 1-15; Ex 7.2: 1-10",
    type: 'HOMEWORK'
  },
  {
    ID: "A102",
    DAY: { EN: "WEDNESDAY", GU: "બુધવાર" },
    TIME: "20:30",
    CARD_TITLE: { EN: "Chemistry: P-Block Elements", GU: "રસાયણશાસ્ત્ર: પી-બ્લોક તત્વો" },
    FOCUS_DETAIL: { EN: "Revise group 15 and 16 elements.", GU: "જૂથ 15 અને 16 તત્વોનું પુનરાવર્તન કરો." },
    SUBJECT_TAG: { EN: "CHEMISTRY", GU: "રસાયણશાસ્ત્ર" },
    type: 'ACTION',
    SUB_TYPE: 'DEEP_DIVE',
    isUserCreated: false
  },
   {
    ID: "AC201",
    type: 'ACTIVITY',
    CARD_TITLE: { EN: 'Physics Revision', GU: '' },
    STATUS: 75,
    DAY: { EN: 'MONDAY', GU: '' },
    FOCUS_DETAIL: { EN: 'Overall progress in Physics topics.', GU: '' },
    SUBJECT_TAG: { EN: 'PHYSICS', GU: '' },
  },
];

// Mock studentDatabase
export const studentDatabase: StudentData[] = [
  {
    id: 1,
    sid: 'S001_DEMO',
    email: 'demo.student@example.com',
    fullName: 'Demo Student',
    profilePhoto: `https://api.dicebear.com/8.x/initials/svg?seed=Demo%20Student`,
    isVerified: true,
    role: 'student',
    CONFIG: {
      WAKE: '06:00',
      SCORE: '185/300',
      WEAK: ['Integration by Parts', 'Wave Optics', 'P-Block Elements'],
      UNACADEMY_SUB: true,
      settings: {
        accentColor: '#0891b2',
        blurEnabled: true,
        mobileLayout: 'standard',
        forceOfflineMode: false,
        perQuestionTime: 180,
      }
    },
    SCHEDULE_ITEMS: mockScheduleItems,
    RESULTS: [
      { ID: 'R1', DATE: '2024-05-10', SCORE: '185/300', MISTAKES: ['Integration by Parts', 'Wave Optics'], FIXED_MISTAKES: ['Wave Optics'] },
      { ID: 'R2', DATE: '2024-05-17', SCORE: '205/300', MISTAKES: ['P-Block Elements', 'Thermodynamics'], FIXED_MISTAKES: [] },
    ],
    EXAMS: [
      { ID: 'E1', subject: 'FULL', title: 'AITS Mock Test #1', date: '2024-06-01', time: '09:00', syllabus: 'Full Syllabus' },
      { ID: 'E2', subject: 'MATHS', title: 'Maths Weekly Test', date: '2024-06-05', time: '14:00', syllabus: 'Calculus' },
    ],
    STUDY_SESSIONS: [
      { date: '2024-05-20', duration: 3600, questions_solved: 20, questions_skipped: [5, 12] },
      { date: '2024-05-21', duration: 5400, questions_solved: 30, questions_skipped: [10] },
    ],
    DOUBTS: []
  },
  {
    id: 2,
    sid: 'S002_DEMO',
    email: 'another.student@example.com',
    fullName: 'Riya Sharma',
    profilePhoto: `https://api.dicebear.com/8.x/initials/svg?seed=Riya%20Sharma`,
    isVerified: true,
    role: 'student',
    CONFIG: {
      WAKE: '05:30',
      SCORE: '220/300',
      WEAK: ['Rotational Motion', 'Organic Chemistry Isomerism'],
      UNACADEMY_SUB: false,
      settings: {
        accentColor: '#7c3aed',
        blurEnabled: true,
        mobileLayout: 'toolbar',
        forceOfflineMode: false,
        perQuestionTime: 150,
      }
    },
    SCHEDULE_ITEMS: [],
    RESULTS: [],
    EXAMS: [],
    STUDY_SESSIONS: [],
    DOUBTS: []
  },
];
