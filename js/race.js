
import { GPX } from './gpx.js';
import { Geolocation } from './geolocation.js';
import { RaceState } from './raceState.js';

export class Race {
    constructor(ui, mapView, elevationView, trackStorage) {
        this.trackStorage = trackStorage;
        this.ui = ui;
        this.mapView = mapView;
        this.elevationView = elevationView;
        this.state = new RaceState();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            this.ui.updateStatus('Please select a GPX file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.ui.updateStatus('File too large (max 10MB)');
            return;
        }
        this.ui.updateStatus('Loading GPX file...');
        try {
            const text = await file.text();
            this.state.originalGpxData = GPX.parse(text);
            if (this.state.originalGpxData && this.state.originalGpxData.length > 0) {
                this.applyReverseMode();
                const trackLength = GPX.calculateTrackLength(this.state.gpxData);
                const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
                this.ui.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.state.gpxData.length} points)${direction}</span>`);
                this.ui.elements.startRace.style.display = 'block';
                this.mapView.show(); // Show map when GPX is loaded
                this.mapView.drawTrack(this.state.gpxData); // Draw track on map
                this.elevationView.show(); // Show elevation profile
                this.elevationView.drawProfile(this.state.gpxData); // Draw elevation profile
                
                const trackName = prompt("Enter a name for this track:", file.name.replace('.gpx', ''));
                if (trackName) {
                    await this.trackStorage.saveTrack(trackName, this.state.originalGpxData);
                    this.ui.updateStatus(`GPX loaded and saved as "${trackName}": ${trackLength.toFixed(2)} km <span class="point-count">(${this.state.gpxData.length} points)${direction}</span>`);
                    // Assuming main.js has a method to refresh track list
                    // This would ideally be a callback or event from Race to App
                    // For now, we'll rely on the App to call loadTracks() after file upload
                }

                try {
                    const position = await Geolocation.getCurrentPosition();
                    this.mapView.updateUserPosition(position.coords.latitude, position.coords.longitude, position.coords.heading || 0);
                } catch (geoError) {
                    console.warn('Could not get current position after GPX load:', geoError);
                    this.ui.updateStatus('GPX loaded, but could not get your current location.');
                }
            } else {
                this.ui.updateStatus('Error: No track points found in GPX file');
                this.mapView.hide(); // Hide map if no track data
                this.elevationView.hide(); // Hide elevation profile if no track data
            }
        } catch (error) {
            this.ui.updateStatus('Error parsing GPX file: ' + error.message);
        }
    }

    applyReverseMode() {
        if (!this.state.originalGpxData) return;
        const isReverse = this.ui.elements.reverseMode.checked;
        if (isReverse) {
            const reversedPoints = [...this.state.originalGpxData].reverse();
            this.state.gpxData = reversedPoints.map((point, index) => {
                let newTime = null;
                return {
                    ...point,
                    index: index,
                    time: newTime
                };
            });
        } else {
            this.state.gpxData = [...this.state.originalGpxData];
        }
    }

    handleReverseToggle() {
        if (this.state.originalGpxData) {
            this.applyReverseMode();
            const trackLength = GPX.calculateTrackLength(this.state.gpxData);
            const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
            this.ui.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.state.gpxData.length} points)${direction}</span>`);
        }
    }

    selectTransportationMode(mode) {
        this.state.transportationMode = mode;
        this.ui.selectTransportationMode(mode);
    }

    getCurrentSpeedLimit() {
        return this.state.speedLimits[this.state.transportationMode];
    }

    findNearestPoint(currentLat, currentLon) {
        if (!this.state.gpxData || this.state.gpxData.length === 0) {
            return null;
        }
        let nearestPoint = null;
        let minDistance = Infinity;
        for (const point of this.state.gpxData) {
            const distance = GPX.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = { ...point, distance };
            }
        }
        return nearestPoint;
    }

    getDistanceAlongTrack(index) {
        if (!this.state.gpxData || index < 0 || index >= this.state.gpxData.length) {
            return 0;
        }
        let distance = 0;
        for (let i = 1; i <= index; i++) {
            distance += GPX.calculateDistance(
                this.state.gpxData[i - 1].lat, this.state.gpxData[i - 1].lon,
                this.state.gpxData[i].lat, this.state.gpxData[i].lon
            );
        }
        return distance;
    }

    findOptimalStartPoint(currentLat, currentLon) {
        if (!this.state.gpxData || this.state.gpxData.length === 0) {
            return null;
        }
        if (this.state.preRacePositions.length < 2) {
            return this.findNearestPoint(currentLat, currentLon);
        }
        const lastPos = this.state.preRacePositions[this.state.preRacePositions.length - 1];
        const prevPos = this.state.preRacePositions[this.state.preRacePositions.length - 2];
        const movementLat = lastPos.lat - prevPos.lat;
        const movementLon = lastPos.lon - prevPos.lon;
        const nearest = this.findNearestPoint(currentLat, currentLon);
        if (!nearest) return null;
        const nearestIndex = nearest.index;
        const candidates = [];
        for (let i = Math.max(0, nearestIndex - 2); i <= Math.min(this.state.gpxData.length - 1, nearestIndex + 2); i++) {
            const point = this.state.gpxData[i];
            const distance = GPX.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            if (distance <= 15) {
                candidates.push({ ...point, distance, trackIndex: i });
            }
        }
        if (candidates.length <= 1) {
            return nearest;
        }
        let bestCandidate = candidates[0];
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            let trackDirection = null;
            if (candidate.trackIndex < this.state.gpxData.length - 1) {
                const nextPoint = this.state.gpxData[candidate.trackIndex + 1];
                trackDirection = {
                    lat: nextPoint.lat - candidate.lat,
                    lon: nextPoint.lon - candidate.lon
                };
            } else if (candidate.trackIndex > 0) {
                const prevPoint = this.state.gpxData[candidate.trackIndex - 1];
                trackDirection = {
                    lat: candidate.lat - prevPoint.lat,
                    lon: candidate.lon - prevPoint.lon
                };
            }
            if (trackDirection) {
                const dotProduct = (movementLat * trackDirection.lat) + (movementLon * trackDirection.lon);
                const score = dotProduct - (candidate.distance * 0.1);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
        }
        return bestCandidate;
    }

    addSpeedMeasurement(speed) {
        this.state.speedMeasurements.push(speed);
        if (this.state.speedMeasurements.length > 10) {
            this.state.speedMeasurements.shift();
        }
    }

    getSmoothedSpeed() {
        if (this.state.speedMeasurements.length === 0) {
            return 0;
        }
        const sum = this.state.speedMeasurements.reduce((total, speed) => total + speed, 0);
        return sum / this.state.speedMeasurements.length;
    }

    getMotivationMessage(isAhead) {
        const messages = isAhead ? this.state.aheadMessages : this.state.behindMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    saveRaceResult(result) {
        try {
            let raceHistory = JSON.parse(localStorage.getItem('raceHistory') || '[]');
            raceHistory.unshift(result);
            if (raceHistory.length > 10) {
                raceHistory = raceHistory.slice(0, 10);
            }
            localStorage.setItem('raceHistory', JSON.stringify(raceHistory));
        } catch (error) {
            console.error('Failed to save race result:', error);
        }
    }

    getGhostIndexByTime(elapsedTime) {
        // Note: This function will not work correctly for reversed tracks as their time property is set to null.
        if (!this.state.gpxData || this.state.gpxData.length === 0 || !this.state.gpxData[0].time) {
            return 0;
        }

        const gpxStartTimeMs = this.state.gpxData[0].time.getTime();
        const targetTimeMs = gpxStartTimeMs + (elapsedTime * 1000);

        for (let i = 0; i < this.state.gpxData.length; i++) {
            const point = this.state.gpxData[i];
            if (point.time && point.time.getTime() >= targetTimeMs) {
                return i;
            }
        }
        return this.state.gpxData.length - 1;
    }

    getRaceHistory() {
        try {
            return JSON.parse(localStorage.getItem('raceHistory') || '[]');
        } catch (error) {
            console.error('Failed to get race history:', error);
            return [];
        }
    }
}
