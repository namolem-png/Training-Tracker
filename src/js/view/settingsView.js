export class SettingsView {
    constructor() {
        this.templatesList = document.getElementById('templates-list');
        this.libraryList = document.getElementById('library-list');
        this.categoryList = document.getElementById('category-list');
        this.currentTemplateExercises = [];
        
        this.els = {
            accordion: document.getElementById('settings-accordion'),
            newCategoryName: document.getElementById('newCategoryName'),
            btnAddCategory: document.getElementById('btn-add-category'),
            btnOpenTplEditor: document.getElementById('btn-open-template-editor'),
            btnCloseTplEditor: document.getElementById('btn-close-template-editor'),
            btnCancelTplStep: document.getElementById('btn-cancel-template-step'),
            btnAddExToTpl: document.getElementById('btn-add-ex-to-template'),
            btnSaveTpl: document.getElementById('btn-save-template'),
            stepOptions: document.getElementById('step-options'),
            tplEditor: document.getElementById('template-editor'),
            tplEditorTitle: document.getElementById('template-editor-title'),
            tplName: document.getElementById('template-name'),
            editTplId: document.getElementById('edit-template-id'),
            tplExercisesList: document.getElementById('template-exercises-list'),
            tplStepContainer: document.getElementById('template-step-container'),
            stepInstruction: document.getElementById('step-instruction')
        };
    }

    async render(model) {
        this.renderCategories(model);
        this.renderLibrary(model);
        this.renderTemplates(model);
    }

    renderCategories(model) {
        this.categoryList.innerHTML = '';
        const frag = document.createDocumentFragment();
        model.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `<span>${cat.name}</span><button class="btn-delete-ex" data-action="delete-cat" data-id="${cat.id}">🗑️</button>`;
            frag.appendChild(item);
        });
        this.categoryList.appendChild(frag);
    }

    renderLibrary(model) {
        this.libraryList.innerHTML = '';
        if (model.exercises.length === 0) {
            const p = document.createElement('p');
            p.className = 'empty-state';
            p.textContent = 'Библиотека пуста.';
            this.libraryList.appendChild(p);
            return;
        }

        const grouped = {};
        model.exercises.forEach(ex => {
            if (!grouped[ex.categoryId]) grouped[ex.categoryId] = [];
            grouped[ex.categoryId].push(ex);
        });

        const fragment = document.createDocumentFragment();
        model.categories.forEach(cat => {
            const items = grouped[cat.id];
            if (items?.length > 0) {
                const header = document.createElement('div');
                header.className = 'category-header mt-15';
                header.innerHTML = `<div class="category-title fs-16">${cat.name}</div><button class="btn-add-to-cat" data-action="show-add-lib" data-cat="${cat.id}">+</button>`;
                fragment.appendChild(header);

                items.sort((a, b) => a.name.localeCompare(b.name)).forEach(ex => {
                    const el = document.createElement('div');
                    el.className = 'category-item library-item';
                    el.innerHTML = `
                        <div class="flex-1"><div class="fw-bold">${ex.name}</div><div class="fs-12 text-muted">${ex.target}</div></div>
                        <div class="set-actions"><button class="btn-edit" data-action="edit-lib" data-id="${ex.id}">✎</button><button class="btn-delete-ex ml-10" data-action="delete-lib" data-id="${ex.id}">🗑️</button></div>
                    `;
                    fragment.appendChild(el);
                });
            }
        });
        this.libraryList.appendChild(fragment);
    }

    renderTemplates(model) {
        this.templatesList.innerHTML = '';
        if (model.templates.length === 0) {
            const p = document.createElement('p');
            p.className = 'empty-state';
            p.textContent = 'Нет созданных шаблонов.';
            this.templatesList.appendChild(p);
        } else {
            const frag = document.createDocumentFragment();
            model.templates.forEach(tpl => {
                const el = document.createElement('div');
                el.className = 'category-item library-item';
                el.innerHTML = `
                    <div class="flex-1"><div class="fw-bold">${tpl.name}</div><div class="fs-12 text-muted">Упражнений: ${tpl.exercises.length}</div></div>
                    <div class="set-actions"><button class="btn-edit" data-action="edit-template" data-id="${tpl.id}">✎</button><button class="btn-delete-ex ml-10" data-action="delete-template" data-id="${tpl.id}">🗑️</button></div>
                `;
                frag.appendChild(el);
            });
            this.templatesList.appendChild(frag);
        }
    }

    renderTemplateExercisesList(model) {
        this.els.tplExercisesList.innerHTML = '';
        if (this.currentTemplateExercises.length) {
            const p = document.createElement('p');
            p.className = 'fs-12 mb-5 text-muted';
            p.textContent = 'Состав шаблона:';
            this.els.tplExercisesList.appendChild(p);
        }
        
        const frag = document.createDocumentFragment();
        this.currentTemplateExercises.forEach((exId, idx) => {
            const ex = model.getLibraryExercise(exId);
            const item = document.createElement('div');
            item.className = 'set-item';
            item.innerHTML = `<span>${ex.name} <small>(${model.getCategoryName(ex.categoryId)})</small></span><button class="btn-delete" data-action="remove-ex-template" data-idx="${idx}">✖</button>`;
            frag.appendChild(item);
        });
        this.els.tplExercisesList.appendChild(frag);
    }

    bindEvents(controller) {
        this.els.accordion.addEventListener('click', e => {
            const header = e.target.closest('.collapsible-header');
            if (header) {
                header.classList.toggle('open');
                const body = header.nextElementSibling;
                if (body && body.classList.contains('collapsible-body')) body.classList.toggle('open');
            }

            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            switch(btn.dataset.action) {
                case 'delete-cat': controller.handleDeleteCategory(btn.dataset.id); break;
                case 'show-add-lib': controller.view.showAddExerciseForm(btn.dataset.cat, true); break;
                case 'edit-lib': controller.handleEditLibrary(btn.dataset.id); break;
                case 'delete-lib': controller.handleDeleteLibrary(btn.dataset.id); break;
                case 'edit-template': this.openTemplateEditor(controller.model, btn.dataset.id); break;
                case 'delete-template': controller.handleDeleteTemplate(btn.dataset.id); break;
                case 'remove-ex-template': 
                    this.currentTemplateExercises.splice(btn.dataset.idx, 1);
                    this.renderTemplateExercisesList(controller.model);
                    break;
            }
        });

        this.els.btnAddCategory.addEventListener('click', () => {
            controller.handleAddCategory(this.els.newCategoryName.value);
        });

        // Шаблоны: редактор
        this.els.btnOpenTplEditor.addEventListener('click', () => this.openTemplateEditor(controller.model));
        this.els.btnCloseTplEditor.addEventListener('click', () => this.els.tplEditor.classList.add('d-none'));
        this.els.btnCancelTplStep.addEventListener('click', () => this.cancelTemplateStep());
        this.els.btnAddExToTpl.addEventListener('click', () => this.startAddExToTemplate(controller.model));
        
        this.els.btnSaveTpl.addEventListener('click', () => {
            controller.handleSaveTemplate(
                this.els.editTplId.value,
                this.els.tplName.value,
                this.currentTemplateExercises
            );
            this.els.tplEditor.classList.add('d-none');
        });

        this.els.stepOptions.addEventListener('click', e => {
            if(e.target.tagName !== 'BUTTON') return;
            if (e.target.dataset.cat) {
                this.selectCategoryForTemplate(controller.model, e.target.dataset.cat);
            } else if (e.target.dataset.ex) {
                this.currentTemplateExercises.push(e.target.dataset.ex);
                this.cancelTemplateStep();
                this.renderTemplateExercisesList(controller.model);
            }
        });
    }

    openTemplateEditor(model, id = null) {
        this.cancelTemplateStep();
        this.els.tplEditor.classList.remove('d-none');
        if (id) {
            const tpl = model.templates.find(t => t.id === id);
            this.els.tplEditorTitle.innerText = 'Редактировать шаблон';
            this.els.tplName.value = tpl.name;
            this.els.editTplId.value = tpl.id;
            this.currentTemplateExercises = [...tpl.exercises];
        } else {
            this.els.tplEditorTitle.innerText = 'Новый шаблон';
            this.els.tplName.value = '';
            this.els.editTplId.value = '';
            this.currentTemplateExercises = [];
        }
        this.renderTemplateExercisesList(model);
    }

    startAddExToTemplate(model) {
        this.els.tplStepContainer.classList.remove('d-none');
        this.els.btnAddExToTpl.classList.add('d-none');
        this.els.stepInstruction.innerText = '1. Выберите категорию:';
        
        this.els.stepOptions.innerHTML = model.categories.map(cat => `<button data-cat="${cat.id}" style="padding:5px 10px; cursor:pointer;">${cat.name}</button>`).join('');
    }

    selectCategoryForTemplate(model, catId) {
        this.els.stepInstruction.innerText = `2. Выберите упражнение:`;
        const filtered = model.exercises.filter(ex => ex.categoryId === catId);
        const options = this.els.stepOptions;
        if (filtered.length === 0) {
            options.innerHTML = '<p style="font-size:12px;">В этой категории нет упражнений.</p>';
        } else {
            options.innerHTML = filtered.map(ex => `<button data-ex="${ex.id}" style="padding:5px 10px; cursor:pointer;">${ex.name}</button>`).join('');
        }
    }

    cancelTemplateStep() {
        this.els.tplStepContainer.classList.add('d-none');
        this.els.btnAddExToTpl.classList.remove('d-none');
    }
}