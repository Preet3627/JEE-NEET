export type Language = 'EN' | 'GU';

export interface LocalizedString {
  EN: string;
  GU: string;
}

export interface UiText {
  LANGUAGE: string;
  APP_TITLE: LocalizedString;
  CURRENT_STATUS_TITLE: LocalizedString;
  CURRENT_SCORE: LocalizedString;
  TARGET_SCORE: LocalizedString;
  WEAKNESS_TITLE: LocalizedString;
  SCHEDULE_TITLE: LocalizedString;
  ACTION_BUTTONS: {
    SET_ALARM: LocalizedString;
    COPY_CMD: LocalizedString;
  };
}

export interface ScheduleCardData {
  ID: string;
  DAY: LocalizedString;
  TIME?: string; // Made optional for actions that might not have a specific time
  CARD_TITLE: LocalizedString;
  FOCUS_DETAIL: LocalizedString;
  SUBJECT_TAG: LocalizedString;
  UNACADEMY_QUERY?: string;
  ACTION_COMMAND?: string;
  type: 'ACTION';
  SUB_TYPE?: 'MORNING_DRILL' | 'DEEP_DIVE' | 'ANALYSIS' | 'FLASHCARD_REVIEW';
  isUserCreated?: boolean;
  isStarred?: boolean;
  googleEventId?: string;
  deckId?: string;
  date?: string; // For one-off tasks overriding DAY
  gradient?: string;
  imageUrl?: string;
  externalLink?: string;
  isRecurring?: boolean;
}

export interface PracticeHistory {
  date: string;
  attempted: number[];
  correct: number[];
  incorrect: number[];
  skipped: number[];
}

export interface HomeworkData {
  ID: string;
  DAY: LocalizedString;
  CARD_TITLE: LocalizedString;
  SUBJECT_TAG: LocalizedString;
  FOCUS_DETAIL: LocalizedString;
  Q_RANGES: string;
  type: 'HOMEWORK';
  category?: 'Level-1' | 'Level-2' | 'Classroom-Discussion' | 'PYQ' | 'Custom';
  TIME?: string;
  isUserCreated?: boolean;
  isStarred?: boolean;
  googleEventId?: string;
  // FIX: Updated to correctly accept string or array of strings for answers.
  answers?: Record<string, string | string[]>;
  solutions?: Record<string, string>;
  date?: string;
  practiceHistory?: PracticeHistory[];
  flashcards?: { front: string; back: string }[];
  gradient?: string;
  imageUrl?: string;
  externalLink?: string;
  isRecurring?: boolean;
}

export interface ActivityData {
  ID: string;
  DAY: LocalizedString; // Assuming activities can also be scheduled by day
  CARD_TITLE: LocalizedString;
  FOCUS_DETAIL: LocalizedString;
  SUBJECT_TAG: LocalizedString;
  STATUS: number; // e.g., percentage completion
  type: 'ACTIVITY';
  isUserCreated?: boolean;
  isStarred?: boolean;
  googleEventId?: string;
  date?: string; // For one-off activities
  gradient?: string;
  imageUrl?: string;
  externalLink?: string;
  isRecurring?: boolean;
}

export type ScheduleItem = ScheduleCardData | HomeworkData | ActivityData;

export interface ResultData {
  ID: string;
  DATE: string;
  SCORE: string;
  MISTAKES: string[];
  FIXED_MISTAKES?: string[];
  syllabus?: string;
  timings?: Record<number, number>;
  analysis?: {
    subjectTimings: Record<string, number>;
    chapterScores: Record<string, { correct: number, incorrect: number, accuracy: number }>;
    aiSuggestions: string;
    incorrectQuestionNumbers: number[];
    suggestedFlashcards?: { front: string; back: string; }[];
  }
}

export interface StudySession {
  date: string;
  duration: number; // in seconds
  questions_solved: number;
  questions_skipped: number[];
}

export interface ExamData {
  ID: string;
  title: string;
  subject: 'PHYSICS' | 'CHEMISTRY' | 'MATHS' | 'BIOLOGY' | 'FULL'; // Added BIOLOGY
  date: string;
  time: string;
  syllabus: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  subject: string;
  chapter?: string;
  cards: Flashcard[];
  isLocked: boolean;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface DashboardWidgetItem {
  id: string;
  wide?: boolean;
  tall?: boolean;
  minimized?: boolean;
}

export interface NotchSettings {
  position: 'top' | 'bottom';
  size: 'small' | 'medium' | 'large';
  width: number;
  enabled?: boolean;
}

export interface VisualizerSettings {
  preset: 'bars' | 'wave' | 'circle';
  colorMode: 'rgb' | 'album' | 'mono';
}

export interface DjDropSettings {
  enabled: boolean;
  autoTrigger: boolean;
  customDropUrl?: string;
}

export interface Config {
  WAKE: string;
  SCORE: string;
  WEAK: string[];
  UNACADEMY_SUB: boolean;
  isCalendarSyncEnabled?: boolean;
  calendarLastSync?: string;
  googleDriveFileId?: string;
  driveLastSync?: string;
  geminiApiKey?: string;
  flashcardDecks?: FlashcardDeck[];
  pinnedMaterials?: string[];
  customWidgets?: { id: string, title: string, content: string }[];
  localPlaylists?: LocalPlaylist[];
  settings: {
    accentColor: string;
    blurEnabled: boolean;
    mobileLayout: 'standard' | 'toolbar';
    forceOfflineMode: boolean;
    perQuestionTime: number;
    showAiChatAssistant?: boolean;
    hasGeminiKey?: boolean;
    examType?: 'JEE' | 'NEET';
    theme?: 'default' | 'liquid-glass' | 'midnight';
    dashboardLayout?: DashboardWidgetItem[];
    dashboardFlashcardDeckIds?: string[];
    musicPlayerWidgetLayout?: 'minimal' | 'expanded';
    dashboardBackgroundImage?: string;
    dashboardTransparency?: number;
    notchSettings?: NotchSettings;
    visualizerSettings?: VisualizerSettings;
    djDropSettings?: DjDropSettings;
  }
}

// Added missing DoubtData and MessageData interfaces
export interface DoubtSolutionData {
  id: string;
  doubt_id: string;
  user_sid: string;
  solution: string;
  solution_image?: string;
  created_at: string;
  solver_name: string;
  solver_photo?: string;
}

export interface DoubtData {
  id: string;
  user_sid: string;
  question: string;
  question_image?: string;
  created_at: string;
  author_name: string;
  author_photo?: string;
  status: 'active' | 'archived' | 'deleted';
  solutions: DoubtSolutionData[]; // Solutions are part of a doubt
}

export interface StudentData {
  id: number;
  sid: string;
  email: string;
  fullName: string;
  profilePhoto?: string;
  isVerified: boolean;
  role: 'student' | 'admin';
  last_seen?: string;
  apiToken?: string;
  CONFIG: Config;
  SCHEDULE_ITEMS: ScheduleItem[];
  RESULTS: ResultData[];
  EXAMS: ExamData[];
  STUDY_SESSIONS: StudySession[];
  // DOUBTS: DoubtData[]; // Doubts are fetched globally for community, not stored per student directly
}

export interface MessageData {
    id: number;
    sender_sid: string;
    recipient_sid: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

export interface StudyMaterialItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  size: number;
  modified: string;
}

export interface PracticeQuestion {
    number: number;
    text: string;
    options: string[]; // For MCQ & MULTI_CHOICE, empty for NUM
    type: 'MCQ' | 'NUM' | 'MULTI_CHOICE'; // Added MULTI_CHOICE
    solution?: string; // Optional detailed solution
}

export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    track: string;
    coverArt: string;
    coverArtUrl?: string;
    duration: string;
    size: string;
    path?: string;
    isLocal: boolean;
    file?: File;
}

// Added missing types for video generation models, if they were used (not directly in current error files)
export interface VideoGenerationReferenceImage {
  image: {
    imageBytes: string;
    mimeType: string;
  };
  referenceType: VideoGenerationReferenceType;
}

export enum VideoGenerationReferenceType {
  UNKNOWN = 'UNKNOWN',
  ASSET = 'ASSET',
}

export type ActiveTab = 'dashboard' | 'today' | 'schedule' | 'planner' | 'material' | 'flashcards' | 'exams' | 'performance' | 'doubts';