export class MapView {
    constructor() {
        this.map = null;
        this.track = null;
        this.userMarker = null;
        this.ghostMarker = null;

        // Custom icon for the user (arrow)
        this.userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div class="arrow-head"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        // Custom icon for the ghost (simple circle)
        this.ghostIcon = L.divIcon({
            className: 'ghost-marker',
            html: '<div class="ghost-circle"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    show() {
        document.getElementById('map').style.display = 'block';
        if (!this.map) {
            this.init();
        }
        // Invalidate size to ensure map renders correctly after being shown
        setTimeout(() => {
            if (this.map) this.map.invalidateSize();
        }, 100);
    }

    hide() {
        document.getElementById('map').style.display = 'none';
    }

    init() {
        this.map = L.map('map', { zoomControl: false }).setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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
        // Rotate the user marker
        if (this.userMarker._icon) {
            this.userMarker._icon.style.transform += ` rotate(${heading - 45}deg)`; // Adjust for arrow pointing up
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