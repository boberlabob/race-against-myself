export class StreakCounter {
    constructor() {
        this.STORAGE_KEY = 'commuteStreaks';
        this.streakData = this.loadStreakData();
    }

    loadStreakData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {
                currentStreak: 0,
                longestStreak: 0,
                lastRaceDate: null,
                totalRaceDays: 0,
                weeklyStreaks: {},
                monthlyStats: {},
                streakHistory: [] // for charts
            };
        } catch (error) {
            console.error('Error loading streak data:', error);
            return this.getDefaultStreakData();
        }
    }

    getDefaultStreakData() {
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastRaceDate: null,
            totalRaceDays: 0,
            weeklyStreaks: {},
            monthlyStats: {},
            streakHistory: []
        };
    }

    saveStreakData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.streakData));
        } catch (error) {
            console.error('Error saving streak data:', error);
        }
    }

    /**
     * Update streak based on new race completion
     * @param {string} raceDate - ISO date string of completed race
     */
    updateStreak(raceDate) {
        const today = new Date(raceDate);
        const todayStr = this.getDateString(today);
        const lastRaceDate = this.streakData.lastRaceDate ? 
            new Date(this.streakData.lastRaceDate) : null;

        // If this is the first race today
        if (!lastRaceDate || this.getDateString(lastRaceDate) !== todayStr) {
            const daysSinceLastRace = lastRaceDate ? 
                Math.floor((today - lastRaceDate) / (1000 * 60 * 60 * 24)) : 0;

            if (!lastRaceDate || daysSinceLastRace === 1) {
                // Continue or start streak
                this.streakData.currentStreak++;
            } else if (daysSinceLastRace > 1) {
                // Streak broken, start new one
                this.addToHistory(this.streakData.currentStreak);
                this.streakData.currentStreak = 1;
            }
            // Same day = no change to streak

            this.streakData.lastRaceDate = raceDate;
            this.streakData.totalRaceDays++;

            // Update longest streak if needed
            if (this.streakData.currentStreak > this.streakData.longestStreak) {
                this.streakData.longestStreak = this.streakData.currentStreak;
            }

            // Update weekly and monthly stats
            this.updateWeeklyStats(today);
            this.updateMonthlyStats(today);

            this.saveStreakData();
        }

        return this.getStreakInfo();
    }

    addToHistory(streakLength) {
        if (streakLength > 0) {
            this.streakData.streakHistory.push({
                length: streakLength,
                endDate: this.streakData.lastRaceDate
            });
            
            // Keep only last 50 streaks for performance
            if (this.streakData.streakHistory.length > 50) {
                this.streakData.streakHistory = this.streakData.streakHistory.slice(-50);
            }
        }
    }

    updateWeeklyStats(date) {
        const weekKey = this.getWeekKey(date);
        if (!this.streakData.weeklyStreaks[weekKey]) {
            this.streakData.weeklyStreaks[weekKey] = {
                days: new Set(),
                races: 0
            };
        }
        
        const dayStr = this.getDateString(date);
        this.streakData.weeklyStreaks[weekKey].days.add(dayStr);
        this.streakData.weeklyStreaks[weekKey].races++;
        
        // Convert Set to Array for storage
        this.streakData.weeklyStreaks[weekKey].daysArray = 
            Array.from(this.streakData.weeklyStreaks[weekKey].days);
        delete this.streakData.weeklyStreaks[weekKey].days;
    }

    updateMonthlyStats(date) {
        const monthKey = this.getMonthKey(date);
        if (!this.streakData.monthlyStats[monthKey]) {
            this.streakData.monthlyStats[monthKey] = {
                days: new Set(),
                races: 0,
                longestStreakInMonth: 0
            };
        }

        const dayStr = this.getDateString(date);
        this.streakData.monthlyStats[monthKey].days.add(dayStr);
        this.streakData.monthlyStats[monthKey].races++;

        // Track longest streak in this month
        if (this.streakData.currentStreak > this.streakData.monthlyStats[monthKey].longestStreakInMonth) {
            this.streakData.monthlyStats[monthKey].longestStreakInMonth = this.streakData.currentStreak;
        }

        // Convert Set to Array for storage
        this.streakData.monthlyStats[monthKey].daysArray = 
            Array.from(this.streakData.monthlyStats[monthKey].days);
        delete this.streakData.monthlyStats[monthKey].days;
    }

    /**
     * Get current streak information
     */
    getStreakInfo() {
        const lastRaceDate = this.streakData.lastRaceDate ? 
            new Date(this.streakData.lastRaceDate) : null;
        
        let status = 'none';
        let daysWithoutRace = 0;
        
        if (lastRaceDate) {
            const today = new Date();
            daysWithoutRace = Math.floor((today - lastRaceDate) / (1000 * 60 * 60 * 24));
            
            if (daysWithoutRace === 0) {
                status = 'active'; // Raced today
            } else if (daysWithoutRace === 1) {
                status = 'at-risk'; // One day break
            } else {
                status = 'broken'; // Streak is broken
            }
        }

        return {
            currentStreak: this.streakData.currentStreak,
            longestStreak: this.streakData.longestStreak,
            totalRaceDays: this.streakData.totalRaceDays,
            status,
            daysWithoutRace,
            lastRaceDate: this.streakData.lastRaceDate,
            streakMessage: this.getStreakMessage(status)
        };
    }

    getStreakMessage(status) {
        const streak = this.streakData.currentStreak;
        
        switch (status) {
            case 'active':
                return `🔥 ${streak} Tage Streak! Du rockst!`;
            case 'at-risk':
                return `⚠️ ${streak} Tage Streak in Gefahr! Heute fahren?`;
            case 'broken':
                return `💔 Streak unterbrochen. Zeit für einen neuen Start!`;
            default:
                return `🚴‍♂️ Bereit für deinen ersten Streak?`;
        }
    }

    /**
     * Get weekly statistics
     */
    getWeeklyStats() {
        const currentWeek = this.getWeekKey(new Date());
        const weekData = this.streakData.weeklyStreaks[currentWeek];
        
        return {
            currentWeek: {
                daysRaced: weekData ? weekData.daysArray?.length || 0 : 0,
                totalRaces: weekData ? weekData.races || 0 : 0,
                completionRate: weekData ? (weekData.daysArray?.length || 0) / 7 * 100 : 0
            },
            recentWeeks: this.getRecentWeeks(4)
        };
    }

    getRecentWeeks(count) {
        const weeks = [];
        const today = new Date();
        
        for (let i = 0; i < count; i++) {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - (today.getDay() + 7 * i));
            const weekKey = this.getWeekKey(weekStart);
            const weekData = this.streakData.weeklyStreaks[weekKey];
            
            weeks.push({
                week: weekKey,
                daysRaced: weekData ? weekData.daysArray?.length || 0 : 0,
                totalRaces: weekData ? weekData.races || 0 : 0
            });
        }
        
        return weeks;
    }

    /**
     * Get monthly statistics  
     */
    getMonthlyStats() {
        const currentMonth = this.getMonthKey(new Date());
        const monthData = this.streakData.monthlyStats[currentMonth];
        
        return {
            currentMonth: {
                daysRaced: monthData ? monthData.daysArray?.length || 0 : 0,
                totalRaces: monthData ? monthData.races || 0 : 0,
                longestStreak: monthData ? monthData.longestStreakInMonth || 0 : 0
            },
            recentMonths: this.getRecentMonths(6)
        };
    }

    getRecentMonths(count) {
        const months = [];
        const today = new Date();
        
        for (let i = 0; i < count; i++) {
            const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = this.getMonthKey(monthDate);
            const monthData = this.streakData.monthlyStats[monthKey];
            
            months.push({
                month: monthKey,
                daysRaced: monthData ? monthData.daysArray?.length || 0 : 0,
                totalRaces: monthData ? monthData.races || 0 : 0,
                longestStreak: monthData ? monthData.longestStreakInMonth || 0 : 0
            });
        }
        
        return months;
    }

    /**
     * Check for streak milestones (for achievements)
     */
    checkMilestones() {
        const milestones = [];
        const streak = this.streakData.currentStreak;
        
        // Define milestone thresholds
        const thresholds = [7, 14, 30, 50, 100, 365];
        
        thresholds.forEach(threshold => {
            if (streak === threshold) {
                milestones.push({
                    type: 'streak',
                    days: threshold,
                    message: this.getMilestoneMessage(threshold),
                    icon: this.getMilestoneIcon(threshold)
                });
            }
        });
        
        return milestones;
    }

    getMilestoneMessage(days) {
        if (days === 7) return '🎉 Eine Woche Streak! Du bist dabei!';
        if (days === 14) return '💪 Zwei Wochen Streak! Starke Leistung!';
        if (days === 30) return '🏆 30 Tage Streak! Du bist ein Champion!';
        if (days === 50) return '🔥 50 Tage Streak! Unglaubliche Ausdauer!';
        if (days === 100) return '🚀 100 Tage Streak! Du bist eine Legende!';
        if (days === 365) return '👑 365 Tage Streak! Du bist der König/die Königin der Straße!';
        return `🎯 ${days} Tage Streak erreicht!`;
    }

    getMilestoneIcon(days) {
        if (days === 7) return '🎉';
        if (days === 14) return '💪';
        if (days === 30) return '🏆';
        if (days === 50) return '🔥';
        if (days === 100) return '🚀';
        if (days === 365) return '👑';
        return '🎯';
    }

    // Utility methods
    getDateString(date) {
        return date.toISOString().split('T')[0];
    }

    getWeekKey(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    }

    getMonthKey(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    }

    /**
     * Reset all streak data (for testing or user preference)
     */
    resetStreaks() {
        this.streakData = this.getDefaultStreakData();
        this.saveStreakData();
    }
}