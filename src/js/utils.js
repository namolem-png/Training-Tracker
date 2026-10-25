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
 * Возвращает startDate и endDate в формате YYYY-MM-DD для заданного количества дней.
 * @param {number} days - Количество дней (7, 30, 365). 0 для "за все время".
 * @returns {{startDate: string, endDate: string}}
 */
export function getDateRange(days) {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate = '1970-01-01'; // По умолчанию - с начала времен
    if (days > 0) {
        const start = new Date();
        start.setDate(now.getDate() - days);
        startDate = start.toISOString().split('T')[0];
    }
    return { startDate, endDate };
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