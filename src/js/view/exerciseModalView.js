import { escapeHtml } from '../utils.js';

export class ExerciseModalView {
    constructor() {
        this.addingToLibraryOnly = false;

        this.els = {
            addExFormContainer: document.getElementById(
                'add-ex-form-container',
            ),
            addExFormTitle: document.getElementById('add-ex-form-title'),
            categorySelectWrapper: document.getElementById(
                'category-select-wrapper',
            ),
            libSelectWrapper: document.getElementById('library-select-wrapper'),
            customExFields: document.getElementById('custom-ex-fields'),
            selectedExTargetInfo: document.getElementById(
                'selected-ex-target-info',
            ),
            btnShowAddEx: document.getElementById('btn-show-add-ex'),
            btnShowAddLibEx: document.getElementById('btn-show-add-lib-ex'),
            btnCancelNewEx: document.getElementById('btn-cancel-new-ex'),
            exLibSelect: document.getElementById('exerciseLibrarySelect'),
            newExName: document.getElementById('newExName'),
            newExCat: document.getElementById('newExCat'),
            newExTarget: document.getElementById('newExTarget'),
            btnSaveNewEx: document.getElementById('btn-save-new-ex'),
            tabWorkout: document.getElementById('tab-workout'),
        };
    }

    bindEvents(controller) {
        if (this.els.btnShowAddEx) {
            this.els.btnShowAddEx.addEventListener('click', () =>
                this.show(null, false, controller.model),
            );
        }
        if (this.els.btnShowAddLibEx) {
            this.els.btnShowAddLibEx.addEventListener('click', () =>
                this.show(null, true, controller.model),
            );
        }
        if (this.els.btnCancelNewEx) {
            this.els.btnCancelNewEx.addEventListener('click', () =>
                this.hide(),
            );
        }

        if (this.els.newExCat) {
            this.els.newExCat.addEventListener('change', () => {
                const catId = this.els.newExCat.value;
                this.updateExerciseList(controller.model, catId);
            });
        }

        if (this.els.exLibSelect) {
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
                    if (ex?.target) {
                        this.els.selectedExTargetInfo.textContent = `Цель: ${ex.target}`;
                        this.els.selectedExTargetInfo.classList.remove(
                            'd-none',
                        );
                    } else {
                        this.els.selectedExTargetInfo.classList.add('d-none');
                    }
                } else {
                    this.els.customExFields.classList.add('d-none');
                    this.els.selectedExTargetInfo.classList.add('d-none');
                }
            });
        }

        if (this.els.btnSaveNewEx) {
            this.els.btnSaveNewEx.addEventListener('click', () =>
                controller.handleSaveNewExercise(this.addingToLibraryOnly),
            );
        }
    }

    show(categoryId, isLibraryOnly, model) {
        this.addingToLibraryOnly = isLibraryOnly;
        if (this.els.addExFormContainer) {
            this.els.addExFormContainer.classList.remove('d-none');
        }

        if (this.els.btnShowAddEx) {
            this.els.btnShowAddEx.classList.toggle('d-none', isLibraryOnly);
        }
        if (this.els.btnShowAddLibEx) {
            this.els.btnShowAddLibEx.classList.toggle('d-none', !isLibraryOnly);
        }
        if (this.els.libSelectWrapper) {
            this.els.libSelectWrapper.classList.toggle('d-none', isLibraryOnly);
        }

        if (this.els.addExFormTitle) {
            if (isLibraryOnly) {
                this.els.addExFormTitle.textContent =
                    'Новое упражнение в библиотеку';
            } else if (categoryId && model) {
                this.els.addExFormTitle.textContent = `Добавить в "${model.getCategoryName(categoryId)}"`;
            } else {
                this.els.addExFormTitle.textContent = 'Добавить упражнение';
            }
        }

        this.populateForm(model, categoryId, isLibraryOnly);

        if (categoryId && this.els.newExCat) {
            this.els.newExCat.value = categoryId;
            this.els.newExCat.disabled = true;
        } else if (this.els.newExCat) {
            this.els.newExCat.disabled = false;
        }

        let placed = false;
        if (categoryId && !isLibraryOnly) {
            const catContent = document.getElementById(
                `cat-content-${categoryId}`,
            );
            const catHeader = document.querySelector(
                `[data-cat-id="${categoryId}"]`,
            );
            if (catContent && this.els.addExFormContainer) {
                catContent.classList.remove('collapsed');
                if (catHeader) catHeader.classList.remove('collapsed');
                catContent.appendChild(this.els.addExFormContainer);
                this.els.addExFormContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
                placed = true;
            }
        }

        if (!placed) {
            const parentBtn = isLibraryOnly
                ? this.els.btnShowAddLibEx
                : this.els.btnShowAddEx;
            if (parentBtn?.parentNode && this.els.addExFormContainer) {
                parentBtn.parentNode.insertBefore(
                    this.els.addExFormContainer,
                    parentBtn,
                );
                this.els.addExFormContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }

    hide() {
        if (this.els.addExFormContainer) {
            this.els.addExFormContainer.classList.add('d-none');
        }
        if (this.els.btnShowAddEx) {
            this.els.btnShowAddEx.classList.remove('d-none');
        }
        if (this.els.btnShowAddLibEx) {
            this.els.btnShowAddLibEx.classList.remove('d-none');
        }
        if (this.els.tabWorkout && this.els.addExFormContainer) {
            this.els.tabWorkout.appendChild(this.els.addExFormContainer);
        }
        if (this.els.newExName) this.els.newExName.value = '';
        if (this.els.newExTarget) this.els.newExTarget.value = '';
        if (this.els.customExFields)
            this.els.customExFields.classList.add('d-none');
        if (this.els.selectedExTargetInfo)
            this.els.selectedExTargetInfo.classList.add('d-none');
        if (this.els.newExCat) this.els.newExCat.disabled = false;
        if (this.els.exLibSelect) this.els.exLibSelect.disabled = false;
    }

    updateExerciseList(model, catId) {
        const libSel = this.els.exLibSelect;
        if (!libSel) return;

        if (!catId) {
            libSel.innerHTML =
                '<option value="" disabled selected>-- Сначала выберите категорию --</option>';
            libSel.disabled = true;
            if (this.els.customExFields)
                this.els.customExFields.classList.add('d-none');
            if (this.els.selectedExTargetInfo)
                this.els.selectedExTargetInfo.classList.add('d-none');
            return;
        }

        libSel.disabled = false;
        const filtered = (model?.exercises || [])
            .filter((e) => e.categoryId === catId)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            libSel.innerHTML =
                '<option value="new" selected>+ Новое упражнение (вручную)</option>';
            if (this.els.customExFields)
                this.els.customExFields.classList.remove('d-none');
            if (this.els.selectedExTargetInfo)
                this.els.selectedExTargetInfo.classList.add('d-none');
            if (this.els.newExName) this.els.newExName.value = '';
            if (this.els.newExTarget) this.els.newExTarget.value = '';
        } else {
            libSel.innerHTML =
                '<option value="" disabled selected>-- Выберите упражнение --</option>' +
                filtered
                    .map(
                        (e) =>
                            `<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)}</option>`,
                    )
                    .join('') +
                '<option value="new">+ Новое упражнение (вручную)</option>';
            if (this.els.customExFields)
                this.els.customExFields.classList.add('d-none');
            if (this.els.selectedExTargetInfo)
                this.els.selectedExTargetInfo.classList.add('d-none');
        }
    }

    populateForm(model, catId, isLibraryOnly) {
        const catSel = this.els.newExCat;
        if (!catSel) return;

        const categories = model?.categories || [];

        if (isLibraryOnly) {
            catSel.innerHTML =
                '<option value="" disabled selected>-- Выберите категорию --</option>' +
                categories
                    .map(
                        (c) =>
                            `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`,
                    )
                    .join('');
            if (catId) catSel.value = catId;
            if (this.els.customExFields)
                this.els.customExFields.classList.remove('d-none');
            if (this.els.newExName) this.els.newExName.value = '';
            if (this.els.newExTarget) this.els.newExTarget.value = '';
            if (this.els.selectedExTargetInfo)
                this.els.selectedExTargetInfo.classList.add('d-none');
            return;
        }

        catSel.innerHTML =
            '<option value="" disabled selected>-- Выберите категорию --</option>' +
            categories
                .map(
                    (c) =>
                        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`,
                )
                .join('');

        if (catId) {
            catSel.value = catId;
            this.updateExerciseList(model, catId);
        } else {
            catSel.value = '';
            this.updateExerciseList(model, null);
        }
    }
}
