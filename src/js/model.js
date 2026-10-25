import { STRINGS } from './constants/strings.js';
import { WorkoutRepository } from './repositories/workoutRepository.js';
import { ExerciseRepository } from './repositories/exerciseRepository.js';
import { TemplateRepository } from './repositories/templateRepository.js';
import { ImportExportService } from './services/importExportService.js';

export class AppModel {
    constructor(db) {
        this.db = db;
        this.workoutRepo = new WorkoutRepository(db);
        this.exerciseRepo = new ExerciseRepository(db);
        this.templateRepo = new TemplateRepository(db);
        this.importExportService = new ImportExportService(this);

        this.categories = [];
        this.exercises = [];
        this.templates = [];
        this.activeWorkoutId = null;
        this.activeWorkout = null; // Текущая тренировка, загруженная в память
    }

    async init() {
        await this.db.init();
        
        this.exercises = await this.exerciseRepo.getAllExercises();
        this.categories = await this.exerciseRepo.getAllCategories();
        this.templates = await this.templateRepo.getAll();
        
        const savedId = await this.workoutRepo.getActiveWorkoutId();
        await this.loadActiveWorkout(savedId);

        // Если сохраненной тренировки нет, загружаем самую последнюю
        if (!this.activeWorkout) {
            const recent = await this.getWorkoutsByPage(1, 0);
            if (recent.length > 0) {
                await this.loadActiveWorkout(recent[0].id);
            }
        }

        await this.normalizeActiveWorkout();

        const isMigrated = await this.exerciseRepo.getMigrationFlag();
        if (!isMigrated) {
            await this.migrateLegacyExercises();
        }
    }

    async normalizeActiveWorkout() {
        const w = this.activeWorkout;
        if (w && w.exercises && !Array.isArray(w.exercises) && typeof w.exercises === 'object') {
            const flat = [];
            for (const cat in w.exercises) flat.push(...w.exercises[cat]);
            w.exercises = this.reorderExercisesByCategory(flat);
            await this.workoutRepo.save(w);
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
                await this.exerciseRepo.saveExercise(ex);
            }
        }

        if (this.activeWorkout) {
            let changed = false;
            for (const ex of this.activeWorkout.exercises) {
                if (!ex.exerciseId) {
                    changed = true;
                }
            }
            if (changed) await this.workoutRepo.save(this.activeWorkout);
        }

        await this.exerciseRepo.setMigrationFlag(true);
    }

    async getWorkoutsByPage(limit, offset) {
        return await this.workoutRepo.getByPage(limit, offset, 'prev');
    }

    /**
     * Получает все тренировки за указанный год и месяц.
     * @param {number} year Год.
     * @param {number} month Месяц (0-11).
     * @returns {Promise<Array>} Массив тренировок за месяц.
     */
    async getWorkoutsForMonth(year, month) {
        return await this.workoutRepo.getForMonth(year, month);
    }

    async saveActiveWorkoutId(id) {
        this.activeWorkoutId = id;
        await this.workoutRepo.saveActiveWorkoutId(id);
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
        const workout = await this.workoutRepo.get(id);
        if (workout) {
            // Нормализация данных при загрузке
            if (workout.exercises && !Array.isArray(workout.exercises) && typeof workout.exercises === 'object') {
                const flat = [];
                for (const cat in workout.exercises) flat.push(...workout.exercises[cat]);
                workout.exercises = flat;
            }
            workout.exercises = this.reorderExercisesByCategory(workout.exercises);
            if (workout.templateName !== undefined) {
                delete workout.templateName;
                await this.workoutRepo.save(workout);
            }
            
            this.activeWorkout = workout;
            this.activeWorkoutId = String(id);
            await this.saveActiveWorkoutId(this.activeWorkoutId);
        }
    }

    async getAdjacentWorkoutId(id, direction) {
        return await this.workoutRepo.getAdjacentId(id, direction);
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

    async addWorkout(templateId = null, customDate = null, customDay = null) {
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

        const date = customDate || today.toISOString().split('T')[0];
        const dayOfWeek = customDay || days[today.getDay()];

        const newWorkout = {
            id: Date.now().toString(),
            date: date,
            dayOfWeek: dayOfWeek,
            exercises: this.reorderExercisesByCategory(initialExercises),
            templateId: templateId
        };

        this.activeWorkout = newWorkout;
        await this.saveActiveWorkoutId(newWorkout.id);
        await this.workoutRepo.save(newWorkout);
    }

    async deleteWorkout(id) {
        await this.workoutRepo.delete(id);
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
        await this.workoutRepo.save(workout);
    }

    async addSet(exIndex, weight, reps) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets.push({ weight, reps });
        await this.workoutRepo.save(workout);
    }

    async editSet(exIndex, setIndex, weight, reps) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets[setIndex] = { weight, reps };
        await this.workoutRepo.save(workout);
    }

    async deleteSet(exIndex, setIndex) {
        const workout = this.getActiveWorkout();
        workout.exercises[exIndex].sets.splice(setIndex, 1);
        await this.workoutRepo.save(workout);
    }

    async deleteExerciseFromWorkout(exIndex) {
        const workout = this.getActiveWorkout();
        workout.exercises.splice(exIndex, 1);
        await this.workoutRepo.save(workout);
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
        await this.workoutRepo.save(workout);
    }

    async addLibraryExercise(name, catId, target) {
        let existing = this.exercises.find(e => e.name.toLowerCase() === name.toLowerCase() && e.categoryId === catId);
        if (existing) return existing.id;

        const exerciseId = 'lib_' + Date.now() + Math.random();
        const newLibEx = { id: exerciseId, name, categoryId: catId, target };
        this.exercises.push(newLibEx);
        await this.exerciseRepo.saveExercise(newLibEx);
        return exerciseId;
    }

    async editLibraryExercise(id, name, catId, target) {
        const ex = this.exercises.find(e => e.id === id);
        if (ex) {
            ex.name = name; ex.categoryId = catId; ex.target = target;
            await this.exerciseRepo.saveExercise(ex);
        }
    }

    async deleteLibraryExercise(id) {
        this.exercises = this.exercises.filter(e => e.id !== id);
        await this.exerciseRepo.deleteExercise(id);
    }

    async addCategory(name) {
        if (!this.categories.find(c => c.name === name)) {
            const newCat = { id: 'c_' + Date.now(), name };
            this.categories.push(newCat);
            await this.exerciseRepo.saveCategory(newCat);
            return true;
        }
        return false;
    }

    async deleteCategory(id) {
        this.categories = this.categories.filter(c => c.id !== id);
        await this.exerciseRepo.deleteCategory(id);
    }

    async saveTemplate(id, name, exercises) {
        const templateData = { id: id || 'tpl_' + Date.now(), name, exercises };
        if (id) {
            const idx = this.templates.findIndex(t => t.id === id);
            if (idx > -1) this.templates[idx] = templateData;
        } else {
            this.templates.push(templateData);
        }
        await this.templateRepo.save(templateData);
    }

    async deleteTemplate(id) {
        this.templates = this.templates.filter(t => t.id !== id);
        await this.templateRepo.delete(id);
    }

    getUniqueTemplateName(baseName) {
        return this.importExportService.getUniqueTemplateName(baseName);
    }

    async buildSelectiveExport(options) {
        return await this.importExportService.buildSelectiveExport(options);
    }

    parseImportPayload(rawInput) {
        return this.importExportService.parseImportPayload(rawInput);
    }

    async executeSelectiveImport(options, payload) {
        return await this.importExportService.executeSelectiveImport(options, payload);
    }

    async getExportData() {
        return await this.importExportService.getExportData();
    }

    async importData(importedData) {
        return await this.importExportService.importData(importedData);
    }
}