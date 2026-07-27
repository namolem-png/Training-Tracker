import { GymDatabase } from './db.js';
import { AppModel } from './model.js';
import { AppView } from './view/appView.js';
import { injectPWA } from './pwa.js';
import { STRINGS } from './constants/strings.js';
import { StatisticsService } from './services/statisticsService.js';

export class AppController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.statsService = new StatisticsService(model);
    }

    async init() {
        await this.model.init();
        this.view.init(this);

        // Переопределяем метод отображения формы, чтобы она перемещалась внутрь выбранной категории
        const originalShowForm = this.view.showAddExerciseForm.bind(this.view);
        this.view.showAddExerciseForm = (categoryId, isLibraryOnly) => {
            // Вызываем базовую логику (настройка полей, кнопок и т.д.)
            originalShowForm(categoryId, isLibraryOnly);
            
            // Если передан ID категории (клик по btn-add-to-cat), перемещаем форму
            if (categoryId && !isLibraryOnly) {
                const catContent = document.getElementById(`cat-content-${categoryId}`);
                const catHeader = document.querySelector(`[data-cat-id="${categoryId}"]`);
                if (catContent && this.view.els.addExFormContainer) {
                    // Раскрываем категорию, если она была свернута
                    catContent.classList.remove('collapsed');
                    if (catHeader) catHeader.classList.remove('collapsed');
                    
                    // Перемещаем форму в конец списка упражнений данной категории
                    catContent.appendChild(this.view.els.addExFormContainer);
                    
                    // Прокручиваем к форме для удобства
                    this.view.els.addExFormContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        };
        
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
        this.view.switchTab(hash);
        await this.view.renderAll(this.model, this.statsService);
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
        await this.model.addSet(exIndex, weight, reps);
        await this.updateWorkoutAndStats(exIndex, cardElement);
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
            await this.view.statisticsView.render(this.model);
        }
    }

    async updateWorkoutAndStats(exIndex, cardElement) {
        if (cardElement) {
            this.view.workoutView.renderCardSets(this.model, exIndex, cardElement);
        } else {
            this.view.workoutView.render(this.model);
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
        const d = this.view.workoutView.dateInput.value;
        const day = this.view.workoutView.dayInput.value;
        await this.model.updateWorkoutHeader(d, day);
        this.view.historyView.render(this.model);
    }

    async navigateWorkout(dir) {
        const nextId = await this.model.getAdjacentWorkoutId(this.model.activeWorkoutId, dir);
        if (nextId) {
            await this.model.loadActiveWorkout(nextId);
            await this.view.renderAll(this.model, this.statsService);
        }
    }

    async handleStartWorkout(templateId) {
        await this.model.addWorkout(templateId);
        window.location.hash = 'workout';
    }

    async handleLoadWorkout(id) {
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
        await this.model.deleteCategory(id);
        await this.view.renderAll(this.model, this.statsService);
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

    async handleSaveNewExercise(isLibraryOnly) {
        const libId = this.view.els.exLibSelect.value;
        let exerciseId = libId;

        if (libId === 'new') {
            const name = this.view.els.newExName.value;
            if(!name) return alert(STRINGS.MESSAGES.ERROR_NO_NAME);
            exerciseId = await this.model.addLibraryExercise(name, this.view.els.newExCat.value, this.view.els.newExTarget.value);
        }

        if (!isLibraryOnly) {
            await this.model.addExerciseToWorkout(exerciseId);
        }
        this.view.hideAddExerciseForm();
        await this.view.renderAll(this.model, this.statsService);
    }

    async handleExport() {
        this.view.showLoading?.('Подготовка файла...');
        setTimeout(async () => {
            const data = await this.model.getExportData();
            if (data.workouts.length === 0 && data.exercises.length === 0) return alert(STRINGS.MESSAGES.ERROR_NO_DATA_EXPORT);
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `gym_history_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }, 50);
    }

    async handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if(!confirm(STRINGS.MESSAGES.CONFIRM_IMPORT)) return;
                await this.model.importData(JSON.parse(e.target.result));
                alert(STRINGS.MESSAGES.IMPORT_SUCCESS);
                location.reload();
            } catch (err) { alert(STRINGS.MESSAGES.ERROR_IMPORT); }
        };
        reader.readAsText(file);
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
    controller.init();
});