/**
 * Attempts to parse a JSON string.
 * @param text The string to parse.
 * @returns The parsed object if successful, otherwise null.
 */
export const tryParseJson = (text: string): any | null => {
    try {
        const parsed = JSON.parse(text);
        // Ensure it's a valid JSON object/array, not just a primitive like "null" or "123"
        if (parsed !== null && (typeof parsed === 'object' || Array.isArray(parsed))) {
            return parsed;
        }
    } catch (e) {
        // Ignore parsing errors, we'll return null
    }
    return null;
};

/**
 * Attempts to perform non-AI, heuristic-based auto-correction on a potentially broken JSON string.
 * Fixes common issues like missing quotes, trailing commas, missing brackets, etc.
 * @param text The potentially broken JSON string.
 * @returns A string with heuristic corrections applied.
 */
export const nonAIFallbackCorrection = (text: string): string => {
    let correctedText = text.trim();

    // 1. Add missing outer brackets/braces if they seem to be missing
    if (!correctedText.startsWith('[') && !correctedText.startsWith('{')) {
        correctedText = `{${correctedText}`;
    }
    if (!correctedText.endsWith(']') && !correctedText.endsWith('}')) {
        correctedText = `${correctedText}}`;
    }
    
    // 2. Replace single quotes with double quotes
    correctedText = correctedText.replace(/'/g, '"');

    // 3. Add missing double quotes around keys (basic attempt, handles simple cases)
    // This regex looks for:
    // - start of object/comma (non-capturing group)
    // - optional whitespace
    // - an unquoted word (key) that is NOT a number (to avoid quoting numbers)
    // - optional whitespace
    // - a colon
    correctedText = correctedText.replace(/([,{]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    // 4. Remove trailing commas (e.g., in objects or arrays like {"a":1,})
    correctedText = correctedText.replace(/,(\s*[}\]])/g, '$1');

    // 5. Add missing commas between key-value pairs or array elements (simple cases)
    // This is tricky and can introduce errors. A simple heuristic: if a '}' or ']' is immediately
    // followed by a '{' or '[', or if a quoted string/number is followed by a quoted string/number,
    // and there's no comma, add one. This is very basic and prone to false positives.
    // For now, let's focus on less risky corrections.

    // 6. Handle unescaped newlines in string values (JSON doesn't allow raw newlines)
    correctedText = correctedText.replace(/"(.*?)\n(.*?)"/gs, (match, p1, p2) => {
        // Only replace if not already escaped
        if (!p1.endsWith('\\')) {
            return `"${p1}\\n${p2}"`;
        }
        return match;
    });

    // 7. Try to fix unclosed strings (very basic)
    correctedText = correctedText.replace(/"([^ vital"]*)$/, '"$1"');

    // Attempt to pretty print (can help reveal syntax issues by re-indenting)
    try {
        const parsed = JSON.parse(correctedText);
        correctedText = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // If pretty-printing fails, just keep the best-effort corrected text
    }

    return correctedText;
};
