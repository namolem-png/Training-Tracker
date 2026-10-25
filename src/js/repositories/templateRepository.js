import { STORE } from '../db.js';

/**
 * Репозиторий для работы с шаблонами тренировок в IndexedDB
 */
export class TemplateRepository {
    constructor(db) {
        this.db = db;
    }

    async getAll() {
        return await this.db.getAll(STORE.TEMPLATES);
    }

    async get(id) {
        if (!id) return null;
        return await this.db.get(STORE.TEMPLATES, id);
    }

    async save(template) {
        return await this.db.save(STORE.TEMPLATES, template);
    }

    async delete(id) {
        return await this.db.delete(STORE.TEMPLATES, id);
    }
}
