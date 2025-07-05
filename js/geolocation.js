
export class Geolocation {
    static WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    static CURRENT_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

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
