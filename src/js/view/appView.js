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
            
            // Export Modal
            modalExport: document.getElementById('modal-export'),
            btnCloseExportModal: document.getElementById('btn-close-export-modal'),
            btnExportSelectAll: document.getElementById('btn-export-select-all'),
            btnExportDeselectAll: document.getElementById('btn-export-deselect-all'),
            exportOptionsList: document.getElementById('export-options-list'),
            btnExportCopyAi: document.getElementById('btn-export-copy-ai'),
            btnExportCopyJson: document.getElementById('btn-export-copy-json'),
            btnExportDownloadJson: document.getElementById('btn-export-download-json'),

            // Import Modal
            modalImport: document.getElementById('modal-import'),
            btnCloseImportModal: document.getElementById('btn-close-import-modal'),
            importFileInput: document.getElementById('import-file-input'),
            btnImportTriggerFile: document.getElementById('btn-import-trigger-file'),
            btnImportPasteClipboard: document.getElementById('btn-import-paste-clipboard'),
            importJsonTextarea: document.getElementById('import-json-textarea'),
            btnImportParse: document.getElementById('btn-import-parse'),
            importDetectedContainer: document.getElementById('import-detected-container'),
            btnImportSelectAll: document.getElementById('btn-import-select-all'),
            btnImportDeselectAll: document.getElementById('btn-import-deselect-all'),
            importOptionsList: document.getElementById('import-options-list'),
            btnConfirmImportSelected: document.getElementById('btn-confirm-import-selected'),

            addExFormContainer: document.getElementById('add-ex-form-container'),
            addExFormTitle: document.getElementById('add-ex-form-title'),
            categorySelectWrapper: document.getElementById('category-select-wrapper'),
            libSelectWrapper: document.getElementById('library-select-wrapper'),
            customExFields: document.getElementById('custom-ex-fields'),
            selectedExTargetInfo: document.getElementById('selected-ex-target-info'),
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
        
        this.els.newExCat.addEventListener('change', () => {
            const catId = this.els.newExCat.value;
            this.updateExerciseList(controller.model, catId);
        });

        this.els.exLibSelect.addEventListener('change', () => {
            const id = this.els.exLibSelect.value;
            if (id === 'new') {
                this.els.customExFields.classList.remove('d-none');
                this.els.selectedExTargetInfo.classList.add('d-none');
                this.els.newExName.value = '';
                this.els.newExTarget.value = '';
                this.els.newExName.focus();
            } else if (id) {
                this.els.customExFields.classList.add('d-none');
                const ex = controller.model.getLibraryExercise(id);
                if (ex && ex.target) {
                    this.els.selectedExTargetInfo.textContent = `Цель: ${ex.target}`;
                    this.els.selectedExTargetInfo.classList.remove('d-none');
                } else {
                    this.els.selectedExTargetInfo.classList.add('d-none');
                }
            } else {
                this.els.customExFields.classList.add('d-none');
                this.els.selectedExTargetInfo.classList.add('d-none');
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

        // Export Modal Events
        this.els.btnExport.addEventListener('click', () => controller.handleOpenExport());
        this.els.btnCloseExportModal.addEventListener('click', () => this.closeExportModal());
        this.els.modalExport.addEventListener('click', (e) => {
            if (e.target === this.els.modalExport) this.closeExportModal();
        });
        this.els.btnExportSelectAll.addEventListener('click', () => this.setAllExportCheckboxes(true));
        this.els.btnExportDeselectAll.addEventListener('click', () => this.setAllExportCheckboxes(false));
        this.els.btnExportCopyAi.addEventListener('click', () => controller.handleExportCopyAi());
        this.els.btnExportCopyJson.addEventListener('click', () => controller.handleExportCopyJson());
        this.els.btnExportDownloadJson.addEventListener('click', () => controller.handleExportDownloadJson());

        // Import Modal Events
        this.els.btnImport.addEventListener('click', () => controller.handleOpenImport());
        this.els.btnCloseImportModal.addEventListener('click', () => this.closeImportModal());
        this.els.modalImport.addEventListener('click', (e) => {
            if (e.target === this.els.modalImport) this.closeImportModal();
        });
        this.els.btnImportTriggerFile.addEventListener('click', () => this.els.importFileInput.click());
        this.els.importFileInput.addEventListener('change', (e) => controller.handleImportFileSelected(e));
        this.els.btnImportPasteClipboard.addEventListener('click', () => controller.handleImportPasteClipboard());
        this.els.btnImportParse.addEventListener('click', () => controller.handleParseImportText());
        this.els.btnImportSelectAll.addEventListener('click', () => this.setAllImportCheckboxes(true));
        this.els.btnImportDeselectAll.addEventListener('click', () => this.setAllImportCheckboxes(false));
        this.els.btnConfirmImportSelected.addEventListener('click', () => controller.handleConfirmImportSelected());
    }

    updateExerciseList(model, catId) {
        const libSel = this.els.exLibSelect;
        if (!catId) {
            libSel.innerHTML = '<option value="" disabled selected>-- Сначала выберите категорию --</option>';
            libSel.disabled = true;
            this.els.customExFields.classList.add('d-none');
            this.els.selectedExTargetInfo.classList.add('d-none');
            return;
        }

        libSel.disabled = false;
        const filtered = model.exercises
            .filter(e => e.categoryId === catId)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            libSel.innerHTML = '<option value="new" selected>+ Новое упражнение (вручную)</option>';
            this.els.customExFields.classList.remove('d-none');
            this.els.selectedExTargetInfo.classList.add('d-none');
            this.els.newExName.value = '';
            this.els.newExTarget.value = '';
        } else {
            libSel.innerHTML = '<option value="" disabled selected>-- Выберите упражнение --</option>' + 
                filtered.map(e => `<option value="${e.id}">${e.name}</option>`).join('') + 
                '<option value="new">+ Новое упражнение (вручную)</option>';
            this.els.customExFields.classList.add('d-none');
            this.els.selectedExTargetInfo.classList.add('d-none');
        }
    }

    showAddExerciseForm(categoryId, isLibraryOnly) {
        this.addingToLibraryOnly = isLibraryOnly;
        this.els.addExFormContainer.classList.remove('d-none');
        
        this.els.btnShowAddEx.classList.toggle('d-none', isLibraryOnly);
        this.els.btnShowAddLibEx.classList.toggle('d-none', !isLibraryOnly);
        this.els.libSelectWrapper.classList.toggle('d-none', isLibraryOnly);
        
        if (this.els.addExFormTitle) {
            if (isLibraryOnly) {
                this.els.addExFormTitle.textContent = 'Новое упражнение в библиотеку';
            } else if (categoryId && window.app && window.app.model) {
                this.els.addExFormTitle.textContent = `Добавить в "${window.app.model.getCategoryName(categoryId)}"`;
            } else {
                this.els.addExFormTitle.textContent = 'Добавить упражнение';
            }
        }

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
        this.els.customExFields.classList.add('d-none');
        this.els.selectedExTargetInfo.classList.add('d-none');
        this.els.newExCat.disabled = false;
        this.els.exLibSelect.disabled = false;
    }

    populateAddExForm(model, catId, isLibraryOnly) {
        const catSel = this.els.newExCat;
        
        if (isLibraryOnly) {
            catSel.innerHTML = '<option value="" disabled selected>-- Выберите категорию --</option>' +
                model.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            if (catId) catSel.value = catId;
            this.els.customExFields.classList.remove('d-none');
            this.els.newExName.value = '';
            this.els.newExTarget.value = '';
            this.els.selectedExTargetInfo.classList.add('d-none');
            return;
        }

        catSel.innerHTML = '<option value="" disabled selected>-- Выберите категорию --</option>' +
            model.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        if (catId) {
            catSel.value = catId;
            this.updateExerciseList(model, catId);
        } else {
            catSel.value = '';
            this.updateExerciseList(model, null);
        }
    }

    openExportModal(model) {
        this.els.exportOptionsList.innerHTML = '';
        const frag = document.createDocumentFragment();

        // 1. Library option
        const libLabel = document.createElement('label');
        libLabel.className = 'checklist-item';
        libLabel.innerHTML = `
            <input type="checkbox" id="export-check-library" checked>
            <span>📚 <strong>Каталог упражнений</strong> (${model.exercises.length} упр., ${model.categories.length} кат.)</span>
        `;
        frag.appendChild(libLabel);

        // 2. Templates
        if (model.templates.length > 0) {
            model.templates.forEach(tpl => {
                const tplLabel = document.createElement('label');
                tplLabel.className = 'checklist-item';
                tplLabel.innerHTML = `
                    <input type="checkbox" class="export-check-template" data-tpl-id="${tpl.id}" checked>
                    <span>📋 Шаблон: <strong>${tpl.name}</strong> (${tpl.exercises.length} упр.)</span>
                `;
                frag.appendChild(tplLabel);
            });
        }

        // 3. History
        const histLabel = document.createElement('label');
        histLabel.className = 'checklist-item';
        histLabel.innerHTML = `
            <input type="checkbox" id="export-check-history" checked>
            <span>⏱️ <strong>История тренировок</strong> (все сохраненные записи)</span>
        `;
        frag.appendChild(histLabel);

        this.els.exportOptionsList.appendChild(frag);
        this.els.modalExport.classList.remove('d-none');
    }

    closeExportModal() {
        this.els.modalExport.classList.add('d-none');
    }

    setAllExportCheckboxes(checked) {
        const checkboxes = this.els.exportOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checked);
    }

    openImportModal() {
        this.els.importJsonTextarea.value = '';
        this.els.importDetectedContainer.classList.add('d-none');
        this.els.importOptionsList.innerHTML = '';
        this.els.modalImport.classList.remove('d-none');
    }

    closeImportModal() {
        this.els.modalImport.classList.add('d-none');
    }

    setAllImportCheckboxes(checked) {
        const checkboxes = this.els.importOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checked);
    }

    renderDetectedImport(payload) {
        this.els.importOptionsList.innerHTML = '';
        const frag = document.createDocumentFragment();

        if (payload.hasLibrary) {
            const libLabel = document.createElement('label');
            libLabel.className = 'checklist-item';
            libLabel.innerHTML = `
                <input type="checkbox" id="import-check-library" checked>
                <span>📚 <strong>Каталог упражнений</strong> (${payload.exercises.length} упр., ${payload.categories.length} кат.)</span>
            `;
            frag.appendChild(libLabel);
        }

        if (payload.hasTemplates) {
            payload.templates.forEach((tpl, idx) => {
                const tplLabel = document.createElement('label');
                tplLabel.className = 'checklist-item';
                const exCount = (tpl.exercises || []).length;
                tplLabel.innerHTML = `
                    <input type="checkbox" class="import-check-template" data-idx="${idx}" checked>
                    <span>📋 Шаблон: <strong>${tpl.name || 'Шаблон без названия'}</strong> (${exCount} упр.)</span>
                `;
                frag.appendChild(tplLabel);
            });
        }

        if (payload.hasHistory) {
            const histLabel = document.createElement('label');
            histLabel.className = 'checklist-item';
            histLabel.innerHTML = `
                <input type="checkbox" id="import-check-history" checked>
                <span>⏱️ <strong>История тренировок</strong> (${payload.workouts.length} записей)</span>
            `;
            frag.appendChild(histLabel);
        }

        this.els.importOptionsList.appendChild(frag);
        this.els.importDetectedContainer.classList.remove('d-none');
    }
}