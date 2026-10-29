export class ImportExportService {
    constructor(model) {
        this.model = model;
    }

    getUniqueTemplateName(baseName) {
        let name = (baseName || 'Шаблон').trim();
        if (!this.model.templates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            return name;
        }
        let counter = 1;
        let candidate = `${name} (импорт)`;
        while (this.model.templates.some(t => t.name.toLowerCase() === candidate.toLowerCase())) {
            counter++;
            candidate = `${name} (импорт ${counter})`;
        }
        return candidate;
    }

    async buildSelectiveExport({ includeLibrary = false, templateIds = [], includeHistory = false, historyDateRange = null } = {}) {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString()
        };

        if (includeLibrary) {
            exportData.categories = this.model.categories;
            exportData.exercises = this.model.exercises;
        }

        if (Array.isArray(templateIds) && templateIds.length > 0) {
            exportData.templates = templateIds.map(tid => {
                const tpl = this.model.templates.find(t => t.id === tid);
                if (!tpl) return null;
                return {
                    id: tpl.id,
                    name: tpl.name,
                    exercises: tpl.exercises, // Array of string IDs for 100% compatibility with older versions
                    exerciseDetails: tpl.exercises.map(exId => {
                        const lib = this.model.getLibraryExercise(exId);
                        return {
                            id: lib.id,
                            name: lib.name,
                            category: this.model.getCategoryName(lib.categoryId),
                            target: lib.target || ''
                        };
                    })
                };
            }).filter(Boolean);
        }

        if (includeHistory) {
            let workouts = await this.model.workoutRepo.getAll();

            if (historyDateRange && (historyDateRange.startDate || historyDateRange.endDate)) {
                const { startDate, endDate } = historyDateRange;
                workouts = workouts.filter(w => {
                    const d = (w.date || '').split('T')[0];
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                });
                exportData.dateRange = {
                    startDate: startDate || null,
                    endDate: endDate || null
                };
            }

            workouts.sort((a, b) => {
                const dateA = (a.date || '').split('T')[0];
                const dateB = (b.date || '').split('T')[0];
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return String(a.id || '').localeCompare(String(b.id || ''));
            });

            exportData.workouts = workouts;

            if (this.model.activeWorkoutId) {
                const isActiveIncluded = workouts.some(w => String(w.id) === String(this.model.activeWorkoutId));
                if (isActiveIncluded) {
                    exportData.activeWorkoutId = this.model.activeWorkoutId;
                }
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

    /**
     * @private
     * Imports library categories and exercises from payload.
     * @param {Object} payload
     * @returns {Promise<{ importedCategoriesCount: number, importedExercisesCount: number }>}
     */
    async _importLibraryCategoriesAndExercises(payload) {
        let importedCategoriesCount = 0;
        let importedExercisesCount = 0;

        if (!payload || !payload.hasLibrary) {
            return { importedCategoriesCount, importedExercisesCount };
        }

        if (Array.isArray(payload.categories)) {
            for (const cat of payload.categories) {
                if (!cat || !cat.name) continue;
                const existing = this.model.categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase());
                if (!existing) {
                    const newCat = { id: cat.id || ('c_' + Date.now() + Math.random().toString(36).substr(2, 4)), name: cat.name };
                    this.model.categories.push(newCat);
                    await this.model.exerciseRepo.saveCategory(newCat);
                    importedCategoriesCount++;
                }
            }
        }

        if (Array.isArray(payload.exercises)) {
            for (const ex of payload.exercises) {
                if (!ex || !ex.name) continue;
                const existing = this.model.exercises.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
                if (!existing) {
                    let catId = ex.categoryId;
                    if (!catId && ex.category) {
                        const cat = this.model.categories.find(c => c.name.toLowerCase() === ex.category.toLowerCase());
                        catId = cat ? cat.id : 'c7';
                    }
                    const newEx = {
                        id: ex.id || ('lib_' + Date.now() + Math.random().toString(36).substr(2, 4)),
                        name: ex.name,
                        categoryId: catId || 'c7',
                        target: ex.target || ''
                    };
                    this.model.exercises.push(newEx);
                    await this.model.exerciseRepo.saveExercise(newEx);
                    importedExercisesCount++;
                } else if (ex.target && (!existing.target || existing.target === '-')) {
                    existing.target = ex.target;
                    await this.model.exerciseRepo.saveExercise(existing);
                }
            }
        }

        return { importedCategoriesCount, importedExercisesCount };
    }

    /**
     * @private
     * Resolves an existing library exercise or creates a new one for a template item.
     * @param {string|Object} item
     * @returns {Promise<{ exerciseId: string, importedCategoriesCount: number, importedExercisesCount: number }|null>}
     */
    async _resolveOrCreateTemplateExercise(item) {
        if (typeof item === 'string') {
            const byId = this.model.exercises.find(e => e.id === item);
            if (byId) {
                return { exerciseId: byId.id, importedCategoriesCount: 0, importedExercisesCount: 0 };
            }
            const byName = this.model.exercises.find(e => e.name.toLowerCase() === item.toLowerCase());
            if (byName) {
                return { exerciseId: byName.id, importedCategoriesCount: 0, importedExercisesCount: 0 };
            }
            const newId = await this.model.addLibraryExercise(item, 'c7', '');
            return { exerciseId: newId, importedCategoriesCount: 0, importedExercisesCount: 1 };
        }

        if (typeof item === 'object' && item !== null) {
            const exName = (item.name || '').trim();
            if (!exName) return null;

            let targetCatId = 'c7';
            let importedCategoriesCount = 0;
            let importedExercisesCount = 0;

            const catName = (item.category || item.categoryName || '').trim();
            if (catName) {
                const cat = this.model.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                if (!cat) {
                    const newCat = { id: 'c_' + Date.now() + Math.random().toString(36).substr(2, 4), name: catName };
                    this.model.categories.push(newCat);
                    await this.model.exerciseRepo.saveCategory(newCat);
                    targetCatId = newCat.id;
                    importedCategoriesCount++;
                } else {
                    targetCatId = cat.id;
                }
            }

            const existingEx = this.model.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
            if (!existingEx) {
                const newEx = {
                    id: 'lib_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    name: exName,
                    categoryId: targetCatId,
                    target: item.target || ''
                };
                this.model.exercises.push(newEx);
                await this.model.exerciseRepo.saveExercise(newEx);
                importedExercisesCount++;
                return { exerciseId: newEx.id, importedCategoriesCount, importedExercisesCount };
            }

            if (item.target && (!existingEx.target || existingEx.target === '-')) {
                existingEx.target = item.target;
                await this.model.exerciseRepo.saveExercise(existingEx);
            }
            return { exerciseId: existingEx.id, importedCategoriesCount, importedExercisesCount };
        }

        return null;
    }

    /**
     * @private
     * Imports selected templates, resolving their exercises and updating templateIdMap.
     * @param {Array<number>} selectedIndices
     * @param {Object} payload
     * @param {Map<string, string>} templateIdMap
     * @returns {Promise<{ importedCategoriesCount: number, importedExercisesCount: number, importedTemplatesCount: number }>}
     */
    async _importSelectedTemplates(selectedIndices, payload, templateIdMap) {
        let importedCategoriesCount = 0;
        let importedExercisesCount = 0;
        let importedTemplatesCount = 0;

        if (!Array.isArray(selectedIndices) || selectedIndices.length === 0 || !payload?.hasTemplates || !Array.isArray(payload.templates)) {
            return { importedCategoriesCount, importedExercisesCount, importedTemplatesCount };
        }

        for (const idx of selectedIndices) {
            const tpl = payload.templates[idx];
            if (!tpl) continue;

            const uniqueName = this.getUniqueTemplateName(tpl.name);
            const templateExIds = [];

            for (const item of (tpl.exerciseDetails || tpl.exercises || [])) {
                const resolved = await this._resolveOrCreateTemplateExercise(item);
                if (resolved?.exerciseId) {
                    templateExIds.push(resolved.exerciseId);
                    importedCategoriesCount += resolved.importedCategoriesCount;
                    importedExercisesCount += resolved.importedExercisesCount;
                }
            }

            const newTpl = {
                id: 'tpl_' + Date.now() + Math.random().toString(36).substr(2, 4),
                name: uniqueName,
                exercises: templateExIds
            };
            this.model.templates.push(newTpl);
            await this.model.templateRepo.save(newTpl);
            importedTemplatesCount++;
            if (tpl.id) {
                templateIdMap.set(tpl.id, newTpl.id);
            }
        }

        return { importedCategoriesCount, importedExercisesCount, importedTemplatesCount };
    }

    /**
     * @private
     * Imports workout history records, remapping template IDs and updating active workout.
     * @param {Object} payload
     * @param {Map<string, string>} templateIdMap
     * @returns {Promise<{ importedWorkoutsCount: number }>}
     */
    async _importWorkoutHistory(payload, templateIdMap) {
        let importedWorkoutsCount = 0;

        if (!payload || !payload.hasHistory || !Array.isArray(payload.workouts)) {
            return { importedWorkoutsCount };
        }

        for (const w of payload.workouts) {
            if (!w) continue;
            const existing = await this.model.workoutRepo.get(w.id);
            const workoutToSave = { ...w };
            if (existing) {
                workoutToSave.id = String(Date.now() + Math.random().toString(36).substr(2, 6));
            }

            let targetTemplateId = null;
            if (w.templateId && templateIdMap.has(w.templateId)) {
                targetTemplateId = templateIdMap.get(w.templateId);
            } else if (w.templateId && this.model.templates.some(t => t.id === w.templateId)) {
                targetTemplateId = w.templateId;
            } else {
                const payloadTpl = Array.isArray(payload.templates) ? payload.templates.find(t => t && t.id === w.templateId) : null;
                if (payloadTpl?.name) {
                    const matchedByName = this.model.templates.find(t => t.name.toLowerCase() === payloadTpl.name.toLowerCase());
                    if (matchedByName) targetTemplateId = matchedByName.id;
                }
            }

            workoutToSave.templateId = targetTemplateId || w.templateId || null;
            delete workoutToSave.templateName;

            await this.model.workoutRepo.save(workoutToSave);
            importedWorkoutsCount++;
        }

        if (payload.activeWorkoutId) {
            const activeExists = await this.model.workoutRepo.get(payload.activeWorkoutId);
            if (activeExists) {
                await this.model.loadActiveWorkout(payload.activeWorkoutId);
            }
        }
        if (!this.model.activeWorkout) {
            const recent = await this.model.getWorkoutsByPage(1, 0);
            if (recent.length > 0) {
                await this.model.loadActiveWorkout(recent[0].id);
            }
        } else {
            await this.model.loadActiveWorkout(this.model.activeWorkoutId);
        }

        return { importedWorkoutsCount };
    }

    async executeSelectiveImport({ importLibrary = false, selectedTemplateIndices = [], importHistory = false } = {}, payload = {}) {
        let importedCategoriesCount = 0;
        let importedExercisesCount = 0;
        let importedTemplatesCount = 0;
        let importedWorkoutsCount = 0;

        const templateIdMap = new Map();

        // 1. Import library (categories & exercises)
        if (importLibrary && payload?.hasLibrary) {
            const libResult = await this._importLibraryCategoriesAndExercises(payload);
            importedCategoriesCount += libResult.importedCategoriesCount;
            importedExercisesCount += libResult.importedExercisesCount;
        }

        // 2. Import templates
        if (Array.isArray(selectedTemplateIndices) && selectedTemplateIndices.length > 0 && payload?.hasTemplates) {
            const tplResult = await this._importSelectedTemplates(selectedTemplateIndices, payload, templateIdMap);
            importedCategoriesCount += tplResult.importedCategoriesCount;
            importedExercisesCount += tplResult.importedExercisesCount;
            importedTemplatesCount += tplResult.importedTemplatesCount;
        }

        // 3. Import workout history
        if (importHistory && payload?.hasHistory) {
            const histResult = await this._importWorkoutHistory(payload, templateIdMap);
            importedWorkoutsCount += histResult.importedWorkoutsCount;
        }

        return {
            importedCategoriesCount,
            importedExercisesCount,
            importedTemplatesCount,
            importedWorkoutsCount
        };
    }
}
