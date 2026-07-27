import { STRINGS } from '../constants/strings.js';
import { debounce } from '../utils.js';

/**
 * Класс для отрисовки линейного графика на нативном Canvas
 */
class NativeLineChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.padding = { top: 40, right: 30, bottom: 40, left: 50 };
    }

    // Метод для установки размеров Canvas
    resize() {
        const parent = this.canvas.parentElement;
        const width = parent ? parent.clientWidth - 20 : (this.canvas.offsetWidth || 300);
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
            values = data.map(d => Object.values(d.categories).reduce((a, b) => a + b, 0));
        } else {
            values = data.map(d => d.value);
        }

        let minY = Math.min(...values);
        let maxY = Math.max(...values);
        
        const range = maxY - minY || 10;
        minY = (type === 'line') ? Math.max(0, minY - range * 0.1) : 0;
        if (maxY <= minY) maxY = minY + 1; 
        maxY = maxY + range * 0.1;

        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        const getX = (i) => {
            if (type === 'line' || data.length <= 1) {
                return padding.left + (i * plotWidth / (data.length - 1 || 1));
            } else {
                const segmentWidth = plotWidth / data.length;
                return padding.left + (i * segmentWidth) + segmentWidth / 2;
            }
        };
        const getY = (val) => height - padding.bottom - ((val - minY) * plotHeight / (maxY - minY));
        const barWidth = plotWidth / (data.length || 1) * 0.7;

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
        ctx.fillText(Math.round(minY), padding.left - 10, height - padding.bottom);

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
                ctx.fillRect(xCenter - barWidth / 2, y, barWidth, (height - padding.bottom) - y);
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(point.value), xCenter, y - 5);
            });
        } else if (type === 'stacked') {
            const colors = this.colors || StatisticsView.CATEGORY_COLORS;
            data.forEach((point, i) => {
                let currentYOffset = 0;
                const xCenter = getX(i);
                Object.entries(point.categories).forEach(([cat, val], idx) => {
                    if (val === 0) return;
                    const h = (val / (maxY - minY)) * plotHeight;
                    const y = (height - padding.bottom) - h - currentYOffset;
                    ctx.fillStyle = colors[idx % colors.length];
                    ctx.fillRect(xCenter - barWidth / 2, y, barWidth, h);
                    currentYOffset += h;
                });
                // Выводим общее значение для всего столбца
                const totalBarValue = Object.values(point.categories).reduce((a, b) => a + b, 0);
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(totalBarValue), xCenter, getY(totalBarValue) - 5);
            });
        }

        // 5. Даты (общие для всех типов)
        data.forEach((point, i) => {
            const x = getX(i);
            if (i === 0 || i === data.length - 1 || data.length < 5) {
                ctx.fillStyle = '#888';
                ctx.textAlign = 'center';
                const shortDate = point.date.split('-').slice(1).reverse().join('.');
                ctx.fillText(shortDate, x, height - padding.bottom + 15);
            }
        });
    }
}

/**
 * Класс для отрисовки круговой диаграммы (Doughnut)
 */
class NativePieChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
    }

    resize() {
        const parent = this.canvas.parentElement;
        const width = parent ? parent.clientWidth - 20 : (this.canvas.offsetWidth || 300);
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

    render(data) {
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
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.fillStyle = StatisticsView.CATEGORY_COLORS[i % StatisticsView.CATEGORY_COLORS.length];
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
            let x2 = centerX + cos * (radius + 25);
            let y2 = centerY + sin * (radius + 25);

            // Предотвращение наслоения подписей по вертикали
            const side = isRight ? 'right' : 'left';
            const minDist = 16;
            while (sideY[side].some(prevY => Math.abs(y2 - prevY) < minDist)) {
                y2 += (sin >= 0 ? 5 : -5);
            }
            sideY[side].push(y2);

            const x3 = isRight ? x2 + 35 : x2 - 35; // Конец линии подчеркивания

            // Рисуем линию выноски и подчеркивание
            ctx.strokeStyle = StatisticsView.CATEGORY_COLORS[i % StatisticsView.CATEGORY_COLORS.length];
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
            ctx.fillText(`${key}`+" "+`${percentage}%`, isRight ? x2 + 2 : x2 - 2, y2 - 4);

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

export class StatisticsView {
    // Цвета для категорий, чтобы они были одинаковыми на графике и в легенде
    static CATEGORY_COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#8e44ad', '#1abc9c', '#d35400', '#c0392b'];

    constructor() {
        this.totalWorkoutsEl = document.getElementById('stat-total-workouts');
        this.totalExercisesEl = document.getElementById('stat-total-exercises');
        this.totalSetsEl = document.getElementById('stat-total-sets');
        
        this.progressSelect = document.getElementById('progress-stats-exercise-select');
        this.volumeSelect = document.getElementById('volume-stats-exercise-select');
        this.volumeLegendContainer = document.getElementById('volume-legend-container');
        this.weeklyWidgetContainer = document.getElementById('weekly-volume-widget');
        this.streakContainer = document.getElementById('streak-plaque-container');
        this.balanceChartTitle = document.getElementById('balance-chart-title');
        this.progressChartTitle = document.getElementById('progress-chart-title');
        this.volumeChartTitle = document.getElementById('volume-chart-title');
        
        this.progressChart = null;
        this.volumeChart = null;
        this.balanceChart = null;
        
        this.currentProgressMetric = 'max';
        this.currentVolumeMetric = 'total_tonnage';
        this.activeVolumeCategoryFilter = null; // New property to store active category filter for volume chart
        this.currentProgressInterval = 30; // Default to 1 month
        this.currentVolumeInterval = 30;   // Default to 1 month
        this.currentBalanceInterval = 30;
        this.statsService = null;
    }


    async render(model, statsService) {
        if (!this.totalWorkoutsEl) return;
        this.statsService = statsService;
        
        // Загружаем общую статистику (счетчики)
        const { totalWorkouts, totalExercises, totalSets } = await statsService.getGeneralStats();

        this.totalWorkoutsEl.textContent = totalWorkouts;
        this.totalExercisesEl.textContent = totalExercises;
        this.totalSetsEl.textContent = totalSets;
        await this.renderStreakPlaque(model, statsService);

        if (!this.progressChart) {
            this.progressChart = new NativeLineChart('progress-stats-chart');
            this.progressChart.resize();
        }
        if (!this.volumeChart) {
            this.volumeChart = new NativeLineChart('volume-stats-chart'); // Передаем ID canvas
            this.volumeChart.resize();
        }
        if (!this.balanceChart) {
            this.balanceChart = new NativePieChart('balance-stats-chart');
            this.balanceChart.resize();
        }

        await this.populateExerciseSelects(model, statsService);
        await this.updateProgressChart(model, statsService);
        await this.updateVolumeChart(model, statsService);
        await this.updateBalanceChart(model, statsService);
        await this.updateWeeklyWidget(model, statsService);
    }

    async renderStreakPlaque(model, statsService) {
        if (!this.streakContainer) return;
        const n = await (statsService || this.statsService).getConsecutiveWeeks();
        
        if (n === 0) {
            this.streakContainer.innerHTML = '';
            return;
        }

        const getWord = (num) => {
            const forms = STRINGS.COMMON.UNITS.WEEK_FORMS;
            let val = Math.abs(num) % 100;
            if (val >= 5 && val <= 20) return forms[2];
            val %= 10;
            if (val === 1) return forms[0];
            if (val >= 2 && val <= 4) return forms[1];
            return forms[2];
        };

        const streakText = STRINGS.STATISTICS.STREAK_TEMPLATE
            .replace('{n}', n)
            .replace('{word}', getWord(n));

        this.streakContainer.innerHTML = `
            <div class="streak-plaque">
                <span class="streak-text">${streakText}</span>
            </div>
        `;
    }

    async populateExerciseSelects(model, statsService) {
        const grouped = await (statsService || this.statsService).getGroupedExerciseLibrary();
        const currentProgressVal = this.progressSelect.value;
        const currentVolumeVal = this.volumeSelect.value;
        let firstExerciseId = '';
        
        let optionsHtml = '<option value="">-- Выберите упражнение --</option>';
        Object.values(grouped).forEach(group => {
            optionsHtml += `<optgroup label="${group.categoryName}">`;
            group.exercises.forEach(ex => {
                optionsHtml += `<option value="${ex.id}">${ex.name}</option>`;
                if (!firstExerciseId) firstExerciseId = ex.id; // Запоминаем ID первого упражнения
            });
            optionsHtml += `</optgroup>`;
        });
        
        this.progressSelect.innerHTML = optionsHtml;
        this.volumeSelect.innerHTML = optionsHtml;

        if (currentProgressVal) this.progressSelect.value = currentProgressVal;
        if (currentVolumeVal) this.volumeSelect.value = currentVolumeVal;

        // Выбираем первое упражнение по умолчанию, если ничего не выбрано
        if (!this.progressSelect.value && firstExerciseId) {
            this.progressSelect.value = firstExerciseId;
        }
        if (!this.volumeSelect.value && firstExerciseId) {
            this.volumeSelect.value = firstExerciseId;
        }

        // Добавляем обработчик изменения размера окна для респонсивности Canvas
        window.removeEventListener('resize', this._onResize); // Удаляем предыдущий, если есть
        this._onResize = () => this.render(model);
        this._onResize = debounce(() => this.render(model), 250); // Дебаунс на 250 мс
        window.addEventListener('resize', this._onResize);
    }

    bindEvents(controller) {
        const progressContainer = document.getElementById('statistics-container');
        const volumeContainer = document.getElementById('volume-statistics-container');

        // Универсальная функция для переключения активной кнопки в ряду
        const toggleActiveBtn = (btn) => {
            const row = btn.closest('.chart-type-selector');
            if (row) {
                row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            }
        };

        progressContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.metric) {
                this.currentProgressMetric = btn.dataset.metric;
                toggleActiveBtn(btn);
                this.updateProgressChart(controller.model, controller.statsService);
            } else if (btn.dataset.days) {
                this.currentProgressInterval = parseInt(btn.dataset.days);
                toggleActiveBtn(btn);
                if (this.progressChartTitle) {
                    this.progressChartTitle.textContent = STRINGS.STATISTICS.CHART_TITLES.PROGRESS
                        .replace('{period}', btn.textContent.toLowerCase());
                }
                this.updateProgressChart(controller.model, controller.statsService);
            }

            if (e.target.closest('#btn-stats-help')) {
                alert(STRINGS.STATISTICS.HELP.PROGRESS[this.currentProgressMetric]);
            }
        });

        volumeContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.metric) {
                this.currentVolumeMetric = btn.dataset.metric;
                toggleActiveBtn(btn);
                this.volumeSelect.classList.toggle('d-none', this.currentVolumeMetric !== 'exercise_tonnage');
                this.activeVolumeCategoryFilter = null;
                if (this.volumeLegendContainer) {
                    this.volumeLegendContainer.classList.toggle('d-none', this.currentVolumeMetric !== 'cat_tonnage');
                }
                this.updateVolumeChart(controller.model, controller.statsService);
                this.updateVolumeLegend(controller.model);
            } else if (btn.dataset.days) {
                this.currentVolumeInterval = parseInt(btn.dataset.days);
                toggleActiveBtn(btn);
                if (this.volumeChartTitle) {
                    this.volumeChartTitle.textContent = STRINGS.STATISTICS.CHART_TITLES.VOLUME
                        .replace('{period}', btn.textContent.toLowerCase());
                }
                this.updateVolumeChart(controller.model, controller.statsService);
                this.updateVolumeLegend(controller.model);
            }

            const legendItem = e.target.closest('.legend-item');
            const resetBtn = e.target.closest('#btn-reset-volume-filter');
            if (legendItem && this.currentVolumeMetric === 'cat_tonnage') {
                const categoryId = legendItem.dataset.categoryId;
                this.activeVolumeCategoryFilter = (this.activeVolumeCategoryFilter === categoryId) ? null : categoryId; // Toggle filter
                this.updateVolumeChart(controller.model, controller.statsService);
                this.updateVolumeLegend(controller.model); // Update legend to reflect active state
            } else if (resetBtn && this.currentVolumeMetric === 'cat_tonnage') {
                this.activeVolumeCategoryFilter = null;
                this.updateVolumeChart(controller.model, controller.statsService);
                this.updateVolumeLegend(controller.model);
            }
            if (e.target.closest('#btn-volume-stats-help')) {
                alert(STRINGS.STATISTICS.HELP.VOLUME[this.currentVolumeMetric]);
            }
        });

        const balanceContainer = document.getElementById('balance-statistics-container');
        balanceContainer.addEventListener('click', (e) => {
            const intervalBtn = e.target.closest('#balance-interval-selector button');
            if (intervalBtn) {
                this.currentBalanceInterval = parseInt(intervalBtn.dataset.days);
                balanceContainer.querySelectorAll('#balance-interval-selector button').forEach(b => b.classList.toggle('active', b === intervalBtn));
                
                if (this.balanceChartTitle) {
                    const label = intervalBtn.textContent;
                    this.balanceChartTitle.textContent = STRINGS.STATISTICS.CHART_TITLES.BALANCE_30
                        .replace('{period}', label.toLowerCase());
                }
                
                this.updateBalanceChart(controller.model, controller.statsService);
                return;
            }

            if (e.target.closest('#btn-balance-pie-help')) {
                alert(STRINGS.STATISTICS.HELP.BALANCE_PIE);
            } else if (e.target.closest('#btn-balance-weekly-help')) {
                alert(STRINGS.STATISTICS.HELP.BALANCE_WEEKLY);
            }
        });

        this.progressSelect.addEventListener('change', () => {
            this.updateProgressChart(controller.model, controller.statsService);
        });

        this.volumeSelect.addEventListener('change', () => {
            this.updateVolumeChart(controller.model, controller.statsService);
        });
    }

    async updateProgressChart(model, statsService) {
        if (!this.progressChart) return;
        const exerciseId = this.progressSelect.value;
        if (!exerciseId) return this.progressChart.render([]);
        const s = statsService || this.statsService;
        const data = await s.getExerciseProgressData(exerciseId, this.currentProgressMetric, this.currentProgressInterval);
        const type = (this.currentProgressMetric === 'tonnage') ? 'bar' : 'line'; // Тоннаж упражнения - это столбиковая диаграмма
        this.progressChart.render(data, type);
    }

    async updateVolumeChart(model, statsService) {
        if (!this.volumeChart) return;
        const s = statsService || this.statsService;
        if (this.currentVolumeMetric === 'total_tonnage') {
            this.volumeChart.render(await s.getOverallTonnageData(this.currentVolumeInterval), 'bar');
        } else if (this.currentVolumeMetric === 'cat_tonnage') {
            const rawData = await s.getCategoryTonnageData(this.currentVolumeInterval);
            
            if (this.activeVolumeCategoryFilter) {
                // Filtered view: render as a single-category bar chart
                const category = model.categories.find(c => c.id === this.activeVolumeCategoryFilter);
                const categoryName = category ? category.name : '';
                const categoryColor = StatisticsView.CATEGORY_COLORS[model.categories.findIndex(c => c.id === this.activeVolumeCategoryFilter) % StatisticsView.CATEGORY_COLORS.length];

                const filteredData = rawData.map(d => ({
                    date: d.date,
                    value: d.categories[categoryName] || 0
                }));
                this.volumeChart.render(filteredData, 'bar', { barColor: categoryColor });
            } else {
                this.volumeChart.colors = StatisticsView.CATEGORY_COLORS; // Pass colors for stacked
                this.volumeChart.render(rawData, 'stacked');
            }
        } else if (this.currentVolumeMetric === 'exercise_tonnage') {
            const exerciseId = this.volumeSelect.value;
            if (!exerciseId) return this.volumeChart.render([]);
                this.volumeChart.render(await s.getExerciseProgressData(exerciseId, 'tonnage', this.currentVolumeInterval), 'bar');
        }
    }

    updateVolumeLegend(model) {
        if (!this.volumeLegendContainer) return;

        if (this.currentVolumeMetric === 'cat_tonnage') {
            const categories = model.categories; // Получаем все категории из модели
            const legendItemsHtml = categories.map((cat, index) => {
                const isActive = this.activeVolumeCategoryFilter === cat.id ? 'active' : '';
                return `
                <div class="legend-item ${isActive}" data-category-id="${cat.id}">
                    <span class="legend-dot" style="background-color:${StatisticsView.CATEGORY_COLORS[index % StatisticsView.CATEGORY_COLORS.length]};"></span>
                    <span>${cat.name}</span>
                </div>
                `;
            }).join('');
            this.volumeLegendContainer.innerHTML = `
                ${legendItemsHtml}
                <button id="btn-reset-volume-filter" class="btn-reset-filter">Сбросить фильтр</button>
            `;
            this.volumeLegendContainer.classList.remove('d-none');
        } else {
            this.volumeLegendContainer.innerHTML = '';
            this.volumeLegendContainer.classList.add('d-none');
        }
    }

    async updateBalanceChart(model, statsService) {
        if (!this.balanceChart) return;
        const data = await (statsService || this.statsService).getCategorySetsData(this.currentBalanceInterval);
        this.balanceChart.render(data);
    }

    async updateWeeklyWidget(model, statsService) {
        if (!this.weeklyWidgetContainer) return;
        const data = await (statsService || this.statsService).getCategorySetsData(7);
        
        this.weeklyWidgetContainer.innerHTML = Object.entries(data).map(([name, sets]) => {
            // Определение цвета прогресс-бара
            let color = '#f1c40f'; // Желтый (<10)
            if (sets >= 10 && sets <= 20) color = '#2ecc71'; // Зеленый
            if (sets > 20) color = '#e74c3c'; // Красный
            
            const width = Math.min(100, (sets / 25) * 100); // 25 - условный максимум для ширины

            return `
                <div class="weekly-item">
                    <div class="weekly-item-info">
                        <span class="weekly-item-name">${name}</span>
                        <span class="weekly-item-count">${sets} <span class="weekly-item-target">/ 20</span></span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-fill" style="width: ${width}%; background-color: ${color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}