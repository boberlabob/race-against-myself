
export class MapView {
    constructor() {
        this.map = null;
        this.track = null;
        this.userMarker = null;
        this.ghostMarker = null;
    }

    show() {
        document.getElementById('map').style.display = 'block';
        if (!this.map) {
            this.init();
        }
    }

    hide() {
        document.getElementById('map').style.display = 'none';
    }

    init() {
        this.map = L.map('map').setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
    }

    drawTrack(gpxData) {
        if (this.track) {
            this.map.removeLayer(this.track);
        }
        const latlngs = gpxData.map(p => [p.lat, p.lon]);
        this.track = L.polyline(latlngs, { color: '#e94560', weight: 5 }).addTo(this.map);
        this.map.fitBounds(this.track.getBounds());
    }

    updateUserPosition(lat, lon) {
        if (!this.userMarker) {
            this.userMarker = L.circleMarker([lat, lon], {
                radius: 8,
                fillColor: "#1f7a8c",
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(this.map);
        } else {
            this.userMarker.setLatLng([lat, lon]);
        }
        this.map.panTo([lat, lon]);
    }

    updateGhostPosition(lat, lon) {
        if (!this.ghostMarker) {
            this.ghostMarker = L.circleMarker([lat, lon], {
                radius: 6,
                fillColor: "#e94560",
                color: "#fff",
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
            }).addTo(this.map);
        } else {
            this.ghostMarker.setLatLng([lat, lon]);
        }
    }
}
