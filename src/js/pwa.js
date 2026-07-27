export function injectPWA() {
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2c3e50"/><rect x="64" y="208" width="64" height="96" rx="16" fill="#4CAF50"/><rect x="384" y="208" width="64" height="96" rx="16" fill="#4CAF50"/><rect x="160" y="232" width="32" height="48" rx="8" fill="#4CAF50"/><rect x="320" y="232" width="32" height="48" rx="8" fill="#4CAF50"/><rect x="192" y="240" width="128" height="32" fill="#4CAF50"/></svg>`;
    const iconBase64 = btoa(iconSvg);
    const iconDataUrl = `data:image/svg+xml;base64,${iconBase64}`;

    const linkAppleIcon = document.createElement('link');
    linkAppleIcon.rel = 'apple-touch-icon';
    linkAppleIcon.href = iconDataUrl;
    document.head.appendChild(linkAppleIcon);

    const manifest = {
        name: "Дневник Тренировок",
        short_name: "Тренировки",
        display: "standalone",
        background_color: "#f4f7f6",
        theme_color: "#2c3e50",
        icons: [{ src: iconDataUrl, sizes: "512x512", type: "image/svg+xml" }],
        start_url: "."
    };
    
    const manifestDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;
    const linkManifest = document.createElement('link');
    linkManifest.rel = 'manifest';
    linkManifest.href = manifestDataUrl;
    document.head.appendChild(linkManifest);
}