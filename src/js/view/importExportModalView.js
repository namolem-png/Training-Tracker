export class ImportExportModalView {
    constructor() {
        this.els = {
            // Export Modal
            btnExport: document.getElementById('btn-export-data'),
            modalExport: document.getElementById('modal-export'),
            btnCloseExportModal: document.getElementById('btn-close-export-modal'),
            btnExportSelectAll: document.getElementById('btn-export-select-all'),
            btnExportDeselectAll: document.getElementById('btn-export-deselect-all'),
            exportOptionsList: document.getElementById('export-options-list'),
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
            btnImportParse: document.getElementById('btn-import-parse'),
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
        if (this.els.btnImportParse) {
            this.els.btnImportParse.addEventListener('click', () => controller.handleParseImportText());
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

    openExportModal(model) {
        if (!this.els.exportOptionsList) return;
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
        if (model.templates && model.templates.length > 0) {
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
        if (this.els.modalExport) this.els.modalExport.classList.remove('d-none');
    }

    closeExportModal() {
        if (this.els.modalExport) this.els.modalExport.classList.add('d-none');
    }

    setAllExportCheckboxes(checked) {
        if (!this.els.exportOptionsList) return;
        const checkboxes = this.els.exportOptionsList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = checked);
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

        return { includeLibrary, templateIds, includeHistory };
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
