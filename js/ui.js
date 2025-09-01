export class UI {
    constructor() {
        // this.elements = {}; // Initialize as empty object
    }

    RACE_HISTORY_DISPLAY_LIMIT = 5;
    FINISH_SCREEN_COUNTDOWN = 10;

    MODE_ICONS = { walking: '🚶', cycling: '🚴', car: '🚗' };

    initializeElements() {
        this.elements = {
            gpxFile: document.getElementById('gpxFile'),
            startRace: document.getElementById('startRace'),
            stopRace: document.getElementById('stopRace'),
            downloadRace: document.getElementById('downloadRace'),
            walkingMode: document.getElementById('walkingMode'),
            cyclingMode: document.getElementById('cyclingMode'),
            carMode: document.getElementById('carMode'),
            status: document.getElementById('status'),
            racingDisplay: document.getElementById('racingDisplay'),
            timeDifference: document.getElementById('timeDifference'),
            raceStatus: document.getElementById('raceStatus'),
            modeIndicator: document.getElementById('modeIndicator'),
            distanceDifference: document.getElementById('distanceDifference'),
            speed: document.getElementById('speed'),
            uploadSection: document.querySelector('.upload-section'),
            unifiedTracksContainer: document.getElementById('unifiedTracksContainer'),
            unifiedTracksList: document.getElementById('unifiedTracksList'),
            nearbyTracksIndicator: document.getElementById('nearbyTracksIndicator'),
            raceHistoryContainer: document.getElementById('raceHistoryContainer'),
            raceHistoryList: document.getElementById('raceHistoryList'),
            muteAudio: document.getElementById('muteAudio'),
            fullscreenToggle: document.getElementById('fullscreenToggle')
        };
    }

    bindEventListeners(onFileUpload, onStartRace, onStopRace, onDownloadRace, onTransportationModeSelected, onLoadTrack, onDeleteTrack, onFinishScreenDismissed, onMuteToggle) {
        this.elements.gpxFile.addEventListener('change', (e) => {
            console.log('GPX File selected:', e.target.files[0]);
            onFileUpload(e.target.files[0]);
        });
        this.elements.startRace.addEventListener('click', onStartRace);
        this.elements.stopRace.addEventListener('click', onStopRace);
        this.elements.downloadRace.addEventListener('click', onDownloadRace);
        this.elements.walkingMode.addEventListener('click', () => onTransportationModeSelected('walking'));
        this.elements.cyclingMode.addEventListener('click', () => onTransportationModeSelected('cycling'));
        this.elements.carMode.addEventListener('click', () => onTransportationModeSelected('car'));
        this.elements.muteAudio.addEventListener('change', (e) => onMuteToggle(e.target.checked));
        this.elements.fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());

        // Handle fullscreen changes - comprehensive Android support
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());
        
        // Additional Android/mobile events
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateFullscreenButton(), 100);
        });
        window.addEventListener('resize', () => {
            setTimeout(() => this.updateFullscreenButton(), 100);
        });

        this.elements.unifiedTracksList.addEventListener('click', (e) => {
            if (e.target.classList.contains('load-track-btn') || e.target.classList.contains('quick-load-btn')) {
                onLoadTrack(parseInt(e.target.dataset.id));
            }
            if (e.target.classList.contains('track-options-btn')) {
                this.showTrackOptions(e.target, onLoadTrack, onDeleteTrack);
            }
            if (e.target.classList.contains('delete-track-btn')) {
                onDeleteTrack(parseInt(e.target.dataset.id));
            }
        });

        this.onFinishScreenDismissed = onFinishScreenDismissed;
    }

    render(state) {
        const { 
            isRacing, gpxData, statusMessage, timeDifference, distanceDifference, 
            smoothedSpeed, motivationMessage, transportationMode, raceTrack, raceHistory,
            unifiedTracks, nearbyTracksCount, gpsStatus, gpsAccuracy 
        } = state;

        // Status message
        this.elements.status.innerHTML = statusMessage;

        // Button visibility
        this.elements.startRace.style.display = !isRacing && gpxData ? 'block' : 'none';
        this.elements.stopRace.style.display = isRacing ? 'block' : 'none';
        this.elements.downloadRace.style.display = !isRacing && raceTrack && raceTrack.length > 0 ? 'block' : 'none';

        // Section visibility
        this.elements.uploadSection.style.display = isRacing ? 'none' : 'block';
        this.elements.racingDisplay.style.display = isRacing ? 'block' : 'none';
        this.elements.raceHistoryContainer.style.display = isRacing ? 'none' : 'block';
        this.elements.unifiedTracksContainer.style.display = isRacing ? 'none' : 'block';

        // Racing data
        if (isRacing) {
            this.elements.timeDifference.textContent = this.formatTimeDifference(timeDifference);
            // Vereinfachte Anzeigen für bessere Lesbarkeit beim Fahren
            this.elements.distanceDifference.textContent = `${distanceDifference >= 0 ? '+' : ''}${Math.round(distanceDifference)}`;
            this.elements.speed.textContent = Math.round(smoothedSpeed).toString();
            this.elements.raceStatus.textContent = motivationMessage;
            this.elements.timeDifference.className = `time-difference ${timeDifference < 0 ? 'ahead' : 'behind'}`;
        }

        // Transportation mode
        document.querySelectorAll('.mode-button').forEach(button => {
            button.classList.toggle('active', button.dataset.mode === transportationMode);
        });
        const modeIcons = this.MODE_ICONS;
        if (this.elements.modeIndicator) {
            this.elements.modeIndicator.textContent = modeIcons[transportationMode];
        }

        // Race History
        this.renderRaceHistory(raceHistory);

        // Unified Tracks (combines nearby and saved tracks)
        this.renderUnifiedTracks(unifiedTracks, nearbyTracksCount, gpsStatus);

        // Finish Screen
        if (state.finishMessage) {
            this.showFinishScreen(state.finishMessage);
        }
    }

    renderRaceHistory(history) {
        if (!history || history.length === 0) {
            this.elements.raceHistoryContainer.style.display = 'none';
            return;
        }
        this.elements.raceHistoryList.innerHTML = '';
        history.slice(0, this.RACE_HISTORY_DISPLAY_LIMIT).forEach(race => {
            const raceEntry = document.createElement('div');
            raceEntry.className = 'race-entry';
            const modeIcons = this.MODE_ICONS;
            const modeEmoji = modeIcons[race.transportationMode] || '';
            raceEntry.innerHTML = `
                <div class="race-mode">${modeEmoji}</div>
                <div class="race-date">${new Date(race.date).toLocaleString()}</div>
                <div class="race-time">${this.formatTime(race.totalTime)}</div>
                <div class="race-difference ${race.timeDifference < 0 ? 'schneller' : 'langsamer'}">${race.timeDifference < 0 ? '-' : '+'}${Math.abs(race.timeDifference).toFixed(1)}s</div>
            `;
            this.elements.raceHistoryList.appendChild(raceEntry);
        });
        this.elements.raceHistoryContainer.style.display = 'block';
    }

    showFinishScreen(message) {
        let finishScreen = document.getElementById('finishScreen');
        if (!finishScreen) {
            finishScreen = document.createElement('div');
            finishScreen.id = 'finishScreen';
            finishScreen.className = 'finish-screen';
            document.body.appendChild(finishScreen);
        }
        finishScreen.innerHTML = `
            <div class="finish-content">
                <h2>🏁 Rennen beendet!</h2>
                <p>${message}</p>
                <div class="finish-timer">Zurück zum Start in <span id="finishTimer">10</span> Sekunden...</div>
            </div>
        `;
        finishScreen.style.display = 'flex';
        let countdown = this.FINISH_SCREEN_COUNTDOWN;
        const timer = setInterval(() => {
            countdown--;
            const timerElement = document.getElementById('finishTimer');
            if (timerElement) {
                timerElement.textContent = countdown;
            }
            if (countdown <= 0) {
                clearInterval(timer);
                finishScreen.style.display = 'none';
                if (this.onFinishScreenDismissed) {
                    this.onFinishScreenDismissed();
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatTimeDifference(seconds) {
        const sign = seconds < 0 ? '-' : '+';
        const absSeconds = Math.ceil(Math.abs(seconds));
        return sign + this.formatTime(absSeconds);
    }

    toggleFullscreen() {
        const isFullscreen = this.isInFullscreen();
        if (!isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    isInFullscreen() {
        return !!(document.fullscreenElement || 
                  document.webkitFullscreenElement || 
                  document.mozFullScreenElement || 
                  document.msFullscreenElement ||
                  document.webkitIsFullScreen);
    }

    async enterFullscreen() {
        const element = document.documentElement;
        try {
            // Try modern API first
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            }
            // Android Chrome/Brave fallback
            else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
            // Android older webkit
            else if (element.webkitRequestFullScreen) {
                element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            }
            // Firefox
            else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            }
            // IE/Edge
            else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            else {
                console.warn('Fullscreen API not supported on this device');
                // Fallback: hide address bar on mobile
                if (window.innerHeight < window.outerHeight) {
                    window.scrollTo(0, 1);
                }
            }
        } catch (error) {
            console.error('Fullscreen request failed:', error);
            // Try webkit without keyboard input flag
            if (element.webkitRequestFullscreen) {
                try {
                    element.webkitRequestFullscreen();
                } catch (e2) {
                    console.error('Webkit fallback also failed:', e2);
                }
            }
        }
    }

    async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } catch (error) {
            console.error('Exit fullscreen failed:', error);
        }
    }

    updateFullscreenButton() {
        const isFullscreen = this.isInFullscreen();
        
        const button = this.elements.fullscreenToggle;
        if (isFullscreen) {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>`;
            button.title = "Vollbild beenden";
        } else {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>`;
            button.title = "Vollbild aktivieren";
        }
    }

    // --- Unified Track Rendering ---

    renderUnifiedTracks(unifiedTracks, nearbyTracksCount, gpsStatus) {
        if (!this.elements.unifiedTracksList) return;
        
        // Update header with nearby count
        if (this.elements.nearbyTracksIndicator) {
            if (nearbyTracksCount > 0) {
                this.elements.nearbyTracksIndicator.textContent = `${nearbyTracksCount} in der Nähe`;
            } else if (gpsStatus === 'available') {
                this.elements.nearbyTracksIndicator.textContent = 'Keine in der Nähe';
            } else {
                this.elements.nearbyTracksIndicator.textContent = '';
            }
        }
        
        // Clear existing tracks
        this.elements.unifiedTracksList.innerHTML = '';
        
        if (!unifiedTracks || unifiedTracks.length === 0) {
            this.showEmptyTracksState(gpsStatus);
            return;
        }
        
        // Render each track
        unifiedTracks.forEach(track => {
            const trackEntry = this.createUnifiedTrackEntry(track);
            this.elements.unifiedTracksList.appendChild(trackEntry);
        });
    }

    createUnifiedTrackEntry(track) {
        const trackEntry = document.createElement('div');
        trackEntry.className = 'unified-track-entry';
        
        if (track.proximityLevel) {
            trackEntry.setAttribute('data-proximity', track.proximityLevel);
        }
        
        // Build metadata string
        const metadata = [];
        if (track.isNearby && track.distance) {
            metadata.push(`<span class="track-distance">${this.formatDistance(track.distance)} entfernt</span>`);
        }
        if (track.trackLength) {
            metadata.push(`<span class="track-length">${track.trackLength.toFixed(1)}km</span>`);
        }
        if (track.lastUsed) {
            const lastUsedText = this.formatLastUsed(track.lastUsed);
            if (lastUsedText) {
                metadata.push(`<span class="track-last-used">Zuletzt: ${lastUsedText}</span>`);
            }
        }
        
        trackEntry.innerHTML = `
            <div class="track-proximity-indicator">${track.proximityIcon || ''}</div>
            <div class="track-main-info">
                <div class="track-name">${track.name}</div>
                <div class="track-metadata">
                    ${metadata.join('')}
                </div>
            </div>
            <div class="track-actions">
                <button class="quick-load-btn" data-id="${track.id}" title="Track laden">
                    🚀
                </button>
                <button class="track-options-btn" data-id="${track.id}" title="Weitere Optionen">
                    ⋯
                </button>
            </div>
        `;
        
        return trackEntry;
    }

    showEmptyTracksState(gpsStatus) {
        let message = '';
        let actionButton = '';
        
        switch (gpsStatus) {
            case 'loading':
                message = '🛰️ Suche Tracks in deiner Nähe...';
                break;
            case 'denied':
                message = '🚫 Standort nicht verfügbar<br><small>Alle gespeicherten Tracks werden angezeigt</small>';
                break;
            case 'unavailable':
                message = '📍 GPS nicht verfügbar<br><small>Alle gespeicherten Tracks werden angezeigt</small>';
                break;
            default:
                message = '📍 Keine Tracks gespeichert';
                actionButton = '<button class="upload-first-track" onclick="document.getElementById(\'gpxFile\').click()">Ersten Track hochladen</button>';
                break;
        }
        
        this.elements.unifiedTracksList.innerHTML = `
            <div class="tracks-empty-state">
                <p>${message}</p>
                ${actionButton}
            </div>
        `;
    }

    // --- Utility Methods for Unified Tracks ---
    
    formatDistance(distance) {
        if (distance < 1000) {
            return `${Math.round(distance)}m`;
        } else {
            return `${(distance / 1000).toFixed(1)}km`;
        }
    }
    
    formatLastUsed(lastUsed) {
        if (!lastUsed) return '';
        
        const now = new Date();
        const diffTime = Math.abs(now - new Date(lastUsed));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Heute';
        if (diffDays === 1) return 'Gestern';
        if (diffDays < 7) return `vor ${diffDays} Tagen`;
        if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
        return `vor ${Math.floor(diffDays / 30)} Monaten`;
    }
    
    showTrackOptions(button, onLoadTrack, onDeleteTrack) {
        const trackId = parseInt(button.dataset.id);
        
        // Simple context menu using confirm dialogs for now
        // Future enhancement: proper dropdown menu
        const action = confirm('Track löschen? (OK = Löschen, Abbrechen = Laden)');
        
        if (action) {
            onDeleteTrack(trackId);
        } else {
            onLoadTrack(trackId);
        }
    }

    calculateTrackLength(gpxData) {
        if (!gpxData || gpxData.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < gpxData.length; i++) {
            const prev = gpxData[i - 1];
            const curr = gpxData[i];
            totalDistance += this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        }
        
        return totalDistance / 1000; // Convert to km
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
}