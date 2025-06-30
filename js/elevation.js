
export class ElevationView {
    constructor() {
        this.chart = null;
        this.userPositionLine = null;
        this.ghostPositionLine = null;
    }

    show() {
        document.getElementById('elevation-profile').style.display = 'block';
    }

    hide() {
        document.getElementById('elevation-profile').style.display = 'none';
    }

    drawProfile(gpxData) {
        const labels = gpxData.map((_, i) => i);
        const elevationData = gpxData.map(p => p.ele);

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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y + ' m';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false // Hide x-axis labels
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Elevation (m)',
                            color: '#e0e0e0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    }
                }
            }
        });
    }

    updatePositions(userIndex, ghostIndex, gpxData) {
        if (!this.chart) return;

        // Clear previous positions
        this.chart.data.datasets[1].data = [];
        this.chart.data.datasets[2].data = [];

        // Set new positions
        if (userIndex !== null && gpxData[userIndex]) {
            this.chart.data.datasets[1].data[userIndex] = gpxData[userIndex].ele;
        }
        if (ghostIndex !== null && gpxData[ghostIndex]) {
            this.chart.data.datasets[2].data[ghostIndex] = gpxData[ghostIndex].ele;
        }

        this.chart.update();
    }
}
