import { AppState } from './state.js';
import { UI } from './ui.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { AudioFeedback } from './audio.js';
import { TrackStorage } from './trackStorage.js';
import { TrackProcessor } from './trackProcessor.js';
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
        this.gpsWarmupId = null;
        this.currentPosition = null;
        this.gpsAccuracy = null;

        this.initializeEventListeners();
        this.loadInitialData();
        this.startGPSWarmup(); // Start GPS immediately for calibration
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

    // --- GPS Warm-up & Calibration ---

    startGPSWarmup() {
        // Update GPS status in footer instead of main status
        this.ui.updateGpsStatus('GPS wird kalibriert für bessere Genauigkeit...', 'loading');
        
        // Start watching position immediately for warm-up
        this.gpsWarmupId = Geolocation.watchPosition(
            (position) => this.handleGPSWarmupUpdate(position),
            (error) => this.handleGPSWarmupError(error)
        );
    }

    handleGPSWarmupUpdate(position) {
        this.currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
        };
        
        this.gpsAccuracy = position.coords.accuracy;
        
        // Update GPS status in UI
        let accuracyStatus = '';
        let gpsStatusType = 'available';
        if (this.gpsAccuracy <= 5) {
            accuracyStatus = '🎯 GPS sehr genau';
        } else if (this.gpsAccuracy <= 10) {
            accuracyStatus = '✅ GPS gut';
        } else if (this.gpsAccuracy <= 20) {
            accuracyStatus = '⚠️ GPS mäßig';
        } else {
            accuracyStatus = '❌ GPS ungenau';
        }
        
        // Update GPS status in footer instead of main status
        this.ui.updateGpsStatus(`${accuracyStatus} (±${Math.round(this.gpsAccuracy)}m)`, gpsStatusType);
        
        // Update unified tracks with new position
        this.updateUnifiedTracks();
        
        this.state.setState({ 
            userPosition: this.currentPosition,
            gpsAccuracy: this.gpsAccuracy,
            gpsStatus: gpsStatusType
        });
    }

    handleGPSWarmupError(error) {
        let message = '';
        let gpsStatusType = 'denied';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = '🚫 Standortzugriff verweigert';
                gpsStatusType = 'denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '❌ Standort nicht verfügbar';
                gpsStatusType = 'denied';
                break;
            case error.TIMEOUT:
                message = '⏱️ GPS Timeout - Versuche es nochmal';
                gpsStatusType = 'loading';
                break;
            default:
                message = '❌ GPS-Fehler';
                gpsStatusType = 'denied';
                break;
        }
        
        this.ui.updateGpsStatus(message, gpsStatusType);
        this.state.setState({ gpsStatus: gpsStatusType });
    }

    stopGPSWarmup() {
        if (this.gpsWarmupId) {
            Geolocation.clearWatch(this.gpsWarmupId);
            this.gpsWarmupId = null;
        }
    }

    // --- Unified Track Processing ---

    async updateUnifiedTracks() {
        const savedTracks = this.state.getState().savedTracks || [];
        console.log('Updating unified tracks with saved tracks:', savedTracks);
        
        try {
            // Process tracks with smart sorting and proximity data
            const unifiedTracks = TrackProcessor.processTracksForDisplay(
                savedTracks,
                this.currentPosition,
                this.gpsAccuracy
            );
            
            console.log('Processed unified tracks:', unifiedTracks);
            
            // Get nearby tracks summary
            const summary = TrackProcessor.getNearbyTracksSummary(unifiedTracks);
            
            this.state.setState({ 
                unifiedTracks,
                nearbyTracksCount: summary.total
            });
        } catch (error) {
            console.error('Error processing unified tracks:', error);
            // Fallback: use saved tracks directly
            this.state.setState({ 
                unifiedTracks: savedTracks,
                nearbyTracksCount: 0
            });
        }
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

    // Get currently selected transportation mode from UI
    getSelectedTransportationMode() {
        const walkingBtn = document.getElementById('walkingMode');
        const cyclingBtn = document.getElementById('cyclingMode');
        const carBtn = document.getElementById('carMode');
        
        if (walkingBtn && walkingBtn.classList.contains('active')) return 'walking';
        if (cyclingBtn && cyclingBtn.classList.contains('active')) return 'cycling';
        if (carBtn && carBtn.classList.contains('active')) return 'car';
        
        return 'cycling'; // Default fallback
    }

    // Update UI transportation mode buttons to reflect track's mode
    updateTransportationModeUI(mode) {
        const walkingBtn = document.getElementById('walkingMode');
        const cyclingBtn = document.getElementById('cyclingMode');
        const carBtn = document.getElementById('carMode');
        
        // Remove active class from all buttons
        if (walkingBtn) walkingBtn.classList.remove('active');
        if (cyclingBtn) cyclingBtn.classList.remove('active');
        if (carBtn) carBtn.classList.remove('active');
        
        // Add active class to the selected mode
        switch (mode) {
            case 'walking':
                if (walkingBtn) walkingBtn.classList.add('active');
                break;
            case 'car':
                if (carBtn) carBtn.classList.add('active');
                break;
            case 'cycling':
            default:
                if (cyclingBtn) cyclingBtn.classList.add('active');
                break;
        }
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
                    // Get currently selected transportation mode
                    const selectedMode = this.getSelectedTransportationMode();
                    await this.trackStorage.saveTrack(trackName, gpxData, selectedMode);
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
        
        // Stop GPS warmup and use high-precision tracking for race
        this.stopGPSWarmup();
        
        this.state.setState({ statusMessage: 'Rennen startet - GPS-Tracking aktiviert!' });
        try {
            // Use current position if available from warmup, otherwise get fresh position
            let position;
            if (this.currentPosition && this.gpsAccuracy <= 10) {
                // Use warmed-up position if accurate enough
                position = {
                    coords: {
                        latitude: this.currentPosition.lat,
                        longitude: this.currentPosition.lon,
                        accuracy: this.gpsAccuracy
                    }
                };
            } else {
                position = await Geolocation.getCurrentPosition();
            }
            
            this.race.handleLocationUpdate(position);
            this.watchId = Geolocation.watchPosition(
                (pos) => this.race.handleLocationUpdate(pos),
                (err) => this.race.handleLocationError(err)
            );
            this.state.setState({ isRacing: true });
            await this.requestWakeLock();
        } catch (error) {
            this.state.setState({ statusMessage: 'Konnte deinen Standort nicht finden: ' + error.message });
            // Restart warmup on error
            this.startGPSWarmup();
        }
    }

    onStopRace() {
        if (!this.state.getState().isRacing) return;
        Geolocation.clearWatch(this.watchId);
        this.releaseWakeLock();
        this.race.stop();
        this.loadTracks();
        // Restart GPS warmup after race
        this.startGPSWarmup();
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
            // Update unified tracks after loading
            this.updateUnifiedTracks();
        } catch (error) {
            console.error('Huch, da gab\'s ein Problem beim Laden deiner Tracks:', error);
            this.state.setState({ statusMessage: 'Konnte deine gespeicherten Tracks nicht laden.' });
        }
    }

    async loadTrack(id) {
        try {
            const track = await this.trackStorage.getTrack(id);
            if (track) {
                // Update track usage
                await TrackProcessor.updateTrackUsage(id, this.trackStorage);
                
                this.state.setState({ 
                    gpxData: track.gpxData,
                    transportationMode: track.transportationMode || 'cycling'
                });
                
                // Update UI mode buttons to reflect the track's transportation mode
                this.updateTransportationModeUI(track.transportationMode || 'cycling');
                
                const trackLength = track.trackLength || GPX.calculateTrackLength(track.gpxData);
                this.state.setState({ statusMessage: `Track "${track.name}" geladen: ${trackLength.toFixed(2)} km mit ${track.gpxData.length} Punkten.` });
                
                // Reload tracks to update the unified list with new usage data
                this.loadTracks();
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
