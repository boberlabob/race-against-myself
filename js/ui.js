import { DOMUtils } from './utils/domUtils.js';

export class UI {
    constructor() {
        // this.elements = {}; // Initialize as empty object
    }

    RACE_HISTORY_DISPLAY_LIMIT = 5;
    FINISH_SCREEN_COUNTDOWN = 10;

    MODE_ICONS = { walking: '🚶', cycling: '🚴', car: '🚗' };

    initializeElements() {
        console.log('🔍 Initializing UI elements...');
        
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
            fullscreenToggle: document.getElementById('fullscreenToggle'),
            gpsStatusFooter: document.getElementById('gpsStatusFooter'),
            gpsStatusText: document.getElementById('gpsStatusText')
        };

        // Check for missing critical elements
        const criticalElements = ['unifiedTracksContainer', 'unifiedTracksList', 'uploadSection'];
        const missingElements = [];
        
        for (const key of criticalElements) {
            if (!this.elements[key]) {
                missingElements.push(key);
                console.error(`❌ Critical element missing: ${key}`);
            } else {
                console.log(`✅ Found element: ${key}`, this.elements[key]);
            }
        }
        
        if (missingElements.length > 0) {
            console.error('💥 Missing critical UI elements:', missingElements);
            console.log('🔍 Available elements in DOM:');
            console.log('- unifiedTracksContainer:', document.getElementById('unifiedTracksContainer'));
            console.log('- unifiedTracksList:', document.getElementById('unifiedTracksList'));
            console.log('- upload-section:', document.querySelector('.upload-section'));
        } else {
            console.log('✅ All critical UI elements found');
        }
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

        // Primary event handler for unified tracks
        if (this.elements.unifiedTracksList) {
            this.elements.unifiedTracksList.addEventListener('click', (e) => {
                console.log('Unified tracks click:', e.target.classList, e.target.dataset.id);
                
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
        } else {
            console.error('unifiedTracksList element not found during initialization!');
        }
        
        // Backup event handler on container (event delegation)
        if (this.elements.unifiedTracksContainer) {
            this.elements.unifiedTracksContainer.addEventListener('click', (e) => {
                console.log('Container click:', e.target.classList, e.target.dataset.id);
                
                if (e.target.classList.contains('load-track-btn') || e.target.classList.contains('quick-load-btn')) {
                    console.log('Loading track via container:', e.target.dataset.id);
                    onLoadTrack(parseInt(e.target.dataset.id));
                }
                if (e.target.classList.contains('track-options-btn')) {
                    this.showTrackOptions(e.target, onLoadTrack, onDeleteTrack);
                }
            });
        }

        this.onFinishScreenDismissed = onFinishScreenDismissed;
    }

    render(state) {
        const { 
            isRacing, gpxData, statusMessage, timeDifference, distanceDifference, 
            smoothedSpeed, motivationMessage, transportationMode, raceTrack, raceHistory,
            unifiedTracks, nearbyTracksCount, gpsStatus, gpsAccuracy 
        } = state;

        // Status message (safe text content)
        this.elements.status.textContent = statusMessage;

        // Button visibility
        this.elements.startRace.style.display = !isRacing && gpxData ? 'block' : 'none';
        this.elements.stopRace.style.display = isRacing ? 'block' : 'none';
        this.elements.downloadRace.style.display = !isRacing && raceTrack && raceTrack.length > 0 ? 'block' : 'none';

        // Section visibility
        this.elements.uploadSection.style.display = isRacing ? 'none' : 'block';
        this.elements.racingDisplay.style.display = isRacing ? 'block' : 'none';
        this.elements.raceHistoryContainer.style.display = isRacing ? 'none' : 'block';
        // Hide tracks list when racing OR when a track is loaded (including pre-run phase)
        this.elements.unifiedTracksContainer.style.display = (isRacing || gpxData) ? 'none' : 'block';
        this.elements.gpsStatusFooter.style.display = isRacing ? 'none' : 'block';

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
            // Hide mode indicator during races to save space
            this.elements.modeIndicator.style.display = isRacing ? 'none' : 'block';
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
            
            // NEW: Track name display with fallback for legacy races
            const trackDisplay = race.trackName ? `<span class="track-name">${race.trackName}</span> - ` : '';
            const dateStr = new Date(race.date).toLocaleDateString('de-DE');
            const timeStr = new Date(race.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const distance = race.trackLength ? `${race.trackLength.toFixed(1)}km` : '';
            const distanceDisplay = distance ? ` - ${distance}` : '';
            
            const raceSummaryDiv = DOMUtils.createElement('div', { class: 'race-summary' });
            const trackName = race.trackName ? `${race.trackName} - ` : '';
            const summaryText = `${modeEmoji} ${trackName}${dateStr}, ${timeStr}${distanceDisplay} in ${this.formatTime(race.totalTime)}`;
            raceSummaryDiv.textContent = summaryText;
            
            const raceDifferenceDiv = DOMUtils.createElement('div', { 
                class: `race-difference ${race.timeDifference < 0 ? 'schneller' : 'langsamer'}` 
            });
            raceDifferenceDiv.textContent = `${race.timeDifference < 0 ? '-' : '+'}${Math.abs(race.timeDifference).toFixed(1)}s`;
            
            raceEntry.appendChild(raceSummaryDiv);
            raceEntry.appendChild(raceDifferenceDiv);
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
        DOMUtils.clearContent(finishScreen);
        
        const finishContent = DOMUtils.createElement('div', { class: 'finish-content' });
        const title = DOMUtils.createElement('h2', {}, '🏁 Rennen beendet!');
        const messageP = DOMUtils.createElement('p', {}, message);
        
        const timerDiv = DOMUtils.createElement('div', { class: 'finish-timer' });
        timerDiv.appendChild(DOMUtils.createTextNode('Zurück zum Start in '));
        const timerSpan = DOMUtils.createElement('span', { id: 'finishTimer' }, '10');
        timerDiv.appendChild(timerSpan);
        timerDiv.appendChild(DOMUtils.createTextNode(' Sekunden...'));
        
        finishContent.appendChild(title);
        finishContent.appendChild(messageP);
        finishContent.appendChild(timerDiv);
        finishScreen.appendChild(finishContent);
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
        console.log('🎨 renderUnifiedTracks called');
        console.log('📊 Tracks to render:', unifiedTracks?.length || 0);
        console.log('📊 Nearby count:', nearbyTracksCount);
        console.log('📊 GPS status:', gpsStatus);
        console.log('🔍 Element check:', {
            container: !!this.elements.unifiedTracksContainer,
            list: !!this.elements.unifiedTracksList,
            indicator: !!this.elements.nearbyTracksIndicator
        });
        
        if (!this.elements.unifiedTracksList) {
            console.error('❌ unifiedTracksList element not found!');
            console.log('🔍 DOM check:', document.getElementById('unifiedTracksList'));
            return;
        }
        
        if (!this.elements.unifiedTracksContainer) {
            console.error('❌ unifiedTracksContainer element not found!');
            console.log('🔍 DOM check:', document.getElementById('unifiedTracksContainer'));
            return;
        }
        
        // Make sure container is visible
        if (this.elements.unifiedTracksContainer.style.display === 'none') {
            console.log('⚠️ Container was hidden, making it visible');
            this.elements.unifiedTracksContainer.style.display = 'block';
        }
        
        console.log('✅ Elements validated, proceeding with render');
        
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
            console.log('No unified tracks to render, showing empty state');
            this.showEmptyTracksState(gpsStatus);
            this.updateUploadSectionVisibility(0);  // Make upload prominent when no tracks
            return;
        }
        
        console.log(`Rendering ${unifiedTracks.length} tracks`);
        // Render each track
        unifiedTracks.forEach(track => {
            const trackEntry = this.createUnifiedTrackEntry(track);
            this.elements.unifiedTracksList.appendChild(trackEntry);
        });
        
        // Update upload section visibility based on track count
        this.updateUploadSectionVisibility(unifiedTracks.length);
    }

    createUnifiedTrackEntry(track) {
        const trackEntry = document.createElement('div');
        trackEntry.className = 'unified-track-entry';
        
        if (track.proximityLevel) {
            trackEntry.setAttribute('data-proximity', track.proximityLevel);
        }
        
        // Build metadata string
        const metadata = [];
        
        // Add transportation mode indicator
        if (track.transportationMode) {
            const modeIcon = this.MODE_ICONS[track.transportationMode] || '🚴';
            metadata.push(`<span class="track-transport-mode">${modeIcon}</span>`);
        }
        
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
        
        // Create track entry safely
        DOMUtils.clearContent(trackEntry);
        
        const proximityIndicator = DOMUtils.createElement('div', { 
            class: 'track-proximity-indicator' 
        }, track.proximityIcon || '');
        
        const mainInfo = DOMUtils.createElement('div', { class: 'track-main-info' });
        const trackNameDiv = DOMUtils.createElement('div', { class: 'track-name' }, track.name);
        const metadataDiv = DOMUtils.createElement('div', { class: 'track-metadata' });
        
        // Add metadata safely (metadata is already HTML escaped above)
        metadataDiv.innerHTML = metadata.join('');
        
        const actions = DOMUtils.createElement('div', { class: 'track-actions' });
        const quickLoadBtn = DOMUtils.createButton('🚀', null, {
            class: 'quick-load-btn',
            'data-id': track.id,
            title: 'Track laden'
        });
        const optionsBtn = DOMUtils.createButton('⋯', null, {
            class: 'track-options-btn',
            'data-id': track.id,
            title: 'Weitere Optionen'
        });
        
        mainInfo.appendChild(trackNameDiv);
        mainInfo.appendChild(metadataDiv);
        actions.appendChild(quickLoadBtn);
        actions.appendChild(optionsBtn);
        
        trackEntry.appendChild(proximityIndicator);
        trackEntry.appendChild(mainInfo);
        trackEntry.appendChild(actions);
        
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

    // --- GPS Status Management ---

    updateGpsStatus(message, status = 'loading') {
        if (this.elements.gpsStatusText) {
            this.elements.gpsStatusText.textContent = message;
        }
        
        if (this.elements.gpsStatusFooter) {
            this.elements.gpsStatusFooter.setAttribute('data-status', status);
        }
    }

    // --- Progressive Disclosure Logic ---

    updateUploadSectionVisibility(trackCount) {
        if (!this.elements.uploadSection) return;
        
        const uploadSection = this.elements.uploadSection;
        const uploadHint = uploadSection.querySelector('.upload-hint');
        
        if (trackCount === 0) {
            // No tracks: Make upload prominent with hint
            uploadSection.classList.add('prominent');
            if (uploadHint) uploadHint.style.display = 'block';
        } else {
            // Has tracks: Make upload secondary
            uploadSection.classList.remove('prominent');
            if (uploadHint) uploadHint.style.display = 'none';
        }
    }

    // --- Enhanced Empty States ---

    showEmptyTracksState(gpsStatus) {
        if (!this.elements.unifiedTracksList) return;
        
        let emptyStateHTML = '';
        
        if (gpsStatus === 'denied') {
            emptyStateHTML = `
                <div class="tracks-empty-state">
                    <h3>📍 Keine Tracks gespeichert</h3>
                    <p>🚫 Standortzugriff nicht verfügbar</p>
                    <p>Lade deinen ersten GPX-Track hoch, um zu starten!</p>
                    <button class="upload-hint-btn" onclick="document.getElementById('gpxFile').click()">
                        Ersten Track hochladen
                    </button>
                </div>
            `;
        } else {
            emptyStateHTML = `
                <div class="tracks-empty-state">
                    <h3>📍 Keine Tracks gespeichert</h3>
                    <p>Lade deinen ersten GPX-Track hoch, um gegen dich selbst zu fahren!</p>
                    <button class="upload-hint-btn" onclick="document.getElementById('gpxFile').click()">
                        Ersten Track hochladen
                    </button>
                </div>
            `;
        }
        
        this.elements.unifiedTracksList.innerHTML = emptyStateHTML;
    }
}