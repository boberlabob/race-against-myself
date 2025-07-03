export class UI {
    constructor() {
        this.elements = {}; // Initialize as empty object
    }

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
            raceHistoryList: document.getElementById('raceHistoryList')
        };
    }

    bindEventListeners(onFileUpload, onStartRace, onStopRace, onDownloadRace, onReverseToggle, onTransportationModeSelected, onLoadTrack, onDeleteTrack, onFinishScreenDismissed) {
        this.elements.gpxFile.addEventListener('change', (e) => onFileUpload(e.target.files[0]));
        this.elements.startRace.addEventListener('click', onStartRace);
        this.elements.stopRace.addEventListener('click', onStopRace);
        this.elements.downloadRace.addEventListener('click', onDownloadRace);
        this.elements.reverseMode.addEventListener('change', (e) => onReverseToggle(e.target.checked));
        this.elements.walkingMode.addEventListener('click', () => onTransportationModeSelected('walking'));
        this.elements.cyclingMode.addEventListener('click', () => onTransportationModeSelected('cycling'));
        this.elements.carMode.addEventListener('click', () => onTransportationModeSelected('car'));

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
            this.elements.distanceDifference.textContent = `${distanceDifference >= 0 ? '+' : ''}${Math.round(distanceDifference)} m`;
            this.elements.speed.textContent = smoothedSpeed.toFixed(1) + ' km/h';
            this.elements.raceStatus.textContent = motivationMessage;
            this.elements.timeDifference.className = `time-difference ${timeDifference < 0 ? 'ahead' : 'behind'}`;
        }

        // Transportation mode
        document.querySelectorAll('.mode-button').forEach(button => {
            button.classList.toggle('active', button.dataset.mode === transportationMode);
        });
        const modeIcons = { walking: '🚶', cycling: '🚴', car: '🚗' };
        if (this.elements.modeIndicator) {
            this.elements.modeIndicator.textContent = modeIcons[transportationMode];
        }

        // Race History
        this.renderRaceHistory(raceHistory);

        // Saved Tracks
        this.elements.trackList.innerHTML = '';
        if (!state.savedTracks || state.savedTracks.length === 0) {
            this.elements.trackList.innerHTML = '<p>No saved tracks yet.</p>';
            this.elements.savedTracks.style.display = 'block';
        } else {
            state.savedTracks.forEach(track => {
                const trackEntry = document.createElement('div');
                trackEntry.className = 'track-entry';
                trackEntry.innerHTML = `
                    <span>${track.name}</span>
                    <div class="track-actions">
                        <button class="load-track-btn" data-id="${track.id}">Load</button>
                        <button class="delete-track-btn" data-id="${track.id}">Delete</button>
                    </div>
                `;
                this.elements.trackList.appendChild(trackEntry);
            });
            this.elements.savedTracks.style.display = 'block';
        }

        // Finish Screen
        if (state.finishMessage) {
            this.showFinishScreen(state.finishMessage);
            // Notify the controller that the message has been shown
            this.onFinishScreenDismissed();
        }
    }

    renderRaceHistory(history) {
        if (!history || history.length === 0) {
            this.elements.raceHistoryContainer.style.display = 'none';
            return;
        }
        this.elements.raceHistoryList.innerHTML = '';
        history.slice(0, 5).forEach(race => {
            const raceEntry = document.createElement('div');
            raceEntry.className = 'race-entry';
            const modeIcons = { walking: '🚶', cycling: '🚴', car: '🚗' };
            const modeEmoji = modeIcons[race.transportationMode] || '';
            raceEntry.innerHTML = `
                <div class="race-date">${new Date(race.date).toLocaleDateString()}</div>
                <div class="race-time">${this.formatTime(race.totalTime)}</div>
                <div class="race-difference ${race.timeDifference < 0 ? 'faster' : 'slower'}">${race.timeDifference < 0 ? '-' : '+'}${Math.abs(race.timeDifference).toFixed(1)}s</div>
                <div class="race-mode">${modeEmoji}</div>
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
                <h2>🏁 Race Complete!</h2>
                <p>${message}</p>
                <div class="finish-timer">Returning to start screen in <span id="finishTimer">10</span> seconds...</div>
            </div>
        `;
        finishScreen.style.display = 'flex';
        let countdown = 10;
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
}