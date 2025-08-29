export class ChallengeModes {
    constructor(personalRecords) {
        this.personalRecords = personalRecords;
        this.STORAGE_KEY = 'activeChallenges';
        this.activeChallenges = this.loadChallenges();
        this.challengeTemplates = this.initializeChallengeTemplates();
    }

    initializeChallengeTemplates() {
        return {
            // Perfect for daily commuting
            beatPersonalBest: {
                id: 'beat-pb',
                name: 'Persönlicher Rekord',
                description: 'Unterbiete deine beste Zeit um mindestens 5 Sekunden',
                icon: '🏆',
                difficulty: 'medium',
                category: 'speed',
                generate: (trackId, records) => {
                    const pbTime = records.getPersonalBestTime(trackId);
                    if (!pbTime) return null;
                    return {
                        targetTime: pbTime - 5,
                        currentPB: pbTime,
                        reward: 'PR Champion Badge'
                    };
                }
            },

            consistencyStreak: {
                id: 'consistency',
                name: 'Konstanz Challenge',
                description: 'Halte 5 Fahrten in Folge deine Zeit unter +30 Sekunden vom Rekord',
                icon: '🎯',
                difficulty: 'hard',
                category: 'consistency',
                generate: (trackId, records) => {
                    const pbTime = records.getPersonalBestTime(trackId);
                    if (!pbTime) return null;
                    return {
                        targetTime: pbTime + 30,
                        streakNeeded: 5,
                        currentStreak: 0,
                        reward: 'Consistency Master Badge'
                    };
                }
            },

            speedDemon: {
                id: 'speed-demon',
                name: 'Speed Dämon',
                description: 'Erreiche eine Höchstgeschwindigkeit von 45+ km/h',
                icon: '⚡',
                difficulty: 'medium',
                category: 'speed',
                generate: () => ({
                    targetSpeed: 12.5, // 45 km/h in m/s
                    reward: 'Speed Demon Badge'
                })
            },

            earlyBird: {
                id: 'early-bird',
                name: 'Früher Vogel',
                description: 'Fahre 3 mal vor 7:00 Uhr morgens',
                icon: '🌅',
                difficulty: 'easy',
                category: 'timing',
                generate: () => ({
                    targetHour: 7,
                    ridesNeeded: 3,
                    currentRides: 0,
                    reward: 'Early Bird Badge'
                })
            },

            weekendWarrior: {
                id: 'weekend-warrior',
                name: 'Wochenend Krieger',
                description: 'Fahre sowohl Samstag als auch Sonntag',
                icon: '🏃‍♂️',
                difficulty: 'easy',
                category: 'frequency',
                generate: () => ({
                    needsSaturday: true,
                    needsSunday: true,
                    hasSaturday: false,
                    hasSunday: false,
                    reward: 'Weekend Warrior Badge'
                })
            },

            improveByPercent: {
                id: 'improve-percent',
                name: '5% Verbesserung',
                description: 'Verbessere deine Zeit um mindestens 5%',
                icon: '📈',
                difficulty: 'hard',
                category: 'improvement',
                generate: (trackId, records) => {
                    const pbTime = records.getPersonalBestTime(trackId);
                    if (!pbTime) return null;
                    return {
                        targetTime: pbTime * 0.95,
                        currentPB: pbTime,
                        improvementPercent: 5,
                        reward: '5% Improvement Badge'
                    };
                }
            }
        };
    }

    loadChallenges() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading challenges:', error);
            return {};
        }
    }

    saveChallenges() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.activeChallenges));
        } catch (error) {
            console.error('Error saving challenges:', error);
        }
    }

    /**
     * Generate appropriate challenges for a track
     */
    generateChallengesForTrack(trackId, trackName) {
        const suggestions = [];
        const records = this.personalRecords;

        Object.values(this.challengeTemplates).forEach(template => {
            const challenge = template.generate(trackId, records);
            if (challenge) {
                suggestions.push({
                    ...template,
                    trackId,
                    trackName,
                    ...challenge,
                    createdAt: new Date().toISOString(),
                    expiresAt: this.calculateExpiration(template.difficulty)
                });
            }
        });

        return suggestions;
    }

    calculateExpiration(difficulty) {
        const now = new Date();
        const daysToAdd = difficulty === 'easy' ? 7 : difficulty === 'medium' ? 14 : 30;
        now.setDate(now.getDate() + daysToAdd);
        return now.toISOString();
    }

    /**
     * Accept a challenge
     */
    acceptChallenge(challenge) {
        const challengeId = `${challenge.trackId}_${challenge.id}_${Date.now()}`;
        this.activeChallenges[challengeId] = {
            ...challenge,
            acceptedAt: new Date().toISOString(),
            progress: {},
            completed: false,
            active: true
        };
        this.saveChallenges();
        return challengeId;
    }

    /**
     * Process race results against active challenges
     */
    processRaceResults(raceData) {
        const completedChallenges = [];
        const progressUpdates = [];

        Object.entries(this.activeChallenges).forEach(([challengeId, challenge]) => {
            if (!challenge.active || challenge.completed) return;
            if (challenge.trackId !== raceData.trackId) return;

            const result = this.checkChallengeCompletion(challenge, raceData);
            
            if (result.completed) {
                challenge.completed = true;
                challenge.completedAt = new Date().toISOString();
                challenge.active = false;
                completedChallenges.push({
                    ...challenge,
                    achievedValue: result.achievedValue
                });
            } else if (result.progress) {
                challenge.progress = { ...challenge.progress, ...result.progress };
                progressUpdates.push({
                    challengeId,
                    name: challenge.name,
                    progress: result.progress
                });
            }
        });

        this.saveChallenges();
        return { completedChallenges, progressUpdates };
    }

    checkChallengeCompletion(challenge, raceData) {
        switch (challenge.id) {
            case 'beat-pb':
                return {
                    completed: raceData.totalTime < challenge.targetTime,
                    achievedValue: raceData.totalTime
                };

            case 'consistency':
                const withinTarget = raceData.totalTime <= challenge.targetTime;
                const newStreak = withinTarget ? (challenge.progress.currentStreak || 0) + 1 : 0;
                return {
                    completed: newStreak >= challenge.streakNeeded,
                    progress: { currentStreak: newStreak }
                };

            case 'speed-demon':
                return {
                    completed: raceData.maxSpeed >= challenge.targetSpeed,
                    achievedValue: raceData.maxSpeed
                };

            case 'early-bird':
                const raceHour = new Date(raceData.completedAt).getHours();
                const isEarlyRide = raceHour < challenge.targetHour;
                const currentRides = (challenge.progress.currentRides || 0) + (isEarlyRide ? 1 : 0);
                return {
                    completed: currentRides >= challenge.ridesNeeded,
                    progress: { currentRides }
                };

            case 'weekend-warrior':
                const raceDay = new Date(raceData.completedAt).getDay();
                const progress = challenge.progress || {};
                if (raceDay === 6) progress.hasSaturday = true; // Saturday
                if (raceDay === 0) progress.hasSunday = true;   // Sunday
                return {
                    completed: progress.hasSaturday && progress.hasSunday,
                    progress
                };

            case 'improve-percent':
                return {
                    completed: raceData.totalTime <= challenge.targetTime,
                    achievedValue: raceData.totalTime,
                    improvementPercent: ((challenge.currentPB - raceData.totalTime) / challenge.currentPB) * 100
                };

            default:
                return { completed: false };
        }
    }

    /**
     * Get active challenges for a track
     */
    getActiveChallengesForTrack(trackId) {
        return Object.values(this.activeChallenges).filter(
            challenge => challenge.trackId === trackId && challenge.active && !challenge.completed
        );
    }

    /**
     * Get all active challenges
     */
    getAllActiveChallenges() {
        return Object.values(this.activeChallenges).filter(
            challenge => challenge.active && !challenge.completed
        );
    }

    /**
     * Get completed challenges (for achievements display)
     */
    getCompletedChallenges() {
        return Object.values(this.activeChallenges)
            .filter(challenge => challenge.completed)
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    }

    /**
     * Clean up expired challenges
     */
    cleanupExpiredChallenges() {
        const now = new Date();
        let cleaned = 0;

        Object.entries(this.activeChallenges).forEach(([challengeId, challenge]) => {
            if (challenge.expiresAt && new Date(challenge.expiresAt) < now && !challenge.completed) {
                delete this.activeChallenges[challengeId];
                cleaned++;
            }
        });

        if (cleaned > 0) {
            this.saveChallenges();
        }

        return cleaned;
    }

    /**
     * Get challenge statistics for dashboard
     */
    getStatistics() {
        const all = Object.values(this.activeChallenges);
        const completed = all.filter(c => c.completed);
        const active = all.filter(c => c.active && !c.completed);
        
        const completionRate = all.length > 0 ? (completed.length / all.length) * 100 : 0;
        
        const badgesByDifficulty = completed.reduce((acc, challenge) => {
            acc[challenge.difficulty] = (acc[challenge.difficulty] || 0) + 1;
            return acc;
        }, {});

        return {
            totalChallenges: all.length,
            completedChallenges: completed.length,
            activeChallenges: active.length,
            completionRate: completionRate.toFixed(1),
            badgesByDifficulty,
            recentCompletions: completed.slice(0, 5)
        };
    }
}