
export class MapView {
    constructor() {
        this.map = null;
        this.track = null;
        this.userMarker = null;
        this.ghostMarker = null;
        this.userInteracting = false;
        this.lastIsRacingState = false;
        this.initialFitDone = false;

        this.INITIAL_ZOOM = 13;
        this.MAX_ZOOM = 20;
        this.RACE_ZOOM = 17;
        this.INVALIDATE_SIZE_DELAY = 100;

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
        this.map = L.map('map', { zoomControl: false }).setView([51.505, -0.09], this.INITIAL_ZOOM);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: this.MAX_ZOOM
        }).addTo(this.map);

        this.map.on('movestart', () => { this.userInteracting = true; });
        this.map.on('zoomstart', () => { this.userInteracting = true; });
        this.map.on('moveend', () => { this.userInteracting = false; });
        this.map.on('zoomend', () => { this.userInteracting = false; });
    }

    render(state) {
        const { gpxData, userPosition, ghostPosition, isRacing } = state;

        const mapContainer = document.getElementById('map');
        if (!this.map) {
            this.init();
        }

        if (gpxData) {
            mapContainer.style.display = 'block';
            this.drawTrack(gpxData); // Draw track immediately
            
            setTimeout(() => {
                this.map.invalidateSize();

                // Handle zoom level based on race state
                if (!isRacing && !this.initialFitDone && this.track) {
                    // Pre-Race Phase (or initial load): fit entire track
                    this.map.fitBounds(this.track.getBounds());
                    this.initialFitDone = true;
                } else if (isRacing && !this.lastIsRacingState) {
                    // Transition from pre-race to race: zoom in on user
                    if (userPosition) {
                        this.map.setView([userPosition.lat, userPosition.lon], this.RACE_ZOOM); // Zoom in
                    }
                    this.initialFitDone = false; // Reset for next pre-race phase
                } else if (!isRacing && this.lastIsRacingState) {
                    // Transition from race to pre-race: fit entire track again
                    if (this.track) {
                        this.map.fitBounds(this.track.getBounds());
                    }
                    this.initialFitDone = true;
                }
            }, this.INVALIDATE_SIZE_DELAY); // Give map a moment to update size

            this.lastIsRacingState = isRacing;
        } else {
            // No GPX data, hide map and reset initialFitDone
            mapContainer.style.display = 'none';
            this.initialFitDone = false;
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
    }

    updateUserPosition(lat, lon, heading = 0) {
        const latlng = [lat, lon];
        if (!this.userMarker) {
            this.userMarker = L.marker(latlng, { icon: this.userIcon }).addTo(this.map);
        } else {
            this.userMarker.setLatLng(latlng);
        }
        if (this.userMarker._icon) {
            this.userMarker._icon.style.transform = `rotate(${heading}deg)`;
        }
        if (!this.userInteracting) {
            this.map.panTo(latlng, { animate: true, duration: 0.5 });
        }
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
