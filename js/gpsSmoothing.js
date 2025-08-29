export class GPSSmoothing {
    constructor() {
        this.positionBuffer = [];
        this.BUFFER_SIZE = 10;
        this.MAX_SPEED_MPS = 25; // 90 km/h max plausible speed
        this.MIN_ACCURACY = 100; // meters
        this.OUTLIER_THRESHOLD = 3; // standard deviations
    }

    /**
     * Smart GPS smoothing for cycling with outlier detection
     * @param {Object} position - GPS position with lat, lon, accuracy, speed
     * @returns {Object} - Smoothed position or null if rejected
     */
    smoothPosition(position) {
        // Basic validation
        if (!this.isValidPosition(position)) {
            console.warn('Invalid GPS position rejected:', position);
            return null;
        }

        // Check for outliers before adding to buffer
        if (this.positionBuffer.length > 2) {
            if (this.isOutlier(position)) {
                console.warn('GPS outlier rejected:', position);
                return null;
            }
        }

        // Add to buffer
        this.positionBuffer.push({
            ...position,
            timestamp: Date.now()
        });

        // Keep buffer size manageable
        if (this.positionBuffer.length > this.BUFFER_SIZE) {
            this.positionBuffer.shift();
        }

        // Need at least 3 points for smoothing
        if (this.positionBuffer.length < 3) {
            return position;
        }

        return this.calculateSmoothedPosition();
    }

    isValidPosition(position) {
        // Basic coordinate validation
        if (!position.lat || !position.lon) return false;
        if (Math.abs(position.lat) > 90 || Math.abs(position.lon) > 180) return false;
        
        // Accuracy check
        if (position.accuracy && position.accuracy > this.MIN_ACCURACY) return false;
        
        // Speed plausibility check
        if (position.speed && position.speed > this.MAX_SPEED_MPS) return false;
        
        return true;
    }

    isOutlier(newPosition) {
        if (this.positionBuffer.length < 3) return false;

        const recent = this.positionBuffer.slice(-3);
        const distances = recent.map(pos => 
            this.calculateDistance(newPosition.lat, newPosition.lon, pos.lat, pos.lon)
        );

        const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        const newDistance = Math.min(...distances);
        return newDistance > (mean + this.OUTLIER_THRESHOLD * stdDev);
    }

    calculateSmoothedPosition() {
        const recent = this.positionBuffer.slice(-5); // Use last 5 points
        const weights = this.calculateWeights(recent);
        
        let weightedLat = 0;
        let weightedLon = 0;
        let weightedSpeed = 0;
        let totalWeight = 0;

        recent.forEach((pos, index) => {
            const weight = weights[index];
            weightedLat += pos.lat * weight;
            weightedLon += pos.lon * weight;
            weightedSpeed += (pos.speed || 0) * weight;
            totalWeight += weight;
        });

        const latest = recent[recent.length - 1];
        return {
            lat: weightedLat / totalWeight,
            lon: weightedLon / totalWeight,
            speed: weightedSpeed / totalWeight,
            accuracy: latest.accuracy,
            timestamp: latest.timestamp,
            heading: this.calculateHeading(recent),
            smoothed: true
        };
    }

    calculateWeights(positions) {
        const now = Date.now();
        return positions.map(pos => {
            // Time-based weight (more recent = higher weight)
            const age = now - pos.timestamp;
            const timeWeight = Math.exp(-age / 10000); // 10 second decay

            // Accuracy-based weight (better accuracy = higher weight)
            const accuracyWeight = pos.accuracy ? 1 / Math.max(pos.accuracy, 1) : 1;

            return timeWeight * accuracyWeight;
        });
    }

    calculateHeading(positions) {
        if (positions.length < 2) return 0;

        const start = positions[positions.length - 2];
        const end = positions[positions.length - 1];

        const deltaLat = end.lat - start.lat;
        const deltaLon = end.lon - start.lon;

        let bearing = Math.atan2(deltaLon, deltaLat) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    reset() {
        this.positionBuffer = [];
    }
}