export class Heatmaps {
    constructor() {
        this.STORAGE_KEY = 'commuteHeatmaps';
        this.heatmapData = this.loadHeatmapData();
    }

    loadHeatmapData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {
                timeHeatmap: {}, // Hour of day -> count
                dayHeatmap: {},  // Day of week -> count  
                routeHeatmap: [], // GPS coordinates with frequency
                monthlyActivity: {}, // Month -> activity data
                weatherPatterns: {}, // Weather -> performance correlations
                performanceHeatmap: {} // Time/day -> average performance
            };
        } catch (error) {
            console.error('Error loading heatmap data:', error);
            return this.getDefaultHeatmapData();
        }
    }

    getDefaultHeatmapData() {
        return {
            timeHeatmap: {},
            dayHeatmap: {},
            routeHeatmap: [],
            monthlyActivity: {},
            weatherPatterns: {},
            performanceHeatmap: {}
        };
    }

    saveHeatmapData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.heatmapData));
        } catch (error) {
            console.error('Error saving heatmap data:', error);
        }
    }

    /**
     * Add race data to heatmap
     * @param {Object} raceData - Completed race data
     */
    addRaceData(raceData) {
        const raceDate = new Date(raceData.completedAt);
        const hour = raceDate.getHours();
        const dayOfWeek = raceDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const monthKey = this.getMonthKey(raceDate);

        // Time of day heatmap
        this.heatmapData.timeHeatmap[hour] = (this.heatmapData.timeHeatmap[hour] || 0) + 1;

        // Day of week heatmap
        this.heatmapData.dayHeatmap[dayOfWeek] = (this.heatmapData.dayHeatmap[dayOfWeek] || 0) + 1;

        // Monthly activity
        if (!this.heatmapData.monthlyActivity[monthKey]) {
            this.heatmapData.monthlyActivity[monthKey] = {
                races: 0,
                totalTime: 0,
                totalDistance: 0,
                avgSpeed: 0,
                bestTime: null
            };
        }
        
        const monthData = this.heatmapData.monthlyActivity[monthKey];
        monthData.races++;
        monthData.totalTime += raceData.totalTime;
        monthData.totalDistance += raceData.totalDistance;
        monthData.avgSpeed = (monthData.avgSpeed * (monthData.races - 1) + raceData.averageSpeed) / monthData.races;
        
        if (!monthData.bestTime || raceData.totalTime < monthData.bestTime) {
            monthData.bestTime = raceData.totalTime;
        }

        // Performance heatmap (hour + day combination)
        const timeSlotKey = `${dayOfWeek}_${hour}`;
        if (!this.heatmapData.performanceHeatmap[timeSlotKey]) {
            this.heatmapData.performanceHeatmap[timeSlotKey] = {
                count: 0,
                totalTime: 0,
                bestTime: null,
                avgSpeed: 0
            };
        }
        
        const perfData = this.heatmapData.performanceHeatmap[timeSlotKey];
        perfData.count++;
        perfData.totalTime += raceData.totalTime;
        perfData.avgSpeed = (perfData.avgSpeed * (perfData.count - 1) + raceData.averageSpeed) / perfData.count;
        
        if (!perfData.bestTime || raceData.totalTime < perfData.bestTime) {
            perfData.bestTime = raceData.totalTime;
        }

        // Route heatmap (if GPS track data is available)
        if (raceData.gpsTrack && raceData.gpsTrack.length > 0) {
            this.addRouteData(raceData.gpsTrack);
        }

        this.saveHeatmapData();
    }

    addRouteData(gpsTrack) {
        // Downsample GPS track for heatmap (every 10th point to reduce data)
        const sampledTrack = gpsTrack.filter((_, index) => index % 10 === 0);
        
        sampledTrack.forEach(point => {
            // Round coordinates to create grid cells (about 10m resolution)
            const lat = Math.round(point.lat * 10000) / 10000;
            const lon = Math.round(point.lon * 10000) / 10000;
            const key = `${lat}_${lon}`;
            
            const existingPoint = this.heatmapData.routeHeatmap.find(p => p.key === key);
            if (existingPoint) {
                existingPoint.count++;
                existingPoint.totalSpeed += point.speed || 0;
                existingPoint.avgSpeed = existingPoint.totalSpeed / existingPoint.count;
            } else {
                this.heatmapData.routeHeatmap.push({
                    key,
                    lat,
                    lon,
                    count: 1,
                    totalSpeed: point.speed || 0,
                    avgSpeed: point.speed || 0
                });
            }
        });

        // Limit route heatmap size for performance
        if (this.heatmapData.routeHeatmap.length > 10000) {
            // Keep only points with count > 1
            this.heatmapData.routeHeatmap = this.heatmapData.routeHeatmap.filter(p => p.count > 1);
        }
    }

    /**
     * Get time of day heatmap data for visualization
     */
    getTimeHeatmap() {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const data = hours.map(hour => ({
            hour,
            count: this.heatmapData.timeHeatmap[hour] || 0,
            percentage: 0
        }));

        const total = Object.values(this.heatmapData.timeHeatmap).reduce((sum, count) => sum + count, 0);
        data.forEach(item => {
            item.percentage = total > 0 ? (item.count / total * 100) : 0;
        });

        return {
            data,
            peakHour: this.getPeakHour(),
            insights: this.getTimeInsights()
        };
    }

    getPeakHour() {
        let maxCount = 0;
        let peakHour = 0;
        
        Object.entries(this.heatmapData.timeHeatmap).forEach(([hour, count]) => {
            if (count > maxCount) {
                maxCount = count;
                peakHour = parseInt(hour);
            }
        });

        return {
            hour: peakHour,
            count: maxCount,
            label: this.getHourLabel(peakHour)
        };
    }

    getHourLabel(hour) {
        if (hour >= 6 && hour <= 9) return 'Morgen-Pendler';
        if (hour >= 17 && hour <= 19) return 'Abend-Pendler';
        if (hour >= 12 && hour <= 14) return 'Mittagsfahrer';
        if (hour >= 20 && hour <= 22) return 'Abend-Sportler';
        if (hour >= 5 && hour <= 6) return 'Früher Vogel';
        return 'Nacht-Fahrer';
    }

    /**
     * Get day of week heatmap
     */
    getDayHeatmap() {
        const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const data = dayNames.map((name, index) => ({
            day: index,
            name,
            count: this.heatmapData.dayHeatmap[index] || 0,
            percentage: 0,
            isWeekday: index >= 1 && index <= 5
        }));

        const total = Object.values(this.heatmapData.dayHeatmap).reduce((sum, count) => sum + count, 0);
        data.forEach(item => {
            item.percentage = total > 0 ? (item.count / total * 100) : 0;
        });

        return {
            data,
            weekdayTotal: data.filter(d => d.isWeekday).reduce((sum, d) => sum + d.count, 0),
            weekendTotal: data.filter(d => !d.isWeekday).reduce((sum, d) => sum + d.count, 0),
            insights: this.getDayInsights(data)
        };
    }

    getDayInsights(data) {
        const insights = [];
        const weekdayAvg = data.filter(d => d.isWeekday).reduce((sum, d) => sum + d.count, 0) / 5;
        const weekendAvg = data.filter(d => !d.isWeekday).reduce((sum, d) => sum + d.count, 0) / 2;

        if (weekdayAvg > weekendAvg * 2) {
            insights.push('Du bist ein klassischer Pendler - hauptsächlich unter der Woche unterwegs');
        } else if (weekendAvg > weekdayAvg) {
            insights.push('Weekend Warrior! Du fährst lieber am Wochenende');
        }

        const favoriteDay = data.reduce((max, day) => day.count > max.count ? day : max);
        if (favoriteDay.count > 0) {
            insights.push(`Dein Lieblingstag: ${favoriteDay.name}`);
        }

        return insights;
    }

    /**
     * Get performance heatmap (best times by day/hour combination)
     */
    getPerformanceHeatmap() {
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const heatmapGrid = [];

        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const key = `${day}_${hour}`;
                const perfData = this.heatmapData.performanceHeatmap[key];
                
                heatmapGrid.push({
                    day,
                    hour,
                    dayName: dayNames[day],
                    count: perfData ? perfData.count : 0,
                    avgTime: perfData ? perfData.totalTime / perfData.count : 0,
                    bestTime: perfData ? perfData.bestTime : null,
                    avgSpeed: perfData ? perfData.avgSpeed : 0,
                    intensity: perfData ? Math.min(perfData.count / 5, 1) : 0 // 0-1 scale
                });
            }
        }

        return {
            grid: heatmapGrid,
            insights: this.getPerformanceInsights(heatmapGrid)
        };
    }

    getPerformanceInsights(grid) {
        const insights = [];
        const activeSlots = grid.filter(slot => slot.count > 0);
        
        if (activeSlots.length === 0) return ['Noch keine Daten für Performance-Analyse'];

        // Find best performance time
        const bestSlot = activeSlots.reduce((best, slot) => 
            slot.bestTime && (!best.bestTime || slot.bestTime < best.bestTime) ? slot : best
        );

        if (bestSlot.bestTime) {
            insights.push(`Beste Performance: ${bestSlot.dayName} um ${bestSlot.hour}:00 Uhr`);
        }

        // Find most active time
        const mostActive = activeSlots.reduce((max, slot) => slot.count > max.count ? slot : max);
        insights.push(`Aktivste Zeit: ${mostActive.dayName} um ${mostActive.hour}:00 Uhr (${mostActive.count}x)`);

        return insights;
    }

    /**
     * Get monthly activity trends
     */
    getMonthlyTrends() {
        const months = Object.keys(this.heatmapData.monthlyActivity).sort();
        const trendData = months.map(month => ({
            month,
            ...this.heatmapData.monthlyActivity[month],
            avgTimePerRace: this.heatmapData.monthlyActivity[month].totalTime / 
                          this.heatmapData.monthlyActivity[month].races
        }));

        return {
            data: trendData,
            insights: this.getMonthlyInsights(trendData)
        };
    }

    getMonthlyInsights(data) {
        const insights = [];
        if (data.length === 0) return ['Noch keine monatlichen Daten verfügbar'];

        const latest = data[data.length - 1];
        const previous = data.length > 1 ? data[data.length - 2] : null;

        if (previous) {
            const raceChange = latest.races - previous.races;
            const speedChange = latest.avgSpeed - previous.avgSpeed;
            
            if (raceChange > 0) {
                insights.push(`📈 ${raceChange} mehr Fahrten als letzten Monat`);
            }
            
            if (speedChange > 0.5) {
                insights.push(`⚡ Durchschnittsgeschwindigkeit um ${(speedChange * 3.6).toFixed(1)} km/h gestiegen`);
            }
        }

        const mostActiveMonth = data.reduce((max, month) => month.races > max.races ? month : max);
        insights.push(`Aktivster Monat: ${mostActiveMonth.month} mit ${mostActiveMonth.races} Fahrten`);

        return insights;
    }

    /**
     * Get route heatmap data for map visualization
     */
    getRouteHeatmap() {
        return {
            points: this.heatmapData.routeHeatmap.slice(0, 5000), // Limit for performance
            totalPoints: this.heatmapData.routeHeatmap.length,
            insights: this.getRouteInsights()
        };
    }

    getRouteInsights() {
        const insights = [];
        const points = this.heatmapData.routeHeatmap;
        
        if (points.length === 0) return ['Noch keine Routendaten verfügbar'];

        const totalFrequency = points.reduce((sum, p) => sum + p.count, 0);
        const hottestSpot = points.reduce((max, p) => p.count > max.count ? p : max);
        
        insights.push(`${points.length} verschiedene GPS-Punkte erfasst`);
        insights.push(`Häufigster Punkt: ${hottestSpot.count} mal befahren`);
        
        const highFreqPoints = points.filter(p => p.count > 5).length;
        if (highFreqPoints > 0) {
            insights.push(`${highFreqPoints} "Stammrouten"-Punkte identifiziert`);
        }

        return insights;
    }

    // Utility methods
    getMonthKey(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    /**
     * Export heatmap data for analysis
     */
    exportHeatmapData() {
        return {
            ...this.heatmapData,
            exportedAt: new Date().toISOString(),
            statistics: this.getOverallStatistics()
        };
    }

    getOverallStatistics() {
        const totalRaces = Object.values(this.heatmapData.timeHeatmap).reduce((sum, count) => sum + count, 0);
        const uniqueHours = Object.keys(this.heatmapData.timeHeatmap).length;
        const uniqueDays = Object.keys(this.heatmapData.dayHeatmap).length;
        const routePoints = this.heatmapData.routeHeatmap.length;

        return {
            totalRaces,
            uniqueHours,
            uniqueDays,
            routePoints,
            monthsTracked: Object.keys(this.heatmapData.monthlyActivity).length
        };
    }

    /**
     * Clear all heatmap data
     */
    clearHeatmapData() {
        this.heatmapData = this.getDefaultHeatmapData();
        this.saveHeatmapData();
    }
}