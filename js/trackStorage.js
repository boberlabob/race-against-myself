
export class TrackStorage {
    constructor() {
        this.db = null;
        this.DB_NAME = 'RaceAgainstMyselfDB';
        this.STORE_NAME = 'gpxTracks';
        this.DB_VERSION = 1;
    }

    async openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async saveTrack(trackName, gpxData) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const track = { name: trackName, gpxData: gpxData, savedAt: new Date() };
            const request = store.add(track);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error saving track:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getTracks() {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error getting tracks:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getTrack(id) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error getting track:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async deleteTrack(id) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error deleting track:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}
