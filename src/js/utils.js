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