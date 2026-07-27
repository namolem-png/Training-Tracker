import { WorkoutView } from './workoutView.js';
import { HistoryView } from './historyView.js';
import { StatisticsView } from './statisticsView.js';
import { SettingsView } from './settingsView.js';

export class AppView {
    constructor() {
        this.workoutView = new WorkoutView();
        this.historyView = new HistoryView();
        this.settingsView = new SettingsView();
        this.statisticsView = new StatisticsView();
        this.addingToLibraryOnly = false;
        
        this.timeContainer = document.getElementById('estimated-time-container');

        this.els = {
            mainNavbar: document.getElementById('main-navbar'),
            btnHamburger: document.getElementById('btn-hamburger'),
            sideMenu: document.getElementById('side-menu'),
            menuOverlay: document.getElementById('menu-overlay'),
            pageTitle: document.getElementById('page-title'),
            btnPrevWorkout: document.getElementById('btn-prev-workout'),
            btnNextWorkout: document.getElementById('btn-next-workout'),
            btnShowAddEx: document.getElementById('btn-show-add-ex'),
            btnShowAddLibEx: document.getElementById('btn-show-add-lib-ex'),
            btnCancelNewEx: document.getElementById('btn-cancel-new-ex'),
            exLibSelect: document.getElementById('exerciseLibrarySelect'),
            newExName: document.getElementById('newExName'),
            newExCat: document.getElementById('newExCat'),
            newExTarget: document.getElementById('newExTarget'),
            btnSaveNewEx: document.getElementById('btn-save-new-ex'),
            btnShowTemplates: document.getElementById('btn-show-templates'),
            tplOptionsUi: document.getElementById('template-options-ui'),
            tplSelectionContainer: document.getElementById('template-selection-container'),
            btnCancelTpl: document.getElementById('btn-cancel-template'),
            btnConfirmTpl: document.getElementById('btn-confirm-template'),
            btnExport: document.getElementById('btn-export-data'),
            btnImport: document.getElementById('btn-import-data'),
            fileInput: document.getElementById('fileInput'),
            addExFormContainer: document.getElementById('add-ex-form-container'),
            libSelectWrapper: document.getElementById('library-select-wrapper'),
            tabWorkout: document.getElementById('tab-workout'),
            tplSelectDropdown: () => document.getElementById('template-select-dropdown')
        };
    }

    init(controller) {
        this.bindNavigation(controller);
        this.workoutView.bindEvents(controller);
        this.historyView.bindEvents(controller);
        this.settingsView.bindEvents(controller);
        this.statisticsView.bindEvents(controller);
        this.bindModals(controller);
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
        if (!model.activeWorkoutId) {
            if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = true;
            if (this.els.btnNextWorkout) this.els.btnNextWorkout.disabled = true;
            return;
        }
        const hasPrev = await model.getAdjacentWorkoutId(model.activeWorkoutId, -1);
        const hasNext = await model.getAdjacentWorkoutId(model.activeWorkoutId, 1);
        
        if (this.els.btnPrevWorkout) this.els.btnPrevWorkout.disabled = !hasPrev;
        if (this.els.btnNextWorkout) this.els.btnNextWorkout.disabled = !hasNext;
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
            if (window.app && window.app.model) this.updateProgress(window.app.model); 
        }
    }

    
    bindModals(controller) {
        this.els.btnShowAddEx.addEventListener('click', () => this.showAddExerciseForm(null, false));
        this.els.btnShowAddLibEx.addEventListener('click', () => this.showAddExerciseForm(null, true));
        this.els.btnCancelNewEx.addEventListener('click', () => this.hideAddExerciseForm());
        
        this.els.exLibSelect.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id === 'new') {
                this.els.newExName.value = ''; this.els.newExTarget.value = '';
                this.els.newExName.disabled = false; this.els.newExCat.disabled = false; this.els.newExTarget.disabled = false;
            } else {
                const ex = controller.model.getLibraryExercise(id);
                this.els.newExName.value = ex.name; this.els.newExCat.value = ex.categoryId; this.els.newExTarget.value = ex.target;
                this.els.newExName.disabled = true; this.els.newExCat.disabled = true; this.els.newExTarget.disabled = true;
            }
        });

        this.els.btnSaveNewEx.addEventListener('click', () => controller.handleSaveNewExercise(this.addingToLibraryOnly));

        this.els.btnShowTemplates.addEventListener('click', () => {
            if (controller.model.templates.length === 0) {
                this.els.tplOptionsUi.innerHTML = '<p>Нет шаблонов.</p>';
            } else {
                this.els.tplOptionsUi.innerHTML = '<select id="template-select-dropdown" style="width:100%; padding:10px;"><option value="empty">Пустая тренировка</option>' + 
                    controller.model.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '</select>';
            }
            this.els.tplSelectionContainer.classList.remove('d-none');
            this.els.btnShowTemplates.classList.add('d-none');
        });

        this.els.btnCancelTpl.addEventListener('click', () => {
            this.els.tplSelectionContainer.classList.add('d-none');
            this.els.btnShowTemplates.classList.remove('d-none');
        });

        this.els.btnConfirmTpl.addEventListener('click', () => {
            const sel = this.els.tplSelectDropdown();
            const val = sel ? sel.value : 'empty';
            controller.handleStartWorkout(val === 'empty' ? null : val);
            this.els.tplSelectionContainer.classList.add('d-none');
            this.els.btnShowTemplates.classList.remove('d-none');
        });

        this.els.btnExport.addEventListener('click', () => controller.handleExport());
        this.els.btnImport.addEventListener('click', () => this.els.fileInput.click());
        this.els.fileInput.addEventListener('change', (e) => controller.handleImport(e));
    }

    showAddExerciseForm(categoryId, isLibraryOnly) {
        this.addingToLibraryOnly = isLibraryOnly;
        this.els.addExFormContainer.classList.remove('d-none');
        
        this.els.btnShowAddEx.classList.toggle('d-none', isLibraryOnly);
        this.els.btnShowAddLibEx.classList.toggle('d-none', !isLibraryOnly);
        this.els.libSelectWrapper.classList.toggle('d-none', isLibraryOnly);
        
        window.app.populateAddExForm(categoryId, isLibraryOnly);
        
        if (categoryId) {
            this.els.newExCat.value = categoryId;
            this.els.newExCat.disabled = true;
        } else {
            this.els.newExCat.disabled = false;
        }

        const parentBtn = isLibraryOnly ? this.els.btnShowAddLibEx : this.els.btnShowAddEx;
        parentBtn.parentNode.insertBefore(this.els.addExFormContainer, parentBtn);
        this.els.addExFormContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    hideAddExerciseForm() {
        this.els.addExFormContainer.classList.add('d-none');
        this.els.btnShowAddEx.classList.remove('d-none');
        const libBtn = this.els.btnShowAddLibEx;
        if(libBtn) libBtn.classList.remove('d-none');
        this.els.tabWorkout.appendChild(this.els.addExFormContainer);
        this.els.newExName.value = '';
        this.els.newExTarget.value = '';
    }

    populateAddExForm(model, catId, isLibraryOnly) {
        const libSel = this.els.exLibSelect;
        const catSel = this.els.newExCat;
        
        libSel.innerHTML = '<option value="new">-- Новое (вручную) --</option>' + 
            [...model.exercises]
            .filter(e => !catId || e.categoryId === catId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(e => `<option value="${e.id}">${e.name} (${model.getCategoryName(e.categoryId)})</option>`).join('');
            
        catSel.innerHTML = model.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        if (!isLibraryOnly) libSel.value = 'new';
        catSel.value = catId || (model.categories[0] ? model.categories[0].id : '');
        libSel.dispatchEvent(new Event('change'));
    }
}