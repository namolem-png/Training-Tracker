import { STORE } from '../db.js';

/**
 * Репозиторий для работы с тренировками и их состоянием в IndexedDB
 */
export class WorkoutRepository {
    constructor(db) {
        this.db = db;
    }

    async get(id) {
        if (!id) return null;
        return await this.db.get(STORE.WORKOUTS, String(id));
    }

    async getAll() {
        return await this.db.getAll(STORE.WORKOUTS);
    }

    async getByPage(limit, offset, direction = 'prev') {
        return await this.db.getByPage(STORE.WORKOUTS, 'date', limit, offset, direction);
    }

    async getForMonth(year, month) {
        const monthStr = String(month + 1).padStart(2, '0');
        const startDate = `${year}-${monthStr}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        return await this.db.getInRange(STORE.WORKOUTS, 'date', startDate, endDate, 'prev');
    }

    async getAdjacentId(id, direction) {
        const current = await this.get(id);
        if (!current) return null;
        return await this.db.getAdjacentId(STORE.WORKOUTS, 'date', String(id), current.date, direction);
    }

    async save(workout) {
        return await this.db.save(STORE.WORKOUTS, workout);
    }

    async delete(id) {
        return await this.db.delete(STORE.WORKOUTS, String(id));
    }

    async getActiveWorkoutId() {
        const setting = await this.db.get(STORE.SETTINGS, 'activeWorkoutId');
        return setting ? String(setting.value) : null;
    }

    async saveActiveWorkoutId(id) {
        return await this.db.save(STORE.SETTINGS, { id: 'activeWorkoutId', value: id });
    }
}
