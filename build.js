const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function build() {
    const srcDir = path.join(__dirname, 'src');
    const distDir = path.join(__dirname, 'dist');

    console.log('Building Training Tracker...');

    // 1. Bundle and minify CSS (automatically resolves @import rules in style.css)
    const cssResult = esbuild.buildSync({
        entryPoints: [path.join(srcDir, 'style.css')],
        bundle: true,
        minify: true,
        write: false,
    });
    const minifiedCss = cssResult.outputFiles[0].text;

    // 2. Bundle and minify JS (automatically resolves all ES module imports starting from app.js)
    const jsResult = esbuild.buildSync({
        entryPoints: [path.join(srcDir, 'js', 'app.js')],
        bundle: true,
        minify: true,
        format: 'iife',
        target: 'es2022',
        write: false,
    });
    const minifiedJs = jsResult.outputFiles[0].text;

    // 3. Inline CSS and JS into index.html
    let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
    html = html.replace(/<link rel="stylesheet" href="style\.css">/, () => '<style>\n' + minifiedCss + '\n</style>');
    html = html.replace(/<script type="module" src="js\/app\.js"><\/script>/, () => '<script>\n' + minifiedJs + '\n</script>');

    // 4. Ensure dist directory exists and write dist/index.html
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    fs.writeFileSync(path.join(distDir, 'index.html'), html);

    // 5. Minify service worker and write to dist/sw.js
    const swPath = path.join(srcDir, 'sw.js');
    if (fs.existsSync(swPath)) {
        const swResult = esbuild.buildSync({
            entryPoints: [swPath],
            bundle: true,
            minify: true,
            target: 'es2022',
            write: false,
        });
        fs.writeFileSync(path.join(distDir, 'sw.js'), swResult.outputFiles[0].text);
    }

    // 6. Copy remaining PWA assets
    const staticAssets = ['manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png', 'favicon.ico'];
    staticAssets.forEach(file => {
        const srcFile = path.join(srcDir, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(distDir, file));
        }
    });

    console.log('Build completed successfully! Assets output to dist/');
}

build();
