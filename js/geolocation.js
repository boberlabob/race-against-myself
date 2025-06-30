
export class Geolocation {
    static watchPosition(successCallback, errorCallback) {
        if (!navigator.geolocation) {
            errorCallback(new Error('Geolocation is not supported by this browser'));
            return null;
        }
        return navigator.geolocation.watchPosition(
            successCallback, 
            errorCallback, 
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }

    static clearWatch(watchId) {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
    }

    static getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }
}
