
import { GPX } from './gpx.js';
import { Geolocation } from './geolocation.js';

export class Race {
    constructor(ui, mapView, elevationView) {
        this.ui = ui;
        this.mapView = mapView;
        this.elevationView = elevationView;
        this.gpxData = null;
        this.originalGpxData = null;
        this.isRacing = false;
        this.raceStartTime = null;
        this.nearestPoint = null;
        this.raceStarted = false;
        this.raceTrack = [];
        this.previousPosition = null;
        this.maxProgressIndex = -1;
        this.preRacePositions = [];
        this.finishDetected = false;
        this.finishDetectionTime = null;
        this.finishBufferPositions = [];
        this.speedMeasurements = [];
        this.transportationMode = 'cycling';
        this.speedLimits = {
            walking: 20,
            cycling: 80,
            car: 160
        };
        this.behindMessages = [
            "Push harder!", "You can catch up!", "Dig deeper!", "Fight back!", "Don't give up!",
            "Find your speed!", "You've got this!", "Time to sprint!", "Chase it down!", "Prove yourself!",
            "Every pedal stroke counts!", "The finish line awaits!", "Unleash your inner beast!",
            "Don't let the ghost win!", "Accelerate now!", "Find your rhythm, find your speed!",
            "This is your moment!", "Leave no doubt!", "Conquer the course!", "Push past your limits!",
            "Make every second count!", "You're stronger than you think!", "Ignite your pace!",
            "Break free from the past!", "Own this race!", "No regrets, just effort!",
            "The road is calling, answer it!", "Feel the burn, embrace the speed!", "Go beyond!",
            "Your best self is waiting!", "Outrun your doubts!", "Victory is earned!",
            "Leave it all on the track!", "Find that extra gear!", "Make a statement!",
            "The only way is forward!", "Challenge yourself!", "Rise to the occasion!",
            "Your effort defines you!", "Push through the pain!", "Make it count!",
            "Don't look back, push ahead!", "The clock is ticking, so are you!", "Faster, stronger, better!",
            "This is your race to win!", "Show them what you're made of!", "No excuses, just results!",
            "The power is within you!", "Break the tape!"
        ];
        this.aheadMessages = [
            "Keep it up!", "You're flying!", "Stay strong!", "Maintain pace!", "Looking good!",
            "Don't slow down!", "You're crushing it!", "Hold the lead!", "Perfect rhythm!", "Beast mode!",
            "Effortless speed!", "You're in the zone!", "Mastering the course!", "Setting a new standard!",
            "Unstoppable force!", "Pure dominance!", "Flawless execution!", "Leading the way!",
            "Making it look easy!", "A true champion's pace!", "Beyond expectations!",
            "The ghost is fading!", "Leave them in the dust!", "Setting the pace!",
            "You're a machine!", "Incredible performance!", "Keep that momentum!",
            "No one can touch you!", "This is your moment of glory!", "Absolutely brilliant!",
            "A masterclass in speed!", "You're in a league of your own!", "Phenomenal effort!",
            "The wind is at your back!", "Effortlessly fast!", "A true inspiration!",
            "Making history!", "The perfect run!", "Unrivaled speed!",
            "You're a legend in the making!", "Simply outstanding!", "Pure power!",
            "The gold standard!", "Breaking barriers!", "On top of the world!"
        ];
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
            this.originalGpxData = GPX.parse(text);
            if (this.originalGpxData && this.originalGpxData.length > 0) {
                this.applyReverseMode();
                const trackLength = GPX.calculateTrackLength(this.gpxData);
                const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
                this.ui.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.gpxData.length} points)${direction}</span>`);
                this.ui.elements.startRace.style.display = 'block';
                this.mapView.show(); // Show map when GPX is loaded
                this.mapView.drawTrack(this.gpxData); // Draw track on map
                this.elevationView.show(); // Show elevation profile
                this.elevationView.drawProfile(this.gpxData); // Draw elevation profile
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
        if (!this.originalGpxData) return;
        const isReverse = this.ui.elements.reverseMode.checked;
        if (isReverse) {
            const reversedPoints = [...this.originalGpxData].reverse();
            this.gpxData = reversedPoints.map((point, index) => {
                let newTime = null;
                if (this.originalGpxData[0].time) {
                    if (index === 0) {
                        newTime = new Date(this.originalGpxData[0].time);
                    } else {
                        const prevReversedPoint = reversedPoints[index - 1];
                        const currentReversedPoint = reversedPoints[index];
                        const prevOriginalIndex = this.originalGpxData.length - 1 - (index - 1);
                        const currentOriginalIndex = this.originalGpxData.length - 1 - index;
                        if (this.originalGpxData[prevOriginalIndex].time && this.originalGpxData[currentOriginalIndex].time) {
                            const timeInterval = Math.abs(this.originalGpxData[prevOriginalIndex].time - this.originalGpxData[currentOriginalIndex].time);
                            const prevNewTime = this.gpxData[index - 1].time;
                            if (!isNaN(timeInterval) && prevNewTime) {
                                newTime = new Date(prevNewTime.getTime() + timeInterval);
                            }
                        }
                    }
                }
                return {
                    ...point,
                    index: index,
                    time: newTime
                };
            });
        } else {
            this.gpxData = [...this.originalGpxData];
        }
    }

    handleReverseToggle() {
        if (this.originalGpxData) {
            this.applyReverseMode();
            const trackLength = GPX.calculateTrackLength(this.gpxData);
            const direction = this.ui.elements.reverseMode.checked ? ' (reverse)' : '';
            this.ui.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.gpxData.length} points)${direction}</span>`);
        }
    }

    selectTransportationMode(mode) {
        this.transportationMode = mode;
        this.ui.selectTransportationMode(mode);
    }

    getCurrentSpeedLimit() {
        return this.speedLimits[this.transportationMode];
    }

    findNearestPoint(currentLat, currentLon) {
        if (!this.gpxData || this.gpxData.length === 0) {
            return null;
        }
        let nearestPoint = null;
        let minDistance = Infinity;
        for (const point of this.gpxData) {
            const distance = GPX.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = { ...point, distance };
            }
        }
        return nearestPoint;
    }

    findOptimalStartPoint(currentLat, currentLon) {
        if (!this.gpxData || this.gpxData.length === 0) {
            return null;
        }
        if (this.preRacePositions.length < 2) {
            return this.findNearestPoint(currentLat, currentLon);
        }
        const lastPos = this.preRacePositions[this.preRacePositions.length - 1];
        const prevPos = this.preRacePositions[this.preRacePositions.length - 2];
        const movementLat = lastPos.lat - prevPos.lat;
        const movementLon = lastPos.lon - prevPos.lon;
        const nearest = this.findNearestPoint(currentLat, currentLon);
        if (!nearest) return null;
        const nearestIndex = nearest.index;
        const candidates = [];
        for (let i = Math.max(0, nearestIndex - 2); i <= Math.min(this.gpxData.length - 1, nearestIndex + 2); i++) {
            const point = this.gpxData[i];
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
            if (candidate.trackIndex < this.gpxData.length - 1) {
                const nextPoint = this.gpxData[candidate.trackIndex + 1];
                trackDirection = {
                    lat: nextPoint.lat - candidate.lat,
                    lon: nextPoint.lon - candidate.lon
                };
            } else if (candidate.trackIndex > 0) {
                const prevPoint = this.gpxData[candidate.trackIndex - 1];
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
        this.speedMeasurements.push(speed);
        if (this.speedMeasurements.length > 10) {
            this.speedMeasurements.shift();
        }
    }

    getSmoothedSpeed() {
        if (this.speedMeasurements.length === 0) {
            return 0;
        }
        const sum = this.speedMeasurements.reduce((total, speed) => total + speed, 0);
        return sum / this.speedMeasurements.length;
    }

    getMotivationMessage(isAhead) {
        const messages = isAhead ? this.aheadMessages : this.behindMessages;
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

    getRaceHistory() {
        try {
            return JSON.parse(localStorage.getItem('raceHistory') || '[]');
        } catch (error) {
            console.error('Failed to get race history:', error);
            return [];
        }
    }
}
