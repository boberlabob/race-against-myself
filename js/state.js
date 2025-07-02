
export class AppState {
    constructor() {
        this.state = {
            // Core race state
            gpxData: null,
            originalGpxData: null,
            isRacing: false,
            raceStartTime: null,
            nearestPoint: null,
            raceStarted: false,
            raceTrack: [],
            previousPosition: null,
            maxProgressIndex: -1,
            preRacePositions: [],
            finishDetected: false,
            finishDetectionTime: null,
            finishBufferPositions: [],
            speedMeasurements: [],
            transportationMode: 'cycling',

            // UI and view state
            statusMessage: 'Please select a GPX file to begin.',
            userPosition: null, // { lat, lon, heading }
            ghostPosition: null, // { lat, lon }
            timeDifference: 0,
            distanceDifference: 0,
            smoothedSpeed: 0,
            motivationMessage: '',
            finishMessage: null,
            savedTracks: [], // Initialize savedTracks as an empty array
            raceHistory: [], // Initialize raceHistory as an empty array

            speedLimits: {
                walking: 20,
                cycling: 80,
                car: 160
            },
            behindMessages: [
                "Push harder!", "You can do it!", "Catch up!", "Don't give up!", "Go, go, go!",
                "You're losing time!", "Speed up!", "The ghost is getting away!", "Focus!", "Dig deep!",
                "Find your rhythm!", "You're stronger than this!", "Close the gap!", "Stay determined!",
                "Every second counts!", "You've got more in you!", "Let's see some fire!", "Chase it down!",
                "Remember your goal!", "This is where it matters!", "No regrets!", "Unleash your power!",
                "It's now or never!", "Prove them wrong!", "You're a fighter!", "Keep your head up!",
                "Pain is temporary!", "Challenge yourself!", "Make a comeback!", "The race isn't over!"
            ],
            aheadMessages: [
                "Keep it up!", "You're flying!", "Stay strong!", "Maintain pace!", "Looking good!",
                "Don't slow down!", "You're crushing it!", "Hold the lead!", "Perfect rhythm!", "Beast mode!",
                "Effortless speed!", "You're in the zone!", "Mastering the course!", "Setting a new standard!",
                "Unstoppable force!", "Pure dominance!", "Flawless execution!", "Leading the way!",
                "Making it look easy!", "A true champion's pace!", "Beyond expectations!",
                "The ghost is fading!", "Leave them in the dust!", "Setting the pace!",
                "You're a machine!", "Incredible performance!", "Keep that momentum!",
                "No one can touch you!", "This is your moment of glory!", "Absolutely brilliant!"
            ]
        };
        this.subscribers = [];
    }

    // Method to update the state
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifySubscribers();
    }

    // Method to get the current state
    getState() {
        return this.state;
    }

    // Subscribe to state changes
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    // Notify all subscribers of a state change
    notifySubscribers() {
        for (const subscriber of this.subscribers) {
            subscriber(this.state);
        }
    }
}
