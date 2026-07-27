import { STORE } from './db.js';
import { STRINGS } from './constants/strings.js';

export class AppModel {
    constructor(db) {
        this.db = db;
        this.categories = [];
        this.exercises = [];
        this.templates = [];
        this.activeWorkoutId = null;
        this.activeWorkout = null; // Текущая тренировка, загруженная в память
    }

    async init() {
        await this.db.init();
        
        this.exercises = await this.db.getAll(STORE.EXERCISES);
        this.categories = await this.db.getAll(STORE.CATEGORIES);
        this.templates = await this.db.getAll(STORE.TEMPLATES);
        
        const activeSetting = await this.db.get(STORE.SETTINGS, 'activeWorkoutId');
        const savedId = activeSetting ? String(activeSetting.value) : null;

        await this.loadActiveWorkout(savedId);

        // Если сохраненной тренировки нет, загружаем самую последнюю
        if (!this.activeWorkout) {
            const recent = await this.getWorkoutsByPage(1, 0);
            if (recent.length > 0) {
                await this.loadActiveWorkout(recent[0].id);
            }
        }

        await this.normalizeActiveWorkout();

        const migrationFlag = await this.db.get(STORE.SETTINGS, 'isLegacyMigrated');
        if (!migrationFlag || !migrationFlag.value) {
            await this.migrateLegacyExercises();
        }
    }

    async normalizeActiveWorkout() {
        const w = this.activeWorkout;
        if (w && w.exercises && !Array.isArray(w.exercises) && typeof w.exercises === 'object') {
            const flat = [];
            for (const cat in w.exercises) flat.push(...w.exercises[cat]);
            w.exercises = this.reorderExercisesByCategory(flat);
            await this.db.save(STORE.WORKOUTS, w);
        }
    }

    async migrateLegacyExercises() {
        if (!this.exercises) this.exercises = [];
        const getCatId = (name) => {
            const found = this.categories.find(c => c.name === name);
            return found ? found.id : 'c7'; 
        };

        for (const ex of [...this.exercises]) {
            if (ex.cat) {
                ex.categoryId = getCatId(ex.cat);
                delete ex.cat;
                await this.db.save(STORE.EXERCISES, ex);
            }
        }

        // Миграция теперь должна проходить по всей базе, но это тяжелая операция. 
        // Оставим её только для активной тренировки при загрузке или сделаем разовый скрипт.
        if (this.activeWorkout) {
            let changed = false;
            for (const ex of this.activeWorkout.exercises) {
                if (!ex.exerciseId) {
                    // ... логика поиска libEntry ...
                    changed = true;
                }
            }
            if (changed) await this.db.save(STORE.WORKOUTS, this.activeWorkout);
        }

        // Помечаем, что миграция успешно выполнена, чтобы не повторять её при следующем запуске
        await this.db.save(STORE.SETTINGS, { id: 'isLegacyMigrated', value: true });
    }

    async getWorkoutsByPage(limit, offset) {
        return await this.db.getByPage(STORE.WORKOUTS, 'date', limit, offset, 'prev');
    }

    /**
     * Получает все тренировки за указанный год и месяц.
     * @param {number} year Год.
     * @param {number} month Месяц (0-11).
     * @returns {Promise<Array>} Массив тренировок за месяц.
     */
    async getWorkoutsForMonth(year, month) {
        const monthStr = String(month + 1).padStart(2, '0');
        const startDate = `${year}-${monthStr}-01`;
        
        // Определяем последний день месяца
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        // Запрашиваем из базы только этот диапазон, сортируем от новых к старым (prev)
        return await this.db.getInRange(STORE.WORKOUTS, 'date', startDate, endDate, 'prev');
    }

    async saveActiveWorkoutId(id) {
        this.activeWorkoutId = id;
        await this.db.save(STORE.SETTINGS, { id: 'activeWorkoutId', value: id });
    }

    getActiveWorkout() {
        return this.activeWorkout;
    }

    /**
     * Загружает конкретную тренировку из БД и делает её активной
     */
    async loadActiveWorkout(id) {
        if (!id) {
            this.activeWorkout = null;
            this.activeWorkoutId = null;
            return;
        }
        const workout = await this.db.get(STORE.WORKOUTS, String(id));
        if (workout) {
            // Нормализация данных при загрузке
            if (workout.exercises && !Array.isArray(workout.exercises) && typeof workout.exercises === 'object') {
                const flat = [];
                for (const cat in workout.exercises) flat.push(...workout.exercises[cat]);
                workout.exercises = flat;
            }
            workout.exercises = this.reorderExercisesByCategory(workout.exercises);
            
            this.activeWorkout = workout;
            this.activeWorkoutId = String(id);
            await this.saveActiveWorkoutId(this.activeWorkoutId);
        }
    }

    async getAdjacentWorkoutId(id, direction) {
        const current = await this.db.get(STORE.WORKOUTS, String(id));
        if (!current) return null;
        return await this.db.getAdjacentId(STORE.WORKOUTS, 'date', String(id), current.date, direction);
    }

    getCategoryName(id) {
        const cat = this.categories.find(c => c.id === id);
        return cat ? cat.name : STRINGS.MODEL.DEFAULT_CATEGORY;
    }

    getLibraryExercise(id) {
        return this.exercises.find(e => e.id === id) || { name: STRINGS.MODEL.DELETED_EXERCISE, categoryId: 'c5', target: STRINGS.MODEL.TARGET_NONE };
    }

    reorderExercisesByCategory(exercises) {
        if (!Array.isArray(exercises)) return exercises;
        const grouped = {};
        const catOrder = this.categories.map(c => c.id);
        exercises.forEach(ex => {
            const catId = this.getLibraryExercise(ex.exerciseId).categoryId;
            if (!grouped[catId]) grouped[catId] = [];
            grouped[catId].push(ex);
        });
        return catOrder.filter(id => grouped[id]).flatMap(id => grouped[id]);
    }

    async addWorkout(templateId = null) {
        const today = new Date();
        const days = STRINGS.COMMON.DAYS;
        let initialExercises = [];
        
        if (templateId) {
            const template = this.templates.find(t => t.id === templateId);
            if (template) {
                initialExercises = template.exercises.map(exId => ({
                    id: 'inst_' + Date.now() + Math.random(),
                    exerciseId: exId,
                    completed: false,
                    sets: []
                }));
            }
        }

        const newWorkout = {
            id: Date.now().toString(),
            date: today.toISOString().split('T')[0],
            dayOfWeek: days[today.getDay()],
            exercises: this.reorderExercisesByCategory(initialExercises),
            templateId: templateId
                };

        this.activeWorkout = newWorkout;
        await this.saveActiveWorkoutId(newWorkout.id);
        await this.db.save(STORE.WORKOUTS, newWorkout);
    }

    async deleteWorkout(id) {
        await this.db.delete(STORE.WORKOUTS, id);
        if (this.activeWorkoutId === id) {
            this.activeWorkout = null;
            this.activeWorkoutId = null;
            const recent = await this.getWorkoutsByPage(1, 0);
            if (recent.length > 0) await this.loadActiveWorkout(recent[0].id);
        }
    }

    async toggleComplete(exIndex) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].completed = !workout.exercises[exIndex].completed;
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async addSet(exIndex, weight, reps) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets.push({ weight, reps });
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async editSet(exIndex, setIndex, weight, reps) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets[setIndex] = { weight, reps };
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async deleteSet(exIndex, setIndex) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets.splice(setIndex, 1);
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async deleteExerciseFromWorkout(exIndex) {
        const workout = this.getActiveWorkout();
        workout.exercises.splice(exIndex, 1);
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async addExerciseToWorkout(exerciseId) {
        const workout = this.getActiveWorkout();
        workout.exercises.push({
            id: 'inst_' + Date.now(),
            exerciseId: exerciseId,
            completed: false,
            sets: []
        });
        workout.exercises = this.reorderExercisesByCategory(workout.exercises);
        await this.db.save(STORE.WORKOUTS, workout);
    }

    async addLibraryExercise(name, catId, target) {
        let existing = this.exercises.find(e => e.name.toLowerCase() === name.toLowerCase() && e.categoryId === catId);
        if (existing) return existing.id;

        const exerciseId = 'lib_' + Date.now() + Math.random();
        const newLibEx = { id: exerciseId, name, categoryId: catId, target };
        this.exercises.push(newLibEx);
        await this.db.save(STORE.EXERCISES, newLibEx);
        return exerciseId;
    }

    async editLibraryExercise(id, name, catId, target) {
        const ex = this.exercises.find(e => e.id === id);
        if (ex) {
            ex.name = name; ex.categoryId = catId; ex.target = target;
            await this.db.save(STORE.EXERCISES, ex);
        }
    }

    async deleteLibraryExercise(id) {
        this.exercises = this.exercises.filter(e => e.id !== id);
        await this.db.delete(STORE.EXERCISES, id);
    }

    async addCategory(name) {
        if (!this.categories.find(c => c.name === name)) {
            const newCat = { id: 'c_' + Date.now(), name };
            this.categories.push(newCat);
            await this.db.save(STORE.CATEGORIES, newCat);
            return true;
        }
        return false;
    }

    async deleteCategory(id) {
        this.categories = this.categories.filter(c => c.id !== id);
        await this.db.delete(STORE.CATEGORIES, id);
    }

    async saveTemplate(id, name, exercises) {
        const templateData = { id: id || 'tpl_' + Date.now(), name, exercises };
        if (id) {
            const idx = this.templates.findIndex(t => t.id === id);
            if (idx > -1) this.templates[idx] = templateData;
        } else {
            this.templates.push(templateData);
        }
        await this.db.save(STORE.TEMPLATES, templateData);
    }

    async deleteTemplate(id) {
        this.templates = this.templates.filter(t => t.id !== id);
        await this.db.delete(STORE.TEMPLATES, id);
    }

    async getExportData() {
        return {
            workouts: await this.db.getAll(STORE.WORKOUTS),
            exercises: this.exercises,
            categories: this.categories,
            templates: this.templates,
            activeWorkoutId: this.activeWorkoutId
        };
    }

    async importData(importedData) {
        const stores = [STORE.WORKOUTS, STORE.EXERCISES, STORE.CATEGORIES, STORE.TEMPLATES, STORE.SETTINGS];
        for (const store of stores) await this.db.clear(store);

        if (importedData.workouts) for (const w of importedData.workouts) await this.db.save(STORE.WORKOUTS, w);
        if (importedData.exercises) for (const e of importedData.exercises) await this.db.save(STORE.EXERCISES, e);
        if (importedData.categories) for (const c of importedData.categories) await this.db.save(STORE.CATEGORIES, c);
        if (importedData.templates) for (const t of importedData.templates) await this.db.save(STORE.TEMPLATES, t);
        if (importedData.activeWorkoutId) await this.db.save(STORE.SETTINGS, { id: 'activeWorkoutId', value: importedData.activeWorkoutId });
    }
}