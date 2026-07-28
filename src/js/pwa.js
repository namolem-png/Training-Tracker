export function injectPWA() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => {
                console.warn('Ошибка регистрации Service Worker:', err);
            });
        });
    }
}