/**
 * Возвращает новую функцию, которая вызывает func не чаще, чем раз в `wait` миллисекунд.
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 * @param {Date} [d=new Date()]
 * @returns {string} YYYY-MM-DD in local time
 */
export function formatLocalDate(d = new Date()) {
    const dateObj = d instanceof Date ? d : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object at local midnight (00:00:00 local).
 * Avoids the ECMAScript ISO-8601 date-only string UTC midnight parsing behavior.
 * @param {string} str - YYYY-MM-DD date string
 * @returns {Date} Date instance at local midnight
 */
export function parseLocalDate(str) {
    if (!str || typeof str !== 'string') return new Date();
    const parts = str.split('-').map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Возвращает startDate и endDate в формате YYYY-MM-DD для заданного количества дней.
 * @param {number} days - Количество дней (7, 30, 365). 0 для "за все время".
 * @returns {{startDate: string, endDate: string}}
 */
export function getDateRange(days) {
    const now = new Date();
    const endDate = formatLocalDate(now);
    let startDate = '1970-01-01'; // По умолчанию - с начала времен
    if (days > 0) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
        startDate = formatLocalDate(start);
    }
    return { startDate, endDate };
}

/**
 * Returns Russian plural noun form based on number.
 * @param {number} num - Count.
 * @param {[string, string, string]} forms - [one, few, many], e.g. ['тренировка', 'тренировки', 'тренировок'].
 * @returns {string}
 */
export function getPluralForm(num, forms) {
    let val = Math.abs(num) % 100;
    if (val >= 5 && val <= 20) return forms[2];
    val %= 10;
    if (val === 1) return forms[0];
    if (val >= 2 && val <= 4) return forms[1];
    return forms[2];
}

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {*} str - The input string or value to escape.
 * @returns {string} Safe HTML-escaped string.
 */
export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Copies text to the clipboard with fallback for unsupported environments.
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            console.warn('navigator.clipboard.writeText failed, using fallback', e);
        }
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
    } catch (e) {
        textArea.remove();
        return false;
    }
}
