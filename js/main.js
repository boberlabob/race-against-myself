
import { UI } from './ui.js';
import { Race } from './race.js';
import { Geolocation } from './geolocation.js';
import { GPX } from './gpx.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { AudioFeedback } from './audio.js';

class App {
    constructor() {
        this.ui = new UI();
        this.mapView = new MapView();
        this.elevationView = new ElevationView();
        this.audioFeedback = new AudioFeedback();
        this.race = new Race(this.ui, this.mapView, this.elevationView);
        this.watchId = null;
        this.wakeLock = null;
        this.lastMotivationUpdateTime = 0;
        this.motivationUpdateInterval = 15000; // 15 seconds

        this.initializeEventListeners();
        this.ui.updateRaceHistory(this.race.getRaceHistory());
    }

    initializeEventListeners() {
        this.ui.elements.gpxFile.addEventListener('change', (e) => this.race.handleFileUpload(e));
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
        if (this.race.isRacing) return;
        if (!this.race.gpxData || this.race.gpxData.length === 0) {
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

        if (!this.race.raceStarted) {
            this.race.preRacePositions.push({
                lat: currentPosition.lat,
                lon: currentPosition.lon,
                timestamp: currentPosition.timestamp
            });
            if (this.race.preRacePositions.length > 5) {
                this.race.preRacePositions.shift();
            }
        }

        const nearest = this.race.raceStarted ? 
            this.race.findNearestPoint(currentPosition.lat, currentPosition.lon) :
            this.race.findOptimalStartPoint(currentPosition.lat, currentPosition.lon);

        if (!nearest) {
            this.ui.elements.raceStatus.textContent = 'No track data available';
            return;
        }

        if (nearest.distance > 10) {
            this.ui.elements.raceStatus.textContent = 
                `Too far from track (${Math.round(nearest.distance)}m). Move closer to start.`;
            return;
        }

        if (!this.race.raceStarted) {
            this.race.raceStartTime = new Date();
            this.race.raceStarted = true;
            this.race.nearestPoint = nearest;
            this.race.raceTrack = [];
            this.race.previousPosition = null;
            this.race.maxProgressIndex = nearest.index;
            this.race.preRacePositions = [];
            this.race.finishDetected = false;
            this.race.finishDetectionTime = null;
            this.race.finishBufferPositions = [];
            this.race.speedMeasurements = [];
            this.ui.updateModeDisplay(this.race.transportationMode);
            this.ui.elements.raceStatus.textContent = 'Race started!';
        }

        if (this.race.raceStarted) {
            this.race.raceTrack.push({
                lat: currentPosition.lat,
                lon: currentPosition.lon,
                timestamp: currentPosition.timestamp
            });
            this.race.maxProgressIndex = Math.max(this.race.maxProgressIndex, nearest.index);
            if (this.race.maxProgressIndex >= this.race.gpxData.length - 1) {
                if (!this.race.finishDetected) {
                    this.race.finishDetected = true;
                    this.race.finishDetectionTime = new Date();
                    this.race.finishBufferPositions = [];
                    this.ui.elements.raceStatus.textContent = 'Finishing...';
                }
                this.race.finishBufferPositions.push({
                    lat: currentPosition.lat,
                    lon: currentPosition.lon,
                    timestamp: currentPosition.timestamp
                });
                const elapsed = (new Date() - this.race.finishDetectionTime) / 1000;
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
            this.elevationView.updatePositions(this.race.maxProgressIndex, nearest.index, this.race.gpxData); // Update elevation profile
        }
    }

    updateRaceDisplay(nearest, currentPosition) {
        const elapsedTime = (new Date() - this.race.raceStartTime) / 1000;
        let referenceTime = 0;
        if (nearest.time && this.race.nearestPoint && this.race.nearestPoint.time) {
            referenceTime = (nearest.time - this.race.nearestPoint.time) / 1000;
        } else if (this.race.nearestPoint) {
            referenceTime = (nearest.index - this.race.nearestPoint.index) * 2;
        }
        const timeDifference = elapsedTime - referenceTime;

        let currentSpeed = 0;
        if (this.race.previousPosition) {
            const distance = GPX.calculateDistance(
                this.race.previousPosition.lat, this.race.previousPosition.lon,
                currentPosition.lat, currentPosition.lon
            );
            const timeDiff = (currentPosition.timestamp - this.race.previousPosition.timestamp) / 1000;
            if (timeDiff > 0.001) {
                currentSpeed = (distance / timeDiff) * 3.6;
                const speedLimit = this.race.getCurrentSpeedLimit();
                if (currentSpeed <= speedLimit) {
                    this.race.addSpeedMeasurement(currentSpeed);
                }
            }
        }
        const smoothedSpeed = this.race.getSmoothedSpeed();
        this.race.previousPosition = {
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
            distance: nearest.distance,
            referenceTime,
            elapsedTime,
            smoothedSpeed,
            motivation: motivationMessage
        });
    }

    stopRace() {
        if (!this.race.isRacing) return;

        Geolocation.clearWatch(this.watchId);
        this.releaseWakeLock();

        this.race.isRacing = false;
        this.race.raceStarted = false;
        this.race.finishDetected = false;
        this.race.finishDetectionTime = null;
        this.race.finishBufferPositions = [];
        this.race.preRacePositions = [];
        this.race.speedMeasurements = [];
        this.race.raceTrack = [];
        this.race.previousPosition = null;
        this.race.nearestPoint = null;
        this.race.maxProgressIndex = -1;

        this.ui.elements.racingDisplay.style.display = 'none';
        this.mapView.hide();
        this.elevationView.hide();

        this.ui.elements.startRace.style.display = 'block';
        this.ui.elements.stopRace.style.display = 'none';
        this.ui.elements.downloadRace.style.display = 'none';
        this.ui.elements.uploadSection.style.display = 'block';
        this.ui.updateStatus('Race stopped. Upload a GPX file to start again.');
    }

    async finishRaceWithBuffer() {
        const finishPoint = this.race.gpxData[this.race.gpxData.length - 1];
        let closestPosition = null;
        let closestDistance = Infinity;
        for (const position of this.race.finishBufferPositions) {
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
        const totalTime = (finishTime - this.race.raceStartTime) / 1000;
        await this.finishRaceWithTime(totalTime, closestDistance);
    }

    async finishRaceWithTime(totalTime, finishDistance) {
        let expectedTime = 0;
        if (this.race.gpxData.length > 0) {
            const firstPoint = this.race.gpxData[0];
            const lastPoint = this.race.gpxData[this.race.gpxData.length - 1];
            if (firstPoint.time && lastPoint.time) {
                expectedTime = (lastPoint.time - firstPoint.time) / 1000;
            } else {
                expectedTime = this.race.gpxData.length * 2;
            }
        }
        const timeDifference = totalTime - expectedTime;
        this.race.saveRaceResult({
            date: new Date().toISOString(),
            totalTime: totalTime,
            finishDistance: finishDistance,
            timeDifference: timeDifference,
            trackLength: GPX.calculateTrackLength(this.race.gpxData),
            expectedTime: expectedTime
        });

        Geolocation.clearWatch(this.watchId);
        await this.releaseWakeLock();

        this.race.isRacing = false;
        this.race.raceStarted = false;
        this.race.finishDetected = false;
        this.race.finishDetectionTime = null;
        this.race.finishBufferPositions = [];

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

        if (this.race.raceTrack && this.race.raceTrack.length > 0) {
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
            if (this.race.raceTrack && this.race.raceTrack.length > 0) {
                briefMessage += 'Download your track or upload a new GPX file to race again.';
            } else {
                briefMessage += 'Upload a new GPX file to race again.';
            }
            this.ui.updateStatus(briefMessage);
            this.ui.updateRaceHistory(this.race.getRaceHistory());
        }, 10000);
    }

    downloadRaceTrack() {
        const gpxContent = GPX.generateGPXFromTrack(this.race.raceTrack);
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
