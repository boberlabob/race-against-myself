import { AppState } from './state.js';
import { UI } from './ui.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { AudioFeedback } from './audio.js';
import { TrackStorage } from './trackStorage.js';
import { Race } from './race.js';
import { Geolocation } from './geolocation.js';
import { GPX } from './gpx.js';

const MAX_GPX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

class AppController {
    constructor(state, trackStorage, audioFeedback, ui) {
        this.ui = ui;
        this.state = state;
        this.trackStorage = trackStorage;
        this.audioFeedback = audioFeedback;
        this.race = new Race(this.state, this.trackStorage, this.audioFeedback);
        this.watchId = null;
        this.wakeLock = null;

        this.initializeEventListeners();
        this.loadInitialData();
    }

    initializeEventListeners() {
        this.ui.bindEventListeners(
            (file) => this.onFileUpload(file),
            () => this.onStartRace(),
            () => this.onStopRace(),
            () => this.onDownloadRace(),
            (mode) => this.onTransportationModeSelected(mode),
            (id) => this.loadTrack(id),
            (id) => this.deleteTrack(id),
            () => {
                // After 10 seconds, reset the finish message and stop the race
                setTimeout(() => {
                    this.state.setState({ finishMessage: null });
                    this.race.stop();
                }, 10000);
            },
            (isMuted) => this.onMuteToggle(isMuted)
        );
    }

    async loadInitialData() {
        const history = JSON.parse(localStorage.getItem('raceHistory') || '[]');
        this.state.setState({ raceHistory: history });
        await this.loadTracks();
        // Any other initial data loading
    }

    // --- Event Handlers ---

    async onFileUpload(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            this.state.setState({ statusMessage: 'Wähle bitte eine GPX-Datei aus.' });
            return;
        }
        if (file.size > MAX_GPX_FILE_SIZE) {
            this.state.setState({ statusMessage: 'Uups, die Datei ist zu groß (max. 10 MB).' });
            return;
        }
        this.state.setState({ statusMessage: 'Dein GPX-Track wird geladen...' });
        try {
            const text = await file.text();
            const gpxData = GPX.parse(text);
            if (gpxData && gpxData.length > 0) {
                this.state.setState({ gpxData: gpxData });
                const trackLength = GPX.calculateTrackLength(gpxData);
                this.state.setState({ statusMessage: `Track geladen: ${trackLength.toFixed(2)} km mit ${gpxData.length} Punkten. Bereit zum Start!` });

                const trackName = prompt("Wie möchtest du diesen Track nennen?", file.name.replace('.gpx', ''));
                if (trackName) {
                    await this.trackStorage.saveTrack(trackName, gpxData);
                    this.state.setState({ statusMessage: `Super! Dein Track "${trackName}" ist geladen und gespeichert.` });
                    this.loadTracks();
                }
            } else {
                this.state.setState({ statusMessage: 'Hoppla! Keine Trackpunkte in dieser GPX-Datei gefunden.' });
            }
        } catch (error) {
            this.state.setState({ statusMessage: 'Da gab es einen Fehler beim Laden deines GPX-Tracks: ' + error.message });
        }
    }


    onTransportationModeSelected(mode) {
        this.state.setState({ transportationMode: mode });
    }

    async onStartRace() {
        const { isRacing, gpxData } = this.state.getState();
        if (isRacing) return;
        if (!gpxData || gpxData.length === 0) {
            this.state.setState({ statusMessage: 'Lade zuerst einen GPX-Track, dann kann\'s losgehen!' });
            return;
        }
        this.state.setState({ statusMessage: 'Ich brauche kurz deine Standortberechtigung...' });
        try {
            const position = await Geolocation.getCurrentPosition();
            this.race.handleLocationUpdate(position);
            this.watchId = Geolocation.watchPosition(
                (pos) => this.race.handleLocationUpdate(pos),
                (err) => this.race.handleLocationError(err)
            );
            this.state.setState({ isRacing: true });
            await this.requestWakeLock();
        } catch (error) {
            this.state.setState({ statusMessage: 'Konnte deinen Standort nicht finden: ' + error.message });
        }
    }

    onStopRace() {
        if (!this.state.getState().isRacing) return;
        Geolocation.clearWatch(this.watchId);
        this.releaseWakeLock();
        this.race.stop();
        this.loadTracks();
    }

    onDownloadRace() {
        const { raceTrack } = this.state.getState();
        const gpxContent = GPX.generateGPXFromTrack(raceTrack);
        if (!gpxContent) {
            this.state.setState({ statusMessage: 'Keine Renndaten zum Speichern gefunden.' });
            return;
        }
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `race-${new Date().toISOString().split('T')[0]}.gpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async loadTracks() {
        try {
            const tracks = await this.trackStorage.getTracks();
            this.state.setState({ savedTracks: tracks });
        } catch (error) {
            console.error('Huch, da gab\'s ein Problem beim Laden deiner Tracks:', error);
            this.state.setState({ statusMessage: 'Konnte deine gespeicherten Tracks nicht laden.' });
        }
    }

    async loadTrack(id) {
        try {
            const track = await this.trackStorage.getTrack(id);
            if (track) {
                this.state.setState({ gpxData: track.gpxData });
                const trackLength = GPX.calculateTrackLength(track.gpxData);
                this.state.setState({ statusMessage: `Track "${track.name}" geladen: ${trackLength.toFixed(2)} km mit ${track.gpxData.length} Punkten.` });
            } else {
                this.state.setState({ statusMessage: 'Diesen Track konnte ich leider nicht finden.' });
            }
        } catch (error) {
            console.error('Fehler beim Laden des Tracks:', error);
            this.state.setState({ statusMessage: 'Fehler beim Laden dieses Tracks.' });
        }
    }

    async deleteTrack(id) {
        if (confirm('Soll ich diesen Track wirklich für immer löschen?')) {
            try {
                await this.trackStorage.deleteTrack(id);
                this.state.setState({ statusMessage: 'Track erfolgreich gelöscht!' });
                this.loadTracks();
            } catch (error) {
                console.error('Uups, Fehler beim Löschen des Tracks:', error);
                this.state.setState({ statusMessage: 'Fehler beim Löschen des Tracks.' });
            }
        }
    }

    onMuteToggle(isMuted) {
        this.audioFeedback.setMuted(isMuted);
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Konnte den Bildschirm-Wake-Lock nicht aktivieren:', err.message);
        }
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
            } catch (err) {
                console.error('Konnte den Bildschirm-Wake-Lock nicht freigeben:', err.message);
            }
        }
    }
}

// Register Service Worker for offline functionality
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully:', registration);
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                console.log('Service Worker update found');
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Register Service Worker first for offline functionality
    await registerServiceWorker();

    // 1. Initialize State
    const appState = new AppState();

    // 2. Initialize Services
    const trackStorage = new TrackStorage();
    const audioFeedback = new AudioFeedback();

    // 3. Initialize Views
    const ui = new UI();
    ui.initializeElements(); // Call this after UI is instantiated
    const mapView = new MapView();
    const elevationView = new ElevationView();

    mapView.init(); // Initialize map here

    // 4. Initialize Controller
    const controller = new AppController(appState, trackStorage, audioFeedback, ui);

    // 5. Connect Views to State (subscribe to updates)
    appState.subscribe((state) => {
        ui.render(state);
        mapView.render(state);
        elevationView.render(state);
    });

    // Initial render
    ui.render(appState.getState());
    mapView.render(appState.getState());
    elevationView.render(appState.getState());
});
