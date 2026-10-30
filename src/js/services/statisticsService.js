import { formatLocalDate, getDateRange, parseLocalDate } from '../utils.js';

export class StatisticsService {
    constructor(model) {
        this.model = model;
    }

    /**
     * Вспомогательный метод для кэширования результатов вычислений в SessionStorage.
     */
    async _withCache(methodName, params, computeFn) {
        const lastWorkoutArr = await this.model.workoutRepo.getByPage(
            1,
            0,
            'prev',
        );
        const dataVersion =
            lastWorkoutArr.length > 0 ? lastWorkoutArr[0].id : 'empty';
        const revision = this.model?.dataRevision ?? 0;

        const today = formatLocalDate();
        const cacheKey = `gym_stats_${methodName}_${JSON.stringify(params)}_rev${revision}_${dataVersion}_${today}`;

        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                sessionStorage.removeItem(cacheKey);
            }
        }

        const result = await computeFn();

        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {
            this._clearOldCache();
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(result));
            } catch (err) {}
        }

        return result;
    }

    /**
     * Очищает старые записи кэша статистики из sessionStorage без пропуска индексов.
     */
    _clearOldCache() {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('gym_stats_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }

    /**
     * Инвалидация кэша статистики при мутациях данных.
     */
    invalidateCache() {
        this._clearOldCache();
    }

    clearCache() {
        this._clearOldCache();
    }

    /**
     * Получает данные прогресса для конкретного упражнения
     */
    async getExerciseProgressData(exerciseId, metric, days = 0) {
        return this._withCache(
            'progress',
            { exerciseId, metric, days },
            async () => {
                const results = [];
                const { startDate, endDate } = getDateRange(days);
                const rangeWorkouts = await this.model.workoutRepo.getInRange(
                    startDate,
                    endDate,
                );

                const sortedWorkouts = [...rangeWorkouts].sort(
                    (a, b) => new Date(a.date) - new Date(b.date),
                );

                sortedWorkouts.forEach((workout) => {
                    const instance = (workout.exercises || []).find(
                        (ex) => ex.exerciseId === exerciseId,
                    );
                    if (
                        !instance ||
                        !instance.sets ||
                        instance.sets.length === 0
                    )
                        return;

                    const sets = instance.sets
                        .map((s) => ({
                            weight: Number.parseFloat(s.weight) || 0,
                            reps: Number.parseInt(s.reps, 10) || 0,
                        }))
                        .filter((s) => s.reps > 0);

                    if (sets.length === 0) return;

                    let dayValue = 0;
                    if (metric === 'max') {
                        dayValue = Math.max(...sets.map((s) => s.weight));
                    } else if (metric === '1rm') {
                        const calculated1RMs = sets.map(
                            (s) => s.weight * (1 + s.reps / 30),
                        );
                        dayValue = Math.round(Math.max(...calculated1RMs));
                    } else if (metric === 'avg') {
                        const sum = sets.reduce((acc, s) => acc + s.weight, 0);
                        dayValue = Number.parseFloat(
                            (sum / sets.length).toFixed(1),
                        );
                    } else if (metric === 'tonnage') {
                        dayValue = sets.reduce(
                            (acc, s) => acc + s.weight * s.reps,
                            0,
                        );
                    }

                    const date = (workout.date || '').split('T')[0];
                    results.push({ date, value: dayValue });
                });

                return results;
            },
        );
    }

    /**
     * Получает суммарный тоннаж за каждую тренировку
     */
    async getOverallTonnageData(days = 0) {
        return this._withCache('overall_tonnage', { days }, async () => {
            const { startDate, endDate } = getDateRange(days);
            const rangeWorkouts = await this.model.workoutRepo.getInRange(
                startDate,
                endDate,
            );

            return rangeWorkouts
                .map((w) => {
                    let total = 0;
                    (w.exercises || []).forEach((ex) => {
                        (ex.sets || []).forEach((s) => {
                            total +=
                                (Number.parseFloat(s.weight) || 0) *
                                (Number.parseInt(s.reps, 10) || 0);
                        });
                    });
                    const date = (w.date || '').split('T')[0];
                    return { date, value: total };
                })
                .filter((data) => data !== null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
        });
    }

    /**
     * Получает тоннаж, разбитый по категориям
     */
    async getCategoryTonnageData(days = 0) {
        return this._withCache('category_tonnage', { days }, async () => {
            const { startDate, endDate } = getDateRange(days);
            const rangeWorkouts = await this.model.workoutRepo.getInRange(
                startDate,
                endDate,
            );

            return rangeWorkouts
                .map((w) => {
                    const categories = {};
                    this.model.categories.forEach((c) => {
                        categories[c.name] = 0;
                    });

                    (w.exercises || []).forEach((ex) => {
                        const libEx = this.model.getLibraryExercise(
                            ex.exerciseId,
                        );
                        if (!libEx) return;
                        const catName = this.model.getCategoryName(
                            libEx.categoryId,
                        );
                        if (catName && Object.hasOwn(categories, catName)) {
                            (ex.sets || []).forEach((s) => {
                                categories[catName] +=
                                    (Number.parseFloat(s.weight) || 0) *
                                    (Number.parseInt(s.reps, 10) || 0);
                            });
                        }
                    });
                    const date = (w.date || '').split('T')[0];
                    return { date, categories };
                })
                .filter((data) => data !== null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
        });
    }

    /**
     * Группирует библиотеку для селекторов статистики
     */
    async getGroupedExerciseLibrary() {
        return this._withCache('grouped_lib', {}, async () => {
            const grouped = {};
            const usedExerciseIds = new Set();
            const allWorkouts = await this.model.workoutRepo.getAll();
            allWorkouts.forEach((w) => {
                (w.exercises || []).forEach((e) => {
                    if (
                        e.sets?.some(
                            (s) => (Number.parseInt(s.reps, 10) || 0) > 0,
                        )
                    ) {
                        usedExerciseIds.add(e.exerciseId);
                    }
                });
            });

            this.model.exercises.forEach((ex) => {
                if (!usedExerciseIds.has(ex.id)) return;
                if (!grouped[ex.categoryId]) {
                    grouped[ex.categoryId] = {
                        categoryName: this.model.getCategoryName(ex.categoryId),
                        exercises: [],
                    };
                }
                grouped[ex.categoryId].exercises.push(ex);
            });
            return grouped;
        });
    }

    async getCategorySetsData(days) {
        return this._withCache('category_sets', { days }, async () => {
            const { startDate, endDate } = getDateRange(days);
            const rangeWorkouts = await this.model.workoutRepo.getInRange(
                startDate,
                endDate,
            );

            const stats = {};
            this.model.categories.forEach((c) => {
                stats[c.name] = 0;
            });

            rangeWorkouts.forEach((w) => {
                (w.exercises || []).forEach((ex) => {
                    const libEx = this.model.getLibraryExercise(ex.exerciseId);
                    if (!libEx) return;
                    const catName = this.model.getCategoryName(
                        libEx.categoryId,
                    );
                    if (catName && Object.hasOwn(stats, catName)) {
                        const validSets = (ex.sets || []).filter(
                            (s) => (Number.parseInt(s.reps, 10) || 0) > 0,
                        ).length;
                        stats[catName] += validSets;
                    }
                });
            });
            return stats;
        });
    }

    async getConsecutiveWeeks() {
        return this._withCache('consecutive_weeks', {}, async () => {
            const allWorkouts = await this.model.workoutRepo.getAll();
            if (allWorkouts.length === 0) return 0;
            const weeksWithWorkouts = new Set();
            allWorkouts.forEach((w) => {
                const d = parseLocalDate(w.date);
                const dayNum = d.getDay();
                d.setDate(d.getDate() - (dayNum === 0 ? 6 : dayNum - 1));
                weeksWithWorkouts.add(formatLocalDate(d));
            });
            const now = new Date();
            const nowDay = now.getDay();
            const currentWeekMondayDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - (nowDay === 0 ? 6 : nowDay - 1),
            );
            const currentWeekMonday = formatLocalDate(currentWeekMondayDate);
            const prevWeekMondayDate = new Date(currentWeekMondayDate);
            prevWeekMondayDate.setDate(prevWeekMondayDate.getDate() - 7);
            const prevWeekMonday = formatLocalDate(prevWeekMondayDate);
            if (
                !weeksWithWorkouts.has(currentWeekMonday) &&
                !weeksWithWorkouts.has(prevWeekMonday)
            )
                return 0;
            let streak = 0;
            let checkDate = weeksWithWorkouts.has(currentWeekMonday)
                ? currentWeekMonday
                : prevWeekMonday;
            while (weeksWithWorkouts.has(checkDate)) {
                streak++;
                const d = parseLocalDate(checkDate);
                d.setDate(d.getDate() - 7);
                checkDate = formatLocalDate(d);
            }
            return streak;
        });
    }

    async getGeneralStats() {
        return this._withCache('general_stats', {}, async () => {
            const allWorkouts = await this.model.workoutRepo.getAll();
            const totalWorkouts = allWorkouts.length;
            let totalExercises = 0;
            let totalSets = 0;

            allWorkouts.forEach((w) => {
                w.exercises.forEach((ex) => {
                    if (ex.completed) totalExercises++;
                    totalSets += ex.sets.length;
                });
            });
            return { totalWorkouts, totalExercises, totalSets };
        });
    }
}
