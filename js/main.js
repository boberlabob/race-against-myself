
import { UI } from './ui.js';
import { Race } from './race.js';
import { Geolocation } from './geolocation.js';
import { GPX } from './gpx.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { AudioFeedback } from './audio.js';
import { TrackStorage } from './trackStorage.js';

class App {
    constructor() {
        this.ui = new UI();
        this.mapView = new MapView();
        this.elevationView = new ElevationView();
        this.audioFeedback = new AudioFeedback();
        this.trackStorage = new TrackStorage();
        this.race = new Race(this.ui, this.mapView, this.elevationView, this.trackStorage);
        this.watchId = null;
        this.wakeLock = null;
        this.lastMotivationUpdateTime = 0;
        this.motivationUpdateInterval = 15000; // 15 seconds
        this.lastDistanceAnnounceTime = 0;
        this.distanceAnnounceInterval = 5000; // Announce distance every 5 seconds

        this.initializeEventListeners();
        this.ui.updateRaceHistory(this.race.getRaceHistory());
        this.ui.onRaceSelect = (race) => this.ui.showRaceDetails(race);
        this.loadTracks(); // Load saved tracks on app initialization
    }

    initializeEventListeners() {
        this.ui.elements.gpxFile.addEventListener('change', async (e) => {
            await this.race.handleFileUpload(e);
            this.loadTracks(); // Refresh track list after file upload
        });
        this.ui.elements.startRace.addEventListener('click', () => this.startRace());
        this.ui.elements.stopRace.addEventListener('click', () => this.stopRace());
        this.ui.elements.downloadRace.addEventListener('click', () => this.downloadRaceTrack());
        this.ui.elements.reverseMode.addEventListener('change', () => this.race.handleReverseToggle());
        this.ui.elements.walkingMode.addEventListener('click', () => this.race.selectTransportationMode('walking'));
        this.ui.elements.cyclingMode.addEventListener('click', () => this.race.selectTransportationMode('cycling'));
        this.ui.elements.carMode.addEventListener('click', () => this.race.selectTransportationMode('car'));
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && this.race.isRacing) {
                await this.requestWakeLock();
            }
        });
    }

    async startRace() {
        if (this.race.state.isRacing) return;
        if (!this.race.state.gpxData || this.race.state.gpxData.length === 0) {
            this.ui.updateStatus('Please load a GPX file first');
            return;
        }
        this.ui.updateStatus('Requesting location permission...');
        try {
            const position = await Geolocation.getCurrentPosition();
            this.handleLocationUpdate(position);
            this.watchId = Geolocation.watchPosition(
                (pos) => this.handleLocationUpdate(pos),
                (err) => this.handleLocationError(err)
            );
            this.race.isRacing = true;
            this.ui.elements.startRace.style.display = 'none';
            this.ui.elements.stopRace.style.display = 'block';
            this.ui.elements.downloadRace.style.display = 'none';
            this.ui.elements.racingDisplay.style.display = 'block';
            this.ui.elements.uploadSection.style.display = 'none';
            this.ui.elements.raceHistoryContainer.style.display = 'none';
            this.mapView.show(); // Show map when race starts
            this.elevationView.show(); // Show elevation profile when race starts
            await this.requestWakeLock();
        } catch (error) {
            this.ui.updateStatus('Error getting location: ' + error.message);
        }
    }

    handleLocationUpdate(position) {
        const currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date()
        };

        this.mapView.updateUserPosition(currentPosition.lat, currentPosition.lon, position.coords.heading || 0); // Always update user position on map

        if (this.ui.elements.status.innerHTML === 'Requesting location permission...') {
            this.ui.elements.status.style.display = 'none';
        }

        if (!this.race.state.raceStarted) {
            this.race.state.preRacePositions.push({
                lat: currentPosition.lat,
                lon: currentPosition.lon,
                timestamp: currentPosition.timestamp
            });
            if (this.race.state.preRacePositions.length > 5) {
                this.race.state.preRacePositions.shift();
            }
        }

        const nearest = this.race.state.raceStarted ? 
            this.race.findNearestPoint(currentPosition.lat, currentPosition.lon) :
            this.race.findOptimalStartPoint(currentPosition.lat, currentPosition.lon);

        if (!nearest) {
            this.ui.elements.raceStatus.textContent = 'No track data available';
            return;
        }

        // Distance to track is only relevant before race starts
        if (!this.race.state.raceStarted && nearest.distance > 10) {
            this.ui.elements.raceStatus.textContent = 
                `Too far from track (${Math.round(nearest.distance)}m). Move closer to start.`;
            
            const currentTime = new Date().getTime();
            if (currentTime - this.lastDistanceAnnounceTime > this.distanceAnnounceInterval) {
                this.audioFeedback.speak(`${Math.round(nearest.distance)} meters away from the start.`);
                this.lastDistanceAnnounceTime = currentTime;
            }
            return;
        }

        if (!this.race.state.raceStarted) {
            this.race.state.raceStartTime = new Date();
            this.race.state.raceStarted = true;
            this.race.state.nearestPoint = nearest;
            this.race.state.raceTrack = [];
            this.race.state.previousPosition = null;
            this.race.state.maxProgressIndex = nearest.index;
            this.race.state.preRacePositions = [];
            this.race.state.finishDetected = false;
            this.race.state.finishDetectionTime = null;
            this.race.state.finishBufferPositions = [];
            this.race.state.speedMeasurements = [];
            this.ui.updateModeDisplay(this.race.state.transportationMode);
            this.ui.elements.raceStatus.textContent = 'Race started!';
        }

        if (this.race.state.raceStarted) {
            this.race.state.raceTrack.push({
                lat: currentPosition.lat,
                lon: currentPosition.lon,
                timestamp: currentPosition.timestamp
            });
            this.race.state.maxProgressIndex = Math.max(this.race.state.maxProgressIndex, nearest.index);
            if (this.race.state.maxProgressIndex >= this.race.state.gpxData.length - 1) {
                if (!this.race.state.finishDetected) {
                    this.race.state.finishDetected = true;
                    this.race.state.finishDetectionTime = new Date();
                    this.race.state.finishBufferPositions = [];
                    this.ui.elements.raceStatus.textContent = 'Finishing...';
                }
                this.race.state.finishBufferPositions.push({
                    lat: currentPosition.lat,
                    lon: currentPosition.lon,
                    timestamp: currentPosition.timestamp
                });
                const elapsed = (new Date() - this.race.state.finishDetectionTime) / 1000;
                if (elapsed >= 2.0) {
                    this.finishRaceWithBuffer();
                    return;
                }
            }
        }

        this.updateRaceDisplay(nearest, currentPosition);
        this.mapView.updateUserPosition(currentPosition.lat, currentPosition.lon, position.coords.heading || 0); // Update user position on map
        // Update ghost position on map (assuming ghost position is nearest point on track)
        if (nearest) {
            this.mapView.updateGhostPosition(nearest.lat, nearest.lon);
            this.elevationView.updatePositions(this.race.state.maxProgressIndex, nearest.index, this.race.state.gpxData); // Update elevation profile
        }
    }

    updateRaceDisplay(nearest, currentPosition) {
        const elapsedTime = (new Date() - this.race.state.raceStartTime) / 1000;
        const ghostIndex = this.race.getGhostIndexByTime(elapsedTime);
        const ghostPoint = this.race.state.gpxData[ghostIndex];

        let referenceTime = 0;
        if (ghostPoint.time && this.race.state.gpxData[0].time) {
            referenceTime = (ghostPoint.time - this.race.state.gpxData[0].time) / 1000;
        }

        const timeDifference = elapsedTime - referenceTime;

        const userDistanceAlongTrack = this.race.getDistanceAlongTrack(this.race.state.maxProgressIndex);
        const ghostDistanceAlongTrack = this.race.getDistanceAlongTrack(ghostIndex);
        const distanceDifference = userDistanceAlongTrack - ghostDistanceAlongTrack;

        let currentSpeed = 0;
        if (this.race.state.previousPosition) {
            const distance = GPX.calculateDistance(
                this.race.state.previousPosition.lat, this.race.state.previousPosition.lon,
                currentPosition.lat, currentPosition.lon
            );
            const timeDiff = (currentPosition.timestamp - this.race.state.previousPosition.timestamp) / 1000;
            if (timeDiff > 0.001) {
                currentSpeed = (distance / timeDiff) * 3.6;
                const speedLimit = this.race.getCurrentSpeedLimit();
                if (currentSpeed <= speedLimit) {
                    this.race.addSpeedMeasurement(currentSpeed);
                }
            }
        }
        const smoothedSpeed = this.race.getSmoothedSpeed();
        this.race.state.previousPosition = {
            lat: currentPosition.lat,
            lon: currentPosition.lon,
            timestamp: currentPosition.timestamp
        };

        let motivationMessage = this.ui.elements.raceStatus.textContent; // Keep current message by default
        const currentTime = new Date().getTime();

        if (currentTime - this.lastMotivationUpdateTime > this.motivationUpdateInterval) {
            motivationMessage = this.race.getMotivationMessage(timeDifference < 0);
            this.lastMotivationUpdateTime = currentTime;
        }

        this.ui.updateRaceDisplay({
            timeDifference,
            distanceDifference,
            smoothedSpeed,
            motivation: motivationMessage
        });

        this.mapView.updateGhostPosition(ghostPoint.lat, ghostPoint.lon);
        this.elevationView.updatePositions(this.race.state.maxProgressIndex, ghostIndex, this.race.state.gpxData);
    }

    stopRace() {
        if (!this.race.state.isRacing) return;

        Geolocation.clearWatch(this.watchId);
        this.releaseWakeLock();

        this.race.state.isRacing = false;
        this.race.state.raceStarted = false;
        this.race.state.finishDetected = false;
        this.race.state.finishDetectionTime = null;
        this.race.state.finishBufferPositions = [];
        this.race.state.preRacePositions = [];
        this.race.state.speedMeasurements = [];
        this.race.state.raceTrack = [];
        this.race.state.previousPosition = null;
        this.race.state.nearestPoint = null;
        this.race.state.maxProgressIndex = -1;

        this.ui.elements.racingDisplay.style.display = 'none';
        this.mapView.hide();
        this.elevationView.hide();

        this.ui.elements.startRace.style.display = 'block';
        this.ui.elements.stopRace.style.display = 'none';
        this.ui.elements.downloadRace.style.display = 'none';
        this.ui.elements.uploadSection.style.display = 'block';
        this.ui.updateStatus('Race stopped. Upload a GPX file to start again.');
        this.loadTracks(); // Display saved tracks after stopping race
    }

    async finishRaceWithBuffer() {
        const finishPoint = this.race.state.gpxData[this.race.state.gpxData.length - 1];
        let closestPosition = null;
        let closestDistance = Infinity;
        for (const position of this.race.state.finishBufferPositions) {
            const distance = GPX.calculateDistance(
                position.lat, position.lon,
                finishPoint.lat, finishPoint.lon
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPosition = position;
            }
        }
        const finishTime = closestPosition ? closestPosition.timestamp : new Date();
        const totalTime = (finishTime - this.race.state.raceStartTime) / 1000;
        await this.finishRaceWithTime(totalTime, closestDistance);
    }

    async finishRaceWithTime(totalTime, finishDistance) {
        let expectedTime = 0;
        if (this.race.state.gpxData.length > 0) {
            const firstPoint = this.race.state.gpxData[0];
            const lastPoint = this.race.state.gpxData[this.race.state.gpxData.length - 1];
            if (firstPoint.time && lastPoint.time) {
                expectedTime = (lastPoint.time - firstPoint.time) / 1000;
            } else {
                expectedTime = this.race.state.gpxData.length * 2;
            }
        }
        const timeDifference = totalTime - expectedTime;
        this.race.saveRaceResult({
            date: new Date().toISOString(),
            totalTime: totalTime,
            finishDistance: finishDistance,
            timeDifference: timeDifference,
            trackLength: GPX.calculateTrackLength(this.race.state.gpxData),
            expectedTime: expectedTime
        });

        Geolocation.clearWatch(this.watchId);
        await this.releaseWakeLock();

        this.race.state.isRacing = false;
        this.race.state.raceStarted = false;
        this.race.state.finishDetected = false;
        this.race.state.finishDetectionTime = null;
        this.race.state.finishBufferPositions = [];

        let resultMessage = `🏁 Race completed in ${this.ui.formatTime(totalTime)}! `;
        if (finishDistance > 0) {
            resultMessage += `(${finishDistance.toFixed(1)}m from finish line) `;
        }
        if (timeDifference < 0) {
            resultMessage += `You finished ${Math.abs(timeDifference).toFixed(1)}s faster than your reference!`;
        } else {
            resultMessage += `You finished ${timeDifference.toFixed(1)}s slower than your reference.`;
        }

        this.ui.showFinishScreen(resultMessage);

        if (this.race.state.raceTrack && this.race.state.raceTrack.length > 0) {
            this.ui.elements.downloadRace.style.display = 'block';
        } else {
            this.ui.elements.downloadRace.style.display = 'none';
        }

        this.ui.elements.racingDisplay.style.display = 'none';
        this.mapView.hide(); // Hide map when race finishes
        this.elevationView.hide(); // Hide elevation profile when race finishes

        setTimeout(() => {
            this.ui.elements.startRace.style.display = 'block';
            this.ui.elements.stopRace.style.display = 'none';
            this.ui.elements.uploadSection.style.display = 'block';
            this.ui.elements.map.style.display = 'none'; // Ensure map is hidden
            this.ui.elements['elevation-profile'].style.display = 'none'; // Ensure elevation profile is hidden
            let briefMessage = 'Race completed! ';
            if (this.race.state.raceTrack && this.race.state.raceTrack.length > 0) {
                briefMessage += 'Download your track or upload a new GPX file to race again.';
            } else {
                briefMessage += 'Upload a new GPX file to race again.';
            }
            this.ui.updateStatus(briefMessage);
            this.ui.updateRaceHistory(this.race.getRaceHistory());
            this.loadTracks(); // Display saved tracks after finishing race
        }, 10000);
    }

    downloadRaceTrack() {
        const gpxContent = GPX.generateGPXFromTrack(this.race.state.raceTrack);
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
            this.ui.renderTrackList(tracks, 
                (id) => this.loadTrack(id),
                (id) => this.deleteTrack(id)
            );
        } catch (error) {
            console.error('Error loading tracks:', error);
            this.ui.updateStatus('Error loading saved tracks.');
        }
    }

    async loadTrack(id) {
        try {
            const track = await this.trackStorage.getTrack(id);
            if (track) {
                this.race.state.originalGpxData = track.gpxData;
                this.race.applyReverseMode();
                const trackLength = GPX.calculateTrackLength(this.race.state.gpxData);
                const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
                this.ui.updateStatus(`Loaded track "${track.name}": ${trackLength.toFixed(2)} km <span class="point-count">(${this.race.state.gpxData.length} points)${direction}</span>`);
                this.ui.elements.startRace.style.display = 'block';
                this.mapView.show();
                this.mapView.drawTrack(this.race.state.gpxData);
                this.elevationView.show();
                this.elevationView.drawProfile(this.race.state.gpxData);
                try {
                    const position = await Geolocation.getCurrentPosition();
                    this.mapView.updateUserPosition(position.coords.latitude, position.coords.longitude, position.coords.heading || 0);
                } catch (geoError) {
                    console.warn('Could not get current position after GPX load:', geoError);
                    this.ui.updateStatus('Track loaded, but could not get your current location.');
                }
                this.ui.hideTrackList();
            } else {
                this.ui.updateStatus('Track not found.');
            }
        } catch (error) {
            console.error('Error loading track:', error);
            this.ui.updateStatus('Error loading track.');
        }
    }

    async deleteTrack(id) {
        if (confirm('Are you sure you want to delete this track?')) {
            try {
                await this.trackStorage.deleteTrack(id);
                this.ui.updateStatus('Track deleted.');
                this.loadTracks(); // Refresh the list
            } catch (error) {
                console.error('Error deleting track:', error);
                this.ui.updateStatus('Error deleting track.');
            }
        }
    }

    handleLocationError(error) {
        let message = 'Location error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Location access denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Location unavailable';
                break;
            case error.TIMEOUT:
                message += 'Location timeout';
                break;
            default:
                message += 'Unknown error';
                break;
        }
        this.ui.updateStatus(message);
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {});
            } else {
                console.log('Screen Wake Lock API not supported');
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
    new App();
});
