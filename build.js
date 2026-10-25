const fs = require('fs');
const path = require('path');

function build() {
    const srcDir = path.join(__dirname, 'src');

    // Функция для простой минификации CSS
    function minifyCss(cssContent) {
        // Удаляем комментарии /* ... */
        cssContent = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
        // Заменяем переносы строк и табуляции на пробелы
        cssContent = cssContent.replace(/[\n\r\t]+/g, ' ');
        cssContent = cssContent.replace(/\s{2,}/g, ' ');
        // Удаляем пробелы вокруг некоторых символов
        cssContent = cssContent.replace(/\s*([:;,{}])\s*/g, '$1');
        // Удаляем последний символ ';' перед '}'
        cssContent = cssContent.replace(/;}/g, '}');
        // Удаляем пробелы в начале и конце
        cssContent = cssContent.trim();
        return cssContent;
    }

    // Функция для простой минификации JavaScript
    function minifyJs(jsContent) {
        // Защищаем строковые литералы с обратными кавычками (`...`) от удаления переносов строк
        const templateLiterals = [];
        jsContent = jsContent.replace(/`[\s\S]*?`/g, (match) => {
            templateLiterals.push(match);
            return `__TL_${templateLiterals.length - 1}__`;
        });

        // Удаляем однострочные комментарии // ...
        // Избегаем удаления // если они являются частью протокола (например, http://)
        jsContent = jsContent.replace(/(^|[^\:])\/\/.*$/gm, '$1');
        // Удаляем многострочные комментарии /* ... */
        jsContent = jsContent.replace(/\/\*[\s\S]*?\*\//g, '');
        // Заменяем переносы строк и табуляции на пробелы (критично для сохранения ASI)
        jsContent = jsContent.replace(/[\n\r\t]+/g, ' ');
        // Заменяем множественные пробелы на один
        jsContent = jsContent.replace(/\s{2,}/g, ' ');
        // Удаляем пробелы вокруг операторов и скобок (осторожно, чтобы не сломать ASI)
        jsContent = jsContent.replace(/\s*([=+\-\*\/%&|^!~?:,;()\[\]<>])\s*/g, '$1');

        // Восстанавливаем сохраненные шаблонные строки
        jsContent = jsContent.replace(/__TL_(\d+)__/g, (_, idx) => templateLiterals[idx]);

        // Удаляем пробелы в начале и конце
        jsContent = jsContent.trim();
        return jsContent;
    }


    let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');

    // Собираем CSS
    const cssPath = path.join(srcDir, 'style.css');
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    // Заменяем тег link на встроенные стили
    html = html.replace(/<link rel="stylesheet" href="style\.css">/, `<style>\n${minifyCss(css)}\n</style>`);

    // Собираем JS
    const jsFiles = [
        'js/constants/strings.js',
        'js/utils.js',
        'js/services/statisticsService.js',
        'js/services/aiPromptService.js',
        'js/db.js',
        'js/model.js',
        'js/view/workoutView.js',
        'js/view/historyView.js',
        'js/view/statisticsView.js',
        'js/view/settingsView.js',
        'js/view/appView.js',
        'js/pwa.js',
        'js/app.js'
    ];

    let jsBundle = '';
    jsFiles.forEach(file => {
        const filePath = path.join(srcDir, file);
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Очистка модульного синтаксиса для работы в одном файле
            // Удаляем импорты (например, import { ... } from './...')
            content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?/gm, '');
            // Удаляем экспорты (оставляем само определение класса/константы)
            content = content.replace(/^export\s+/gm, '');
            
            jsBundle += `\n/* --- File: ${file} --- */\n${content}\n`;
        } else {
            console.warn(`Предупреждение: Файл ${filePath} не найден.`);
        }
    });

    // Заменяем тег подключения модуля на собранный скрипт
    html = html.replace(/<script type="module" src="js\/app\.js"><\/script>/, `<script>\n${minifyJs(jsBundle)}\n</script>`);

    // Создаем папку dist и сохраняем результат
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'index.html'), html);

    // Копируем файлы PWA (manifest.json, sw.js, icon-192.png, icon-512.png, favicon.png, favicon.ico)
    ['manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'favicon.png', 'favicon.ico'].forEach(file => {
        const srcFile = path.join(srcDir, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(distDir, file));
        }
    });
    
    console.log('Сборка завершена успешно! Файлы в папке dist/');
}

build();