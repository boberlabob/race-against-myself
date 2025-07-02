import { AppState } from './state.js';
import { UI } from './ui.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { AudioFeedback } from './audio.js';
import { TrackStorage } from './trackStorage.js';
import { Race } from './race.js';
import { Geolocation } from './geolocation.js';
import { GPX } from './gpx.js';

class AppController {
    constructor(state, trackStorage, audioFeedback) {
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
        // Event listeners will now call methods on this controller
        // The UI class will be responsible for attaching the event listeners
    }

    async loadInitialData() {
        const history = JSON.parse(localStorage.getItem('raceHistory') || '[]');
        this.state.setState({ raceHistory: history });
        await this.loadTracks();
        // Any other initial data loading
    }

    // --- Event Handlers ---

    async onFileUpload(file, isReverseModeChecked) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            this.state.setState({ statusMessage: 'Please select a GPX file' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.state.setState({ statusMessage: 'File too large (max 10MB)' });
            return;
        }
        this.state.setState({ statusMessage: 'Loading GPX file...' });
        try {
            const text = await file.text();
            const gpxData = GPX.parse(text);
            if (gpxData && gpxData.length > 0) {
                this.state.setState({ originalGpxData: gpxData });
                // Apply reverse mode based on current UI setting
                this.onReverseToggle(isReverseModeChecked);
                const trackLength = GPX.calculateTrackLength(this.state.getState().gpxData);
                const direction = isReverseModeChecked ? ' (reverse)' : '';
                this.state.setState({ statusMessage: `GPX loaded: ${trackLength.toFixed(2)} km (${gpxData.length} points)${direction}` });

                const trackName = prompt("Enter a name for this track:", file.name.replace('.gpx', ''));
                if (trackName) {
                    await this.trackStorage.saveTrack(trackName, gpxData);
                    this.state.setState({ statusMessage: `GPX loaded and saved as "${trackName}"` });
                    this.loadTracks();
                }
            } else {
                this.state.setState({ statusMessage: 'Error: No track points found in GPX file' });
            }
        } catch (error) {
            this.state.setState({ statusMessage: 'Error parsing GPX file: ' + error.message });
        }
    }

    onReverseToggle(isReverse) {
        const { originalGpxData } = this.state.getState();
        if (originalGpxData) {
            const gpxData = isReverse ? [...originalGpxData].reverse().map((p, i) => ({ ...p, index: i, time: null })) : [...originalGpxData];
            this.state.setState({ gpxData });
            const trackLength = GPX.calculateTrackLength(gpxData);
            const direction = isReverse ? ' (reverse)' : '';
            this.state.setState({ statusMessage: `GPX loaded: ${trackLength.toFixed(2)} km (${gpxData.length} points)${direction}` });
        }
    }

    onTransportationModeSelected(mode) {
        this.state.setState({ transportationMode: mode });
    }

    async onStartRace() {
        const { isRacing, gpxData } = this.state.getState();
        if (isRacing) return;
        if (!gpxData || gpxData.length === 0) {
            this.state.setState({ statusMessage: 'Please load a GPX file first' });
            return;
        }
        this.state.setState({ statusMessage: 'Requesting location permission...' });
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
            this.state.setState({ statusMessage: 'Error getting location: ' + error.message });
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
            alert('No race data to download');
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
            console.error('Error loading tracks:', error);
            this.state.setState({ statusMessage: 'Error loading saved tracks.' });
        }
    }

    async loadTrack(id) {
        try {
            const track = await this.trackStorage.getTrack(id);
            if (track) {
                this.state.setState({ originalGpxData: track.gpxData });
                // Apply reverse mode based on current UI setting
                this.onReverseToggle(this.ui.elements.reverseMode.checked);
                const trackLength = GPX.calculateTrackLength(this.state.getState().gpxData);
                const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
                this.state.setState({ statusMessage: `Loaded track "${track.name}": ${trackLength.toFixed(2)} km (${this.state.getState().gpxData.length} points)${direction}` });
            } else {
                this.state.setState({ statusMessage: 'Track not found.' });
            }
        } catch (error) {
            console.error('Error loading track:', error);
            this.state.setState({ statusMessage: 'Error loading track.' });
        }
    }

    async deleteTrack(id) {
        if (confirm('Are you sure you want to delete this track?')) {
            try {
                await this.trackStorage.deleteTrack(id);
                this.state.setState({ statusMessage: 'Track deleted.' });
                this.loadTracks();
            } catch (error) {
                console.error('Error deleting track:', error);
                this.state.setState({ statusMessage: 'Error deleting track.' });
            }
        }
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Failed to activate screen wake lock:', err.message);
        }
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
            } catch (err) {
                console.error('Failed to release screen wake lock:', err.message);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
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

    // 4. Initialize Controller
    const controller = new AppController(appState, trackStorage, audioFeedback);

    // 5. Connect Views to State (subscribe to updates)
    appState.subscribe((state) => {
        ui.render(state);
        mapView.render(state);
        elevationView.render(state);
    });

    // 6. Connect UI events to the controller
    ui.bindEventListeners(
        (file) => controller.onFileUpload(file, ui.elements.reverseMode.checked),
        () => controller.onStartRace(),
        () => controller.onStopRace(),
        () => controller.onDownloadRace(),
        (isReverse) => controller.onReverseToggle(isReverse),
        (mode) => controller.onTransportationModeSelected(mode),
        (id) => controller.loadTrack(id),
        (id) => controller.deleteTrack(id),
        () => {
            // After 10 seconds, reset the finish message and stop the race
            setTimeout(() => {
                appState.setState({ finishMessage: null });
                controller.race.stop();
            }, 10000);
        }
    );

    // Initial render
    ui.render(appState.getState());
    mapView.render(appState.getState());
    elevationView.render(appState.getState());
});