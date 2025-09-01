/**
 * TrackProcessor - Smart Track Processing for Unified Display
 * Handles proximity calculation, sorting, and categorization
 */
export class TrackProcessor {
    
    static PROXIMITY_THRESHOLDS = {
        close: 100,    // < 100m
        near: 500,     // 100m - 500m  
        far: 1000      // 500m - 1000m
    };

    static PROXIMITY_ICONS = {
        close: '🎯',
        near: '📍',
        far: '🗺️',
        null: ''
    };

    /**
     * Process tracks for unified display with smart sorting
     * @param {Array} savedTracks - All saved tracks
     * @param {Object} currentPosition - Current GPS position {lat, lon}
     * @param {number} gpsAccuracy - Current GPS accuracy in meters
     * @returns {Array} Processed and sorted tracks
     */
    static processTracksForDisplay(savedTracks, currentPosition, gpsAccuracy = null) {
        if (!savedTracks || savedTracks.length === 0) {
            return [];
        }

        // Process each track with proximity data
        const processedTracks = savedTracks.map(track => {
            const unifiedTrack = {
                ...track,
                distance: null,
                isNearby: false,
                proximityLevel: null,
                proximityIcon: '',
                trackLength: track.trackLength || 0,
                lastUsed: track.lastUsed ? new Date(track.lastUsed) : null,
                transportationMode: track.transportationMode || 'cycling' // Fallback for legacy tracks
            };

            // Calculate proximity if GPS position is available
            if (currentPosition && track.gpxData && track.gpxData.length > 0) {
                const trackStart = track.gpxData[0];
                const distance = this.calculateDistance(
                    currentPosition.lat, currentPosition.lon,
                    trackStart.lat, trackStart.lon
                );

                unifiedTrack.distance = Math.round(distance);
                unifiedTrack.proximityLevel = this.categorizeByProximity(distance);
                unifiedTrack.isNearby = unifiedTrack.proximityLevel !== null;
                unifiedTrack.proximityIcon = this.PROXIMITY_ICONS[unifiedTrack.proximityLevel] || '';
            }

            return unifiedTrack;
        });

        // Sort tracks intelligently
        return this.sortTracks(processedTracks);
    }

    /**
     * Smart sorting algorithm for tracks
     * 1. Nearby tracks first (by proximity level, then distance)
     * 2. Non-nearby tracks by last used, then alphabetical
     */
    static sortTracks(tracks) {
        return tracks.sort((a, b) => {
            // 1. Nearby tracks first
            if (a.isNearby && !b.isNearby) return -1;
            if (!a.isNearby && b.isNearby) return 1;

            // 2. Within nearby tracks: sort by proximity level, then distance
            if (a.isNearby && b.isNearby) {
                const proximityOrder = { close: 1, near: 2, far: 3 };
                const aOrder = proximityOrder[a.proximityLevel] || 999;
                const bOrder = proximityOrder[b.proximityLevel] || 999;
                
                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }
                
                // Same proximity level: sort by distance
                return (a.distance || 0) - (b.distance || 0);
            }

            // 3. Non-nearby tracks: sort by last used, then alphabetical
            if (a.lastUsed && b.lastUsed) {
                return b.lastUsed.getTime() - a.lastUsed.getTime();
            }
            if (a.lastUsed && !b.lastUsed) return -1;
            if (!a.lastUsed && b.lastUsed) return 1;

            // Alphabetical fallback
            return (a.name || '').localeCompare(b.name || '');
        });
    }

    /**
     * Update track usage timestamp
     * @param {number} trackId - Track ID to update
     * @param {TrackStorage} trackStorage - Storage instance
     */
    static async updateTrackUsage(trackId, trackStorage) {
        try {
            return await trackStorage.updateTrackUsage(trackId);
        } catch (error) {
            console.error('Failed to update track usage:', error);
        }
    }

    /**
     * Categorize distance into proximity levels
     * @param {number} distance - Distance in meters
     * @returns {string|null} Proximity level or null if too far
     */
    static categorizeByProximity(distance) {
        if (distance < this.PROXIMITY_THRESHOLDS.close) return 'close';
        if (distance < this.PROXIMITY_THRESHOLDS.near) return 'near';
        if (distance < this.PROXIMITY_THRESHOLDS.far) return 'far';
        return null;
    }

    /**
     * Get nearby tracks count and summary
     * @param {Array} processedTracks - Processed track list
     * @returns {Object} Summary of nearby tracks
     */
    static getNearbyTracksSummary(processedTracks) {
        const nearbyTracks = processedTracks.filter(track => track.isNearby);
        
        const summary = {
            total: nearbyTracks.length,
            close: nearbyTracks.filter(t => t.proximityLevel === 'close').length,
            near: nearbyTracks.filter(t => t.proximityLevel === 'near').length,
            far: nearbyTracks.filter(t => t.proximityLevel === 'far').length
        };

        return summary;
    }

    /**
     * Format distance for display
     * @param {number} distance - Distance in meters
     * @returns {string} Formatted distance string
     */
    static formatDistance(distance) {
        if (distance < 1000) {
            return `${Math.round(distance)}m`;
        } else {
            return `${(distance / 1000).toFixed(1)}km`;
        }
    }

    /**
     * Format last used date for display
     * @param {Date} lastUsed - Last used date
     * @returns {string} Formatted date string
     */
    static formatLastUsed(lastUsed) {
        if (!lastUsed) return '';
        
        const now = new Date();
        const diffTime = Math.abs(now - lastUsed);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Heute';
        if (diffDays === 1) return 'Gestern';
        if (diffDays < 7) return `vor ${diffDays} Tagen`;
        if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
        return `vor ${Math.floor(diffDays / 30)} Monaten`;
    }

    /**
     * Calculate distance between two GPS points using Haversine formula
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lon1 - Longitude of point 1  
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lon2 - Longitude of point 2
     * @returns {number} Distance in meters
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
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

    /**
     * Migrate old track data to new format
     * @param {Array} oldTracks - Tracks in old format
     * @returns {Array} Tracks with new metadata
     */
    static migrateTrackData(oldTracks) {
        return oldTracks.map(track => ({
            ...track,
            lastUsed: track.lastUsed || null,
            trackLength: track.trackLength || this.calculateTrackLength(track.gpxData),
            createdAt: track.createdAt || track.savedAt || new Date()
        }));
    }

    /**
     * Calculate track length from GPX data
     * @param {Array} gpxData - GPX track points
     * @returns {number} Track length in kilometers
     */
    static calculateTrackLength(gpxData) {
        if (!gpxData || gpxData.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < gpxData.length; i++) {
            const prev = gpxData[i - 1];
            const curr = gpxData[i];
            totalDistance += this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        }
        
        return totalDistance / 1000; // Convert to km
    }
}