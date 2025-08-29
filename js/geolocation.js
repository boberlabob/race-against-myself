
export class Geolocation {
    static WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 };
    static CURRENT_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 };

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
