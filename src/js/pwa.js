export function injectPWA() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .then(registration => {
                    if (registration && registration.getNotifications) {
                        registration.getNotifications().then(notifications => {
                            notifications.forEach(n => n.close());
                        }).catch(() => {});
                    }
                })
                .catch(err => {
                    console.warn('Ошибка регистрации Service Worker:', err);
                });
        });
    }
}