
export class TrackStorage {
    static DB_NAME = 'RaceAgainstMyselfDB';
    static STORE_NAME = 'gpxTracks';
    static DB_VERSION = 1;
    static LOCALSTORAGE_KEY = 'raceAgainstMyself_tracks';

    constructor() {
        this.db = null;
        this.useIndexedDB = 'indexedDB' in window;
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
        if (!this.useIndexedDB) {
            return this.saveTrackLocalStorage(trackName, gpxData);
        }
        
        try {
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
        } catch (error) {
            console.warn('IndexedDB failed, fallback to localStorage:', error);
            return this.saveTrackLocalStorage(trackName, gpxData);
        }
    }

    async getTracks() {
        if (!this.useIndexedDB) {
            return this.getTracksLocalStorage();
        }

        try {
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
        } catch (error) {
            console.warn('IndexedDB failed, fallback to localStorage:', error);
            return this.getTracksLocalStorage();
        }
    }

    async getTrack(id) {
        if (!this.useIndexedDB) {
            return this.getTrackLocalStorage(id);
        }

        try {
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
        } catch (error) {
            console.warn('IndexedDB failed, fallback to localStorage:', error);
            return this.getTrackLocalStorage(id);
        }
    }

    async deleteTrack(id) {
        if (!this.useIndexedDB) {
            return this.deleteTrackLocalStorage(id);
        }

        try {
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
        } catch (error) {
            console.warn('IndexedDB failed, fallback to localStorage:', error);
            return this.deleteTrackLocalStorage(id);
        }
    }

    // LocalStorage fallback methods
    saveTrackLocalStorage(trackName, gpxData) {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            const newTrack = {
                id: Date.now(),
                name: trackName,
                gpxData: gpxData,
                savedAt: new Date()
            };
            tracks.push(newTrack);
            localStorage.setItem(TrackStorage.LOCALSTORAGE_KEY, JSON.stringify(tracks));
            return Promise.resolve(newTrack.id);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    getTracksLocalStorage() {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            return Promise.resolve(tracks);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    getTrackLocalStorage(id) {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            const track = tracks.find(t => t.id === id);
            return Promise.resolve(track);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    deleteTrackLocalStorage(id) {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            const filteredTracks = tracks.filter(t => t.id !== id);
            localStorage.setItem(TrackStorage.LOCALSTORAGE_KEY, JSON.stringify(filteredTracks));
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
