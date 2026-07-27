export class HistoryView {
    constructor() {
        this.container = document.getElementById('calendar-container');
        this.historyViewDate = new Date();
    }

    async render(model) {
        this.container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const year = this.historyViewDate.getFullYear();
        const month = this.historyViewDate.getMonth();
        const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        
        const monthWorkouts = (await model.getWorkoutsForMonth(year, month));

        const controls = document.createElement('div');
        controls.className = 'calendar-controls';
        controls.innerHTML = `
            <button class="nav-arrow" data-action="prev-month">◀</button>
            <h3 style="margin:0">${monthNames[month]} ${year}</h3>
            <button class="nav-arrow" data-action="next-month">▶</button>
        `;
        fragment.appendChild(controls);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach(d => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header-day';
            cell.textContent = d;
            grid.appendChild(cell);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < startOffset; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const workouts = monthWorkouts.filter(w => w.date === dateStr);
            const hasWorkout = workouts.length > 0;
            
            const dayCell = document.createElement('div');
            dayCell.className = `calendar-day ${hasWorkout ? 'has-workout' : ''}`;
            dayCell.textContent = day;
            if (hasWorkout) {
                dayCell.dataset.action = 'load-workout';
                dayCell.dataset.id = workouts[workouts.length - 1].id;
                const dot = document.createElement('div');
                dot.className = 'workout-dot';
                dayCell.appendChild(dot);
            }
            grid.appendChild(dayCell);
        }
        fragment.appendChild(grid);

        const listTitle = document.createElement('h4');
        listTitle.className = 'mt-20';
        listTitle.textContent = 'Список за месяц:';
        fragment.appendChild(listTitle);

        const monthWorkoutsList = monthWorkouts; // Они уже приходят отсортированными 'prev'

        if (monthWorkoutsList.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Тренировок не было.';
            fragment.appendChild(empty);
        } else {
            monthWorkouts.forEach(w => fragment.appendChild(this.createHistoryCard(w, model.activeWorkoutId)));
        }
        this.container.appendChild(fragment);
    }

    createHistoryCard(w, activeId) {
        const completed = w.exercises.filter(e => e.completed).length;
        const isActive = w.id === activeId;
        const card = document.createElement('div');
        card.className = `history-card ${isActive ? 'active' : ''}`;
        card.dataset.action = 'load-workout';
        card.dataset.id = w.id;

        card.innerHTML = `
            <div class="flex-1">
                <p class="history-date">${new Date(w.date).toLocaleDateString('ru-RU')} (${w.dayOfWeek})</p>
                <p class="history-stats">Выполнено: ${completed} из ${w.exercises.length}</p>
            </div>
            <div class="d-flex align-center gap-15">
                <button class="btn-delete-ex" data-action="delete-workout" data-id="${w.id}">🗑️</button>
                <div class="text-primary fs-20">➔</div>
            </div>
        `;
        return card;
    }

    bindEvents(controller) {
        this.container.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            switch(btn.dataset.action) {
                case 'prev-month': 
                    this.historyViewDate.setMonth(this.historyViewDate.getMonth() - 1);
                    this.render(controller.model);
                    break;
                case 'next-month': 
                    this.historyViewDate.setMonth(this.historyViewDate.getMonth() + 1);
                    this.render(controller.model);
                    break;
                case 'load-workout': controller.handleLoadWorkout(btn.dataset.id); break;
                case 'delete-workout': 
                    e.stopPropagation();
                    if(confirm("Удалить?")) controller.handleDeleteWorkout(btn.dataset.id); break;
            }
        });
    }
}