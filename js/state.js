
const SPEED_LIMITS = {
    walking: 20,
    cycling: 80,
    car: 160
};

const AHEAD_MESSAGES = [
    "Weiter so!", "Du fliegst ja!", "Bleib stark!", "Halt das Tempo!", "Sieht gut aus!",
    "Nicht nachlassen!", "Du machst das super!", "Halt die Führung!", "Perfekter Rhythmus!", "Bestienmodus!",
    "Mühelose Geschwindigkeit!", "Du bist in der Zone!", "Meisterst den Kurs!", "Setzt einen neuen Standard!",
    "Unaufhaltsam!", "Absolute Dominanz!", "Fehlerfreie Ausführung!", "Führst das Feld an!",
    "Sieht so einfach aus!", "Ein Tempo wie ein Champion!", "Übertrifft alle Erwartungen!",
    "Der Ghost verblasst!", "Lass sie hinter dir!", "Gibst das Tempo vor!",
    "Du bist eine Maschine!", "Unglaubliche Leistung!", "Halt den Schwung!",
    "Niemand kann dich stoppen!", "Das ist dein Moment des Ruhms!", "Absolut brillant!"
];

export class AppState {
    constructor() {
        this.state = {
            // Core race state
            gpxData: null,
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
            statusMessage: 'Wähle deinen Track und starte durch!',
            userPosition: null, // { lat, lon, heading }
            ghostPosition: null, // { lat, lon }
            timeDifference: 0,
            distanceDifference: 0,
            smoothedSpeed: 0,
            motivationMessage: '',
            finishMessage: null,
            raceHistory: [], // Initialize raceHistory as an empty array
            
            // Unified track management
            unifiedTracks: [],     // Processed tracks with proximity data
            savedTracks: [],       // Raw saved tracks (for compatibility)
            gpsStatus: 'loading',  // 'loading', 'available', 'denied', 'unavailable'
            gpsAccuracy: null,
            nearbyTracksCount: 0,  // Count of tracks within proximity

            speedLimits: SPEED_LIMITS,
            behindMessages: [
                "Du schaffst das!", "Kämpf weiter!", "Gib nicht auf!", "Hol auf!", "Du bist stärker!",
                "Nur ein kleiner Schub!", "Beiß die Zähne zusammen!", "Jeder Schritt zählt!", "Konzentrier dich neu!", "Atme tief durch!",
                "Du kommst wieder ran!", "Der Ghost ist schlagbar!", "Lass dich nicht abhängen!", "Finde deinen Rhythmus!",
                "Glaub an dich!", "Du hast mehr drauf!", "Zeig, was in dir steckt!", "Schalt einen Gang hoch!",
                "Es ist noch nicht vorbei!", "Blick nach vorn!", "Stell dir den Erfolg vor!", "Du bist dein eigener Gegner!",
                "Überwinde das Tief!", "Du bist zäh!", "Gib alles, was du hast!", "Schmerz ist vergänglich!",
                "Du bist eine Kämpfernatur!", "Beweise es dir selbst!", "Du kannst das Blatt wenden!", "Jede Sekunde zählt!"
            ],
            aheadMessages: AHEAD_MESSAGES
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
