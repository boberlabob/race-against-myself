
console.log('Loading ui.js module');

export class UI {
    constructor() {
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
            
            distance: document.getElementById('distance'),
            speed: document.getElementById('speed'),
            referenceTime: document.getElementById('referenceTime'),
            currentTime: document.getElementById('currentTime'),
            uploadSection: document.querySelector('.upload-section'),
            map: document.getElementById('map'),
            elevationProfile: document.getElementById('elevation-profile')
        };
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
            }
        }, 1000);
    }

    updateStatus(message) {
        this.elements.status.innerHTML = message;
    }

    updateRaceHistory(history) {
        if (history.length === 0) return;

        let historyContainer = this.elements.status.querySelector('.race-history');
        if (!historyContainer) {
            historyContainer = document.createElement('div');
            historyContainer.className = 'race-history';
            this.elements.status.appendChild(historyContainer);
        } else {
            historyContainer.innerHTML = ''; // Clear existing history
        }

        const historyTitle = document.createElement('h3');
        historyTitle.textContent = 'Recent Races';
        historyContainer.appendChild(historyTitle);

        history.slice(0, 5).forEach(race => {
            const raceEntry = document.createElement('div');
            raceEntry.className = 'race-entry';

            const raceDate = document.createElement('div');
            raceDate.className = 'race-date';
            raceDate.textContent = new Date(race.date).toLocaleDateString();
            raceEntry.appendChild(raceDate);

            const raceTime = document.createElement('div');
            raceTime.className = 'race-time';
            raceTime.textContent = this.formatTime(race.totalTime);
            raceEntry.appendChild(raceTime);

            const raceDifference = document.createElement('div');
            raceDifference.className = `race-difference ${race.timeDifference < 0 ? 'faster' : 'slower'}`;
            raceDifference.textContent = `${race.timeDifference < 0 ? '-' : '+'}${Math.abs(race.timeDifference).toFixed(1)}s`;
            raceEntry.appendChild(raceDifference);

            historyContainer.appendChild(raceEntry);
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatTimeDifference(seconds) {
        const abs = Math.abs(seconds);
        const sign = seconds < 0 ? '-' : '+';
        return sign + this.formatTime(abs);
    }

    updateRaceDisplay(data) {
        this.elements.timeDifference.textContent = this.formatTimeDifference(data.timeDifference);
        this.elements.distance.textContent = Math.round(data.distance) + ' m';
        this.elements.referenceTime.textContent = this.formatTime(data.referenceTime);
        this.elements.currentTime.textContent = this.formatTime(data.elapsedTime);
        this.elements.speed.textContent = data.smoothedSpeed.toFixed(1) + ' km/h';
        if (data.timeDifference < 0) {
            this.elements.timeDifference.className = 'time-difference ahead';
            this.elements.raceStatus.textContent = `You're ${Math.abs(data.timeDifference).toFixed(1)}s ahead! ${data.motivation}`;
        } else {
            this.elements.timeDifference.className = 'time-difference behind';
            this.elements.raceStatus.textContent = `You're ${data.timeDifference.toFixed(1)}s behind. ${data.motivation}`;
        }
    }

    selectTransportationMode(mode) {
        document.querySelectorAll('.mode-button').forEach(button => {
            button.classList.remove('active');
        });
        const selectedButton = document.querySelector(`[data-mode="${mode}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
        this.updateModeDisplay(mode);
    }

    updateModeDisplay(mode) {
        const modeIcons = {
            walking: '🚶',
            cycling: '🚴',
            car: '🚗'
        };
        if (this.elements.modeIndicator) {
            this.elements.modeIndicator.textContent = modeIcons[mode];
        }
    }
}
