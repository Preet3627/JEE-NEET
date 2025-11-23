
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
  TIME: string;
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
  date?: string;
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
  answers?: Record<string, string>;
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
  type: 'ACTIVITY';
  CARD_TITLE: LocalizedString;
  STATUS: number;
  DAY: LocalizedString;
  FOCUS_DETAIL: LocalizedString;
  SUBJECT_TAG: LocalizedString;
  isStarred?: boolean;
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
    subjectTimings: Record<'PHYSICS' | 'CHEMISTRY' | 'MATHS' | 'OTHER', number>;
    chapterScores: Record<string, { correct: number; incorrect: number; accuracy: number }>;
    aiSuggestions: string;
    incorrectQuestionNumbers?: number[];
    suggestedFlashcards?: { front: string; back: string; }[];
  };
  detailedMistakes?: {
    qNumber: number;
    analysis: {
        topic: string;
        explanation: string;
    };
  }[];
}

export interface ExamData {
  ID: string;
  subject: 'PHYSICS' | 'CHEMISTRY' | 'MATHS' | 'FULL';
  title: string;
  date: string;
  time: string;
  syllabus: string;
}

export interface SolutionData {
  id: string;
  doubt_id: string;
  user_sid: string;
  solution: string;
  solution_image?: string;
  created_at: string;
  solver_name: string;
  solver_photo: string;
}

export interface DoubtData {
  id: string;
  user_sid: string;
  question: string;
  question_image?: string;
  created_at: string;
  author_name: string;
  author_photo: string;
  solutions: SolutionData[];
  status?: 'active' | 'archived' | 'deleted';
}

export interface MessageData {
  id: number;
  sender_sid: string;
  recipient_sid: string;
  content: string;
  created_at: string;
}

export interface StudySession {
  date: string;
  duration: number;
  questions_solved: number;
  questions_skipped: number[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  track: string;
  coverArt: string;
  duration: string;
  size: string;
  coverArtUrl?: string;
  isLocal?: boolean;
  file?: File;
  path?: string;
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
  cards: Flashcard[];
  chapter?: string;
  isLocked?: boolean;
}

export interface StudyMaterialItem {
    name: string;
    type: 'file' | 'folder';
    path: string;
    size: number;
    modified: string;
}

export interface PracticeQuestion {
  number: number;
  text: string;
  options: string[];
  type: 'MCQ' | 'NUM';
}

export interface CustomWidget {
  id: string;
  title: string;
  content: string;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  trackIds: string[];
}

export type ActiveTab = 'dashboard' | 'schedule' | 'today' | 'planner' | 'exams' | 'performance' | 'doubts' | 'flashcards' | 'material';

export interface DashboardWidgetItem {
    id: string;
    wide?: boolean;
    tall?: boolean;
    translucent?: boolean;
    minimized?: boolean;
    customTitle?: string;
}

export interface NotchSettings {
    position: 'top' | 'bottom';
    size: 'small' | 'medium' | 'large';
    width: number; // percentage 20-100
}

export interface VisualizerSettings {
    preset: 'bars' | 'wave' | 'circle';
    colorMode: 'rgb' | 'album' | 'mono';
}

export interface DjDropSettings {
    enabled: boolean;
    autoTrigger: boolean; // Play on auto-mix
    customDropUrl?: string; // Base64 or URL
}

export interface Config {
    WAKE: string;
    SCORE: string;
    WEAK: string[];
    UNACADEMY_SUB: boolean;
    googleDriveFileId?: string;
    driveLastSync?: string;
    isCalendarSyncEnabled?: boolean;
    calendarLastSync?: string;
    geminiApiKey?: string;
    flashcardDecks?: FlashcardDeck[];
    pinnedMaterials?: string[];
    customWidgets?: CustomWidget[];
    localPlaylists?: LocalPlaylist[];
    settings: {
        accentColor: string;
        blurEnabled: boolean;
        mobileLayout: 'standard' | 'toolbar';
        forceOfflineMode: boolean;
        perQuestionTime: number;
        hasGeminiKey?: boolean;
        showAiChatAssistant?: boolean;
        creditSaver?: boolean;
        examType?: 'JEE' | 'NEET';
        theme?: 'default' | 'liquid-glass' | 'midnight';
        dashboardLayout?: DashboardWidgetItem[];
        dashboardFlashcardDeckIds?: string[];
        musicPlayerWidgetLayout?: 'minimal' | 'expanded';
        widgetSettings?: { [widgetId: string]: { translucent?: boolean; wide?: boolean } };
        dashboardBackgroundImage?: string;
        dashboardTransparency?: number;
        alwaysShowMusicPopup?: boolean;
        notchSettings?: NotchSettings;
        visualizerSettings?: VisualizerSettings;
        djDropSettings?: DjDropSettings;
    };
}

export interface StudentData {
    id: number;
    sid: string;
    email: string;
    fullName: string;
    profilePhoto: string;
    isVerified: boolean;
    role: 'student' | 'admin';
    apiToken?: string;
    last_seen?: string;
    CONFIG: Config;
    SCHEDULE_ITEMS: ScheduleItem[];
    RESULTS: ResultData[];
    EXAMS: ExamData[];
    STUDY_SESSIONS: StudySession[];
    DOUBTS: DoubtData[];
}
