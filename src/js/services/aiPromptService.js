import { STRINGS } from '../constants/strings.js';

/**
 * Wraps a single line into multiple lines if it exceeds maxLen,
 * preserving indentation and breaking at word boundaries.
 * Guarantees that every produced line is <= maxLen.
 * @param {string} line - Single line of text.
 * @param {number} maxLen - Maximum line length (default: 80).
 * @returns {string[]} Array of lines where each line is <= maxLen.
 */
export function wrapLine(line, maxLen = 80) {
    if (!line || line.length <= maxLen) return [line];
    if (!line.trim()) return [''];

    const matchIndent = line.match(/^(\s*)/);
    let indent = matchIndent ? matchIndent[1] : '';
    if (indent.length >= maxLen - 10) {
        indent = indent.slice(0, Math.max(0, maxLen - 10));
    }

    const words = line.trim().split(/\s+/);
    const result = [];
    let current = indent;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const lineIndent = (result.length === 0) ? indent : (indent + (indent ? '  ' : ''));
        const safeIndent = lineIndent.length >= maxLen - 5 ? '' : lineIndent;

        const testLine = (current === indent || !current) ? (current + word) : (current + ' ' + word);
        if (testLine.length <= maxLen) {
            current = testLine;
        } else {
            if (current && current !== indent) {
                result.push(current);
            }
            const nextIndent = (result.length === 0) ? indent : safeIndent;
            if ((nextIndent + word).length <= maxLen) {
                current = nextIndent + word;
            } else {
                let rem = word;
                let isFirst = true;
                while (rem.length > 0) {
                    const chunkIndent = isFirst ? nextIndent : safeIndent;
                    const maxChunk = Math.max(1, maxLen - chunkIndent.length);
                    const chunk = rem.slice(0, maxChunk);
                    rem = rem.slice(maxChunk);
                    if (rem.length > 0) {
                        result.push(chunkIndent + chunk);
                    } else {
                        current = chunkIndent + chunk;
                    }
                    isFirst = false;
                }
            }
        }
    }

    if (current && current !== indent) {
        result.push(current);
    }
    return result;
}

/**
 * Wraps all lines in a multi-line text to ensure none exceed maxLen.
 * @param {string} text - Multi-line text string.
 * @param {number} maxLen - Maximum line length (default: 80).
 * @returns {string} Text where every single line is <= maxLen.
 */
export function wrapTextToMax80(text, maxLen = 80) {
    if (!text) return '';
    const rawLines = text.split('\n');
    const finalLines = [];
    for (const line of rawLines) {
        finalLines.push(...wrapLine(line, maxLen));
    }
    return finalLines.join('\n');
}

/**
 * Generates an AI prompt wrapper tailored to the specific data sections included,
 * with clearly separated example and actual data sections and strict 80-char line limit.
 * @param {Object} exportData - The exported dataset containing optional exercises, categories, templates, workouts.
 * @returns {string} The formatted prompt with every line <= 80 characters.
 */
export function generateAiPrompt(exportData) {
    const includedParts = [];

    if (exportData.exercises && exportData.exercises.length > 0) {
        includedParts.push(`каталог упражнений (${exportData.exercises.length} упр.)`);
    }
    if (exportData.templates && exportData.templates.length > 0) {
        const tplNames = exportData.templates.map(t => `«${t.name}»`).join(', ');
        includedParts.push(`шаблоны тренировок: ${tplNames}`);
    }
    if (exportData.workouts && exportData.workouts.length > 0) {
        includedParts.push(`история тренировок (${exportData.workouts.length} записей)`);
    }

    const dataDescription = includedParts.length > 0
        ? includedParts.join(', ')
        : 'тренировочные данные';

    const doubleDivider = '='.repeat(80);
    const dashedDivider = '-'.repeat(80);

    const exampleJsonLines = [
        '{',
        '  "templates": [',
        '    {',
        '      "name": "Название шаблона (например, Верх тела A)",',
        '      "exercises": [',
        '        {',
        '          "name": "Жим штанги лежа",',
        '          "category": "Грудь",',
        '          "target": "3x8-10, отдых 2 мин"',
        '        },',
        '        {',
        '          "name": "Тяга верхнего блока",',
        '          "category": "Спина",',
        '          "target": "3x10-12"',
        '        }',
        '      ]',
        '    }',
        '  ]',
        '}'
    ];

    const actualJsonText = JSON.stringify(exportData, null, 2);

    const promptSections = [
        STRINGS.EXPORT_IMPORT.AI_PROMPT_HEADER,
        `В прикрепленных данных ниже содержится моя информация из трекера тренировок: ${dataDescription}.`,
        '',
        STRINGS.EXPORT_IMPORT.AI_PROMPT_TASK,
        STRINGS.EXPORT_IMPORT.AI_PROMPT_USER_COMMENTS,
        '',
        STRINGS.EXPORT_IMPORT.AI_PROMPT_JSON_INSTRUCTIONS,
        '',
        doubleDivider,
        STRINGS.EXPORT_IMPORT.AI_PROMPT_EXAMPLE_BANNER,
        doubleDivider,
        '```json',
        exampleJsonLines.join('\n'),
        '```',
        '',
        dashedDivider,
        STRINGS.EXPORT_IMPORT.AI_PROMPT_EXAMPLE_END,
        dashedDivider,
        '',
        doubleDivider,
        STRINGS.EXPORT_IMPORT.AI_PROMPT_DATA_BANNER,
        doubleDivider,
        '```json',
        actualJsonText,
        '```'
    ];

    const combinedText = promptSections.join('\n');
    return wrapTextToMax80(combinedText, 80);
}
