
export class Geolocation {
    // Enhanced options for Multi-GNSS and better urban performance
    static WATCH_OPTIONS = { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 500, // Fresher positions for cycling
        desiredAccuracy: 5, // Request high accuracy
        priority: 'PRIORITY_HIGH_ACCURACY'
    };
    static CURRENT_OPTIONS = { 
        enableHighAccuracy: true, 
        timeout: 20000, 
        maximumAge: 500,
        desiredAccuracy: 5,
        priority: 'PRIORITY_HIGH_ACCURACY'
    };

    static watchPosition(successCallback, errorCallback) {
        if (!navigator.geolocation) {
            errorCallback(new Error('Dein Browser unterstützt Geolocation nicht.'));
            return null;
        }
        return navigator.geolocation.watchPosition(
            successCallback, 
            errorCallback, 
            Geolocation.WATCH_OPTIONS
        );
    }

    static clearWatch(watchId) {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
    }

    static getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, Geolocation.CURRENT_OPTIONS);
        });
    }
}
