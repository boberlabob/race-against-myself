import { GPX } from './gpx.js';

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export class Race {
    constructor(appState, trackStorage, audioFeedback) {
        this.state = appState;
        this.trackStorage = trackStorage;
        this.audioFeedback = audioFeedback;
        this.lastMotivationUpdateTime = 0;
        this.motivationUpdateInterval = 15000; // 15 seconds
        this.lastDistanceAnnounceTime = 0;
        this.distanceAnnounceInterval = 5000; // Announce distance every 5 seconds
    }

    handleLocationUpdate(position) {
        const currentState = this.state.getState();
        const currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date()
        };

        this.state.setState({ userPosition: { ...currentPosition, heading: position.coords.heading || 0 } });

        if (!currentState.raceStarted) {
            const preRacePositions = [...currentState.preRacePositions, currentPosition];
            if (preRacePositions.length > 5) {
                preRacePositions.shift();
            }
            this.state.setState({ preRacePositions });
        }

        const nearest = currentState.raceStarted ? 
            this.findNearestPoint(currentPosition.lat, currentPosition.lon) :
            this.findOptimalStartPoint(currentPosition.lat, currentPosition.lon);

        if (!nearest) {
            this.state.setState({ motivationMessage: 'No track data available' });
            return;
        }

        if (!currentState.raceStarted && nearest.distance > 10) {
            this.state.setState({ motivationMessage: `Too far from track (${Math.round(nearest.distance)}m). Move closer to start.` });
            const currentTime = new Date().getTime();
            if (currentTime - this.lastDistanceAnnounceTime > this.distanceAnnounceInterval) {
                this.audioFeedback.speak(`${Math.round(nearest.distance)} meters away from the start.`);
                this.lastDistanceAnnounceTime = currentTime;
            }
            return;
        }

        if (!currentState.raceStarted) {
            this.startRace(nearest);
        }

        if (currentState.raceStarted) {
            const raceTrack = [...currentState.raceTrack, currentPosition];
            const maxProgressIndex = Math.max(currentState.maxProgressIndex, nearest.index);
            this.state.setState({ raceTrack, maxProgressIndex });

            if (maxProgressIndex >= currentState.gpxData.length - 1) {
                if (!currentState.finishDetected) {
                    this.state.setState({ 
                        finishDetected: true, 
                        finishDetectionTime: new Date(), 
                        finishBufferPositions: [],
                        motivationMessage: 'Finishing...'
                    });
                }
                const finishBufferPositions = [...currentState.finishBufferPositions, currentPosition];
                this.state.setState({ finishBufferPositions });

                const elapsed = (new Date() - currentState.finishDetectionTime) / 1000;
                if (elapsed >= 2.0) {
                    this.finishRaceWithBuffer();
                    return;
                }
            }
        }

        this.updateRaceDisplay(nearest, currentPosition);
    }

    startRace(startPoint) {
        this.state.setState({
            raceStartTime: new Date(),
            raceStarted: true,
            nearestPoint: startPoint,
            raceTrack: [],
            previousPosition: null,
            maxProgressIndex: startPoint.index,
            preRacePositions: [],
            finishDetected: false,
            finishDetectionTime: null,
            finishBufferPositions: [],
            speedMeasurements: [],
            motivationMessage: 'Race started!'
        });
    }

    updateRaceDisplay(nearest, currentPosition) {
        const currentState = this.state.getState();
        const elapsedTime = (new Date() - currentState.raceStartTime) / 1000;
        const ghostIndex = this.getGhostIndexByTime(elapsedTime);
        const ghostPoint = currentState.gpxData[ghostIndex];

        let referenceTime = 0;
        if (ghostPoint.time && currentState.gpxData[0].time) {
            referenceTime = (ghostPoint.time - currentState.gpxData[0].time) / 1000;
        }

        const timeDifference = elapsedTime - referenceTime;

        const userDistanceAlongTrack = this.getDistanceAlongTrack(currentState.maxProgressIndex);
        const ghostDistanceAlongTrack = this.getDistanceAlongTrack(ghostIndex);
        const distanceDifference = userDistanceAlongTrack - ghostDistanceAlongTrack;

        let currentSpeed = 0;
        if (currentState.previousPosition) {
            const distance = GPX.calculateDistance(
                currentState.previousPosition.lat, currentState.previousPosition.lon,
                currentPosition.lat, currentPosition.lon
            );
            const timeDiff = (currentPosition.timestamp - currentState.previousPosition.timestamp) / 1000;
            if (timeDiff > 0.001) {
                currentSpeed = (distance / timeDiff) * 3.6;
                const speedLimit = currentState.speedLimits[currentState.transportationMode];
                if (currentSpeed <= speedLimit) {
                    const newSpeedMeasurements = [...currentState.speedMeasurements, currentSpeed];
                    if (newSpeedMeasurements.length > 10) newSpeedMeasurements.shift();
                    this.state.setState({ speedMeasurements: newSpeedMeasurements });
                }
            }
        }
        const smoothedSpeed = this.getSmoothedSpeed();
        this.state.setState({ previousPosition: currentPosition, smoothedSpeed });

        let motivationMessage = currentState.motivationMessage;
        const currentTime = new Date().getTime();
        if (currentTime - this.lastMotivationUpdateTime > this.motivationUpdateInterval) {
            motivationMessage = this.getMotivationMessage(timeDifference < 0);
            this.lastMotivationUpdateTime = currentTime;
        }

        this.state.setState({
            timeDifference,
            distanceDifference,
            ghostPosition: { lat: ghostPoint.lat, lon: ghostPoint.lon },
            motivationMessage
        });
    }

    finishRaceWithBuffer() {
        const currentState = this.state.getState();
        const finishPoint = currentState.gpxData[currentState.gpxData.length - 1];
        let closestPosition = null;
        let closestDistance = Infinity;
        for (const position of currentState.finishBufferPositions) {
            const distance = GPX.calculateDistance(position.lat, position.lon, finishPoint.lat, finishPoint.lon);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPosition = position;
            }
        }
        const finishTime = closestPosition ? closestPosition.timestamp : new Date();
        const totalTime = (finishTime - currentState.raceStartTime) / 1000;
        this.finishRaceWithTime(totalTime, closestDistance);
    }

    finishRaceWithTime(totalTime, finishDistance) {
        const currentState = this.state.getState();
        let expectedTime = 0;
        if (currentState.gpxData.length > 0) {
            const firstPoint = currentState.gpxData[0];
            const lastPoint = currentState.gpxData[currentState.gpxData.length - 1];
            if (firstPoint.time && lastPoint.time) {
                expectedTime = (lastPoint.time - firstPoint.time) / 1000;
            } else {
                expectedTime = currentState.gpxData.length * 2; // Fallback
            }
        }
        const timeDifference = totalTime - expectedTime;

        let resultMessage = `🏁 Race completed in ${formatTime(totalTime)}! `;
        if (finishDistance > 0) {
            resultMessage += `(${finishDistance.toFixed(1)}m from finish line) `;
        }
        if (timeDifference < 0) {
            resultMessage += `You finished ${Math.abs(timeDifference).toFixed(1)}s faster than your reference!`
        } else {
            resultMessage += `You finished ${timeDifference.toFixed(1)}s slower than your reference.`
        }

        this.state.setState({ finishMessage: resultMessage });
        
        this.saveRaceResult({
            date: new Date().toISOString(),
            totalTime: totalTime,
            finishDistance: finishDistance,
            timeDifference: timeDifference,
            trackLength: GPX.calculateTrackLength(currentState.gpxData),
            expectedTime: expectedTime
        });

        // Reset state for next race
        this._resetStateForNewRace('Race finished! Upload a new GPX to start again.');
        this.state.setState({ isRacing: false });

        // The UI will handle the finish screen based on the state change
    }

    stop() {
        this._resetStateForNewRace('Race stopped. Upload a GPX file to start again.');
        this.state.setState({ isRacing: false });
    }

    _resetStateForNewRace(motivationMessage) {
        this.state.setState({
            raceStarted: false,
            finishDetected: false,
            finishDetectionTime: null,
            finishBufferPositions: [],
            preRacePositions: [],
            speedMeasurements: [],
            // Keep raceTrack for download
            previousPosition: null,
            nearestPoint: null,
            maxProgressIndex: -1,
            timeDifference: 0,
            distanceDifference: 0,
            smoothedSpeed: 0,
            motivationMessage: motivationMessage
        });
    }

    handleLocationError(error) {
        let message = 'Location error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED: message += 'Location access denied'; break;
            case error.POSITION_UNAVAILABLE: message += 'Location unavailable'; break;
            case error.TIMEOUT: message += 'Location timeout'; break;
            default: message += 'Unknown error'; break;
        }
        this.state.setState({ statusMessage: message });
    }

    // --- Utility functions from old Race class ---

    findNearestPoint(currentLat, currentLon) {
        const { gpxData } = this.state.getState();
        if (!gpxData || gpxData.length === 0) return null;
        let nearestPoint = null;
        let minDistance = Infinity;
        for (const point of gpxData) {
            const distance = GPX.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = { ...point, distance };
            }
        }
        return nearestPoint;
    }

    getDistanceAlongTrack(index) {
        const { gpxData } = this.state.getState();
        if (!gpxData || index < 0 || index >= gpxData.length) return 0;
        let distance = 0;
        for (let i = 1; i <= index; i++) {
            distance += GPX.calculateDistance(gpxData[i - 1].lat, gpxData[i - 1].lon, gpxData[i].lat, gpxData[i].lon);
        }
        return distance;
    }

    findOptimalStartPoint(currentLat, currentLon) {
        const { gpxData, preRacePositions } = this.state.getState();
        if (!gpxData || gpxData.length === 0) return null;
        if (preRacePositions.length < 2) return this.findNearestPoint(currentLat, currentLon);
        
        const lastPos = preRacePositions[preRacePositions.length - 1];
        const prevPos = preRacePositions[preRacePositions.length - 2];
        const movementLat = lastPos.lat - prevPos.lat;
        const movementLon = lastPos.lon - prevPos.lon;
        const nearest = this.findNearestPoint(currentLat, currentLon);
        if (!nearest) return null;

        const candidates = [];
        for (let i = Math.max(0, nearest.index - 2); i <= Math.min(gpxData.length - 1, nearest.index + 2); i++) {
            const point = gpxData[i];
            const distance = GPX.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            if (distance <= 15) {
                candidates.push({ ...point, distance, trackIndex: i });
            }
        }
        if (candidates.length <= 1) return nearest;

        let bestCandidate = candidates[0];
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            let trackDirection = null;
            if (candidate.trackIndex < gpxData.length - 1) {
                const nextPoint = gpxData[candidate.trackIndex + 1];
                trackDirection = { lat: nextPoint.lat - candidate.lat, lon: nextPoint.lon - candidate.lon };
            } else if (candidate.trackIndex > 0) {
                const prevPoint = gpxData[candidate.trackIndex - 1];
                trackDirection = { lat: candidate.lat - prevPoint.lat, lon: candidate.lon - prevPoint.lon };
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

    getSmoothedSpeed() {
        const { speedMeasurements } = this.state.getState();
        if (speedMeasurements.length === 0) return 0;
        const sum = speedMeasurements.reduce((total, speed) => total + speed, 0);
        return sum / speedMeasurements.length;
    }

    getMotivationMessage(isAhead) {
        const { aheadMessages, behindMessages } = this.state.getState();
        const messages = isAhead ? aheadMessages : behindMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    saveRaceResult(result) {
        try {
            let raceHistory = JSON.parse(localStorage.getItem('raceHistory') || '[]');
            raceHistory.unshift({ id: Date.now(), transportationMode: this.state.getState().transportationMode, ...result });
            if (raceHistory.length > 10) {
                raceHistory = raceHistory.slice(0, 10);
            }
            localStorage.setItem('raceHistory', JSON.stringify(raceHistory));
            this.state.setState({ raceHistory });
        } catch (error) {
            console.error('Failed to save race result:', error);
        }
    }

    getGhostIndexByTime(elapsedTime) {
        const { gpxData } = this.state.getState();
        if (!gpxData || gpxData.length === 0) return 0;

        // If track has no time data (e.g., reversed track or simple route), use average speed.
        if (!gpxData[0].time || !gpxData[gpxData.length - 1].time) {
            const totalDistance = this.getDistanceAlongTrack(gpxData.length - 1);
            // Estimate a reasonable time if not present, e.g., assuming 10m/s (36 km/h) for cycling.
            const totalTime = gpxData.length * 2; // Fallback, assuming 2s per point
            if (totalTime <= 0) return 0;

            const averageSpeed = totalDistance / totalTime; // meters per second
            const ghostDistanceTarget = averageSpeed * elapsedTime;

            let cumulativeDistance = 0;
            for (let i = 1; i < gpxData.length; i++) {
                cumulativeDistance += GPX.calculateDistance(gpxData[i - 1].lat, gpxData[i - 1].lon, gpxData[i].lat, gpxData[i].lon);
                if (cumulativeDistance >= ghostDistanceTarget) {
                    return i;
                }
            }
            return gpxData.length - 1;
        }

        // Original time-based calculation
        const gpxStartTimeMs = gpxData[0].time.getTime();
        const targetTimeMs = gpxStartTimeMs + (elapsedTime * 1000);
        for (let i = 0; i < gpxData.length; i++) {
            if (gpxData[i].time && gpxData[i].time.getTime() >= targetTimeMs) {
                return i;
            }
        }
        return gpxData.length - 1;
    }
}