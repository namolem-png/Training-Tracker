import { STRINGS } from '../constants/strings.js';

export const CHART_COLORS = [
    '#3498db',
    '#e74c3c',
    '#2ecc71',
    '#f1c40f',
    '#9b59b6',
    '#34495e',
    '#8e44ad',
    '#1abc9c',
    '#d35400',
    '#c0392b',
];

/**
 * Класс для отрисовки линейного графика на нативном Canvas
 */
export class NativeLineChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.padding = { top: 40, right: 30, bottom: 40, left: 50 };
    }

    // Метод для установки размеров Canvas
    resize() {
        const parent = this.canvas.parentElement;
        const width = parent
            ? parent.clientWidth - 20
            : this.canvas.offsetWidth || 300;
        if (width <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const height = width * 0.6; // Используем фиксированное соотношение 5:3

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.scale(dpr, dpr);

        // Сохраняем логические размеры для расчетов отрисовки
        this.width = width;
        this.height = height;
    }

    render(data, type = 'line', options = {}) {
        if (!this.width) this.resize();
        const { ctx, padding, width, height } = this;
        ctx.clearRect(0, 0, width, height);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#777';
            ctx.textAlign = 'center';
            ctx.font = '14px Arial';
            ctx.fillText(STRINGS.COMMON.NO_DATA_CHART, width / 2, height / 2);
            return;
        }

        // 1. Масштабирование
        let values = [];
        if (type === 'stacked') {
            values = data.map((d) =>
                Object.values(d.categories).reduce((a, b) => a + b, 0),
            );
        } else {
            values = data.map((d) => d.value);
        }

        let minY = Math.min(...values);
        let maxY = Math.max(...values);

        const range = maxY - minY || 10;
        minY = type === 'line' ? Math.max(0, minY - range * 0.1) : 0;
        if (maxY <= minY) maxY = minY + 1;
        maxY = maxY + range * 0.1;

        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        const getX = (i) => {
            if (type === 'line' || data.length <= 1) {
                return padding.left + (i * plotWidth) / (data.length - 1 || 1);
            }
            const segmentWidth = plotWidth / data.length;
            return padding.left + i * segmentWidth + segmentWidth / 2;
        };
        const getY = (val) =>
            height -
            padding.bottom -
            ((val - minY) * plotHeight) / (maxY - minY);
        const barWidth = (plotWidth / (data.length || 1)) * 0.7;

        // 2. Сетка и Оси
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        // 3. Подписи Y
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxY), padding.left - 10, padding.top);
        ctx.fillText(
            Math.round(minY),
            padding.left - 10,
            height - padding.bottom,
        );

        if (type === 'line') {
            // 4. Линия графика
            ctx.beginPath();
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            data.forEach((point, i) => {
                const x = getX(i);
                const y = getY(point.value);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Точки
            data.forEach((point, i) => {
                const x = getX(i);
                const y = getY(point.value);
                ctx.fillStyle = '#2c3e50';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#333';
                ctx.fillText(Math.round(point.value), x, y - 10);
            });
        } else if (type === 'bar') {
            data.forEach((point, i) => {
                const xCenter = getX(i);
                const y = getY(point.value);
                ctx.fillStyle = options.barColor || '#3498db';
                ctx.fillRect(
                    xCenter - barWidth / 2,
                    y,
                    barWidth,
                    height - padding.bottom - y,
                );
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(point.value), xCenter, y - 5);
            });
        } else if (type === 'stacked') {
            const colors = this.colors || options.colors || CHART_COLORS;
            data.forEach((point, i) => {
                let currentYOffset = 0;
                const xCenter = getX(i);
                Object.entries(point.categories).forEach(([cat, val], idx) => {
                    if (val === 0) return;
                    const h = (val / (maxY - minY)) * plotHeight;
                    const y = height - padding.bottom - h - currentYOffset;
                    ctx.fillStyle = colors[idx % colors.length];
                    ctx.fillRect(xCenter - barWidth / 2, y, barWidth, h);
                    currentYOffset += h;
                });
                // Выводим общее значение для всего столбца
                const totalBarValue = Object.values(point.categories).reduce(
                    (a, b) => a + b,
                    0,
                );
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.fillText(
                    Math.round(totalBarValue),
                    xCenter,
                    getY(totalBarValue) - 5,
                );
            });
        }

        // 5. Даты (общие для всех типов)
        data.forEach((point, i) => {
            const x = getX(i);
            if (i === 0 || i === data.length - 1 || data.length < 5) {
                ctx.fillStyle = '#888';
                ctx.textAlign = 'center';
                const shortDate = point.date
                    .split('-')
                    .slice(1)
                    .reverse()
                    .join('.');
                ctx.fillText(shortDate, x, height - padding.bottom + 15);
            }
        });
    }
}

/**
 * Класс для отрисовки круговой диаграммы (Doughnut)
 */
export class NativePieChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
    }

    resize() {
        const parent = this.canvas.parentElement;
        const width = parent
            ? parent.clientWidth - 20
            : this.canvas.offsetWidth || 300;
        if (width <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const height = width * 0.8; // Соотношение сторон
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.scale(dpr, dpr);
        this.width = width;
        this.height = height;
    }

    render(data, options = {}) {
        if (!this.width) this.resize();
        const { ctx, width, height } = this;
        ctx.clearRect(0, 0, width, height);

        const values = Object.values(data);
        const total = values.reduce((a, b) => a + b, 0);

        if (total === 0) {
            ctx.fillStyle = '#777';
            ctx.textAlign = 'center';
            ctx.fillText(STRINGS.COMMON.NO_DATA_SIMPLE, width / 2, height / 2);
            return;
        }

        const colors = this.colors || options.colors || CHART_COLORS;
        const centerX = width / 2;
        const centerY = height * 0.5; // Смещаем центр на 10% ниже
        const radius = Math.min(centerX, centerY) * 0.5; // Уменьшаем радиус, чтобы освободить место для подписей
        let startAngle = -Math.PI / 2;

        const sideY = { left: [], right: [] }; // Для отслеживания позиций и предотвращения наслоения

        Object.entries(data).forEach(([key, value], i) => {
            if (value === 0) return;
            const sliceAngle = (value / total) * Math.PI * 2;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(
                centerX,
                centerY,
                radius,
                startAngle,
                startAngle + sliceAngle,
            );
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();

            // Отрисовка подписей (Имя + %)
            const percentage = Math.round((value / total) * 100);
            const middleAngle = startAngle + sliceAngle / 2;

            const cos = Math.cos(middleAngle);
            const sin = Math.sin(middleAngle);
            const isRight = cos >= 0;

            // Координаты начала линии (на краю сектора)
            const x1 = centerX + cos * radius;
            const y1 = centerY + sin * radius;

            // Координаты изгиба линии
            const x2 = centerX + cos * (radius + 25);
            let y2 = centerY + sin * (radius + 25);

            // Предотвращение наслоения подписей по вертикали
            const side = isRight ? 'right' : 'left';
            const minDist = 16;
            while (
                sideY[side].some((prevY) => Math.abs(y2 - prevY) < minDist)
            ) {
                y2 += sin >= 0 ? 5 : -5;
            }
            sideY[side].push(y2);

            const x3 = isRight ? x2 + 35 : x2 - 35; // Конец линии подчеркивания

            // Рисуем линию выноски и подчеркивание
            ctx.strokeStyle = colors[i % colors.length];
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y2);
            ctx.stroke();

            // Рисуем текст подписи над линией подчеркивания
            ctx.fillStyle = '#333';
            ctx.textAlign = isRight ? 'left' : 'right';
            ctx.font = '12px Arial';
            ctx.shadowBlur = 0;
            ctx.fillText(
                `${key}` + ' ' + `${percentage}%`,
                isRight ? x2 + 2 : x2 - 2,
                y2 - 4,
            );

            startAngle += sliceAngle;
        });

        // Рисуем "дырку" пончика
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Текст в центре
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(total, centerX, centerY + 5);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#777';
        ctx.fillText(STRINGS.COMMON.UNITS.SETS, centerX, centerY + 20);
    }
}
