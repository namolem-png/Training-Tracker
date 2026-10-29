import { STORE } from '../db.js';

/**
 * Репозиторий для работы с каталогом упражнений и категориями в IndexedDB
 */
export class ExerciseRepository {
    constructor(db) {
        this.db = db;
    }

    async getAllExercises() {
        return await this.db.getAll(STORE.EXERCISES);
    }

    async getAllCategories() {
        return await this.db.getAll(STORE.CATEGORIES);
    }

    async saveExercise(exercise) {
        return await this.db.save(STORE.EXERCISES, exercise);
    }

    async deleteExercise(id) {
        return await this.db.delete(STORE.EXERCISES, id);
    }

    async saveCategory(category) {
        return await this.db.save(STORE.CATEGORIES, category);
    }

    async deleteCategory(id) {
        return await this.db.delete(STORE.CATEGORIES, id);
    }

    async getMigrationFlag() {
        const flag = await this.db.get(STORE.SETTINGS, 'isLegacyMigrated');
        return Boolean(flag?.value);
    }

    async setMigrationFlag(value = true) {
        return await this.db.save(STORE.SETTINGS, {
            id: 'isLegacyMigrated',
            value,
        });
    }
}
