class GPSRacer {
    constructor() {
        this.gpxData = null;
        this.currentPosition = null;
        this.raceStartTime = null;
        this.watchId = null;
        this.isRacing = false;
        this.nearestPoint = null;
        this.raceStarted = false;
        this.raceTrack = []; // Store GPS positions during race
        this.previousPosition = null; // For speed calculation
        this.originalGpxData = null; // Store original GPX data
        this.maxProgressIndex = -1; // Track furthest point reached
        this.preRacePositions = []; // Track positions before race starts
        this.finishDetected = false; // Whether we've detected reaching the finish
        this.finishDetectionTime = null; // When we first detected the finish
        this.finishBufferPositions = []; // Positions collected during 2-second buffer
        this.speedMeasurements = []; // Buffer for speed measurements to calculate running mean
        this.transportationMode = 'walking'; // Current transportation mode
        this.speedLimits = {
            walking: 20,
            cycling: 80,
            car: 160
        };
        
        // Motivational messages
        this.behindMessages = [
            "Push harder!",
            "You can catch up!",
            "Dig deeper!",
            "Fight back!",
            "Don't give up!",
            "Find your speed!",
            "You've got this!",
            "Time to sprint!",
            "Chase it down!",
            "Prove yourself!"
        ];
        
        this.aheadMessages = [
            "Keep it up!",
            "You're flying!",
            "Stay strong!",
            "Maintain pace!",
            "Looking good!",
            "Don't slow down!",
            "You're crushing it!",
            "Hold the lead!",
            "Perfect rhythm!",
            "Beast mode!"
        ];
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        document.getElementById('gpxFile').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('startRace').addEventListener('click', () => this.startRace());
        document.getElementById('stopRace').addEventListener('click', () => this.stopRace());
        document.getElementById('downloadRace').addEventListener('click', () => this.downloadRaceTrack());
        document.getElementById('reverseMode').addEventListener('change', () => this.handleReverseToggle());
        
        // Transportation mode event listeners
        document.getElementById('walkingMode').addEventListener('click', () => this.selectTransportationMode('walking'));
        document.getElementById('cyclingMode').addEventListener('click', () => this.selectTransportationMode('cycling'));
        document.getElementById('carMode').addEventListener('click', () => this.selectTransportationMode('car'));
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            this.updateStatus('Please select a GPX file');
            return;
        }
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.updateStatus('File too large (max 10MB)');
            return;
        }
        
        this.updateStatus('Loading GPX file...');
        
        try {
            const text = await file.text();
            this.originalGpxData = this.parseGPX(text);
            
            if (this.originalGpxData && this.originalGpxData.length > 0) {
                this.applyReverseMode();
                const trackLength = this.calculateTrackLength(this.gpxData);
                const direction = document.getElementById('reverseMode').checked ? ' (reverse)' : '';
                this.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.gpxData.length} points)${direction}</span>`);
                document.getElementById('startRace').style.display = 'block';
            } else {
                this.updateStatus('Error: No track points found in GPX file');
            }
        } catch (error) {
            this.updateStatus('Error parsing GPX file: ' + error.message);
        }
    }
    
    parseGPX(gpxText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxText, 'text/xml');
        
        // Check for XML parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format in GPX file');
        }
        
        const trackPoints = xmlDoc.getElementsByTagName('trkpt');
        const points = [];
        
        for (let i = 0; i < trackPoints.length; i++) {
            const point = trackPoints[i];
            const latStr = point.getAttribute('lat');
            const lonStr = point.getAttribute('lon');
            
            // Validate that lat/lon attributes exist
            if (!latStr || !lonStr) continue;
            
            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            
            // Validate that coordinates are valid numbers and within bounds
            if (isNaN(lat) || isNaN(lon) || 
                Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                continue;
            }
            
            const timeElement = point.getElementsByTagName('time')[0];
            let timestamp = null;
            
            if (timeElement) {
                const timeStr = timeElement.textContent;
                if (timeStr) {
                    timestamp = new Date(timeStr);
                    // Validate that the date is valid
                    if (isNaN(timestamp.getTime())) {
                        timestamp = null;
                    }
                }
            }
            
            points.push({
                lat: lat,
                lon: lon,
                time: timestamp,
                index: points.length // Use points.length for proper indexing after filtering
            });
        }
        
        return points;
    }
    
    calculateTrackLength(points) {
        if (!points || points.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            totalDistance += this.calculateDistance(
                points[i-1].lat, points[i-1].lon,
                points[i].lat, points[i].lon
            );
        }
        
        return totalDistance / 1000; // Convert to kilometers
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    findNearestPoint(currentLat, currentLon) {
        if (!this.gpxData || this.gpxData.length === 0) {
            return null;
        }
        
        let nearestPoint = null;
        let minDistance = Infinity;
        
        for (const point of this.gpxData) {
            const distance = this.calculateDistance(currentLat, currentLon, point.lat, point.lon);
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
        
        // If we don't have enough movement data, fall back to nearest point
        if (this.preRacePositions.length < 2) {
            return this.findNearestPoint(currentLat, currentLon);
        }
        
        // Calculate movement direction from the last two positions
        const lastPos = this.preRacePositions[this.preRacePositions.length - 1];
        const prevPos = this.preRacePositions[this.preRacePositions.length - 2];
        
        const movementLat = lastPos.lat - prevPos.lat;
        const movementLon = lastPos.lon - prevPos.lon;
        
        // Find nearest points and determine which aligns better with movement direction
        const nearest = this.findNearestPoint(currentLat, currentLon);
        if (!nearest) return null;
        
        // Look at points around the nearest point to find the best directional match
        const nearestIndex = nearest.index;
        const candidates = [];
        
        // Check points within a reasonable range
        for (let i = Math.max(0, nearestIndex - 2); i <= Math.min(this.gpxData.length - 1, nearestIndex + 2); i++) {
            const point = this.gpxData[i];
            const distance = this.calculateDistance(currentLat, currentLon, point.lat, point.lon);
            
            if (distance <= 15) { // Within 15 meters
                candidates.push({ ...point, distance, trackIndex: i });
            }
        }
        
        if (candidates.length <= 1) {
            return nearest;
        }
        
        // Find the candidate that best matches our movement direction
        let bestCandidate = candidates[0];
        let bestScore = -Infinity;
        
        for (const candidate of candidates) {
            // Get the track direction at this point
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
                // Calculate dot product to measure alignment
                const dotProduct = (movementLat * trackDirection.lat) + (movementLon * trackDirection.lon);
                
                // Score based on direction alignment and distance (prefer closer points)
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
        // Add new speed measurement to the buffer
        this.speedMeasurements.push(speed);
        
        // Keep only the last 10 measurements (roughly 2 seconds at ~5 GPS updates per second)
        if (this.speedMeasurements.length > 10) {
            this.speedMeasurements.shift();
        }
    }
    
    getSmoothedSpeed() {
        if (this.speedMeasurements.length === 0) {
            return 0;
        }
        
        // Calculate running mean of speed measurements
        const sum = this.speedMeasurements.reduce((total, speed) => total + speed, 0);
        return sum / this.speedMeasurements.length;
    }
    
    selectTransportationMode(mode) {
        // Remove active class from all buttons
        document.querySelectorAll('.mode-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Add active class to selected button
        const selectedButton = document.querySelector(`[data-mode="${mode}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
        
        // Update the transportation mode
        this.transportationMode = mode;
        this.updateModeDisplay();
    }
    
    updateModeDisplay() {
        const modeIndicator = document.getElementById('modeIndicator');
        const modeIcons = {
            walking: '🚶 Walking',
            cycling: '🚴 Cycling',
            car: '🚗 Car'
        };
        
        if (modeIndicator) {
            modeIndicator.textContent = modeIcons[this.transportationMode];
        }
    }
    
    getCurrentSpeedLimit() {
        return this.speedLimits[this.transportationMode];
    }
    
    async startRace() {
        // Prevent multiple race starts
        if (this.isRacing) {
            return;
        }
        
        if (!navigator.geolocation) {
            this.updateStatus('Geolocation is not supported by this browser');
            return;
        }
        
        if (!this.gpxData || this.gpxData.length === 0) {
            this.updateStatus('Please load a GPX file first');
            return;
        }
        
        this.updateStatus('Requesting location permission...');
        
        try {
            const position = await this.getCurrentPosition();
            this.handleLocationUpdate(position);
            
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.handleLocationUpdate(position),
                (error) => this.handleLocationError(error),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
            
            this.isRacing = true;
            document.getElementById('startRace').style.display = 'none';
            document.getElementById('stopRace').style.display = 'block';
            document.getElementById('downloadRace').style.display = 'none';
            document.getElementById('racingDisplay').style.display = 'block';
            
        } catch (error) {
            this.updateStatus('Error getting location: ' + error.message);
        }
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }
    
    handleLocationUpdate(position) {
        this.currentPosition = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date()
        };
        
        // Hide the status container on first successful position
        if (document.getElementById('status').innerHTML === 'Requesting location permission...') {
            document.getElementById('status').style.display = 'none';
        }
        
        // Track positions before race starts for directional analysis
        if (!this.raceStarted) {
            this.preRacePositions.push({
                lat: this.currentPosition.lat,
                lon: this.currentPosition.lon,
                timestamp: this.currentPosition.timestamp
            });
            
            // Keep only the last 5 positions to analyze movement direction
            if (this.preRacePositions.length > 5) {
                this.preRacePositions.shift();
            }
        }
        
        const nearest = this.raceStarted ? 
            this.findNearestPoint(this.currentPosition.lat, this.currentPosition.lon) :
            this.findOptimalStartPoint(this.currentPosition.lat, this.currentPosition.lon);
        
        if (!nearest) {
            document.getElementById('raceStatus').textContent = 'No track data available';
            return;
        }
        
        if (nearest.distance > 10) {
            document.getElementById('raceStatus').textContent = 
                `Too far from track (${Math.round(nearest.distance)}m). Move closer to start.`;
            return;
        }
        
        if (!this.raceStarted) {
            this.raceStartTime = new Date();
            this.raceStarted = true;
            this.nearestPoint = nearest;
            this.raceTrack = []; // Reset race track
            this.previousPosition = null; // Reset for speed calculation
            this.maxProgressIndex = nearest.index; // Initialize progress tracking
            this.preRacePositions = []; // Clear pre-race positions
            this.finishDetected = false; // Reset finish detection
            this.finishDetectionTime = null;
            this.finishBufferPositions = [];
            this.speedMeasurements = []; // Reset speed measurements
            this.updateModeDisplay(); // Show transportation mode in race display
            document.getElementById('raceStatus').textContent = 'Race started!';
        }
        
        // Track position during race
        if (this.raceStarted) {
            this.raceTrack.push({
                lat: this.currentPosition.lat,
                lon: this.currentPosition.lon,
                timestamp: this.currentPosition.timestamp
            });
            
            // Update progress tracking
            this.maxProgressIndex = Math.max(this.maxProgressIndex, nearest.index);
            
            // Check if we've reached the last point (finish line)
            if (this.maxProgressIndex >= this.gpxData.length - 1) {
                if (!this.finishDetected) {
                    // First time detecting finish - start 2-second buffer
                    this.finishDetected = true;
                    this.finishDetectionTime = new Date();
                    this.finishBufferPositions = [];
                    document.getElementById('raceStatus').textContent = 'Finishing...';
                }
                
                // Add position to buffer
                this.finishBufferPositions.push({
                    lat: this.currentPosition.lat,
                    lon: this.currentPosition.lon,
                    timestamp: this.currentPosition.timestamp
                });
                
                // Check if 2 seconds have passed
                const elapsed = (new Date() - this.finishDetectionTime) / 1000;
                if (elapsed >= 2.0) {
                    this.finishRaceWithBuffer();
                    return;
                }
            }
        }
        
        this.updateRaceDisplay(nearest);
    }
    
    applyReverseMode() {
        if (!this.originalGpxData) return;
        
        const isReverse = document.getElementById('reverseMode').checked;
        
        if (isReverse) {
            // Reverse the array and recalculate timestamps preserving intervals
            const reversedPoints = [...this.originalGpxData].reverse();
            
            this.gpxData = reversedPoints.map((point, index) => {
                let newTime = null;
                
                // Recalculate timestamps preserving the actual time intervals
                if (this.originalGpxData[0].time) {
                    if (index === 0) {
                        // First point in reversed track gets the original start time
                        newTime = new Date(this.originalGpxData[0].time);
                    } else {
                        // Calculate time based on the interval from the previous original point
                        const prevReversedPoint = reversedPoints[index - 1];
                        const currentReversedPoint = reversedPoints[index];
                        
                        // Find original indices (before reversal)
                        const prevOriginalIndex = this.originalGpxData.length - 1 - (index - 1);
                        const currentOriginalIndex = this.originalGpxData.length - 1 - index;
                        
                        // Get the time interval between these points in the original track
                        if (this.originalGpxData[prevOriginalIndex].time && this.originalGpxData[currentOriginalIndex].time) {
                            const timeInterval = Math.abs(this.originalGpxData[prevOriginalIndex].time - this.originalGpxData[currentOriginalIndex].time);
                            
                            // Add this interval to the previous point's new time
                            const prevNewTime = this.gpxData[index - 1].time;
                            newTime = new Date(prevNewTime.getTime() + timeInterval);
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
            // Use original data
            this.gpxData = [...this.originalGpxData];
        }
    }
    
    handleReverseToggle() {
        if (this.originalGpxData) {
            this.applyReverseMode();
            const trackLength = this.calculateTrackLength(this.gpxData);
            const direction = document.getElementById('reverseMode').checked ? ' (reverse)' : '';
            this.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.gpxData.length} points)${direction}</span>`);
        }
    }
    
    getMotivationMessage(isAhead) {
        const messages = isAhead ? this.aheadMessages : this.behindMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }
    
    updateRaceDisplay(nearest) {
        const currentTime = new Date();
        const elapsedTime = (currentTime - this.raceStartTime) / 1000;
        
        let referenceTime = 0;
        if (nearest.time && this.nearestPoint && this.nearestPoint.time) {
            referenceTime = (nearest.time - this.nearestPoint.time) / 1000;
        } else if (this.nearestPoint) {
            referenceTime = (nearest.index - this.nearestPoint.index) * 2; // Estimate 2 seconds per point
        }
        
        const timeDifference = elapsedTime - referenceTime;
        
        document.getElementById('timeDifference').textContent = this.formatTimeDifference(timeDifference);
        document.getElementById('distance').textContent = Math.round(nearest.distance) + ' m';
        document.getElementById('referenceTime').textContent = this.formatTime(referenceTime);
        document.getElementById('currentTime').textContent = this.formatTime(elapsedTime);
        
        // Calculate and display speed
        let currentSpeed = 0;
        if (this.previousPosition) {
            const distance = this.calculateDistance(
                this.previousPosition.lat, this.previousPosition.lon,
                this.currentPosition.lat, this.currentPosition.lon
            );
            const timeDiff = (this.currentPosition.timestamp - this.previousPosition.timestamp) / 1000; // seconds
            
            if (timeDiff > 0.001) { // More robust check for near-zero time differences
                currentSpeed = (distance / timeDiff) * 3.6; // Convert m/s to km/h
                
                // Filter out unrealistic speed spikes based on transportation mode
                const speedLimit = this.getCurrentSpeedLimit();
                if (currentSpeed <= speedLimit) {
                    this.addSpeedMeasurement(currentSpeed);
                }
            }
        }
        
        // Display smoothed speed
        const smoothedSpeed = this.getSmoothedSpeed();
        document.getElementById('speed').textContent = smoothedSpeed.toFixed(1) + ' km/h';
        
        // Update previous position for next calculation
        this.previousPosition = {
            lat: this.currentPosition.lat,
            lon: this.currentPosition.lon,
            timestamp: this.currentPosition.timestamp
        };
        
        if (timeDifference < 0) {
            document.getElementById('timeDifference').className = 'time-difference ahead';
            const motivation = this.getMotivationMessage(true);
            document.getElementById('raceStatus').textContent = `You're ${Math.abs(timeDifference).toFixed(1)}s ahead! ${motivation}`;
        } else {
            document.getElementById('timeDifference').className = 'time-difference behind';
            const motivation = this.getMotivationMessage(false);
            document.getElementById('raceStatus').textContent = `You're ${timeDifference.toFixed(1)}s behind. ${motivation}`;
        }
    }
    
    formatTimeDifference(seconds) {
        const abs = Math.abs(seconds);
        const sign = seconds < 0 ? '-' : '+';
        return sign + this.formatTime(abs);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    generateGPXFromTrack() {
        if (!this.raceTrack || this.raceTrack.length === 0) {
            return null;
        }
        
        const now = new Date();
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Race Against Myself" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Race Track - ${now.toISOString().split('T')[0]}</name>
    <time>${now.toISOString()}</time>
  </metadata>
  <trk>
    <name>My Race</name>
    <trkseg>
${this.raceTrack.map(point => `      <trkpt lat="${point.lat}" lon="${point.lon}">
        <time>${point.timestamp.toISOString()}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;
        
        return gpxContent;
    }
    
    downloadRaceTrack() {
        const gpxContent = this.generateGPXFromTrack();
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
    
    finishRaceWithBuffer() {
        // Find the position in the buffer that was closest to the finish line
        const finishPoint = this.gpxData[this.gpxData.length - 1];
        let closestPosition = null;
        let closestDistance = Infinity;
        
        for (const position of this.finishBufferPositions) {
            const distance = this.calculateDistance(
                position.lat, position.lon,
                finishPoint.lat, finishPoint.lon
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPosition = position;
            }
        }
        
        // Use the closest position's timestamp as the actual finish time
        const finishTime = closestPosition ? closestPosition.timestamp : new Date();
        const totalTime = (finishTime - this.raceStartTime) / 1000;
        
        this.finishRaceWithTime(totalTime, closestDistance);
    }
    
    finishRace() {
        const finishTime = new Date();
        const totalTime = (finishTime - this.raceStartTime) / 1000;
        this.finishRaceWithTime(totalTime, 0);
    }
    
    finishRaceWithTime(totalTime, finishDistance) {
        // Get the expected time for the full track
        let expectedTime = 0;
        if (this.gpxData.length > 0) {
            const firstPoint = this.gpxData[0];
            const lastPoint = this.gpxData[this.gpxData.length - 1];
            
            if (firstPoint.time && lastPoint.time) {
                expectedTime = (lastPoint.time - firstPoint.time) / 1000;
            } else {
                expectedTime = this.gpxData.length * 2; // Estimate 2 seconds per point
            }
        }
        
        const timeDifference = totalTime - expectedTime;
        
        // Stop the race
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.isRacing = false;
        this.raceStarted = false;
        this.finishDetected = false; // Reset finish detection
        this.finishDetectionTime = null;
        this.finishBufferPositions = [];
        document.getElementById('startRace').style.display = 'block';
        document.getElementById('stopRace').style.display = 'none';
        document.getElementById('racingDisplay').style.display = 'none';
        
        // Show completion message with results
        let resultMessage = `🏁 Race completed in ${this.formatTime(totalTime)}! `;
        if (finishDistance > 0) {
            resultMessage += `(${finishDistance.toFixed(1)}m from finish line) `;
        }
        if (timeDifference < 0) {
            resultMessage += `You finished ${Math.abs(timeDifference).toFixed(1)}s faster than your reference!`;
        } else {
            resultMessage += `You finished ${timeDifference.toFixed(1)}s slower than your reference.`;
        }
        
        // Show download button if we have race data
        if (this.raceTrack && this.raceTrack.length > 0) {
            document.getElementById('downloadRace').style.display = 'block';
            resultMessage += ' Download your track or upload a new GPX file to race again.';
        } else {
            document.getElementById('downloadRace').style.display = 'none';
            resultMessage += ' Upload a new GPX file to race again.';
        }
        
        this.updateStatus(resultMessage);
    }
    
    stopRace() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.isRacing = false;
        this.raceStarted = false;
        document.getElementById('startRace').style.display = 'block';
        document.getElementById('stopRace').style.display = 'none';
        document.getElementById('racingDisplay').style.display = 'none';
        
        // Show download button if we have race data
        if (this.raceTrack && this.raceTrack.length > 0) {
            document.getElementById('downloadRace').style.display = 'block';
            this.updateStatus('Race stopped. Download your track or upload a new GPX file to start again.');
        } else {
            document.getElementById('downloadRace').style.display = 'none';
            this.updateStatus('Race stopped. Upload a GPX file to start again.');
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
        this.updateStatus(message);
    }
    
    updateStatus(message) {
        document.getElementById('status').innerHTML = message;
    }
}

// Initialize the app
const app = new GPSRacer();