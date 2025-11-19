/**
 * Parses a string of question ranges (e.g., "1-5; 8; 10-12") into an array of numbers.
 * @param rangesStr The input string with semicolon-separated ranges.
 * @returns A sorted array of unique question numbers.
 */
export function getQuestionNumbersFromRanges(rangesStr: string): number[] {
    if (!rangesStr || !rangesStr.trim()) {
        return [];
    }

    const questionNumbers = new Set<number>();

    // Remove page number info for parsing, e.g. "@p45" or "(p. 45)"
    const cleanedRangesStr = rangesStr.replace(/@p\d+/g, '').replace(/\(p\.\s*\d+\)/g, '');

    const parts = cleanedRangesStr.split(/[;,]/);

    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(num => parseInt(num, 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    questionNumbers.add(i);
                }
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num)) {
                questionNumbers.add(num);
            }
        }
    });

    return Array.from(questionNumbers).sort((a, b) => a - b);
}