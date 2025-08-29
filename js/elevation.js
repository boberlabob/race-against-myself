export class ElevationView {
    constructor() {
        this.chart = null;
    }

    render(state) {
        const { gpxData, maxProgressIndex, nearestPoint } = state;
        const container = document.getElementById('elevation-profile');

        if (gpxData && !this.chart) {
            this.drawProfile(gpxData);
            container.style.display = 'block';
        } else if (gpxData && this.chart) {
            this.updatePositions(maxProgressIndex, nearestPoint ? nearestPoint.index : null, gpxData);
            container.style.display = 'block';
        } else if (!gpxData && this.chart) {
            this.chart.destroy();
            this.chart = null;
            container.style.display = 'none';
        }
    }

    drawProfile(gpxData) {
        const labels = gpxData.map((_, i) => i);
        const elevationData = gpxData.map(p => p.ele !== null ? p.ele : 0);
        const ctx = document.getElementById('elevationChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Elevation',
                    data: elevationData,
                    borderColor: '#1f7a8c',
                    backgroundColor: 'rgba(31, 122, 140, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2
                }, {
                    label: 'User Position',
                    data: [],
                    borderColor: '#e94560',
                    backgroundColor: 'transparent',
                    pointRadius: 5,
                    pointBackgroundColor: '#e94560',
                    showLine: false
                }, {
                    label: 'Ghost Position',
                    data: [],
                    borderColor: '#a0a0a0',
                    backgroundColor: 'transparent',
                    pointRadius: 5,
                    pointBackgroundColor: '#a0a0a0',
                    showLine: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => `${context.dataset.label || ''}: ${context.parsed.y} m`
                        }
                    }
                },
                animation: { duration: 0 },
                scales: {
                    x: { display: false },
                    y: {
                        title: { display: true, text: 'Elevation (m)', color: '#e0e0e0' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#e0e0e0' }
                    }
                }
            }
        });
    }

    updatePositions(userIndex, ghostIndex, gpxData) {
        if (!this.chart) return;

        this.chart.data.datasets[1].data = [];
        this.chart.data.datasets[2].data = [];

        if (userIndex !== null && gpxData[userIndex]) {
            const userEle = gpxData[userIndex].ele !== null ? gpxData[userIndex].ele : 0;
            this.chart.data.datasets[1].data.push({ x: userIndex, y: userEle });
        }
        if (ghostIndex !== null && gpxData[ghostIndex]) {
            const ghostEle = gpxData[ghostIndex].ele !== null ? gpxData[ghostIndex].ele : 0;
            this.chart.data.datasets[2].data.push({ x: ghostIndex, y: ghostEle });
        }

        this.chart.update();
    }
}