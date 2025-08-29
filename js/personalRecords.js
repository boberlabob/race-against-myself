export class PersonalRecords {
    constructor() {
        this.STORAGE_KEY = 'personalRecords';
        this.TRACK_STORAGE_KEY = 'trackPersonalRecords';
        this.records = this.loadRecords();
    }

    loadRecords() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {
                globalBests: {
                    fastestSpeed: null,
                    longestDistance: null,
                    bestAverageSpeed: null
                },
                trackRecords: {} // trackId -> { bestTime, bestAvgSpeed, attempts, lastImprovement }
            };
        } catch (error) {
            console.error('Error loading personal records:', error);
            return { globalBests: {}, trackRecords: {} };
        }
    }

    saveRecords() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.records));
        } catch (error) {
            console.error('Error saving personal records:', error);
        }
    }

    /**
     * Process a completed race and update records
     * @param {Object} raceData - Race completion data
     */
    processRaceResults(raceData) {
        const {
            trackId,
            trackName,
            totalTime,
            totalDistance,
            averageSpeed,
            maxSpeed,
            completedAt
        } = raceData;

        const improvements = [];

        // Update global records
        if (!this.records.globalBests.fastestSpeed || maxSpeed > this.records.globalBests.fastestSpeed.value) {
            this.records.globalBests.fastestSpeed = {
                value: maxSpeed,
                date: completedAt,
                trackName
            };
            improvements.push({
                type: 'globalBest',
                category: 'Höchstgeschwindigkeit',
                value: `${(maxSpeed * 3.6).toFixed(1)} km/h`,
                isNew: !this.records.globalBests.fastestSpeed
            });
        }

        if (!this.records.globalBests.bestAverageSpeed || averageSpeed > this.records.globalBests.bestAverageSpeed.value) {
            this.records.globalBests.bestAverageSpeed = {
                value: averageSpeed,
                date: completedAt,
                trackName,
                distance: totalDistance
            };
            improvements.push({
                type: 'globalBest', 
                category: 'Beste Durchschnittsgeschwindigkeit',
                value: `${(averageSpeed * 3.6).toFixed(1)} km/h`,
                isNew: !this.records.globalBests.bestAverageSpeed
            });
        }

        // Track-specific records
        if (!this.records.trackRecords[trackId]) {
            this.records.trackRecords[trackId] = {
                trackName,
                bestTime: null,
                bestAvgSpeed: null,
                attempts: 0,
                firstAttempt: completedAt,
                lastImprovement: null
            };
        }

        const trackRecord = this.records.trackRecords[trackId];
        trackRecord.attempts++;

        // Best time for this track
        if (!trackRecord.bestTime || totalTime < trackRecord.bestTime.value) {
            const oldTime = trackRecord.bestTime?.value;
            trackRecord.bestTime = {
                value: totalTime,
                date: completedAt,
                averageSpeed
            };
            trackRecord.lastImprovement = completedAt;

            improvements.push({
                type: 'trackRecord',
                category: 'Streckenrekord',
                trackName,
                value: this.formatTime(totalTime),
                improvement: oldTime ? this.formatTime(oldTime - totalTime) : null,
                isNew: !oldTime
            });
        }

        // Best average speed for this track  
        if (!trackRecord.bestAvgSpeed || averageSpeed > trackRecord.bestAvgSpeed.value) {
            const oldSpeed = trackRecord.bestAvgSpeed?.value;
            trackRecord.bestAvgSpeed = {
                value: averageSpeed,
                date: completedAt,
                totalTime
            };

            improvements.push({
                type: 'trackRecord',
                category: 'Beste Durchschnittsgeschwindigkeit',
                trackName,
                value: `${(averageSpeed * 3.6).toFixed(1)} km/h`,
                improvement: oldSpeed ? `+${((averageSpeed - oldSpeed) * 3.6).toFixed(1)} km/h` : null,
                isNew: !oldSpeed
            });
        }

        this.saveRecords();
        return improvements;
    }

    getTrackRecord(trackId) {
        return this.records.trackRecords[trackId] || null;
    }

    getAllTrackRecords() {
        return Object.values(this.records.trackRecords)
            .sort((a, b) => b.lastImprovement - a.lastImprovement);
    }

    getGlobalBests() {
        return this.records.globalBests;
    }

    /**
     * Get personal best time for a specific track (for ghost racing)
     */
    getPersonalBestTime(trackId) {
        const record = this.getTrackRecord(trackId);
        return record?.bestTime?.value || null;
    }

    /**
     * Check if current performance beats personal record
     */
    isNewPersonalRecord(trackId, currentTime) {
        const pbTime = this.getPersonalBestTime(trackId);
        return !pbTime || currentTime < pbTime;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get statistics for dashboard
     */
    getStatistics() {
        const trackRecords = Object.values(this.records.trackRecords);
        const totalAttempts = trackRecords.reduce((sum, record) => sum + record.attempts, 0);
        const tracksWithRecords = trackRecords.length;
        
        const recentImprovements = trackRecords
            .filter(record => record.lastImprovement)
            .sort((a, b) => new Date(b.lastImprovement) - new Date(a.lastImprovement))
            .slice(0, 5);

        return {
            totalAttempts,
            tracksWithRecords,
            recentImprovements,
            globalBests: this.records.globalBests
        };
    }

    /**
     * Export records for backup
     */
    exportRecords() {
        return {
            records: this.records,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import records from backup
     */
    importRecords(data) {
        if (data.version === '1.0' && data.records) {
            this.records = { ...this.records, ...data.records };
            this.saveRecords();
            return true;
        }
        return false;
    }
}