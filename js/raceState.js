
export class RaceState {
    constructor() {
        this.gpxData = null;
        this.originalGpxData = null;
        this.isRacing = false;
        this.raceStartTime = null;
        this.nearestPoint = null;
        this.raceStarted = false;
        this.raceTrack = [];
        this.previousPosition = null;
        this.maxProgressIndex = -1;
        this.preRacePositions = [];
        this.finishDetected = false;
        this.finishDetectionTime = null;
        this.finishBufferPositions = [];
        this.speedMeasurements = [];
        this.transportationMode = 'cycling';
        this.speedLimits = {
            walking: 20,
            cycling: 80,
            car: 160
        };
        this.behindMessages = [
            "Push harder!", "You're flying!", "Stay strong!", "Maintain pace!", "Looking good!",
            "Don't slow down!", "You're crushing it!", "Hold the lead!", "Perfect rhythm!", "Beast mode!",
            "Effortless speed!", "You're in the zone!", "Mastering the course!", "Setting a new standard!",
            "Unstoppable force!", "Pure dominance!", "Flawless execution!", "Leading the way!",
            "Making it look easy!", "A true champion's pace!", "Beyond expectations!",
            "The ghost is fading!", "Leave them in the dust!", "Setting the pace!",
            "You're a machine!", "Incredible performance!", "Keep that momentum!",
            "No one can touch you!", "This is your moment of glory!", "Absolutely brilliant!",
            "A masterclass in speed!", "You're in a league of your own!", "Phenomenal effort!",
            "The wind is at your back!", "Effortlessly fast!", "A true inspiration!",
            "Making history!", "The perfect run!", "Unrivaled speed!",
            "You're a legend in the making!", "Simply outstanding!", "Pure power!",
            "The gold standard!", "Breaking barriers!", "On top of the world!"
        ];
        this.aheadMessages = [
            "Keep it up!", "You're flying!", "Stay strong!", "Maintain pace!", "Looking good!",
            "Don't slow down!", "You're crushing it!", "Hold the lead!", "Perfect rhythm!", "Beast mode!",
            "Effortless speed!", "You're in the zone!", "Mastering the course!", "Setting a new standard!",
            "Unstoppable force!", "Pure dominance!", "Flawless execution!", "Leading the way!",
            "Making it look easy!", "A true champion's pace!", "Beyond expectations!",
            "The ghost is fading!", "Leave them in the dust!", "Setting the pace!",
            "You're a machine!", "Incredible performance!", "Keep that momentum!",
            "No one can touch you!", "This is your moment of glory!", "Absolutely brilliant!",
            "A masterclass in speed!", "You're in a league of your own!", "Phenomenal effort!",
            "The wind is at your back!", "Effortlessly fast!", "A true inspiration!",
            "Making history!", "The perfect run!", "Unrivaled speed!",
            "You're a legend in the making!", "Simply outstanding!", "Pure power!",
            "The gold standard!", "Breaking barriers!", "On top of the world!"
        ];
    }
}
