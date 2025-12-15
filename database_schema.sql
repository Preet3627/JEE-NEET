-- MySQL Database Schema for JEE-NEET Scheduler Pro
--
-- This schema is generated based on the TypeScript interfaces defined in `types.ts`
-- for a MySQL 8.0+ database, assuming JSON type support.
--
-- Note: Complex objects and arrays from TypeScript interfaces are stored as JSON
-- in TEXT or JSON columns in the database for simplicity and flexibility.
-- This allows the frontend to parse them back into their structured types.
--
-- Foreign keys are defined with ON DELETE CASCADE to ensure data integrity
-- when a user is deleted.

-- Enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS = 1;

-- Drop Tables if they exist (for easy re-creation during development)
DROP TABLE IF EXISTS doubt_solutions;
DROP TABLE IF EXISTS doubts;
DROP TABLE IF EXISTS study_sessions;
DROP TABLE IF EXISTS flashcards;
DROP TABLE IF EXISTS flashcard_decks;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS schedule_items;
DROP TABLE IF EXISTS users;

-- -----------------------------------------------------
-- Table `users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `sid` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Student ID, unique identifier',
    `email` VARCHAR(255) NOT NULL UNIQUE COMMENT 'User email address',
    `fullName` VARCHAR(255) COMMENT 'Full name of the user',
    `profilePhoto` VARCHAR(255) COMMENT 'URL or path to user''s profile photo',
    `isVerified` BOOLEAN DEFAULT FALSE COMMENT 'Whether the user''s email is verified',
    `role` VARCHAR(50) NOT NULL DEFAULT 'student' COMMENT 'User role (e.g., student, admin)',
    `last_seen` DATETIME COMMENT 'Timestamp of user''s last activity',
    `apiToken` VARCHAR(255) COMMENT 'API token for external integrations',
    `config_json` JSON COMMENT 'Stores the entire user configuration object from Config interface'
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'User profiles and their global configurations';

-- -----------------------------------------------------
-- Table `schedule_items`
-- -----------------------------------------------------
-- This table stores all types of schedule items (ACTION, HOMEWORK, ACTIVITY)
CREATE TABLE IF NOT EXISTS `schedule_items` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the schedule item',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table',
    `type` VARCHAR(50) NOT NULL COMMENT 'Type of schedule item (ACTION, HOMEWORK, ACTIVITY)',
    `day_json` JSON COMMENT 'Localized string for day (e.g., {"EN": "MONDAY", "GU": ""})',
    `time` VARCHAR(50) COMMENT 'Time of the schedule item (e.g., "09:00")',
    `card_title_json` JSON COMMENT 'Localized string for card title',
    `focus_detail_json` JSON COMMENT 'Localized string for focus detail',
    `subject_tag_json` JSON COMMENT 'Localized string for subject tag',
    `unacademy_query` TEXT COMMENT 'Query string for Unacademy, if applicable',
    `action_command` TEXT COMMENT 'Command to execute for action type items',
    `sub_type` VARCHAR(50) COMMENT 'Sub-type for ACTION items (e.g., MORNING_DRILL, DEEP_DIVE)',
    `is_user_created` BOOLEAN DEFAULT TRUE COMMENT 'Whether the item was created by the user',
    `is_starred` BOOLEAN DEFAULT FALSE COMMENT 'Whether the item is starred',
    `google_event_id` VARCHAR(255) COMMENT 'Google Calendar event ID, if synced',
    `deck_id` VARCHAR(255) COMMENT 'Flashcard deck ID, if linked to a flashcard review task',
    `date` DATE COMMENT 'Specific date for one-off tasks (YYYY-MM-DD)',
    `gradient` VARCHAR(255) COMMENT 'CSS gradient string',
    `image_url` VARCHAR(255) COMMENT 'URL for an associated image',
    `external_link` TEXT COMMENT 'External link associated with the task',
    `is_recurring` BOOLEAN DEFAULT FALSE COMMENT 'Whether the task is recurring',
    `q_ranges` TEXT COMMENT 'Question ranges for HomeworkData (e.g., "1-10,15")',
    `category` VARCHAR(50) COMMENT 'Category for HomeworkData (e.g., Level-1, PYQ)',
    `answers_json` JSON COMMENT 'Answers for HomeworkData as JSON',
    `solutions_json` JSON COMMENT 'Solutions for HomeworkData as JSON',
    `practice_history_json` JSON COMMENT 'Practice history for HomeworkData as JSON',
    `status` INT COMMENT 'Status for ActivityData (e.g., percentage completion)',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'All types of user schedule items (tasks, homework, activities)';

-- -----------------------------------------------------
-- Table `results`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `results` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the test result',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table',
    `date` DATE NOT NULL COMMENT 'Date of the test (YYYY-MM-DD)',
    `score` VARCHAR(50) NOT NULL COMMENT 'Score obtained in the test (e.g., "250/300")',
    `mistakes_json` JSON COMMENT 'JSON array of mistake descriptions or question numbers',
    `fixed_mistakes_json` JSON COMMENT 'JSON array of fixed mistakes',
    `syllabus` TEXT COMMENT 'Syllabus covered in the test',
    `timings_json` JSON COMMENT 'Timings per question/section as JSON',
    `analysis_json` JSON COMMENT 'AI-generated analysis report as JSON',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'Records of user test results and analysis';

-- -----------------------------------------------------
-- Table `exams`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `exams` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the exam',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table',
    `title` VARCHAR(255) NOT NULL COMMENT 'Title of the exam',
    `subject` VARCHAR(50) COMMENT 'Subject of the exam (e.g., PHYSICS, MATHS)',
    `date` DATE NOT NULL COMMENT 'Date of the exam',
    `time` VARCHAR(50) COMMENT 'Time of the exam (e.g., "10:00 AM")',
    `syllabus` TEXT COMMENT 'Syllabus covered by the exam',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'User-specific exam schedules and details';

-- -----------------------------------------------------
-- Table `flashcard_decks`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `flashcard_decks` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the flashcard deck',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table',
    `name` VARCHAR(255) NOT NULL COMMENT 'Name of the flashcard deck',
    `subject` VARCHAR(50) COMMENT 'Subject of the deck',
    `chapter` VARCHAR(255) COMMENT 'Chapter related to the deck',
    `is_locked` BOOLEAN DEFAULT FALSE COMMENT 'Whether the deck is locked (e.g., system-generated)',
    `cards_json` JSON COMMENT 'JSON array of Flashcard objects within this deck',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'User-created flashcard decks containing multiple flashcards';

-- -----------------------------------------------------
-- Table `study_sessions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `study_sessions` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the study session',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table',
    `date` DATE NOT NULL COMMENT 'Date of the study session',
    `duration` INT NOT NULL COMMENT 'Duration of the session in seconds',
    `questions_solved` INT COMMENT 'Number of questions solved in the session',
    `questions_skipped_json` JSON COMMENT 'JSON array of questions skipped',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'Records of user study sessions';

-- -----------------------------------------------------
-- Table `doubts`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `doubts` (
    `id` VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'Unique ID for the doubt',
    `user_sid` VARCHAR(255) NOT NULL COMMENT 'Foreign Key to the users table (author of the doubt)',
    `question` TEXT NOT NULL COMMENT 'The doubt question text',
    `question_image` VARCHAR(255) COMMENT 'URL or path to an image related to the question',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the doubt was created',
    `author_name` VARCHAR(255) COMMENT 'Name of the author',
    `author_photo` VARCHAR(255) COMMENT 'URL or path to author''s profile photo',
    `status` VARCHAR(50) NOT NULL DEFAULT 'active' COMMENT 'Status of the doubt (e.g., active, archived, deleted)',
    `solutions_json` JSON COMMENT 'JSON array of DoubtSolutionData objects',
    
    FOREIGN KEY (`user_sid`) REFERENCES `users`(`sid`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COMMENT = 'Community doubts posted by users';