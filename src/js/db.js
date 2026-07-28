export const STORE = {
    WORKOUTS: 'workouts',
    EXERCISES: 'exercises',
    CATEGORIES: 'categories',
    TEMPLATES: 'templates',
    SETTINGS: 'settings'
};

export class GymDatabase {
    constructor() {
        this.dbName = 'GymAppDB';
        this.dbVersion = 2; // Версия повышена для создания индекса
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new Error('IndexedDB не поддерживается в данном браузере'));
            }

            const openDatabase = (version) => {
                let request;
                try {
                    request = version ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);
                } catch (e) {
                    console.error('Исключение при вызове indexedDB.open:', e);
                    return reject(e);
                }

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const tx = event.target.transaction;
                    
                    let workoutStore;
                    if (!db.objectStoreNames.contains(STORE.WORKOUTS)) {
                        workoutStore = db.createObjectStore(STORE.WORKOUTS, { keyPath: 'id' });
                    } else {
                        workoutStore = tx.objectStore(STORE.WORKOUTS);
                    }
                    
                    // Создаем индекс для выборки по дате
                    if (!workoutStore.indexNames.contains('date')) {
                        workoutStore.createIndex('date', 'date', { unique: false });
                    }

                    if (!db.objectStoreNames.contains(STORE.EXERCISES)) db.createObjectStore(STORE.EXERCISES, { keyPath: 'id' });
                    if (!db.objectStoreNames.contains(STORE.CATEGORIES)) db.createObjectStore(STORE.CATEGORIES, { keyPath: 'id' });
                    if (!db.objectStoreNames.contains(STORE.TEMPLATES)) db.createObjectStore(STORE.TEMPLATES, { keyPath: 'id' });
                    if (!db.objectStoreNames.contains(STORE.SETTINGS)) db.createObjectStore(STORE.SETTINGS, { keyPath: 'id' });
                };

                request.onsuccess = async (event) => {
                    this.db = event.target.result;
                    this.db.onversionchange = () => {
                        if (this.db) this.db.close();
                    };
                    try {
                        await this.handleMigration();
                    } catch (e) {
                        console.error('Ошибка миграции:', e);
                    }
                    resolve();
                };

                request.onblocked = () => {
                    console.warn('Инициализация IndexedDB заблокирована другой открытой вкладкой.');
                };

                request.onerror = (event) => {
                    const err = request.error || (event.target && event.target.error);
                    if (version && err && err.name === 'VersionError') {
                        console.warn('Существующая версия IndexedDB выше запрошенной. Повторная попытка без указания версии.');
                        openDatabase(null);
                        return;
                    }
                    console.error('Ошибка инициализации IndexedDB:', err);
                    reject(err || new Error('Ошибка инициализации IndexedDB'));
                };
            };

            openDatabase(this.dbVersion);
        });
    }

    async handleMigration() {
        const oldDataRaw = localStorage.getItem('gymAppV2');
        const migrated = localStorage.getItem('migratedToIDB');

        if (oldDataRaw && !migrated) {
            try {
                const data = JSON.parse(oldDataRaw);
                if (data.workouts) for (const w of data.workouts) await this.save(STORE.WORKOUTS, w);
                if (data.exercises) for (const e of data.exercises) await this.save(STORE.EXERCISES, e);
                if (data.categories) for (const c of data.categories) await this.save(STORE.CATEGORIES, c);
                if (data.templates) for (const t of data.templates) await this.save(STORE.TEMPLATES, t);
                if (data.activeWorkoutId) await this.save(STORE.SETTINGS, { id: 'activeWorkoutId', value: data.activeWorkoutId });
                
                localStorage.setItem('migratedToIDB', 'true');
            } catch (e) {
                console.error('Ошибка миграции:', e);
            }
        }
    }

    get(storeName, id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const request = transaction.objectStore(storeName).get(id);
            request.onsuccess = () => resolve(request.result);
        });
    }

    getAll(storeName) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
        });
    }

    getByPage(storeName, indexName, limit, offset, direction = 'prev') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            
            let request;
            if (indexName && store.indexNames.contains(indexName)) {
                request = store.index(indexName).openCursor(null, direction);
            } else {
                request = store.openCursor(null, direction);
            }

            const results = [];
            let advanced = false;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve(results);
                    return;
                }
                if (offset > 0 && !advanced) {
                    advanced = true;
                    cursor.advance(offset);
                    return;
                }
                results.push(cursor.value);
                if (results.length < limit) cursor.continue();
                else resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Получает записи в заданном диапазоне индекса.
     * @param {string} storeName Название хранилища.
     * @param {string} indexName Название индекса (например, 'date').
     * @param {any} lower Нижняя граница.
     * @param {any} upper Верхняя граница.
     * @param {string} direction Направление ('next', 'prev').
     * @returns {Promise<Array>}
     */
    getInRange(storeName, indexName, lower, upper, direction = 'next') {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const range = IDBKeyRange.bound(lower, upper);
            const results = [];
            const request = index.openCursor(range, direction);

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Находит ID соседней записи относительно текущей.
     */
    getAdjacentId(storeName, indexName, currentId, currentValue, direction) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            
            const cursorDir = direction === -1 ? 'prev' : 'next';
            const range = direction === -1 
                ? IDBKeyRange.upperBound(currentValue) 
                : IDBKeyRange.lowerBound(currentValue);
            
            const request = index.openCursor(range, cursorDir);
            let passedCurrent = false;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return resolve(null);

                if (cursor.value.id === currentId) {
                    passedCurrent = true;
                    cursor.continue();
                    return;
                }

                if (passedCurrent) resolve(cursor.value.id);
                else cursor.continue();
            };
            request.onerror = () => resolve(null);
        });
    }

    save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const request = transaction.objectStore(storeName).put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject();
        });
    }

    delete(storeName, id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const request = transaction.objectStore(storeName).delete(id);
            request.onsuccess = () => resolve();
        });
    }

    clear(storeName) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            transaction.objectStore(storeName).clear().onsuccess = () => resolve();
        });
    }
}
