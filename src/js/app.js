import { GymDatabase, STORE } from './db.js';
import { AppModel } from './model.js';
import { AppView } from './view/appView.js';
import { injectPWA } from './pwa.js';
import { STRINGS } from './constants/strings.js';
import { StatisticsService } from './services/statisticsService.js';
import { copyToClipboard } from './utils.js';
import { generateAiPrompt } from './services/aiPromptService.js';

export class AppController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.statsService = new StatisticsService(model);
        this.currentParsedImportPayload = null;
        this.isDraftMode = false;
        this.previousWorkoutIdBeforeDraft = null;
    }

    async init() {
        await this.model.init();
        this.view.init(this);

        window.addEventListener('hashchange', () => this.handleRouting());
        this.handleRouting();
    }

    async handleRouting() {
        let hash = window.location.hash.substring(1);
        const validTabs = ['workout', 'history', 'statistics', 'settings'];
        if (!validTabs.includes(hash)) {
            if (window.location.protocol === 'file:') {
                window.location.hash = '#workout';
            } else {
                history.replaceState(null, null, '#workout');
            }
            hash = 'workout';
        }
        if (hash !== 'workout' && this.isDraftMode) {
            await this.cancelWorkoutDraft();
        }
        this.view.switchTab(hash);
        if (hash === 'workout' && this.isDraftMode) {
            this.view.showWorkoutDraft(this.model);
        } else {
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleToggleComplete(exIndex, cardElement) {
        await this.model.toggleComplete(exIndex);
        const isCompleted = this.model.getActiveWorkout().exercises[exIndex].completed;
        if (cardElement) {
            cardElement.classList.toggle('completed', isCompleted);
            this.view.updateProgress(this.model);
            await this.view.statisticsView.render(this.model, this.statsService);
        } else {
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleAddSet(exIndex, weight, reps, cardElement) {
        if (!weight || !reps) return alert(STRINGS.MESSAGES.ERROR_NO_WEIGHT_REPS);
        const savePromise = this.model.addSet(exIndex, weight, reps);
        await this.updateWorkoutAndStats(exIndex, cardElement, true);
        await savePromise;
    }

    async handleEditSet(exIdx, setIdx, cardElement) {
        const w = this.model.getActiveWorkout().exercises[exIdx].sets[setIdx];
        const newW = prompt("Новый вес (кг):", w.weight); if (newW === null) return;
        const newR = prompt("Новые повторения:", w.reps); if (newR === null) return;
        if (newW.trim() && newR.trim()) {
            await this.model.editSet(exIdx, setIdx, newW, newR);
            await this.updateWorkoutAndStats(exIdx, cardElement);
        }
    }

    async handleDeleteSet(exIdx, setIdx, cardElement) {
        if (confirm(STRINGS.MESSAGES.CONFIRM_DELETE_SET)) {
            await this.model.deleteSet(exIdx, setIdx);
            await this.updateWorkoutAndStats(exIdx, cardElement);
        }
    }

    async handleDeleteExercise(exIdx) {
        if (confirm(STRINGS.MESSAGES.CONFIRM_DELETE_EX)) {
            await this.model.deleteExerciseFromWorkout(exIdx);
            this.view.workoutView.render(this.model);
            this.view.updateProgress(this.model);
            await this.view.statisticsView.render(this.model, this.statsService);
        }
    }

    async updateWorkoutAndStats(exIndex, cardElement, focusAddSet = false) {
        if (cardElement) {
            this.view.workoutView.renderCardSets(this.model, exIndex, cardElement, focusAddSet);
        } else {
            this.view.workoutView.render(this.model);
            if (focusAddSet) {
                this.view.workoutView.focusAddSetInput(exIndex);
            }
        }
        this.view.updateProgress(this.model);
        await this.view.statisticsView.render(this.model, this.statsService);
    }

    async handleToggleCategory(header) {
        const catId = header.dataset.catId;
        const content = document.getElementById(`cat-content-${catId}`);
        if (content) {
            const isCollapsed = content.classList.toggle('collapsed');
            header.classList.toggle('collapsed', isCollapsed);
        }
    }

    async handleHeaderChange() {
        if (this.isDraftMode) {
            const d = this.view.workoutView.dateInput.value;
            if (d) {
                const dayIndex = new Date(d).getDay();
                if (!isNaN(dayIndex)) {
                    this.view.workoutView.dayInput.value = STRINGS.COMMON.DAYS[dayIndex];
                }
            }
            return;
        }
        const d = this.view.workoutView.dateInput.value;
        const day = this.view.workoutView.dayInput.value;
        await this.model.updateWorkoutHeader(d, day);
        if (this.model.activeWorkout?.dayOfWeek) {
            this.view.workoutView.dayInput.value = this.model.activeWorkout.dayOfWeek;
        }
        this.view.historyView.render(this.model);
    }

    async navigateWorkout(dir) {
        if (this.isDraftMode) return;
        const nextId = await this.model.getAdjacentWorkoutId(this.model.activeWorkoutId, dir);
        if (nextId) {
            await this.model.loadActiveWorkout(nextId);
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleNextWorkout() {
        if (this.isDraftMode) return;
        const nextId = await this.model.getAdjacentWorkoutId(this.model.activeWorkoutId, 1);
        if (nextId) {
            await this.model.loadActiveWorkout(nextId);
            await this.view.renderAll(this.model, this.statsService);
        } else if (this.model.activeWorkoutId) {
            this.startNewWorkoutDraft();
        }
    }

    startNewWorkoutDraft() {
        this.isDraftMode = true;
        this.previousWorkoutIdBeforeDraft = this.model.activeWorkoutId;

        if (window.location.hash !== '#workout') {
            window.location.hash = 'workout';
        } else {
            this.view.switchTab('workout');
            this.view.showWorkoutDraft(this.model);
        }
    }

    async cancelWorkoutDraft() {
        if (!this.isDraftMode) return;
        this.isDraftMode = false;
        this.view.hideWorkoutDraft();
        if (this.previousWorkoutIdBeforeDraft) {
            await this.model.loadActiveWorkout(this.previousWorkoutIdBeforeDraft);
        }
        this.previousWorkoutIdBeforeDraft = null;
        await this.view.renderAll(this.model, this.statsService);
    }

    async confirmWorkoutDraft() {
        if (!this.isDraftMode) return;
        const sel = this.view.els.tplSelectDropdown();
        const val = sel ? sel.value : 'empty';
        const tplId = (val && val !== 'empty') ? val : null;
        const customDate = this.view.workoutView.dateInput.value;
        const customDay = this.view.workoutView.dayInput.value;

        this.isDraftMode = false;
        this.previousWorkoutIdBeforeDraft = null;
        this.view.hideWorkoutDraft();

        await this.model.addWorkout(tplId, customDate, customDay);
        await this.view.renderAll(this.model, this.statsService);
    }

    async handleStartWorkout(templateId) {
        this.isDraftMode = false;
        this.previousWorkoutIdBeforeDraft = null;
        this.view.hideWorkoutDraft();
        await this.model.addWorkout(templateId);
        window.location.hash = 'workout';
    }

    async handleLoadWorkout(id) {
        if (this.isDraftMode) {
            this.isDraftMode = false;
            this.previousWorkoutIdBeforeDraft = null;
            this.view.hideWorkoutDraft();
        }
        await this.model.loadActiveWorkout(id);
        window.location.hash = 'workout';
    }

    async handleSaveSetting(key, value) {
        await this.model.db.save(STORE.SETTINGS, { id: key, value: value });
    }

    async handleDeleteWorkout(id) {
        if(confirm(STRINGS.MESSAGES.CONFIRM_DELETE_WORKOUT)) {
            await this.model.deleteWorkout(id);
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleAddCategory(name) {
        if (!name.trim()) return;
        if(await this.model.addCategory(name.trim())) {
            this.view.settingsView.render(this.model);
        } else {
            alert(STRINGS.MESSAGES.ERROR_CATEGORY_EXISTS);
        }
    }

    async handleDeleteCategory(id) {
        if (confirm(STRINGS.MESSAGES.CONFIRM_DELETE_CATEGORY)) {
            await this.model.deleteCategory(id);
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleEditLibrary(id) {
        const ex = this.model.getLibraryExercise(id);
        const name = prompt("Название:", ex.name); if(name===null) return;
        const cat = prompt("Категория:", this.model.getCategoryName(ex.categoryId)); if(cat===null) return;
        const target = prompt("Цель:", ex.target); if(target===null) return;
        
        const foundCat = this.model.categories.find(c => c.name === cat.trim());
        await this.model.editLibraryExercise(id, name, foundCat ? foundCat.id : ex.categoryId, target);
        await this.view.renderAll(this.model, this.statsService);
    }

    async handleDeleteLibrary(id) {
        if (confirm(STRINGS.MESSAGES.CONFIRM_DELETE_LIB_EX)) {
            await this.model.deleteLibraryExercise(id);
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleSaveTemplate(id, name, exercises) {
        if (!name.trim()) return alert(STRINGS.MESSAGES.ERROR_NO_NAME);
        await this.model.saveTemplate(id, name, exercises);
        this.view.settingsView.render(this.model);
    }

    async handleDeleteTemplate(id) {
        if (confirm('Удалить шаблон?')) {
            await this.model.deleteTemplate(id);
            await this.view.settingsView.render(this.model);
        }
    }

    async handleSaveNewExercise(isLibraryOnly) {
        if (isLibraryOnly) {
            const catId = this.view.els.newExCat.value;
            if (!catId) return alert(STRINGS.MESSAGES.ERROR_NO_CATEGORY || 'Выберите категорию');
            const name = this.view.els.newExName.value.trim();
            if (!name) return alert(STRINGS.MESSAGES.ERROR_NO_NAME);
            const target = this.view.els.newExTarget.value.trim();
            await this.model.addLibraryExercise(name, catId, target);
            this.view.hideAddExerciseForm();
            await this.view.renderAll(this.model, this.statsService);
            return;
        }

        const catId = this.view.els.newExCat.value;
        if (!catId) return alert(STRINGS.MESSAGES.ERROR_NO_CATEGORY || 'Выберите категорию');

        const libId = this.view.els.exLibSelect.value;
        if (!libId) return alert(STRINGS.MESSAGES.ERROR_NO_EXERCISE || 'Выберите упражнение');

        let exerciseId = libId;
        if (libId === 'new') {
            const name = this.view.els.newExName.value.trim();
            if (!name) return alert(STRINGS.MESSAGES.ERROR_NO_NAME);
            const target = this.view.els.newExTarget.value.trim();
            exerciseId = await this.model.addLibraryExercise(name, catId, target);
        }

        await this.model.addExerciseToWorkout(exerciseId);
        this.view.hideAddExerciseForm();
        await this.view.renderAll(this.model, this.statsService);
    }

    async handleOpenExport() {
        await this.view.openExportModal(this.model);
    }

    async handleExport() {
        await this.handleOpenExport();
    }

    getExportSelection() {
        try {
            const selection = this.view.importExportModalView.getExportSelection();
            if (!selection) {
                alert(STRINGS.MESSAGES.ERROR_NO_SELECTION);
                return null;
            }
            return selection;
        } catch (err) {
            alert(err.message);
            return null;
        }
    }

    async handleExportCopyAi() {
        const selection = this.getExportSelection();
        if (!selection) return;

        const data = await this.model.buildSelectiveExport(selection);
        const prompt = generateAiPrompt(data);
        const success = await copyToClipboard(prompt);
        if (success) {
            alert(STRINGS.MESSAGES.COPIED_TO_CLIPBOARD);
            this.view.closeExportModal();
        } else {
            alert('Не удалось скопировать в буфер обмена.');
        }
    }

    async handleExportCopyJson() {
        const selection = this.getExportSelection();
        if (!selection) return;

        const data = await this.model.buildSelectiveExport(selection);
        const jsonStr = JSON.stringify(data, null, 2);
        const success = await copyToClipboard(jsonStr);
        if (success) {
            alert(STRINGS.MESSAGES.COPIED_TO_CLIPBOARD);
            this.view.closeExportModal();
        } else {
            alert('Не удалось скопировать в буфер обмена.');
        }
    }

    async handleExportDownloadJson() {
        const selection = this.getExportSelection();
        if (!selection) return;

        const data = await this.model.buildSelectiveExport(selection);
        let dateSuffix = new Date().toISOString().split('T')[0];
        if (selection.historyDateRange) {
            const { startDate, endDate } = selection.historyDateRange;
            if (startDate && endDate) {
                dateSuffix = startDate + '_to_' + endDate;
            } else if (startDate) {
                dateSuffix = 'from_' + startDate;
            } else if (endDate) {
                dateSuffix = 'to_' + endDate;
            }
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = 'gym_tracker_export_' + dateSuffix + '.json';
        a.click();
        this.view.closeExportModal();
    }

    handleOpenImport() {
        this.currentParsedImportPayload = null;
        this.view.openImportModal();
    }

    handleImport() {
        this.handleOpenImport();
    }

    async handleImportPasteClipboard() {
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    this.view.els.importJsonTextarea.value = text;
                    this.handleParseImportText();
                } else {
                    alert('Буфер обмена пуст.');
                }
            } catch (e) {
                alert('Не удалось прочитать буфер обмена. Пожалуйста, вставьте текст в поле вручную (Ctrl+V).');
            }
        } else {
            alert('Чтение буфера обмена не поддерживается вашим браузером. Пожалуйста, вставьте текст в поле вручную.');
        }
    }

    handleImportFileSelected(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.view.els.importJsonTextarea.value = e.target.result;
            this.handleParseImportText();
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    handleAutoParseImportText() {
        this.handleParseImportText(false);
    }

    handleParseImportText(showAlert = true) {
        const text = this.view.els.importJsonTextarea.value;
        if (!text || !text.trim()) {
            this.currentParsedImportPayload = null;
            if (this.view.els.importDetectedContainer) {
                this.view.els.importDetectedContainer.classList.add('d-none');
            }
            if (showAlert) alert(STRINGS.MESSAGES.ERROR_INVALID_JSON);
            return;
        }

        try {
            const payload = this.model.parseImportPayload(text);
            this.currentParsedImportPayload = payload;
            this.view.renderDetectedImport(payload);
        } catch (err) {
            console.error('Ошибка распознавания данных:', err);
            this.currentParsedImportPayload = null;
            if (this.view.els.importDetectedContainer) {
                this.view.els.importDetectedContainer.classList.add('d-none');
            }
            if (showAlert) alert(STRINGS.MESSAGES.ERROR_INVALID_JSON);
        }
    }

    async handleConfirmImportSelected() {
        if (!this.currentParsedImportPayload) {
            alert(STRINGS.MESSAGES.ERROR_NOTHING_TO_IMPORT);
            return;
        }

        const selection = this.view.importExportModalView.getImportSelection();
        if (!selection) {
            alert(STRINGS.MESSAGES.ERROR_NO_SELECTION);
            return;
        }

        try {
            const summary = await this.model.executeSelectiveImport(selection, this.currentParsedImportPayload);

            let msg = STRINGS.MESSAGES.IMPORT_SUCCESS;
            const details = [];
            if (summary.importedTemplatesCount > 0) details.push(`Шаблонов: ${summary.importedTemplatesCount}`);
            if (summary.importedExercisesCount > 0) details.push(`Новых упражнений: ${summary.importedExercisesCount}`);
            if (summary.importedWorkoutsCount > 0) details.push(`Тренировок: ${summary.importedWorkoutsCount}`);
            if (details.length > 0) {
                msg += `\n(${details.join(', ')})`;
            }

            alert(msg);
            this.view.closeImportModal();
            this.currentParsedImportPayload = null;
            await this.view.renderAll(this.model, this.statsService);
        } catch (err) {
            console.error('Ошибка сохранения импорта:', err);
            alert(STRINGS.MESSAGES.ERROR_IMPORT);
        }
    }
    
    populateAddExForm(catId, isLibraryOnly) {
        this.view.populateAddExForm(this.model, catId, isLibraryOnly);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    injectPWA();
    const db = new GymDatabase();
    const model = new AppModel(db);
    const view = new AppView();
    const controller = new AppController(model, view);
    window.app = controller;
    controller.init().catch(err => {
        console.error('Ошибка инициализации приложения:', err);
    });
});