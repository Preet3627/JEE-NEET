

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

// Mock Schedule Items for a student - Updated with Nov/Dec 2025 Schedule
const mockScheduleItems: ScheduleItem[] = [
    {
      "ID": "2311_1",
      "type": "ACTION",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-23",
      "CARD_TITLE": { "EN": "PHYSICS: COM Theory (Impulse & Momentum)", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Review Center of Mass (COM) principles. Focus on the equation $F_{ext} = M a_{cm}$ and the application of impulse (J) defined as $J = \\Delta p$.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2311_2",
      "type": "ACTION",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-23",
      "CARD_TITLE": { "EN": "ANALYSIS: Test 8 Post-Mortem", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Go through Test 8 paper. Identify 5 specific topics where mistakes were made (silly errors, conceptual errors, calculation errors). Write down the correct concept for each.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "ANALYSIS",
      "TIME": "14:00"
    },
    {
      "ID": "2311_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-23",
      "CARD_TITLE": { "EN": "MATHS: Statistics Practice L1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice **Statistics** questions focusing on Mean, Median, and Mode from Ashadeep L1 material. Ensure accuracy in calculating $\\Sigma x_i / N$ for the mean.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "1-10",
      "isUserCreated": true
    },
    {
      "ID": "2411_1",
      "type": "ACTION",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-11-24",
      "CARD_TITLE": { "EN": "PHYSICS: COM Theory (Collision & Variable Mass)", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Study elastic and inelastic collisions. Focus on the equation for relative velocity after collision: $v_2' - v_1' = -e (v_2 - v_1)$. Review rocket propulsion (variable mass system).", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2411_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-11-24",
      "CARD_TITLE": { "EN": "PHYSICS: COM Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: COM of standard bodies and momentum conservation problems.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-35",
      "isUserCreated": true
    },
    {
      "ID": "2411_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-11-24",
      "CARD_TITLE": { "EN": "PHYSICS: COM Practice L1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice from Ashadeep L1. Focus on two-body and multi-body COM problems.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-28",
      "isUserCreated": true
    },
    {
      "ID": "2411_4",
      "type": "ACTION",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-11-24",
      "CARD_TITLE": { "EN": "CHEMISTRY: Equilibrium Basics", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Introduction to Physical and Chemical Equilibria. Understand the dynamic nature of equilibrium.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "2511_1",
      "type": "ACTION",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-11-25",
      "CARD_TITLE": { "EN": "PHYSICS: Circular Motion (Kinematics)", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Study angular displacement ($\\theta$), angular velocity ($\\omega = d\\theta/dt$), and angular acceleration ($\\alpha = d\\omega/dt$). Relate linear and angular quantities: $v = r\\omega$, $a_t = r\\alpha$, $a_c = r\\omega^2$. ", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2511_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-11-25",
      "CARD_TITLE": { "EN": "PHYSICS: Circular Motion Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Centripetal acceleration ($a_c = v^2/r$) and angular speed calculations.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-35",
      "isUserCreated": true
    },
    {
      "ID": "2511_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-11-25",
      "CARD_TITLE": { "EN": "PHYSICS: Circular Motion Practice L1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice from Ashadeep L1. Focus on calculating centripetal force ($F_c = m v^2/r$).", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "29-56",
      "isUserCreated": true
    },
    {
      "ID": "2511_4",
      "type": "ACTION",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-11-25",
      "CARD_TITLE": { "EN": "CHEMISTRY: $K_p$ and $K_c$ ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Understand the equilibrium constants $K_c$ and $K_p$. Focus on the relation: $K_p = K_c (RT)^{\\Delta n}$. Pay attention to solids and pure liquids in the expression.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "2611_1",
      "type": "ACTION",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-11-26",
      "CARD_TITLE": { "EN": "PHYSICS: Vertical Circular Motion", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Detailed study of tension and velocity at the top ($v_{min} = \\sqrt{gr}$) and bottom of a vertical circle. Use the work-energy theorem to relate the points.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2611_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-11-26",
      "CARD_TITLE": { "EN": "CHEMISTRY: Chemical Equilibrium Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Writing $K_c$ and $K_p$ expressions for various reactions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "1-35",
      "isUserCreated": true
    },
    {
      "ID": "2611_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-11-26",
      "CARD_TITLE": { "EN": "PHYSICS: CM L1/L2 Practice", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete L1 questions (up to 85) and start L2 challenging problems. Focus on dynamic problems involving banking of roads.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "57-85 (L1); 1-10 (L2)",
      "isUserCreated": true
    },
    {
      "ID": "2611_4",
      "type": "ACTION",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-11-26",
      "CARD_TITLE": { "EN": "CHEMISTRY: Factors Affecting Equilibrium", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Understand how concentration, pressure, and temperature affect equilibrium. Introduce the concept of the reaction quotient (Q).", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "2711_1",
      "type": "ACTION",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-11-27",
      "CARD_TITLE": { "EN": "CHEMISTRY: Le Chatelier's Principle", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Deep dive into **Le Chatelier's Principle**. Predict the shift in equilibrium for changes in pressure (based on $\\Delta n_{gas}$), volume, and temperature (based on $\\Delta H$).", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2711_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-11-27",
      "CARD_TITLE": { "EN": "CHEMISTRY: Le Chatelier Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Predicting the shift in equilibrium and acid/base basics.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "36-70",
      "isUserCreated": true
    },
    {
      "ID": "2711_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-11-27",
      "CARD_TITLE": { "EN": "CHEMISTRY: Le Chatelier Practice L1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice from Ashadeep L1. Solve problems based on the effect of changing concentration or adding an inert gas.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "41-80",
      "isUserCreated": true
    },
    {
      "ID": "2711_4",
      "type": "ACTION",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-11-27",
      "CARD_TITLE": { "EN": "MATHS: Mean Deviation & Variance", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Study **measures of dispersion**. Calculate Mean Deviation about Mean and Median. Understand the difference between $\\sigma^2$ (Variance) and $\\sigma$ (Standard Deviation).", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "2811_1",
      "type": "ACTION",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-11-28",
      "CARD_TITLE": { "EN": "CHEMISTRY: Acids/Bases & Buffer Solutions", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Review Arrhenius, Bronsted, and Lewis concepts. Focus on **Buffer solutions** and the Henderson-Hasselbalch equation: $pH = pK_a + log_{10}([Salt]/[Acid])$.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2811_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-11-28",
      "CARD_TITLE": { "EN": "CHEMISTRY: Buffer & Hydrolysis Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Buffer action and calculation of pH for salt solutions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "71-105",
      "isUserCreated": true
    },
    {
      "ID": "2811_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-11-28",
      "CARD_TITLE": { "EN": "CHEMISTRY: Buffer Practice L1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice from Ashadeep L1. Solve numerical problems involving $K_a$, $K_b$, and the pH of buffer solutions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "81-120",
      "isUserCreated": true
    },
    {
      "ID": "2811_4",
      "type": "HOMEWORK",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-11-28",
      "CARD_TITLE": { "EN": "MATHS: Standard Deviation Practice", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Practice problems on **Standard Deviation ($\\sigma$)** for grouped and ungrouped data. Ensure correct application of the formula $\\sigma = \\sqrt{(\\Sigma x_i^2/N) - (\\Sigma x_i/N)^2}$.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "11-23 (L2)",
      "isUserCreated": true
    },
    {
      "ID": "2911_1",
      "type": "ACTION",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-11-29",
      "CARD_TITLE": { "EN": "CHEMISTRY: Hydrolysis & Solubility Product", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Study salt hydrolysis (different types) and the calculation of $K_{sp}$ (Solubility Product). Relate $K_{sp}$ to solubility ($s$) for various salt types (e.g., $AB_2 \\implies K_{sp} = 4s^3$).", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "2911_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-11-29",
      "CARD_TITLE": { "EN": "MATHS: Statistics Dispersion Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Coefficient of variation and properties of standard deviation.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "1-35",
      "isUserCreated": true
    },
    {
      "ID": "2911_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-11-29",
      "CARD_TITLE": { "EN": "PHYSICS: Challenging COM/CM Practice L2", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Solve challenging questions from L2 material. Focus on collisions in 2D and non-uniform circular motion.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "11-44 (L2)",
      "isUserCreated": true
    },
    {
      "ID": "2911_4",
      "type": "HOMEWORK",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-11-29",
      "CARD_TITLE": { "EN": "MATHS: Statistics L1 Final Practice", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete all remaining L1 practice questions for Statistics. Also, review all formulas for Physics chapters (COM & CM).", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "11-31 (L1)",
      "isUserCreated": true
    },
    {
      "ID": "3011_1",
      "type": "ACTION",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-30",
      "CARD_TITLE": { "EN": "CHEMISTRY: Equilibrium Final Review", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Doubt clearing session and final concept review for all of Chemical Equilibrium. Ensure understanding of $Q$ vs $K$ criteria.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "3011_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-30",
      "CARD_TITLE": { "EN": "MATHS: Statistics Final Homework", "GU": "" },
      "FOCUS_DETAIL": { "EN": "School Material Homework MCQs. Concepts: Combined mean/variance, and Standard Deviation of frequency distributions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "36-70",
      "isUserCreated": true
    },
    {
      "ID": "3011_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-30",
      "CARD_TITLE": { "EN": "CHEMISTRY: $K_{sp}$ & L1 Final Qs", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete L1 practice. Focus on problems related to $K_{sp}$ and Common Ion Effect.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "121-184 (L1)",
      "isUserCreated": true
    },
    {
      "ID": "3011_4",
      "type": "HOMEWORK",
      "DAY": { "EN": "SUNDAY", "GU": "" },
      "date": "2025-11-30",
      "CARD_TITLE": { "EN": "CHEMISTRY: Equilibrium Practice L2", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Start challenging L2 questions for Chemical Equilibrium. Focus on multi-step equilibrium problems.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "1-30 (L2)",
      "isUserCreated": true
    },
    {
      "ID": "0112_1",
      "type": "ACTION",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-12-01",
      "CARD_TITLE": { "EN": "REVISION: Targeted Weakness", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Spend 3 hours on the weakest topic identified in the last three practice sessions. Create 5 concise flashcards on that topic.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "0112_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-12-01",
      "CARD_TITLE": { "EN": "HOMEWORK: Mixed Set 1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Mixed 30 Qs (10 P, 10 C, 10 M) from School Material. Timed session: 45 minutes.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-30",
      "isUserCreated": true
    },
    {
      "ID": "0112_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-12-01",
      "CARD_TITLE": { "EN": "CHEMISTRY: Final L2 Practice", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete the remaining challenging L2 questions for Chemical Equilibrium.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "31-71 (L2)",
      "isUserCreated": true
    },
    {
      "ID": "0112_4",
      "type": "HOMEWORK",
      "DAY": { "EN": "MONDAY", "GU": "" },
      "date": "2025-12-01",
      "CARD_TITLE": { "EN": "PHYSICS: COM & CM PYQ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Solve Previous Year Questions (PYQ) for Center of Mass and Circular Motion. Time limit: 60 minutes.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-40 (PYQ)",
      "isUserCreated": true
    },
    {
      "ID": "0212_1",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-12-02",
      "CARD_TITLE": { "EN": "PHYSICS: Final COM & CM PYQ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete all remaining PYQs for Circular Motion and COM.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "41-81 (PYQ)",
      "isUserCreated": true
    },
    {
      "ID": "0212_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-12-02",
      "CARD_TITLE": { "EN": "HOMEWORK: Mixed Set 2", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Mixed 30 Qs (10 P, 10 C, 10 M) from School Material. Timed session: 45 minutes.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "1-30",
      "isUserCreated": true
    },
    {
      "ID": "0212_3",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-12-02",
      "CARD_TITLE": { "EN": "CHEMISTRY: Equilibrium PYQ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Solve Previous Year Questions (PYQ) for Chemical Equilibrium.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "1-30 (PYQ)",
      "isUserCreated": true
    },
    {
      "ID": "0212_4",
      "type": "HOMEWORK",
      "DAY": { "EN": "TUESDAY", "GU": "" },
      "date": "2025-12-02",
      "CARD_TITLE": { "EN": "CHEMISTRY: Final Equilibrium PYQ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete all remaining PYQs for Chemical Equilibrium.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "Q_RANGES": "31-60 (PYQ)",
      "isUserCreated": true
    },
    {
      "ID": "0312_1",
      "type": "HOMEWORK",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-12-03",
      "CARD_TITLE": { "EN": "MATHS: Statistics PYQ", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Complete all Previous Year Questions (PYQ) for Statistics. Focus on problems involving the property of change of origin and scale.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "1-65 (PYQ)",
      "isUserCreated": true
    },
    {
      "ID": "0312_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-12-03",
      "CARD_TITLE": { "EN": "HOMEWORK: Mixed Set 3", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Mixed 30 Qs (10 P, 10 C, 10 M) from School Material. Timed session: 45 minutes.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "Q_RANGES": "1-30",
      "isUserCreated": true
    },
    {
      "ID": "0312_3",
      "type": "ACTION",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-12-03",
      "CARD_TITLE": { "EN": "PRACTICE: Final 2hr Timed Session", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Solve a mixed paper of 60 questions covering all four topics. Strict 2-hour timer.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "14:00"
    },
    {
      "ID": "0312_4",
      "type": "ACTION",
      "DAY": { "EN": "WEDNESDAY", "GU": "" },
      "date": "2025-12-03",
      "CARD_TITLE": { "EN": "ANALYSIS: Error and Note Review", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Analyze the 2-hour test. Review short notes and marked tricky questions only.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "ANALYSIS",
      "TIME": "17:00"
    },
    {
      "ID": "0412_1",
      "type": "ACTION",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-12-04",
      "CARD_TITLE": { "EN": "MOCK: Mock Test 1 (3hr)", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Full 3-hour JEE pattern Mock Test.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "0412_2",
      "type": "ACTION",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-12-04",
      "CARD_TITLE": { "EN": "ANALYSIS: Mock Test 1", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Detailed analysis of Mock Test 1. Spend 1 hour reviewing all attempted and missed questions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "ANALYSIS",
      "TIME": "14:00"
    },
    {
      "ID": "0412_3",
      "type": "ACTION",
      "DAY": { "EN": "THURSDAY", "GU": "" },
      "date": "2025-12-04",
      "CARD_TITLE": { "EN": "PRACTICE: Targeted Re-solve", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Re-solve 5 key conceptual questions from the Mock Test that were incorrectly answered.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "0512_1",
      "type": "ACTION",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-12-05",
      "CARD_TITLE": { "EN": "MOCK: Mock Test 2 (3hr)", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Full 3-hour JEE pattern Mock Test.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "0512_2",
      "type": "ACTION",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-12-05",
      "CARD_TITLE": { "EN": "ANALYSIS: Mock Test 2", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Detailed analysis of Mock Test 2. Spend 1 hour reviewing all attempted and missed questions.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "ANALYSIS",
      "TIME": "14:00"
    },
    {
      "ID": "0512_3",
      "type": "ACTION",
      "DAY": { "EN": "FRIDAY", "GU": "" },
      "date": "2025-12-05",
      "CARD_TITLE": { "EN": "REVISION: Final Weakness Review", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Review 5-10 pages of your most critical notes/error log for final concept solidification.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "16:00"
    },
    {
      "ID": "0612_1",
      "type": "ACTION",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-12-06",
      "CARD_TITLE": { "EN": "REVISION: Final Formula Review", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Quick run-through of all major formulas and name reactions. Physics: $F_c = m v^2/r$, Chemistry: $pH = pK_a + log_{10}([S]/[A])$.", "GU": "" },
      "SUBJECT_TAG": { "EN": "MATHS", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "09:00"
    },
    {
      "ID": "0612_2",
      "type": "HOMEWORK",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-12-06",
      "CARD_TITLE": { "EN": "HOMEWORK: Final 50 MCQs", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Solve a final set of 50 mixed, easy-to-medium MCQs to build confidence.", "GU": "" },
      "SUBJECT_TAG": { "EN": "PHYSICS", "GU": "" },
      "Q_RANGES": "1-50",
      "isUserCreated": true
    },
    {
      "ID": "0612_3",
      "type": "ACTION",
      "DAY": { "EN": "SATURDAY", "GU": "" },
      "date": "2025-12-06",
      "CARD_TITLE": { "EN": "ACTION: Relaxation & Mental Prep", "GU": "" },
      "FOCUS_DETAIL": { "EN": "Stop all academic work. Organize admit card, calculator, and other necessary items. Get adequate rest.", "GU": "" },
      "SUBJECT_TAG": { "EN": "CHEMISTRY", "GU": "" },
      "isUserCreated": true,
      "SUB_TYPE": "DEEP_DIVE",
      "TIME": "18:00"
    }
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
        {
            "ID": "E1",
            "title": "JEE Test 9",
            "subject": "MATHS",
            "date": "2025-12-07",
            "time": "09:00",
            "syllabus": "Circular Motion, Center of Mass, Chemical Equilibrium, Statistics."
        }
    ],
    STUDY_SESSIONS: [
      { date: '2024-05-20', duration: 3600, questions_solved: 20, questions_skipped: [5, 12] },
      { date: '2024-05-21', duration: 5400, questions_solved: 30, questions_skipped: [10] },
    ],
    // DOUBTS: [] // FIX: Removed DOUBTS as it's not part of StudentData
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
    // DOUBTS: [] // FIX: Removed DOUBTS as it's not part of StudentData
  },
];