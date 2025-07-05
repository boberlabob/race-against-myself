
export class TrackStorage {
    static DB_NAME = 'RaceAgainstMyselfDB';
    static STORE_NAME = 'gpxTracks';
    static DB_VERSION = 1;

    constructor() {
        this.db = null;
    }

    async openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(TrackStorage.DB_NAME, TrackStorage.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(TrackStorage.STORE_NAME)) {
                    db.createObjectStore(TrackStorage.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB-Fehler:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async saveTrack(trackName, gpxData) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(TrackStorage.STORE_NAME);
            const track = { name: trackName, gpxData: gpxData, savedAt: new Date() };
            const request = store.add(track);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Speichern des Tracks:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getTracks() {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readonly');
            const store = transaction.objectStore(TrackStorage.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Abrufen der Tracks:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getTrack(id) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readonly');
            const store = transaction.objectStore(TrackStorage.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Abrufen des Tracks:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async deleteTrack(id) {
        if (!this.db) await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(TrackStorage.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Fehler beim Löschen des Tracks:', event.target.error);
                reject(event.target.error);
            };
        });
    }
}
