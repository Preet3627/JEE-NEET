/**
 * Attempts to parse a JSON string.
 * @param text The string to parse.
 * @returns The parsed object if successful, otherwise null.
 */
export const tryParseJson = (text: string): any | null => {
    try {
        // First try standard parse
        const parsed = JSON.parse(text);
        if (parsed !== null && (typeof parsed === 'object' || Array.isArray(parsed))) {
            return parsed;
        }
    } catch (e) {
        // If strict parse fails, we might try to relax it slightly if it's very close
        // But main correction logic is in nonAIFallbackCorrection
    }
    return null;
};

/**
 * Advanced Non-AI heuristic-based auto-correction for broken JSON.
 * Significantly improved to handle:
 * - Missing quotes around keys
 * - Missing quotes around string values
 * - Trailing commas
 * - Single quotes instead of double
 * - Missing commas between key-values
 * - JS-style comments
 * @param text The potentially broken JSON string.
 * @returns A string with heuristic corrections applied.
 */
export const nonAIFallbackCorrection = (text: string): string => {
    if (!text) return '{}';
    let json = text.trim();

    // 0. Remove markdown code blocks if present
    json = json.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    // 1. Strip comments (//... and /*...*/)
    json = json.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Ensure outer brackets exist
    if (!json.startsWith('{') && !json.startsWith('[')) {
        // Heuristic: if it looks like a list, wrap in [], else {}
        if (json.includes('"') || json.includes(':')) {
            // likely object or list content
            if (json.trim().startsWith('"') && json.includes(':')) {
                json = `{${json}}`;
            } else {
                // default to object if ambiguous, or list if valid items
                json = `{${json}}`;
            }
        }
    }
    // Simple verification for closing
    if (json.startsWith('{') && !json.endsWith('}')) json += '}';
    if (json.startsWith('[') && !json.endsWith(']')) json += ']';

    // 3. Replace single quotes with double quotes, but preserve ' within text
    // This is tricky. We'll replace ' that are likely delimiters.
    // Replace 'key': 'value' -> "key": "value"
    json = json.replace(/'([^']+)':/g, '"$1":'); // Keys
    json = json.replace(/: '([^']+)'/g, ': "$1"'); // Values

    // 4. Add quotes to unquoted keys
    // Match word followed by colon, not already quoted
    json = json.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    // Handle first key if not covered above
    json = json.replace(/^(\s*){(\s*)([a-zA-Z0-9_]+)(\s*:)/, '$1{$2"$3"$4');

    // 5. Remove trailing commas
    json = json.replace(/,(\s*[}\]])/g, '$1');

    // 6. Fix missing commas between properties
    // Look for "value" "nextKey": or number "nextKey":
    // This regex matches: (quote/number/bool/null) (whitespace/newline) (quote)
    json = json.replace(/("|\d+|true|false|null)(\s+)(?=")/g, '$1,$2');

    // 7. Escape unescaped newlines in strings
    json = json.replace(/"(.*?)"/gs, (match) => {
        return match.replace(/\n/g, '\\n');
    });

    // 8. Replace JS-specifics commonly hallucinated
    json = json.replace(/undefined/g, 'null');
    json = json.replace(/Math\.floor\(([^)]+)\)/g, '$1'); // Unwrap Math.floor
    json = json.replace(/Number\(([^)]+)\)/g, '$1'); // Unwrap Number()

    return json;
};

