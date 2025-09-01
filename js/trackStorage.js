
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

    async saveTrack(trackName, gpxData, transportationMode = 'cycling') {
        if (!this.useIndexedDB) {
            return this.saveTrackLocalStorage(trackName, gpxData, transportationMode);
        }
        
        try {
            if (!this.db) await this.openDb();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(TrackStorage.STORE_NAME);
                const track = { 
                    name: trackName, 
                    gpxData: gpxData,
                    transportationMode: transportationMode,
                    savedAt: new Date(),
                    lastUsed: null,
                    trackLength: this.calculateTrackLength(gpxData),
                    createdAt: new Date()
                };
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
                const tracks = [];
                
                // Use cursor to get both key and value
                const request = store.openCursor();
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        // Add the IndexedDB key as the id property
                        tracks.push({
                            ...cursor.value,
                            id: cursor.key
                        });
                        cursor.continue();
                    } else {
                        // Done iterating
                        resolve(tracks);
                    }
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
    saveTrackLocalStorage(trackName, gpxData, transportationMode = 'cycling') {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            const newTrack = {
                id: Date.now(),
                name: trackName,
                gpxData: gpxData,
                transportationMode: transportationMode,
                savedAt: new Date(),
                lastUsed: null,
                trackLength: this.calculateTrackLength(gpxData),
                createdAt: new Date()
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
            const track = tracks.find(t => t.id === id || t.id === parseInt(id) || t.id === String(id));
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

    // --- New Methods for Track Metadata ---

    async updateTrackUsage(trackId) {
        const now = new Date();
        
        if (!this.useIndexedDB) {
            return this.updateTrackUsageLocalStorage(trackId, now);
        }
        
        try {
            if (!this.db) await this.openDb();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([TrackStorage.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(TrackStorage.STORE_NAME);
                const getRequest = store.get(trackId);
                
                getRequest.onsuccess = () => {
                    const track = getRequest.result;
                    if (track) {
                        track.lastUsed = now;
                        const updateRequest = store.put(track);
                        updateRequest.onsuccess = () => resolve(track);
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        reject(new Error('Track not found'));
                    }
                };
                
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            console.error('Fehler beim Update der Track-Nutzung:', error);
            throw error;
        }
    }

    updateTrackUsageLocalStorage(trackId, lastUsed) {
        try {
            const tracks = JSON.parse(localStorage.getItem(TrackStorage.LOCALSTORAGE_KEY) || '[]');
            const trackIndex = tracks.findIndex(t => t.id === trackId);
            
            if (trackIndex !== -1) {
                tracks[trackIndex].lastUsed = lastUsed;
                localStorage.setItem(TrackStorage.LOCALSTORAGE_KEY, JSON.stringify(tracks));
                return Promise.resolve(tracks[trackIndex]);
            } else {
                return Promise.reject(new Error('Track not found'));
            }
        } catch (error) {
            console.error('Fehler beim Update der Track-Nutzung in localStorage:', error);
            return Promise.reject(error);
        }
    }

    calculateTrackLength(gpxData) {
        if (!gpxData || gpxData.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < gpxData.length; i++) {
            const prev = gpxData[i - 1];
            const curr = gpxData[i];
            totalDistance += this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        }
        
        return totalDistance / 1000; // Convert to km
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
}
