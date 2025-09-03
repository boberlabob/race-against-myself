export class TrackVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.trackPoints = [];
        this.userProgress = 0;
        this.ghostProgress = 0;
        this.trackName = '';
        this.trackDistance = 0;
        this.remainingDistance = 0;
        this.nextDirection = '';
        this.initialized = false;
    }

    init() {
        const container = document.getElementById('track-visualizer');
        if (!container) {
            console.error('Track visualizer container not found');
            return;
        }

        this.canvas = document.getElementById('trackCanvas');
        if (!this.canvas) {
            console.error('Track canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.initialized = true;
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match container
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = 40 * window.devicePixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = '40px';
        
        // Scale context for high DPI displays
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    render(state) {
        const { gpxData, maxProgressIndex, nearestPoint, isRacing, raceTrack } = state;

        console.log('🔄 TrackVisualizer render called with state:', {
            hasGpxData: !!gpxData,
            gpxLength: gpxData ? gpxData.length : 0,
            maxProgressIndex: maxProgressIndex,
            nearestPointIndex: nearestPoint ? nearestPoint.index : null,
            isRacing: isRacing
        });

        const container = document.getElementById('track-visualizer');
        if (!container) {
            console.error('❌ TrackVisualizer: Container not found');
            return;
        }

        if (!this.initialized) {
            console.log('🔧 TrackVisualizer: Initializing...');
            this.init();
        }

        if (gpxData && gpxData.length > 0) {
            console.log('📊 TrackVisualizer: Showing with', gpxData.length, 'track points');
            container.style.display = 'block';
            
            // Update track data
            this.trackPoints = gpxData;
            this.trackDistance = this.calculateTrackDistance(gpxData);
            
            // Use race system's progress tracking (same as ElevationView)
            const userIndex = maxProgressIndex >= 0 ? maxProgressIndex : null;
            const ghostIndex = this.calculateGhostIndex(state);
            
            console.log('📍 TrackVisualizer positions:', {
                userIndex: userIndex,
                ghostIndex: ghostIndex,
                nearestPointIndex: nearestPoint ? nearestPoint.index : 'null'
            });
            
            // Calculate progress percentages
            this.userProgress = userIndex !== null ? userIndex / (gpxData.length - 1) : null;
            this.ghostProgress = ghostIndex !== null ? ghostIndex / (gpxData.length - 1) : null;
            
            console.log('📈 Progress:', {
                userProgress: this.userProgress !== null ? (this.userProgress * 100).toFixed(1) + '%' : 'no position',
                ghostProgress: this.ghostProgress !== null ? (this.ghostProgress * 100).toFixed(1) + '%' : 'no position'
            });
            
            // Calculate remaining distance
            this.remainingDistance = userIndex !== null ? this.calculateRemainingDistance(userIndex, gpxData) : this.trackDistance;
            
            // Update display
            this.updateTrackInfo();
            this.drawProgressBar();
            
            // Resize canvas if needed
            setTimeout(() => this.setupCanvas(), 100);
        } else {
            container.style.display = 'none';
        }
    }


    calculateTrackDistance(gpxData) {
        if (!gpxData || gpxData.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < gpxData.length; i++) {
            totalDistance += this.calculateDistance(
                gpxData[i-1].lat, gpxData[i-1].lon,
                gpxData[i].lat, gpxData[i].lon
            );
        }
        
        return totalDistance / 1000; // Convert to km
    }

    calculateRemainingDistance(userIndex, gpxData) {
        if (!gpxData || userIndex >= gpxData.length - 1) return 0;
        
        let remaining = 0;
        for (let i = userIndex + 1; i < gpxData.length; i++) {
            remaining += this.calculateDistance(
                gpxData[i-1].lat, gpxData[i-1].lon,
                gpxData[i].lat, gpxData[i].lon
            );
        }
        
        return remaining / 1000; // Convert to km
    }

    calculateGhostIndex(state) {
        const { isRacing, raceStartTime, gpxData, nearestPoint } = state;
        
        if (!isRacing || !raceStartTime || !gpxData || gpxData.length === 0) {
            return null;
        }
        
        const elapsedTime = (new Date() - raceStartTime) / 1000;
        
        // Use same logic as race.js getGhostIndexByTime()
        if (elapsedTime <= 0) return nearestPoint?.index || 0;
        
        const startIndex = nearestPoint?.index || 0;
        const targetTimeMs = nearestPoint?.time ? 
            nearestPoint.time.getTime() + (elapsedTime * 1000) : 
            new Date(new Date().getTime() - elapsedTime * 1000);
        
        // Find the point closest to target time
        let bestIndex = startIndex;
        let bestTimeDiff = Infinity;
        
        for (let i = startIndex; i < gpxData.length; i++) {
            const point = gpxData[i];
            if (!point.time) continue;
            
            const timeDiff = Math.abs(point.time.getTime() - targetTimeMs.getTime());
            if (timeDiff < bestTimeDiff) {
                bestTimeDiff = timeDiff;
                bestIndex = i;
            } else if (timeDiff > bestTimeDiff) {
                break; // Times are getting worse, stop searching
            }
        }
        
        return bestIndex;
    }

    updateTrackInfo() {
        // Update track header
        const trackNameEl = document.querySelector('.track-name');
        const trackDistanceEl = document.querySelector('.track-distance');
        
        if (trackNameEl) {
            trackNameEl.textContent = this.trackName || 'Aktueller Track';
        }
        
        if (trackDistanceEl) {
            trackDistanceEl.textContent = `${this.trackDistance.toFixed(1)}km`;
        }
        
        // Update track info
        const remainingEl = document.querySelector('.remaining-distance');
        if (remainingEl) {
            remainingEl.textContent = `📍 Noch ${this.remainingDistance.toFixed(1)}km`;
        }
        
        // Update direction info (simplified for now)
        const directionEl = document.querySelector('.direction-info');
        if (directionEl) {
            if (this.userProgress !== null) {
                const progressPercent = Math.round(this.userProgress * 100);
                directionEl.textContent = `🏃 Fortschritt: ${progressPercent}%`;
            } else {
                directionEl.textContent = '🏃 Warte auf GPS...';
            }
        }
    }

    drawProgressBar() {
        if (!this.ctx || !this.canvas) {
            console.error('❌ TrackVisualizer: Canvas or context not available');
            return;
        }
        
        const width = this.canvas.width / window.devicePixelRatio;
        const height = 40;
        
        console.log('🎨 Drawing progress bar:', {
            width: width,
            userProgress: this.userProgress,
            ghostProgress: this.ghostProgress,
            trackDistance: this.trackDistance
        });
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Draw background track
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(10, 15, width - 20, 10);
        
        // Draw progress track (completed portion) only if user position is available
        if (this.userProgress !== null) {
            const progressWidth = (width - 20) * this.userProgress;
            this.ctx.fillStyle = '#1f7a8c';
            this.ctx.fillRect(10, 15, progressWidth, 10);
        }
        
        // Draw user marker only if position is available
        if (this.userProgress !== null) {
            const userX = 10 + (width - 20) * this.userProgress;
            this.ctx.fillStyle = '#e94560';
            this.ctx.beginPath();
            this.ctx.arc(userX, 20, 8, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Add white border to user marker
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        
        // Draw ghost marker if position available and different from user
        if (this.ghostProgress !== null && 
            (this.userProgress === null || Math.abs(this.ghostProgress - this.userProgress) > 0.01)) {
            const ghostX = 10 + (width - 20) * this.ghostProgress;
            this.ctx.fillStyle = '#95a5a6';
            this.ctx.beginPath();
            this.ctx.arc(ghostX, 20, 6, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Add border to ghost marker
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
        
        // Draw start and end markers
        this.ctx.fillStyle = '#27ae60';
        this.ctx.beginPath();
        this.ctx.arc(10, 20, 4, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(width - 10, 20, 4, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    setTrackName(name) {
        this.trackName = name;
    }
}