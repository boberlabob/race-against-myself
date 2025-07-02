
export class MapView {
    constructor() {
        this.map = null;
        this.track = null;
        this.userMarker = null;
        this.ghostMarker = null;

        this.userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div class="arrow-head"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.ghostIcon = L.divIcon({
            className: 'ghost-marker',
            html: '<div class="ghost-circle"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    init() {
        this.map = L.map('map', { zoomControl: false }).setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
    }

    render(state) {
        const { gpxData, userPosition, ghostPosition, isRacing } = state;

        const mapContainer = document.getElementById('map');
        if (!this.map) {
            this.init();
        }

        if (gpxData && mapContainer.style.display !== 'block') {
            mapContainer.style.display = 'block';
            setTimeout(() => this.map.invalidateSize(), 100);
        } else if (!gpxData && mapContainer.style.display !== 'none') {
            mapContainer.style.display = 'none';
        }

        if (gpxData) {
            this.drawTrack(gpxData);
        }

        if (userPosition) {
            this.updateUserPosition(userPosition.lat, userPosition.lon, userPosition.heading);
        }

        if (ghostPosition) {
            this.updateGhostPosition(ghostPosition.lat, ghostPosition.lon);
        } else if (this.ghostMarker) {
            this.map.removeLayer(this.ghostMarker);
            this.ghostMarker = null;
        }
    }

    drawTrack(gpxData) {
        if (this.track) {
            this.map.removeLayer(this.track);
        }
        const latlngs = gpxData.map(p => [p.lat, p.lon]);
        this.track = L.polyline(latlngs, { color: '#e94560', weight: 5, opacity: 0.7 }).addTo(this.map);
        this.map.fitBounds(this.track.getBounds());
    }

    updateUserPosition(lat, lon, heading = 0) {
        const latlng = [lat, lon];
        if (!this.userMarker) {
            this.userMarker = L.marker(latlng, { icon: this.userIcon }).addTo(this.map);
        } else {
            this.userMarker.setLatLng(latlng);
        }
        if (this.userMarker._icon) {
            this.userMarker._icon.style.transform += ` rotate(${heading - 45}deg)`;
        }
        this.map.panTo(latlng, { animate: true, duration: 0.5 });
    }

    updateGhostPosition(lat, lon) {
        const latlng = [lat, lon];
        if (!this.ghostMarker) {
            this.ghostMarker = L.marker(latlng, { icon: this.ghostIcon }).addTo(this.map);
        } else {
            this.ghostMarker.setLatLng(latlng);
        }
    }
}
