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
            if (workout.templateName !== undefined) {
                delete workout.templateName;
                await this.db.save(STORE.WORKOUTS, workout);
            }
            
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

    getUniqueTemplateName(baseName) {
        let name = (baseName || 'Шаблон').trim();
        if (!this.templates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            return name;
        }
        let counter = 1;
        let candidate = `${name} (импорт)`;
        while (this.templates.some(t => t.name.toLowerCase() === candidate.toLowerCase())) {
            counter++;
            candidate = `${name} (импорт ${counter})`;
        }
        return candidate;
    }

    async buildSelectiveExport({ includeLibrary = false, templateIds = [], includeHistory = false } = {}) {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString()
        };

        if (includeLibrary) {
            exportData.categories = this.categories;
            exportData.exercises = this.exercises;
        }

        if (Array.isArray(templateIds) && templateIds.length > 0) {
            exportData.templates = templateIds.map(tid => {
                const tpl = this.templates.find(t => t.id === tid);
                if (!tpl) return null;
                return {
                    id: tpl.id,
                    name: tpl.name,
                    exercises: tpl.exercises, // Array of string IDs for 100% compatibility with older versions
                    exerciseDetails: tpl.exercises.map(exId => {
                        const lib = this.getLibraryExercise(exId);
                        return {
                            id: lib.id,
                            name: lib.name,
                            category: this.getCategoryName(lib.categoryId),
                            target: lib.target || ''
                        };
                    })
                };
            }).filter(Boolean);
        }

        if (includeHistory) {
            exportData.workouts = await this.db.getAll(STORE.WORKOUTS);
            if (this.activeWorkoutId) {
                exportData.activeWorkoutId = this.activeWorkoutId;
            }
        }

        return exportData;
    }

    parseImportPayload(rawInput) {
        if (!rawInput) throw new Error('Empty payload');

        let parsed = null;
        if (typeof rawInput === 'object') {
            parsed = rawInput;
        } else if (typeof rawInput === 'string') {
            const trimmed = rawInput.trim();
            // Check for markdown ```json ... ``` code fence
            const mdMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            const textToParse = mdMatch ? mdMatch[1].trim() : trimmed;

            try {
                parsed = JSON.parse(textToParse);
            } catch (err) {
                // Try to find the outermost JSON object {...} or array [...]
                const firstBrace = textToParse.indexOf('{');
                const lastBrace = textToParse.lastIndexOf('}');
                const firstBracket = textToParse.indexOf('[');
                const lastBracket = textToParse.lastIndexOf(']');

                let candidate = null;
                if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                    candidate = textToParse.slice(firstBrace, lastBrace + 1);
                } else if (firstBracket !== -1 && lastBracket !== -1) {
                    candidate = textToParse.slice(firstBracket, lastBracket + 1);
                }

                if (candidate) {
                    parsed = JSON.parse(candidate);
                } else {
                    throw new Error('Invalid JSON format');
                }
            }
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid parsed structure');
        }

        // Normalize root shapes
        if (Array.isArray(parsed)) {
            // Could be array of templates or array of workouts
            if (parsed.length > 0 && parsed[0].exercises) {
                parsed = { templates: parsed };
            } else if (parsed.length > 0 && (parsed[0].date || parsed[0].dayOfWeek)) {
                parsed = { workouts: parsed };
            } else {
                parsed = { templates: parsed };
            }
        } else if (parsed.template && typeof parsed.template === 'object') {
            parsed.templates = [parsed.template];
        } else if (!parsed.templates && parsed.name && Array.isArray(parsed.exercises)) {
            parsed = { templates: [parsed] };
        }

        const normalizedTemplates = Array.isArray(parsed.templates) ? parsed.templates.filter(t => t && (t.name || t.exercises)) : [];
        const normalizedCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
        const normalizedExercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
        const normalizedWorkouts = Array.isArray(parsed.workouts) ? parsed.workouts : [];

        const hasLibrary = normalizedExercises.length > 0 || normalizedCategories.length > 0;
        const hasTemplates = normalizedTemplates.length > 0;
        const hasHistory = normalizedWorkouts.length > 0;

        if (!hasLibrary && !hasTemplates && !hasHistory) {
            throw new Error('No compatible tracker data found');
        }

        return {
            hasLibrary,
            hasTemplates,
            hasHistory,
            categories: normalizedCategories,
            exercises: normalizedExercises,
            templates: normalizedTemplates,
            workouts: normalizedWorkouts
        };
    }

    async executeSelectiveImport({ importLibrary = false, selectedTemplateIndices = [], importHistory = false } = {}, payload) {
        let importedCategoriesCount = 0;
        let importedExercisesCount = 0;
        let importedTemplatesCount = 0;
        let importedWorkoutsCount = 0;

        // 1. Import library (categories & exercises)
        if (importLibrary && payload.hasLibrary) {
            for (const cat of payload.categories) {
                if (!cat.name) continue;
                const existing = this.categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase());
                if (!existing) {
                    const newCat = { id: cat.id || ('c_' + Date.now() + Math.random().toString(36).substr(2, 4)), name: cat.name };
                    this.categories.push(newCat);
                    await this.db.save(STORE.CATEGORIES, newCat);
                    importedCategoriesCount++;
                }
            }

            for (const ex of payload.exercises) {
                if (!ex.name) continue;
                const existing = this.exercises.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
                if (!existing) {
                    let catId = ex.categoryId;
                    if (!catId && ex.category) {
                        const cat = this.categories.find(c => c.name.toLowerCase() === ex.category.toLowerCase());
                        catId = cat ? cat.id : 'c7';
                    }
                    const newEx = {
                        id: ex.id || ('lib_' + Date.now() + Math.random().toString(36).substr(2, 4)),
                        name: ex.name,
                        categoryId: catId || 'c7',
                        target: ex.target || ''
                    };
                    this.exercises.push(newEx);
                    await this.db.save(STORE.EXERCISES, newEx);
                    importedExercisesCount++;
                } else if (ex.target && (!existing.target || existing.target === '-')) {
                    existing.target = ex.target;
                    await this.db.save(STORE.EXERCISES, existing);
                }
            }
        }

        // 2. Import templates
        const templateIdMap = new Map();
        if (Array.isArray(selectedTemplateIndices) && selectedTemplateIndices.length > 0 && payload.hasTemplates) {
            for (const idx of selectedTemplateIndices) {
                const tpl = payload.templates[idx];
                if (!tpl) continue;

                const uniqueName = this.getUniqueTemplateName(tpl.name);
                const templateExIds = [];

                for (const item of (tpl.exerciseDetails || tpl.exercises || [])) {
                    if (typeof item === 'string') {
                        // Check if ID exists
                        const byId = this.exercises.find(e => e.id === item);
                        if (byId) {
                            templateExIds.push(byId.id);
                            continue;
                        }
                        // Check if name matches
                        const byName = this.exercises.find(e => e.name.toLowerCase() === item.toLowerCase());
                        if (byName) {
                            templateExIds.push(byName.id);
                            continue;
                        }
                        // Create new exercise
                        const newId = await this.addLibraryExercise(item, 'c7', '');
                        templateExIds.push(newId);
                        importedExercisesCount++;
                    } else if (typeof item === 'object' && item !== null) {
                        const exName = (item.name || '').trim();
                        if (!exName) continue;

                        let targetCatId = 'c7';
                        const catName = (item.category || item.categoryName || '').trim();
                        if (catName) {
                            let cat = this.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                            if (!cat) {
                                const newCat = { id: 'c_' + Date.now() + Math.random().toString(36).substr(2, 4), name: catName };
                                this.categories.push(newCat);
                                await this.db.save(STORE.CATEGORIES, newCat);
                                targetCatId = newCat.id;
                                importedCategoriesCount++;
                            } else {
                                targetCatId = cat.id;
                            }
                        }

                        let existingEx = this.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
                        if (!existingEx) {
                            const newEx = {
                                id: 'lib_' + Date.now() + Math.random().toString(36).substr(2, 4),
                                name: exName,
                                categoryId: targetCatId,
                                target: item.target || ''
                            };
                            this.exercises.push(newEx);
                            await this.db.save(STORE.EXERCISES, newEx);
                            templateExIds.push(newEx.id);
                            importedExercisesCount++;
                        } else {
                            if (item.target && (!existingEx.target || existingEx.target === '-')) {
                                existingEx.target = item.target;
                                await this.db.save(STORE.EXERCISES, existingEx);
                            }
                            templateExIds.push(existingEx.id);
                        }
                    }
                }

                const newTpl = {
                    id: 'tpl_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    name: uniqueName,
                    exercises: templateExIds
                };
                this.templates.push(newTpl);
                await this.db.save(STORE.TEMPLATES, newTpl);
                importedTemplatesCount++;
                if (tpl.id) {
                    templateIdMap.set(tpl.id, newTpl.id);
                }
            }
        }

        // 3. Import workout history
        if (importHistory && payload.hasHistory) {
            for (const w of payload.workouts) {
                const existing = await this.db.get(STORE.WORKOUTS, String(w.id));
                const workoutToSave = { ...w };
                if (existing) {
                    workoutToSave.id = String(Date.now() + Math.random().toString(36).substr(2, 6));
                }

                let targetTemplateId = null;
                if (w.templateId && templateIdMap.has(w.templateId)) {
                    targetTemplateId = templateIdMap.get(w.templateId);
                } else if (w.templateId && this.templates.some(t => t.id === w.templateId)) {
                    targetTemplateId = w.templateId;
                } else {
                    const payloadTpl = Array.isArray(payload.templates) ? payload.templates.find(t => t && t.id === w.templateId) : null;
                    if (payloadTpl && payloadTpl.name) {
                        const matchedByName = this.templates.find(t => t.name.toLowerCase() === payloadTpl.name.toLowerCase());
                        if (matchedByName) targetTemplateId = matchedByName.id;
                    }
                }

                workoutToSave.templateId = targetTemplateId || w.templateId || null;
                delete workoutToSave.templateName;

                await this.db.save(STORE.WORKOUTS, workoutToSave);
                importedWorkoutsCount++;
            }

            if (payload.activeWorkoutId) {
                const activeExists = await this.db.get(STORE.WORKOUTS, String(payload.activeWorkoutId));
                if (activeExists) {
                    await this.loadActiveWorkout(payload.activeWorkoutId);
                }
            }
            if (!this.activeWorkout) {
                const recent = await this.getWorkoutsByPage(1, 0);
                if (recent.length > 0) {
                    await this.loadActiveWorkout(recent[0].id);
                }
            } else {
                await this.loadActiveWorkout(this.activeWorkoutId);
            }
        }

        return {
            importedCategoriesCount,
            importedExercisesCount,
            importedTemplatesCount,
            importedWorkoutsCount
        };
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