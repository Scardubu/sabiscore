/**
 * Charts Component
 * Handles rendering of charts using Chart.js
 */

let Chart = null;

// Dynamically import Chart.js
async function loadChartJS() {
    if (Chart) return Chart;

    try {
        const module = await import('chart.js');
        Chart = module.Chart;
        return Chart;
    } catch (error) {
        console.warn('Chart.js not available, using fallback rendering');
        return null;
    }
}

/**
 * Generic chart rendering function
 */
export async function renderChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Chart container '${containerId}' not found`);
        return;
    }

    // Determine chart type from container ID or data structure
    if (containerId === 'xg-chart' || (data && data.home_xg !== undefined)) {
        await renderXGChart(container, data.home_xg || 0, data.away_xg || 0, 
                          [data.home_team || 'Home', data.away_team || 'Away']);
    } else if (containerId === 'probability-bars' || (data && data.home_win_prob !== undefined)) {
        await renderProbabilityBars(container, data);
    } else {
        console.warn(`Unknown chart type for container: ${containerId}`);
    }
}

export async function renderProbabilityBars(container, predictions) {
    if (!container) return;

    // Load Chart.js
    const ChartClass = await loadChartJS();

    if (!ChartClass) {
        // Fallback rendering without Chart.js
        renderFallbackProbabilityBars(container, predictions);
        return;
    }

    // Clear container
    container.innerHTML = '<canvas id="probability-chart"></canvas>';
    const canvas = container.querySelector('#probability-chart');

    const ctx = canvas.getContext('2d');

    const data = {
        labels: ['Home Win', 'Draw', 'Away Win'],
        datasets: [{
            label: 'Probability (%)',
            data: [
                predictions.home_win_prob * 100,
                predictions.draw_prob * 100,
                predictions.away_win_prob * 100
            ],
            backgroundColor: [
                'rgba(26, 35, 126, 0.8)',   // Primary
                'rgba(255, 193, 7, 0.8)',   // Accent
                'rgba(76, 175, 80, 0.8)'    // Secondary
            ],
            borderColor: [
                'rgba(26, 35, 126, 1)',
                'rgba(255, 193, 7, 1)',
                'rgba(76, 175, 80, 1)'
            ],
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
        }]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            weight: 'bold'
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    };

    new ChartClass(ctx, config);
}

export async function renderXGChart(container, homeXG, awayXG, teamNames) {
    if (!container) return;

    const ChartClass = await loadChartJS();

    if (!ChartClass) {
        renderFallbackXGChart(container, homeXG, awayXG, teamNames);
        return;
    }

    container.innerHTML = '<canvas id="xg-chart"></canvas>';
    const canvas = container.querySelector('#xg-chart');

    const ctx = canvas.getContext('2d');

    const data = {
        labels: teamNames,
        datasets: [{
            label: 'Expected Goals (xG)',
            data: [homeXG, awayXG],
            backgroundColor: [
                'rgba(26, 35, 126, 0.8)',
                'rgba(76, 175, 80, 0.8)'
            ],
            borderColor: [
                'rgba(26, 35, 126, 1)',
                'rgba(76, 175, 80, 1)'
            ],
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
        }]
    };

    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'xG: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Expected Goals'
                    }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutBounce'
            }
        }
    };

    new ChartClass(ctx, config);
}

function renderFallbackProbabilityBars(container, predictions) {
    // Fallback HTML/CSS rendering without Chart.js
    container.innerHTML = `
        <div class="fallback-prob-bars">
            <div class="prob-bar">
                <div class="prob-label">Home Win</div>
                <div class="prob-fill home" style="width: ${predictions.home_win_prob * 100}%">
                    <span class="prob-value">${(predictions.home_win_prob * 100).toFixed(1)}%</span>
                </div>
            </div>
            <div class="prob-bar">
                <div class="prob-label">Draw</div>
                <div class="prob-fill draw" style="width: ${predictions.draw_prob * 100}%">
                    <span class="prob-value">${(predictions.draw_prob * 100).toFixed(1)}%</span>
                </div>
            </div>
            <div class="prob-bar">
                <div class="prob-label">Away Win</div>
                <div class="prob-fill away" style="width: ${predictions.away_win_prob * 100}%">
                    <span class="prob-value">${(predictions.away_win_prob * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
}

function renderFallbackXGChart(container, homeXG, awayXG, teamNames) {
    // Fallback HTML rendering for xG chart
    const [homeTeam, awayTeam] = teamNames;

    container.innerHTML = `
        <div class="fallback-xg-chart">
            <div class="xg-bar">
                <div class="team-name">${homeTeam}</div>
                <div class="xg-bar-fill" style="width: ${(homeXG / (homeXG + awayXG)) * 100}%">
                    <span class="xg-value">${homeXG.toFixed(2)}</span>
                </div>
            </div>
            <div class="xg-bar">
                <div class="team-name">${awayTeam}</div>
                <div class="xg-bar-fill" style="width: ${(awayXG / (homeXG + awayXG)) * 100}%">
                    <span class="xg-value">${awayXG.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

// Additional CSS for fallback charts
const fallbackStyles = `
.fallback-prob-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.fallback-prob-bars .prob-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.fallback-prob-bars .prob-label {
    min-width: 80px;
    font-weight: var(--font-weight-medium);
}

.fallback-prob-bars .prob-fill {
    flex: 1;
    height: 32px;
    border-radius: var(--radius-md);
    position: relative;
    background: var(--gray-200);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: var(--space-sm);
    transition: width var(--transition-slow);
}

.fallback-prob-bars .prob-fill.home { background: var(--primary); }
.fallback-prob-bars .prob-fill.draw { background: var(--accent); }
.fallback-prob-bars .prob-fill.away { background: var(--secondary); }

.fallback-prob-bars .prob-value {
    color: white;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-sm);
}

.fallback-xg-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin: var(--space-lg) 0;
}

.xg-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.xg-bar .team-name {
    min-width: 120px;
    font-weight: var(--font-weight-medium);
}

.xg-bar .xg-bar-fill {
    flex: 1;
    height: 40px;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: var(--font-weight-bold);
    transition: width var(--transition-slow);
}

.xg-bar .xg-value {
    font-size: var(--font-size-lg);
}
`;

// Inject fallback styles
const styleSheet = document.createElement('style');
styleSheet.textContent = fallbackStyles;
document.head.appendChild(styleSheet);
