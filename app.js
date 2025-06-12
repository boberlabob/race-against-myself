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
        
        const nearest = this.findNearestPoint(this.currentPosition.lat, this.currentPosition.lon);
        
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
                this.finishRace();
                return;
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
        let speed = 0;
        if (this.previousPosition) {
            const distance = this.calculateDistance(
                this.previousPosition.lat, this.previousPosition.lon,
                this.currentPosition.lat, this.currentPosition.lon
            );
            const timeDiff = (this.currentPosition.timestamp - this.previousPosition.timestamp) / 1000; // seconds
            
            if (timeDiff > 0) {
                speed = (distance / timeDiff) * 3.6; // Convert m/s to km/h
            }
        }
        document.getElementById('speed').textContent = speed.toFixed(1) + ' km/h';
        
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
    
    finishRace() {
        const finishTime = new Date();
        const totalTime = (finishTime - this.raceStartTime) / 1000;
        
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
        document.getElementById('startRace').style.display = 'block';
        document.getElementById('stopRace').style.display = 'none';
        document.getElementById('racingDisplay').style.display = 'none';
        
        // Show completion message with results
        let resultMessage = `🏁 Race completed in ${this.formatTime(totalTime)}! `;
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