import { WorkoutView } from './workoutView.js';
import { HistoryView } from './historyView.js';
import { StatisticsView } from './statisticsView.js';
import { SettingsView } from './settingsView.js';
import { ExerciseModalView } from './exerciseModalView.js';
import { ImportExportModalView } from './importExportModalView.js';
import { STRINGS } from '../constants/strings.js';
import { escapeHtml } from '../utils.js';

export class AppView {
    constructor() {
        this.workoutView = new WorkoutView();
        this.historyView = new HistoryView();
        this.settingsView = new SettingsView();
        this.statisticsView = new StatisticsView();
        this.exerciseModalView = new ExerciseModalView();
        this.importExportModalView = new ImportExportModalView();
        
        this.timeContainer = document.getElementById('estimated-time-container');

        this.els = {
            mainNavbar: document.getElementById('main-navbar'),
            btnHamburger: document.getElementById('btn-hamburger'),
            sideMenu: document.getElementById('side-menu'),
            menuOverlay: document.getElementById('menu-overlay'),
            pageTitle: document.getElementById('page-title'),
            btnPrevWorkout: document.getElementById('btn-prev-workout'),
            btnNextWorkout: document.getElementById('btn-next-workout'),
            btnShowTemplates: document.getElementById('btn-show-templates'),
            tplOptionsUi: document.getElementById('template-options-ui'),
            tplSelectionContainer: document.getElementById('template-selection-container'),
            btnCancelTpl: document.getElementById('btn-cancel-template'),
            btnConfirmTpl: document.getElementById('btn-confirm-template'),
            tabWorkout: document.getElementById('tab-workout'),
            tplSelectDropdown: () => document.getElementById('template-select-dropdown'),

            // Keep child modal elements accessible for backward compatibility
            ...this.exerciseModalView.els,
            ...this.importExportModalView.els
        };
    }

    get addingToLibraryOnly() {
        return this.exerciseModalView.addingToLibraryOnly;
    }

    set addingToLibraryOnly(val) {
        this.exerciseModalView.addingToLibraryOnly = val;
    }

    init(controller) {
        this.controller = controller;
        this.bindNavigation(controller);
        this.workoutView.bindEvents(controller);
        this.historyView.bindEvents(controller);
        this.settingsView.bindEvents(controller);
        this.statisticsView.bindEvents(controller);
        this.exerciseModalView.bindEvents(controller);
        this.importExportModalView.bindEvents(controller);
        this.bindWorkoutDraftEvents(controller);
    }

    async renderAll(model, statsService) {
        this.workoutView.render(model);
        await this.historyView.render(model);
        await this.settingsView.render(model);
        await this.statisticsView.render(model, statsService);
        this.updateProgress(model);
        await this.updateNavButtons(model);
    }

    updateProgress(model) {
        const workout = model.getActiveWorkout();
        let pct = 0;
        
        if (workout && workout.exercises.length > 0) {
            let totalExpectedSets = 0;
            let totalCompletedSets = 0;

            workout.exercises.forEach(ex => {
                const expectedSets = Math.max(3, ex.sets.length);
                totalExpectedSets += expectedSets;
                
                if (ex.completed) {
                    totalCompletedSets += expectedSets;
                } else {
                    totalCompletedSets += ex.sets.length;
                }
            });

            if (totalExpectedSets > 0) {
                pct = Math.round((totalCompletedSets / totalExpectedSets) * 100);
            }
        }
        
        this.els.mainNavbar.style.setProperty('--progress', `${pct}%`);

        const totalMinutes = Math.round((pct / 100) * 90);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        const timeStr = `⏱️ ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        if (this.timeContainer) {
            this.timeContainer.textContent = timeStr;
        }
    }

    async updateNavButtons(model) {
        if (this.controller && this.controller.isDraftMode) {
            if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = true;
            if (this.els.btnNextWorkout) {
                this.els.btnNextWorkout.disabled = true;
                this.els.btnNextWorkout.textContent = '+';
                this.els.btnNextWorkout.title = STRINGS.WORKOUT.TOOLTIP_NEW;
            }
            return;
        }

        if (!model.activeWorkoutId) {
            if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = true;
            if (this.els.btnNextWorkout) {
                this.els.btnNextWorkout.disabled = true;
                this.els.btnNextWorkout.textContent = '▶';
                this.els.btnNextWorkout.title = STRINGS.WORKOUT.TOOLTIP_NEXT;
            }
            return;
        }
        const hasPrev = await model.getAdjacentWorkoutId(model.activeWorkoutId, -1);
        const hasNext = await model.getAdjacentWorkoutId(model.activeWorkoutId, 1);
        
        if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = !hasPrev;
        if (this.els.btnNextWorkout) {
            if (!hasNext) {
                this.els.btnNextWorkout.disabled = false;
                this.els.btnNextWorkout.textContent = '+';
                this.els.btnNextWorkout.title = STRINGS.WORKOUT.TOOLTIP_NEW;
            } else {
                this.els.btnNextWorkout.disabled = false;
                this.els.btnNextWorkout.textContent = '▶';
                this.els.btnNextWorkout.title = STRINGS.WORKOUT.TOOLTIP_NEXT;
            }
        }
    }

    showWorkoutDraft(model) {
        this.workoutView.titleEl.textContent = STRINGS.WORKOUT.TITLE_NEW_WORKOUT;
        
        const today = new Date();
        this.workoutView.dateInput.value = today.toISOString().split('T')[0];
        this.workoutView.dayInput.value = STRINGS.COMMON.DAYS[today.getDay()];
        
        this.workoutView.container.innerHTML = '';
        
        this.hideAddExerciseForm();
        if (this.els.btnShowAddEx) {
            this.els.btnShowAddEx.classList.add('d-none');
        }

        if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = true;
        if (this.els.btnNextWorkout) {
            this.els.btnNextWorkout.disabled = true;
            this.els.btnNextWorkout.textContent = '+';
            this.els.btnNextWorkout.title = STRINGS.WORKOUT.TOOLTIP_NEW;
        }

        let optionsHtml = `<option value="empty">${STRINGS.WORKOUT.EMPTY_WORKOUT_OPTION}</option>`;
        if (model.templates && model.templates.length > 0) {
            optionsHtml += model.templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
        }
        this.els.tplOptionsUi.innerHTML = `<select id="template-select-dropdown" style="width:100%; padding:10px;">${optionsHtml}</select>`;
        this.els.tplSelectionContainer.classList.remove('d-none');

        this.els.mainNavbar.style.setProperty('--progress', '0%');
        if (this.timeContainer) {
            this.timeContainer.textContent = '⏱️ 00:00';
        }
    }

    hideWorkoutDraft() {
        this.els.tplSelectionContainer.classList.add('d-none');
        if (this.els.btnShowAddEx) {
            this.els.btnShowAddEx.classList.remove('d-none');
        }
    }

    bindNavigation(controller) {
        const toggleMenu = () => {
            this.els.sideMenu.classList.toggle('open');
            this.els.menuOverlay.classList.toggle('open');
        };
        this.els.btnHamburger.addEventListener('click', toggleMenu);
        this.els.menuOverlay.addEventListener('click', toggleMenu);

        this.els.sideMenu.addEventListener('click', e => {
            if(e.target.classList.contains('nav-btn')) {
                window.location.hash = e.target.dataset.tab;
                toggleMenu();
            }
        });
    }

    switchTab(tabName) {
        ['workout', 'history', 'statistics', 'settings'].forEach(tab => {
            const btn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
            const content = document.getElementById(`tab-${tab}`);
            if (btn) btn.classList.remove('active');
            if (content) content.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`tab-${tabName}`);
        
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        const titles = { 'workout': 'Тренировка', 'history': 'История', 'statistics': 'Статистика', 'settings': 'Настройки' };
        this.els.pageTitle.innerText = titles[tabName] || 'Тренировка';
        
        if (tabName !== 'workout') {
            this.els.mainNavbar.style.setProperty('--progress', '0%');
            if (this.timeContainer) this.timeContainer.classList.add('d-none');
        } else {
            if (this.timeContainer) this.timeContainer.classList.remove('d-none');
            if (this.controller?.model) this.updateProgress(this.controller.model);
        }
    }

    bindWorkoutDraftEvents(controller) {
        if (this.els.btnShowTemplates) {
            this.els.btnShowTemplates.addEventListener('click', () => {
                controller.startNewWorkoutDraft();
            });
        }
        if (this.els.btnCancelTpl) {
            this.els.btnCancelTpl.addEventListener('click', () => {
                controller.cancelWorkoutDraft();
            });
        }
        if (this.els.btnConfirmTpl) {
            this.els.btnConfirmTpl.addEventListener('click', () => {
                controller.confirmWorkoutDraft();
            });
        }
    }

    showAddExerciseForm(categoryId, isLibraryOnly) {
        this.exerciseModalView.show(categoryId, isLibraryOnly, this.controller?.model || null);
    }

    hideAddExerciseForm() {
        this.exerciseModalView.hide();
    }

    updateExerciseList(model, catId) {
        this.exerciseModalView.updateExerciseList(model, catId);
    }

    populateAddExForm(model, catId, isLibraryOnly) {
        this.exerciseModalView.populateForm(model, catId, isLibraryOnly);
    }

    async openExportModal(model) {
        await this.importExportModalView.openExportModal(model);
    }

    closeExportModal() {
        this.importExportModalView.closeExportModal();
    }

    setAllExportCheckboxes(checked) {
        this.importExportModalView.setAllExportCheckboxes(checked);
    }

    openImportModal() {
        this.importExportModalView.openImportModal();
    }

    closeImportModal() {
        this.importExportModalView.closeImportModal();
    }

    setAllImportCheckboxes(checked) {
        this.importExportModalView.setAllImportCheckboxes(checked);
    }

    renderDetectedImport(payload) {
        this.importExportModalView.renderDetectedImport(payload);
    }
}