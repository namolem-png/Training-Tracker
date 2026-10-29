import { getDateRange, getPluralForm, escapeHtml, debounce } from '../utils.js';
import { STRINGS } from '../constants/strings.js';
import { STORE } from '../db.js';

export class ImportExportModalView {
    constructor() {
        this.cachedWorkouts = [];
        this.els = {
            // Export Modal
            btnExport: document.getElementById('btn-export-data'),
            modalExport: document.getElementById('modal-export'),
            btnCloseExportModal: document.getElementById('btn-close-export-modal'),
            btnExportSelectAll: document.getElementById('btn-export-select-all'),
            btnExportDeselectAll: document.getElementById('btn-export-deselect-all'),
            exportOptionsList: document.getElementById('export-options-list'),
            exportHistoryRangeContainer: document.getElementById('export-history-range-container'),
            exportRangePresets: document.getElementById('export-range-presets'),
            exportDateStart: document.getElementById('export-date-start'),
            exportDateEnd: document.getElementById('export-date-end'),
            exportRangeInfo: document.getElementById('export-range-info'),
            btnExportCopyAi: document.getElementById('btn-export-copy-ai'),
            btnExportCopyJson: document.getElementById('btn-export-copy-json'),
            btnExportDownloadJson: document.getElementById('btn-export-download-json'),

            // Import Modal
            btnImport: document.getElementById('btn-import-data'),
            modalImport: document.getElementById('modal-import'),
            btnCloseImportModal: document.getElementById('btn-close-import-modal'),
            importFileInput: document.getElementById('import-file-input'),
            btnImportTriggerFile: document.getElementById('btn-import-trigger-file'),
            btnImportPasteClipboard: document.getElementById('btn-import-paste-clipboard'),
            importJsonTextarea: document.getElementById('import-json-textarea'),

            importDetectedContainer: document.getElementById('import-detected-container'),
            btnImportSelectAll: document.getElementById('btn-import-select-all'),
            btnImportDeselectAll: document.getElementById('btn-import-deselect-all'),
            importOptionsList: document.getElementById('import-options-list'),
            btnConfirmImportSelected: document.getElementById('btn-confirm-import-selected')
        };
    }

    bindEvents(controller) {
        // Export Modal Events
        if (this.els.btnExport) {
            this.els.btnExport.addEventListener('click', () => controller.handleOpenExport());
        }
        if (this.els.btnCloseExportModal) {
            this.els.btnCloseExportModal.addEventListener('click', () => this.closeExportModal());
        }
        if (this.els.modalExport) {
            this.els.modalExport.addEventListener('click', (e) => {
                if (e.target === this.els.modalExport) this.closeExportModal();
            });
        }
        if (this.els.btnExportSelectAll) {
            this.els.btnExportSelectAll.addEventListener('click', () => this.setAllExportCheckboxes(true));
        }
        if (this.els.btnExportDeselectAll) {
            this.els.btnExportDeselectAll.addEventListener('click', () => this.setAllExportCheckboxes(false));
        }
        if (this.els.exportRangePresets) {
            this.els.exportRangePresets.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-preset]');
                if (!btn) return;
                this.applyPreset(btn.dataset.preset);
            });
        }
        if (this.els.exportDateStart) {
            this.els.exportDateStart.addEventListener('input', () => this.handleCustomDateChange());
            this.els.exportDateStart.addEventListener('change', () => this.handleCustomDateChange());
        }
        if (this.els.exportDateEnd) {
            this.els.exportDateEnd.addEventListener('input', () => this.handleCustomDateChange());
            this.els.exportDateEnd.addEventListener('change', () => this.handleCustomDateChange());
        }
        if (this.els.exportOptionsList) {
            this.els.exportOptionsList.addEventListener('change', (e) => {
                if (e.target.id === 'export-check-history') {
                    this.updateHistoryRangeVisibility();
                }
            });
        }
        if (this.els.btnExportCopyAi) {
            this.els.btnExportCopyAi.addEventListener('click', () => controller.handleExportCopyAi());
        }
        if (this.els.btnExportCopyJson) {
            this.els.btnExportCopyJson.addEventListener('click', () => controller.handleExportCopyJson());
        }
        if (this.els.btnExportDownloadJson) {
            this.els.btnExportDownloadJson.addEventListener('click', () => controller.handleExportDownloadJson());
        }

        // Import Modal Events
        if (this.els.btnImport) {
            this.els.btnImport.addEventListener('click', () => controller.handleOpenImport());
        }
        if (this.els.btnCloseImportModal) {
            this.els.btnCloseImportModal.addEventListener('click', () => this.closeImportModal());
        }
        if (this.els.modalImport) {
            this.els.modalImport.addEventListener('click', (e) => {
                if (e.target === this.els.modalImport) this.closeImportModal();
            });
        }
        if (this.els.btnImportTriggerFile && this.els.importFileInput) {
            this.els.btnImportTriggerFile.addEventListener('click', () => this.els.importFileInput.click());
        }
        if (this.els.importFileInput) {
            this.els.importFileInput.addEventListener('change', (e) => controller.handleImportFileSelected(e));
        }
        if (this.els.btnImportPasteClipboard) {
            this.els.btnImportPasteClipboard.addEventListener('click', () => controller.handleImportPasteClipboard());
        }
        if (this.els.importJsonTextarea) {
            this.els.importJsonTextarea.addEventListener('input', debounce(() => controller.handleAutoParseImportText(), 300));
        }
        if (this.els.btnImportSelectAll) {
            this.els.btnImportSelectAll.addEventListener('click', () => this.setAllImportCheckboxes(true));
        }
        if (this.els.btnImportDeselectAll) {
            this.els.btnImportDeselectAll.addEventListener('click', () => this.setAllImportCheckboxes(false));
        }
        if (this.els.btnConfirmImportSelected) {
            this.els.btnConfirmImportSelected.addEventListener('click', () => controller.handleConfirmImportSelected());
        }
    }

    async openExportModal(model) {
        if (!this.els.exportOptionsList) return;
        this.cachedWorkouts = model.workoutRepo
            ? await model.workoutRepo.getAll()
            : (model.db ? await model.db.getAll(STORE.WORKOUTS) : []);

        this.els.exportOptionsList.innerHTML = '';
        const frag = document.createDocumentFragment();

        // 1. Library option
        const libLabel = document.createElement('label');
        libLabel.className = 'checklist-item';
        libLabel.innerHTML = `
            <input type="checkbox" id="export-check-library" checked>
            <span>📚 <strong>${STRINGS.EXPORT_IMPORT.SECTION_LIBRARY}</strong> (${model.exercises.length} упр., ${model.categories.length} кат.)</span>
        `;
        frag.appendChild(libLabel);

        // 2. Templates
        if (model.templates && model.templates.length > 0) {
            model.templates.forEach(tpl => {
                const tplLabel = document.createElement('label');
                tplLabel.className = 'checklist-item';
                tplLabel.innerHTML = `
                    <input type="checkbox" class="export-check-template" data-tpl-id="${escapeHtml(tpl.id)}" checked>
                    <span>📋 Шаблон: <strong>${escapeHtml(tpl.name)}</strong> (${tpl.exercises.length} упр.)</span>
                `;
                frag.appendChild(tplLabel);
            });
        }

        // 3. History
        const totalWorkouts = this.cachedWorkouts.length;
        const histLabel = document.createElement('label');
        histLabel.className = 'checklist-item';
        const historyCountDesc = totalWorkouts > 0
            ? `(${STRINGS.EXPORT_IMPORT.HISTORY_ALL_RECORDS}: ${totalWorkouts})`
            : '(нет записей)';
        histLabel.innerHTML = `
            <input type="checkbox" id="export-check-history" checked>
            <span>⏱️ <strong>${STRINGS.EXPORT_IMPORT.SECTION_HISTORY_TITLE}</strong> <span class="text-muted fs-12">${historyCountDesc}</span></span>
        `;
        frag.appendChild(histLabel);

        this.els.exportOptionsList.appendChild(frag);

        this.applyPreset('all');
        this.updateHistoryRangeVisibility();

        if (this.els.modalExport) this.els.modalExport.classList.remove('d-none');
    }

    closeExportModal() {
        if (this.els.modalExport) this.els.modalExport.classList.add('d-none');
    }

    setAllExportCheckboxes(checked) {
        if (!this.els.exportOptionsList) return;
        const checkboxes = this.els.exportOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checked);
        this.updateHistoryRangeVisibility();
    }

    updateHistoryRangeVisibility() {
        const histCheck = this.els.exportOptionsList?.querySelector('#export-check-history');
        const isHistoryChecked = Boolean(histCheck?.checked);
        if (this.els.exportHistoryRangeContainer) {
            this.els.exportHistoryRangeContainer.classList.toggle('d-none', !isHistoryChecked);
        }
    }

    applyPreset(preset) {
        if (!this.els.exportRangePresets) return;
        const buttons = this.els.exportRangePresets.querySelectorAll('button[data-preset]');
        buttons.forEach(b => b.classList.toggle('active', b.dataset.preset === preset));

        if (preset === 'all') {
            if (this.els.exportDateStart) this.els.exportDateStart.value = '';
            if (this.els.exportDateEnd) this.els.exportDateEnd.value = '';
        } else {
            const days = parseInt(preset, 10);
            const { startDate, endDate } = getDateRange(days);
            if (this.els.exportDateStart) this.els.exportDateStart.value = startDate;
            if (this.els.exportDateEnd) this.els.exportDateEnd.value = endDate;
        }

        this.updateRangeSummary();
    }

    handleCustomDateChange() {
        const startDate = this.els.exportDateStart?.value || '';
        const endDate = this.els.exportDateEnd?.value || '';

        if (this.els.exportRangePresets) {
            const buttons = this.els.exportRangePresets.querySelectorAll('button[data-preset]');
            buttons.forEach(b => {
                const preset = b.dataset.preset;
                let matches = false;
                if (preset === 'all' && !startDate && !endDate) {
                    matches = true;
                } else if (preset !== 'all') {
                    const days = parseInt(preset, 10);
                    const range = getDateRange(days);
                    if (range.startDate === startDate && range.endDate === endDate) {
                        matches = true;
                    }
                }
                b.classList.toggle('active', matches);
            });
        }

        this.updateRangeSummary();
    }

    updateRangeSummary() {
        if (!this.els.exportRangeInfo) return;
        const total = (this.cachedWorkouts || []).length;
        const startDate = this.els.exportDateStart?.value || '';
        const endDate = this.els.exportDateEnd?.value || '';

        if (startDate && endDate && startDate > endDate) {
            this.els.exportRangeInfo.className = 'fs-12 text-danger mt-5';
            this.els.exportRangeInfo.textContent = '⚠️ ' + STRINGS.MESSAGES.ERROR_DATE_RANGE_INVALID;
            return;
        }

        this.els.exportRangeInfo.className = 'fs-12 text-muted mt-5';

        if (!startDate && !endDate) {
            this.els.exportRangeInfo.textContent = STRINGS.EXPORT_IMPORT.HISTORY_COUNT_ALL.replace('{count}', total);
            return;
        }

        const filtered = (this.cachedWorkouts || []).filter(w => {
            const d = (w.date || '').split('T')[0];
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
        });

        if (filtered.length === 0) {
            this.els.exportRangeInfo.className = 'fs-12 text-danger mt-5';
            this.els.exportRangeInfo.textContent = STRINGS.EXPORT_IMPORT.HISTORY_COUNT_NONE;
        } else {
            const word = getPluralForm(filtered.length, STRINGS.COMMON.UNITS.WORKOUT_FORMS);
            this.els.exportRangeInfo.textContent = STRINGS.EXPORT_IMPORT.HISTORY_COUNT_SELECTED
                .replace('{count}', filtered.length)
                .replace('{word}', word);
        }
    }

    getExportSelection() {
        const list = this.els.exportOptionsList;
        if (!list) return null;
        const includeLibrary = Boolean(list.querySelector('#export-check-library')?.checked);
        const templateIds = Array.from(list.querySelectorAll('.export-check-template:checked')).map(el => el.dataset.tplId);
        const includeHistory = Boolean(list.querySelector('#export-check-history')?.checked);

        if (!includeLibrary && templateIds.length === 0 && !includeHistory) {
            return null;
        }

        let historyDateRange = null;
        if (includeHistory) {
            const startDate = this.els.exportDateStart?.value || null;
            const endDate = this.els.exportDateEnd?.value || null;
            if (startDate || endDate) {
                if (startDate && endDate && startDate > endDate) {
                    throw new Error(STRINGS.MESSAGES.ERROR_DATE_RANGE_INVALID);
                }
                historyDateRange = { startDate, endDate };

                const matchingCount = (this.cachedWorkouts || []).filter(w => {
                    const d = (w.date || '').split('T')[0];
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                }).length;

                if (matchingCount === 0 && !includeLibrary && templateIds.length === 0) {
                    throw new Error(STRINGS.MESSAGES.ERROR_NO_WORKOUTS_IN_RANGE);
                }
            } else if ((this.cachedWorkouts || []).length === 0 && !includeLibrary && templateIds.length === 0) {
                throw new Error(STRINGS.MESSAGES.ERROR_NO_WORKOUTS_IN_RANGE);
            }
        }

        return { includeLibrary, templateIds, includeHistory, historyDateRange };
    }

    openImportModal() {
        if (this.els.importJsonTextarea) this.els.importJsonTextarea.value = '';
        if (this.els.importDetectedContainer) this.els.importDetectedContainer.classList.add('d-none');
        if (this.els.importOptionsList) this.els.importOptionsList.innerHTML = '';
        if (this.els.modalImport) this.els.modalImport.classList.remove('d-none');
    }

    closeImportModal() {
        if (this.els.modalImport) this.els.modalImport.classList.add('d-none');
    }

    setAllImportCheckboxes(checked) {
        if (!this.els.importOptionsList) return;
        const checkboxes = this.els.importOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checked);
    }

    renderDetectedImport(payload) {
        if (!this.els.importOptionsList) return;
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
                    <span>📋 Шаблон: <strong>${escapeHtml(tpl.name || 'Шаблон без названия')}</strong> (${exCount} упр.)</span>
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
        if (this.els.importDetectedContainer) {
            this.els.importDetectedContainer.classList.remove('d-none');
        }
    }

    getImportSelection() {
        const list = this.els.importOptionsList;
        if (!list) return null;
        const importLibrary = Boolean(list.querySelector('#import-check-library')?.checked);
        const selectedTemplateIndices = Array.from(list.querySelectorAll('.import-check-template:checked')).map(el => parseInt(el.dataset.idx, 10));
        const importHistory = Boolean(list.querySelector('#import-check-history')?.checked);

        if (!importLibrary && selectedTemplateIndices.length === 0 && !importHistory) {
            return null;
        }

        return { importLibrary, selectedTemplateIndices, importHistory };
    }
}
