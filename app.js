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
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        document.getElementById('gpxFile').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('startRace').addEventListener('click', () => this.startRace());
        document.getElementById('stopRace').addEventListener('click', () => this.stopRace());
        document.getElementById('downloadRace').addEventListener('click', () => this.downloadRaceTrack());
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.updateStatus('Loading GPX file...');
        
        try {
            const text = await file.text();
            this.gpxData = this.parseGPX(text);
            
            if (this.gpxData && this.gpxData.length > 0) {
                const trackLength = this.calculateTrackLength(this.gpxData);
                this.updateStatus(`GPX loaded: ${trackLength.toFixed(2)} km <span class="point-count">(${this.gpxData.length} points)</span>`);
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
        
        const trackPoints = xmlDoc.getElementsByTagName('trkpt');
        const points = [];
        
        for (let i = 0; i < trackPoints.length; i++) {
            const point = trackPoints[i];
            const lat = parseFloat(point.getAttribute('lat'));
            const lon = parseFloat(point.getAttribute('lon'));
            
            const timeElement = point.getElementsByTagName('time')[0];
            let timestamp = null;
            
            if (timeElement) {
                timestamp = new Date(timeElement.textContent);
            }
            
            points.push({
                lat: lat,
                lon: lon,
                time: timestamp,
                index: i
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
        if (!navigator.geolocation) {
            this.updateStatus('Geolocation is not supported by this browser');
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
            document.getElementById('raceStatus').textContent = 'Race started!';
        }
        
        // Track position during race
        if (this.raceStarted) {
            this.raceTrack.push({
                lat: this.currentPosition.lat,
                lon: this.currentPosition.lon,
                timestamp: this.currentPosition.timestamp
            });
        }
        
        this.updateRaceDisplay(nearest);
    }
    
    updateRaceDisplay(nearest) {
        const currentTime = new Date();
        const elapsedTime = (currentTime - this.raceStartTime) / 1000;
        
        let referenceTime = 0;
        if (nearest.time && this.nearestPoint.time) {
            referenceTime = (nearest.time - this.nearestPoint.time) / 1000;
        } else {
            referenceTime = (nearest.index - this.nearestPoint.index) * 2; // Estimate 2 seconds per point
        }
        
        const timeDifference = elapsedTime - referenceTime;
        
        document.getElementById('timeDifference').textContent = this.formatTimeDifference(timeDifference);
        document.getElementById('distance').textContent = Math.round(nearest.distance) + ' m';
        document.getElementById('referenceTime').textContent = this.formatTime(referenceTime);
        document.getElementById('currentTime').textContent = this.formatTime(elapsedTime);
        
        if (timeDifference < 0) {
            document.getElementById('timeDifference').className = 'time-difference ahead';
            document.getElementById('raceStatus').textContent = `You're ${Math.abs(timeDifference).toFixed(1)}s ahead!`;
        } else {
            document.getElementById('timeDifference').className = 'time-difference behind';
            document.getElementById('raceStatus').textContent = `You're ${timeDifference.toFixed(1)}s behind`;
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