export class WorkoutView {
    constructor() {
        this.container = document.getElementById('workout-list');
        this.titleEl = document.getElementById('workout-plan-title');
        this.dateInput = document.getElementById('dateInput');
        this.dayInput = document.getElementById('dayOfWeek');
        this.btnPrev = document.getElementById('btn-prev-workout');
        this.btnNext = document.getElementById('btn-next-workout');
    }

    render(model) {
        const workout = model.getActiveWorkout();
        this.container.innerHTML = '';

        if (!workout) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Нет активных тренировок. Создайте новую!';
            this.container.appendChild(empty);
            this.dateInput.value = '';
            this.dayInput.value = '';
            this.titleEl.textContent = "План";
            return;
        }

        this.dateInput.value = workout.date;
        this.dayInput.value = workout.dayOfWeek;
        
        let workoutTitle = "План";
        if (workout.templateId) {
            const template = model.templates.find(t => t.id === workout.templateId);
            if (template) workoutTitle = template.name;
        }
        this.titleEl.textContent = workoutTitle;

        const grouped = {};
        workout.exercises.forEach((ex, index) => {
            const libEx = model.getLibraryExercise(ex.exerciseId);
            const catId = libEx.categoryId || 'c7';
            if (!grouped[catId]) grouped[catId] = [];
            grouped[catId].push({ ex, index, libEx });
        });

        const fragment = document.createDocumentFragment();
        const renderedCats = new Set();

        model.categories.forEach(cat => {
            if (grouped[cat.id]?.length > 0) {
                this.appendCategoryToFragment(fragment, cat.id, cat.name, grouped[cat.id]);
                renderedCats.add(cat.id);
            }
        });

        Object.keys(grouped).forEach(catId => {
            if (!renderedCats.has(catId)) {
                this.appendCategoryToFragment(fragment, catId, model.getCategoryName(catId), grouped[catId]);
            }
        });

        this.container.appendChild(fragment);
    }

    appendCategoryToFragment(fragment, catId, catName, items) {
        const allCompleted = items.every(item => item.ex.completed);
        
        const header = document.createElement('div');
        header.className = `category-header ${allCompleted ? 'collapsed' : ''}`;
        header.dataset.action = 'toggle-category';
        header.dataset.catId = catId;

        header.innerHTML = `
            <div class="category-title-wrapper">
                <span class="category-arrow">▼</span>
                <div class="category-title">${catName}</div>
            </div>
            <button class="btn-add-to-cat" data-action="show-add-ex" data-cat="${catId}" title="Добавить">+</button>
        `;

        const content = document.createElement('div');
        content.className = `category-exercises ${allCompleted ? 'collapsed' : ''}`;
        content.id = `cat-content-${catId}`;

        items.forEach(item => {
            content.appendChild(this.createCardElement(item.ex, item.index, item.libEx));
        });

        fragment.appendChild(header);
        fragment.appendChild(content);
    }

    createCardElement(ex, index, libEx) {
        const card = document.createElement('div');
        card.className = `exercise-card ${ex.completed ? 'completed' : ''}`;
        card.dataset.catId = libEx.categoryId;

        card.innerHTML = `
            <div class="ex-header">
                <div class="ex-header-left">
                    <input type="checkbox" ${ex.completed ? 'checked' : ''} data-action="toggle-complete" data-ex="${index}">
                    <div class="ex-info">
                        <p class="ex-name">${libEx.name}</p>
                        <p class="ex-target">Цель: ${libEx.target}</p>
                    </div>
                </div>
                <button class="btn-delete-ex" data-action="delete-ex" data-ex="${index}" title="Удалить">🗑️</button>
            </div>
            <div class="sets-container"></div>
        `;

        this.updateSetsInCard(ex, index, card.querySelector('.sets-container'));
        return card;
    }

    renderCardSets(model, exIndex, cardElement) {
        const ex = model.getActiveWorkout().exercises[exIndex];
        const container = cardElement.querySelector('.sets-container');
        if (container) this.updateSetsInCard(ex, exIndex, container);
    }

    updateSetsInCard(ex, exIndex, container) {
        container.innerHTML = '';
        const frag = document.createDocumentFragment();

        ex.sets.forEach((set, setIdx) => {
            const setItem = document.createElement('div');
            setItem.className = 'set-item';
            setItem.innerHTML = `
                <span>${setIdx + 1}. <b>${set.weight} кг</b> × <b>${set.reps}</b></span>
                <div class="set-actions">
                    <button class="btn-edit" data-action="edit-set" data-ex="${exIndex}" data-set="${setIdx}">✎</button>
                    <button class="btn-delete" data-action="delete-set" data-ex="${exIndex}" data-set="${setIdx}">✖</button>
                </div>
            `;
            frag.appendChild(setItem);
        });

        const form = document.createElement('div');
        form.className = 'add-set-form';
        form.innerHTML = `
            <input type="number" id="weight-${exIndex}" placeholder="Вес" step="0.5">
            <input type="number" id="reps-${exIndex}" placeholder="Повторы">
            <button data-action="add-set" data-ex="${exIndex}">+</button>
        `;
        frag.appendChild(form);
        container.appendChild(frag);
    }

    bindEvents(controller) {
        this.container.addEventListener('click', e => {
            const actionTarget = e.target.closest('[data-action]');
            if (!actionTarget) return;
            const action = actionTarget.dataset.action;
            const exIdx = actionTarget.dataset.ex;
            const setIdx = actionTarget.dataset.set;
            const card = actionTarget.closest('.exercise-card');

            switch(action) {
                case 'toggle-complete': controller.handleToggleComplete(exIdx, card); break;
                case 'delete-ex': controller.handleDeleteExercise(exIdx); break;
                case 'delete-set': controller.handleDeleteSet(exIdx, setIdx, card); break;
                case 'edit-set': controller.handleEditSet(exIdx, setIdx, card); break;
                case 'add-set': 
                    const w = document.getElementById(`weight-${exIdx}`).value;
                    const r = document.getElementById(`reps-${exIdx}`).value;
                    controller.handleAddSet(exIdx, w, r, card); 
                    break;
                case 'show-add-ex': controller.view.showAddExerciseForm(actionTarget.dataset.cat, false); break;
                case 'toggle-category':
                    if (e.target.closest('button')) return;
                    controller.handleToggleCategory(actionTarget);
                    break;
            }
        });
        this.dateInput.addEventListener('change', () => controller.handleHeaderChange());
        this.dayInput.addEventListener('change', () => controller.handleHeaderChange());
        this.btnPrev.addEventListener('click', () => controller.navigateWorkout(-1));
        this.btnNext.addEventListener('click', () => controller.navigateWorkout(1));
    }
}