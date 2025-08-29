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
            reverseMode: document.getElementById('reverseMode'),
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
            savedTracks: document.getElementById('savedTracks'),
            trackList: document.getElementById('trackList'),
            raceHistoryContainer: document.getElementById('raceHistoryContainer'),
            raceHistoryList: document.getElementById('raceHistoryList'),
            muteAudio: document.getElementById('muteAudio'),
            fullscreenToggle: document.getElementById('fullscreenToggle')
        };
    }

    bindEventListeners(onFileUpload, onStartRace, onStopRace, onDownloadRace, onReverseToggle, onTransportationModeSelected, onLoadTrack, onDeleteTrack, onFinishScreenDismissed, onMuteToggle) {
        this.elements.gpxFile.addEventListener('change', (e) => onFileUpload(e.target.files[0]));
        this.elements.startRace.addEventListener('click', onStartRace);
        this.elements.stopRace.addEventListener('click', onStopRace);
        this.elements.downloadRace.addEventListener('click', onDownloadRace);
        this.elements.reverseMode.addEventListener('change', (e) => onReverseToggle(e.target.checked));
        this.elements.walkingMode.addEventListener('click', () => onTransportationModeSelected('walking'));
        this.elements.cyclingMode.addEventListener('click', () => onTransportationModeSelected('cycling'));
        this.elements.carMode.addEventListener('click', () => onTransportationModeSelected('car'));
        this.elements.muteAudio.addEventListener('change', (e) => onMuteToggle(e.target.checked));
        this.elements.fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());

        // Handle fullscreen changes
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());

        this.elements.trackList.addEventListener('click', (e) => {
            if (e.target.classList.contains('load-track-btn')) {
                onLoadTrack(parseInt(e.target.dataset.id));
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
            smoothedSpeed, motivationMessage, transportationMode, raceTrack, raceHistory 
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

        // Saved Tracks
        this.elements.trackList.innerHTML = '';
        if (!state.savedTracks || state.savedTracks.length === 0) {
            this.elements.trackList.innerHTML = '<p>Du hast noch keine Tracks gespeichert.</p>';
            this.elements.savedTracks.style.display = 'block';
        } else {
            state.savedTracks.forEach(track => {
                const trackEntry = document.createElement('div');
                trackEntry.className = 'track-entry';
                trackEntry.innerHTML = `
                    <span>${track.name}</span>
                    <div class="track-actions">
                        <button class="load-track-btn" data-id="${track.id}">Laden</button>
                        <button class="delete-track-btn" data-id="${track.id}">Löschen</button>
                    </div>
                `;
                this.elements.trackList.appendChild(trackEntry);
            });
            this.elements.savedTracks.style.display = 'block';
        }

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
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    updateFullscreenButton() {
        const isFullscreen = !!(document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement);
        
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
}