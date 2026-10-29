import { STRINGS } from '../constants/strings.js';
import { debounce, escapeHtml, getPluralForm } from '../utils.js';
import { CHART_COLORS, NativeLineChart, NativePieChart } from './charts.js';

export class StatisticsView {
    // Цвета для категорий, чтобы они были одинаковыми на графике и в легенде
    static CATEGORY_COLORS = CHART_COLORS;

    constructor() {
        this.totalWorkoutsEl = document.getElementById('stat-total-workouts');
        this.totalExercisesEl = document.getElementById('stat-total-exercises');
        this.totalSetsEl = document.getElementById('stat-total-sets');

        this.progressSelect = document.getElementById(
            'progress-stats-exercise-select',
        );
        this.volumeSelect = document.getElementById(
            'volume-stats-exercise-select',
        );
        this.volumeLegendContainer = document.getElementById(
            'volume-legend-container',
        );
        this.weeklyWidgetContainer = document.getElementById(
            'weekly-volume-widget',
        );
        this.streakContainer = document.getElementById(
            'streak-plaque-container',
        );
        this.balanceChartTitle = document.getElementById('balance-chart-title');
        this.progressChartTitle = document.getElementById(
            'progress-chart-title',
        );
        this.volumeChartTitle = document.getElementById('volume-chart-title');

        this.progressChart = null;
        this.volumeChart = null;
        this.balanceChart = null;

        this.currentProgressMetric = 'max';
        this.currentVolumeMetric = 'total_tonnage';
        this.activeVolumeCategoryFilter = null; // New property to store active category filter for volume chart
        this.currentProgressInterval = 30; // Default to 1 month
        this.currentVolumeInterval = 30; // Default to 1 month
        this.currentBalanceInterval = 30;
        this.model = null;
        this.statsService = null;
    }

    async render(model, statsService) {
        if (!this.totalWorkoutsEl) return;
        const tabEl = document.getElementById('tab-statistics');
        if (tabEl && !tabEl.classList.contains('active')) {
            return;
        }

        if (model) this.model = model;
        if (statsService) this.statsService = statsService;
        const currentModel = model || this.model;
        const currentStats = statsService || this.statsService;
        if (!currentStats) return;

        // Загружаем общую статистику (счетчики)
        const { totalWorkouts, totalExercises, totalSets } =
            await currentStats.getGeneralStats();

        this.totalWorkoutsEl.textContent = totalWorkouts;
        this.totalExercisesEl.textContent = totalExercises;
        this.totalSetsEl.textContent = totalSets;
        await this.renderStreakPlaque(currentModel, currentStats);

        if (!this.progressChart) {
            this.progressChart = new NativeLineChart('progress-stats-chart');
        }
        this.progressChart.resize();

        if (!this.volumeChart) {
            this.volumeChart = new NativeLineChart('volume-stats-chart'); // Передаем ID canvas
        }
        this.volumeChart.resize();

        if (!this.balanceChart) {
            this.balanceChart = new NativePieChart('balance-stats-chart');
        }
        this.balanceChart.resize();

        await this.populateExerciseSelects(currentModel, currentStats);
        await this.updateProgressChart(currentModel, currentStats);
        await this.updateVolumeChart(currentModel, currentStats);
        await this.updateBalanceChart(currentModel, currentStats);
        await this.updateWeeklyWidget(currentModel, currentStats);
    }

    async renderStreakPlaque(model, statsService) {
        if (!this.streakContainer) return;
        const n = await (
            statsService || this.statsService
        ).getConsecutiveWeeks();

        if (n === 0) {
            this.streakContainer.innerHTML = '';
            return;
        }

        const streakText = STRINGS.STATISTICS.STREAK_TEMPLATE.replace(
            '{n}',
            n,
        ).replace('{word}', getPluralForm(n, STRINGS.COMMON.UNITS.WEEK_FORMS));

        this.streakContainer.innerHTML = `
            <div class="streak-plaque">
                <span class="streak-text">${streakText}</span>
            </div>
        `;
    }

    async populateExerciseSelects(model, statsService) {
        const grouped = await (
            statsService || this.statsService
        ).getGroupedExerciseLibrary();
        const currentProgressVal = this.progressSelect.value;
        const currentVolumeVal = this.volumeSelect.value;
        let firstExerciseId = '';

        let optionsHtml = '<option value="">-- Выберите упражнение --</option>';
        Object.values(grouped).forEach((group) => {
            optionsHtml += `<optgroup label="${escapeHtml(group.categoryName)}">`;
            group.exercises.forEach((ex) => {
                optionsHtml += `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.name)}</option>`;
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
    }

    bindEvents(controller) {
        const progressContainer = document.getElementById(
            'statistics-container',
        );
        const volumeContainer = document.getElementById(
            'volume-statistics-container',
        );

        // Универсальная функция для переключения активной кнопки в ряду
        const toggleActiveBtn = (btn) => {
            const row = btn.closest('.chart-type-selector');
            if (row) {
                row.querySelectorAll('button').forEach((b) =>
                    b.classList.toggle('active', b === btn),
                );
            }
        };

        progressContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.metric) {
                this.currentProgressMetric = btn.dataset.metric;
                toggleActiveBtn(btn);
                this.updateProgressChart(
                    controller.model,
                    controller.statsService,
                );
            } else if (btn.dataset.days) {
                this.currentProgressInterval = Number.parseInt(
                    btn.dataset.days,
                    10,
                );
                toggleActiveBtn(btn);
                if (this.progressChartTitle) {
                    this.progressChartTitle.textContent =
                        STRINGS.STATISTICS.CHART_TITLES.PROGRESS.replace(
                            '{period}',
                            btn.textContent.toLowerCase(),
                        );
                }
                this.updateProgressChart(
                    controller.model,
                    controller.statsService,
                );
            }

            if (e.target.closest('#btn-stats-help')) {
                alert(
                    STRINGS.STATISTICS.HELP.PROGRESS[
                        this.currentProgressMetric
                    ],
                );
            }
        });

        volumeContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.metric) {
                this.currentVolumeMetric = btn.dataset.metric;
                toggleActiveBtn(btn);
                this.volumeSelect.classList.toggle(
                    'd-none',
                    this.currentVolumeMetric !== 'exercise_tonnage',
                );
                this.activeVolumeCategoryFilter = null;
                if (this.volumeLegendContainer) {
                    this.volumeLegendContainer.classList.toggle(
                        'd-none',
                        this.currentVolumeMetric !== 'cat_tonnage',
                    );
                }
                this.updateVolumeChart(
                    controller.model,
                    controller.statsService,
                );
                this.updateVolumeLegend(controller.model);
            } else if (btn.dataset.days) {
                this.currentVolumeInterval = Number.parseInt(
                    btn.dataset.days,
                    10,
                );
                toggleActiveBtn(btn);
                if (this.volumeChartTitle) {
                    this.volumeChartTitle.textContent =
                        STRINGS.STATISTICS.CHART_TITLES.VOLUME.replace(
                            '{period}',
                            btn.textContent.toLowerCase(),
                        );
                }
                this.updateVolumeChart(
                    controller.model,
                    controller.statsService,
                );
                this.updateVolumeLegend(controller.model);
            }

            const legendItem = e.target.closest('.legend-item');
            const resetBtn = e.target.closest('#btn-reset-volume-filter');
            if (legendItem && this.currentVolumeMetric === 'cat_tonnage') {
                const categoryId = legendItem.dataset.categoryId;
                this.activeVolumeCategoryFilter =
                    this.activeVolumeCategoryFilter === categoryId
                        ? null
                        : categoryId; // Toggle filter
                this.updateVolumeChart(
                    controller.model,
                    controller.statsService,
                );
                this.updateVolumeLegend(controller.model); // Update legend to reflect active state
            } else if (resetBtn && this.currentVolumeMetric === 'cat_tonnage') {
                this.activeVolumeCategoryFilter = null;
                this.updateVolumeChart(
                    controller.model,
                    controller.statsService,
                );
                this.updateVolumeLegend(controller.model);
            }
            if (e.target.closest('#btn-volume-stats-help')) {
                alert(STRINGS.STATISTICS.HELP.VOLUME[this.currentVolumeMetric]);
            }
        });

        const balanceContainer = document.getElementById(
            'balance-statistics-container',
        );
        balanceContainer.addEventListener('click', (e) => {
            const intervalBtn = e.target.closest(
                '#balance-interval-selector button',
            );
            if (intervalBtn) {
                this.currentBalanceInterval = Number.parseInt(
                    intervalBtn.dataset.days,
                    10,
                );
                balanceContainer
                    .querySelectorAll('#balance-interval-selector button')
                    .forEach((b) =>
                        b.classList.toggle('active', b === intervalBtn),
                    );

                if (this.balanceChartTitle) {
                    const label = intervalBtn.textContent;
                    this.balanceChartTitle.textContent =
                        STRINGS.STATISTICS.CHART_TITLES.BALANCE_30.replace(
                            '{period}',
                            label.toLowerCase(),
                        );
                }

                this.updateBalanceChart(
                    controller.model,
                    controller.statsService,
                );
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

        window.addEventListener(
            'resize',
            debounce(() => {
                const tabEl = document.getElementById('tab-statistics');
                if (tabEl?.classList.contains('active')) {
                    this.render(controller.model, controller.statsService);
                }
            }, 250),
        );
    }

    async updateProgressChart(model, statsService) {
        if (!this.progressChart) return;
        const exerciseId = this.progressSelect.value;
        if (!exerciseId) return this.progressChart.render([]);
        const s = statsService || this.statsService;
        const data = await s.getExerciseProgressData(
            exerciseId,
            this.currentProgressMetric,
            this.currentProgressInterval,
        );
        const type = this.currentProgressMetric === 'tonnage' ? 'bar' : 'line'; // Тоннаж упражнения - это столбиковая диаграмма
        this.progressChart.render(data, type);
    }

    async updateVolumeChart(model, statsService) {
        if (!this.volumeChart) return;
        const s = statsService || this.statsService;
        if (this.currentVolumeMetric === 'total_tonnage') {
            this.volumeChart.render(
                await s.getOverallTonnageData(this.currentVolumeInterval),
                'bar',
            );
        } else if (this.currentVolumeMetric === 'cat_tonnage') {
            const rawData = await s.getCategoryTonnageData(
                this.currentVolumeInterval,
            );

            if (this.activeVolumeCategoryFilter) {
                // Filtered view: render as a single-category bar chart
                const category = model.categories.find(
                    (c) => c.id === this.activeVolumeCategoryFilter,
                );
                const categoryName = category ? category.name : '';
                const categoryColor =
                    StatisticsView.CATEGORY_COLORS[
                        model.categories.findIndex(
                            (c) => c.id === this.activeVolumeCategoryFilter,
                        ) % StatisticsView.CATEGORY_COLORS.length
                    ];

                const filteredData = rawData.map((d) => ({
                    date: d.date,
                    value: d.categories[categoryName] || 0,
                }));
                this.volumeChart.render(filteredData, 'bar', {
                    barColor: categoryColor,
                });
            } else {
                this.volumeChart.colors = StatisticsView.CATEGORY_COLORS; // Pass colors for stacked
                this.volumeChart.render(rawData, 'stacked');
            }
        } else if (this.currentVolumeMetric === 'exercise_tonnage') {
            const exerciseId = this.volumeSelect.value;
            if (!exerciseId) return this.volumeChart.render([]);
            this.volumeChart.render(
                await s.getExerciseProgressData(
                    exerciseId,
                    'tonnage',
                    this.currentVolumeInterval,
                ),
                'bar',
            );
        }
    }

    updateVolumeLegend(model) {
        if (!this.volumeLegendContainer) return;

        if (this.currentVolumeMetric === 'cat_tonnage') {
            const categories = model.categories; // Получаем все категории из модели
            const legendItemsHtml = categories
                .map((cat, index) => {
                    const isActive =
                        this.activeVolumeCategoryFilter === cat.id
                            ? 'active'
                            : '';
                    return `
                <div class="legend-item ${isActive}" data-category-id="${escapeHtml(cat.id)}">
                    <span class="legend-dot" style="background-color:${StatisticsView.CATEGORY_COLORS[index % StatisticsView.CATEGORY_COLORS.length]};"></span>
                    <span>${escapeHtml(cat.name)}</span>
                </div>
                `;
                })
                .join('');
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
        const data = await (
            statsService || this.statsService
        ).getCategorySetsData(this.currentBalanceInterval);
        this.balanceChart.render(data);
    }

    async updateWeeklyWidget(model, statsService) {
        if (!this.weeklyWidgetContainer) return;
        const data = await (
            statsService || this.statsService
        ).getCategorySetsData(7);

        this.weeklyWidgetContainer.innerHTML = Object.entries(data)
            .map(([name, sets]) => {
                // Определение цвета прогресс-бара
                let color = '#f1c40f'; // Желтый (<10)
                if (sets >= 10 && sets <= 20) color = '#2ecc71'; // Зеленый
                if (sets > 20) color = '#e74c3c'; // Красный

                const width = Math.min(100, (sets / 25) * 100); // 25 - условный максимум для ширины

                return `
                <div class="weekly-item">
                    <div class="weekly-item-info">
                        <span class="weekly-item-name">${escapeHtml(name)}</span>
                        <span class="weekly-item-count">${escapeHtml(sets)} <span class="weekly-item-target">/ 20</span></span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-fill" style="width: ${width}%; background-color: ${color};"></div>
                    </div>
                </div>
            `;
            })
            .join('');
    }
}
