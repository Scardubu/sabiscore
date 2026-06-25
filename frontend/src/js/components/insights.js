/**
 * Insights Component
 * Handles rendering of match analysis and predictions
 */

import { renderProbabilityBars } from './charts.js';

export function renderInsights(container, insights) {
    container.innerHTML = `
        <div class="insights-header">
            <h2 class="match-title">${insights.matchup}</h2>
            <p class="match-subtitle">${insights.league || 'Auto-detected League'}</p>
        </div>

        <div class="insights-grid">
            ${renderPredictionsCard(insights)}
            ${renderXGCard(insights)}
            ${renderValueBetsCard(insights)}
            ${renderMonteCarloCard(insights)}
            ${renderConfidenceCard(insights)}
        </div>

        ${renderNarrative(insights)}
    `;

    // Add animations
    addEntranceAnimations(container);

    // Render charts
    renderProbabilityBars(
        container.querySelector('#probability-bars'),
        insights.predictions
    );

    // Setup interactive elements
    setupInteractiveElements(container, insights);
}

function renderPredictionsCard(insights) {
    const pred = insights.predictions;

    return `
        <div class="card insights-card">
            <div class="card-header">
                <h3 class="card-title">Match Predictions</h3>
                <div class="card-icon bg-primary">🎯</div>
            </div>

            <div class="confidence-meter">
                <div class="confidence-bar">
                    <div class="confidence-fill ${getConfidenceClass(pred.confidence * 100)}"
                         style="width: ${pred.confidence * 100}%"></div>
                </div>
                <div class="confidence-text">
                    ${(pred.confidence * 100).toFixed(1)}% Confidence
                </div>
            </div>

            <div id="probability-bars" class="probability-bars">
                <!-- Chart will be rendered here -->
            </div>

            <div class="mt-4">
                <p class="text-sm text-gray-600">
                    <strong>Prediction:</strong> ${pred.prediction.replace('_', ' ').toUpperCase()}
                </p>
            </div>
        </div>
    `;
}

function renderXGCard(insights) {
    const xg = insights.xg_analysis;

    return `
        <div class="card insights-card">
            <div class="card-header">
                <h3 class="card-title">Expected Goals (xG)</h3>
                <div class="card-icon bg-secondary">📊</div>
            </div>

            <div class="xg-display">
                <div class="xg-item">
                    <div class="xg-value">${xg.home_xg}</div>
                    <div class="xg-label">Home xG</div>
                </div>
                <div class="xg-vs">VS</div>
                <div class="xg-item">
                    <div class="xg-value">${xg.away_xg}</div>
                    <div class="xg-label">Away xG</div>
                </div>
            </div>

            <div class="xg-details mt-4">
                <p class="text-sm">
                    <strong>Total xG:</strong> ${xg.total_xg} |
                    <strong>Difference:</strong> ${xg.xg_difference > 0 ? '+' : ''}${xg.xg_difference}
                </p>
            </div>
        </div>
    `;
}

function renderValueBetsCard(insights) {
    const valueAnalysis = insights.value_analysis;
    const bestBet = valueAnalysis?.best_bet;

    if (!bestBet && !valueAnalysis?.summary) {
        return `
            <div class="card insights-card">
                <div class="card-header">
                    <h3 class="card-title">Value Bets</h3>
                    <div class="card-icon bg-warning">💰</div>
                </div>
                <p class="text-gray-600">No value betting opportunities identified for this match.</p>
            </div>
        `;
    }

    let betsHtml = '';
    if (bestBet) {
        betsHtml = `
            <div class="value-bet-card ${bestBet.recommendation?.toLowerCase() || 'consider'}">
                <div class="bet-type">${bestBet.bet_type.replace('_', ' ')}</div>
                <div class="bet-details">
                    <div class="bet-odds">${bestBet.market_odds.toFixed(2)} odds</div>
                    <div class="bet-value">${bestBet.expected_value > 0 ? '+' : ''}${(bestBet.expected_value * 100).toFixed(1)}% value</div>
                    <div class="kelly-stake">Kelly: ${bestBet.kelly_stake.toFixed(3)}</div>
                </div>
                <div class="bet-recommendation text-${bestBet.recommendation === 'Strong bet' ? 'success' : 'warning'}">
                    ${bestBet.recommendation || 'Consider'}
                </div>
            </div>
        `;
    }

    return `
        <div class="card insights-card">
            <div class="card-header">
                <h3 class="card-title">Value Bets</h3>
                <div class="card-icon bg-success">💰</div>
            </div>
            <div class="value-bets">
                ${betsHtml}
                ${valueAnalysis?.summary ? `<div class="value-summary mt-3 p-3 bg-gray-50 rounded">${valueAnalysis.summary}</div>` : ''}
            </div>
        </div>
    `;
}

function renderMonteCarloCard(insights) {
    const monteCarlo = insights.monte_carlo;

    if (!monteCarlo) {
        return '';
    }

    const distribution = monteCarlo.distribution || {};
    const simulations = monteCarlo.simulations || 10000;

    return `
        <div class="card insights-card">
            <div class="card-header">
                <h3 class="card-title">Monte Carlo Analysis</h3>
                <div class="card-icon bg-info">🎲</div>
            </div>

            <div class="monte-carlo-content">
                <div class="simulations-info mb-3">
                    <span class="text-sm text-gray-600">Based on ${simulations.toLocaleString()} simulations</span>
                </div>

                <div class="distribution-bars">
                    ${Object.entries(distribution).map(([outcome, prob]) => `
                        <div class="distribution-item">
                            <div class="outcome-label">${outcome.replace('_', ' ')}</div>
                            <div class="distribution-bar-container">
                                <div class="distribution-bar" style="width: ${(prob * 100).toFixed(1)}%"></div>
                                <div class="distribution-value">${(prob * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderConfidenceCard(insights) {
    const risk = insights.risk_assessment || {};

    return `
        <div class="card insights-card">
            <div class="card-header">
                <h3 class="card-title">Risk Assessment</h3>
                <div class="card-icon bg-${risk.risk_level === 'low' ? 'success' : risk.risk_level === 'medium' ? 'warning' : 'error'}">
                    ${risk.risk_level === 'low' ? '🛡️' : risk.risk_level === 'medium' ? '⚠️' : '🚨'}
                </div>
            </div>

            <div class="risk-details">
                <div class="risk-level">
                    <span class="font-semibold">Risk Level:</span>
                    <span class="text-${risk.risk_level === 'low' ? 'success' : risk.risk_level === 'medium' ? 'warning' : 'error'}">
                        ${risk.risk_level.toUpperCase()}
                    </span>
                </div>
                <div class="value-available mt-2">
                    <span class="font-semibold">Value Available:</span>
                    <span class="${risk.value_available ? 'text-success' : 'text-gray-500'}">
                        ${risk.value_available ? 'Yes' : 'No'}
                    </span>
                </div>
                <div class="recommendation mt-4 p-3 rounded-lg bg-gray-50">
                    <strong>Recommendation:</strong> ${risk.recommendation}
                </div>
            </div>
        </div>
    `;
}

function renderNarrative(insights) {
    return `
        <div class="insights-narrative">
            <h3 class="narrative-title">
                🤖 AI Analysis
            </h3>
            <div class="narrative-content">
                ${insights.narrative || 'Analysis narrative not available.'}
            </div>
        </div>
    `;
}

function getConfidenceClass(confidence) {
    if (confidence >= 75) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
}

function addEntranceAnimations(container) {
    // Add fade-in animations to cards
    const cards = container.querySelectorAll('.insights-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('animate-fade-in');
    });
}

function setupInteractiveElements(container, insights) {
    // Add tooltips or interactive elements as needed
    // For now, this is a placeholder for future enhancements
}

// Additional CSS for insights components
const insightsStyles = `
.xg-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: var(--space-lg) 0;
}

.xg-item {
    text-align: center;
    flex: 1;
}

.xg-value {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--primary);
}

.xg-label {
    font-size: var(--font-size-sm);
    color: var(--gray-600);
    margin-top: var(--space-xs);
}

.xg-vs {
    font-weight: var(--font-weight-bold);
    color: var(--primary);
    margin: 0 var(--space-md);
}

.risk-details {
    margin-top: var(--space-md);
}

.risk-level, .value-available {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--gray-200);
}

.risk-level:last-child,
.value-available:last-child {
    border-bottom: none;
}

.monte-carlo-content {
    margin-top: var(--space-md);
}

.distribution-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.distribution-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.outcome-label {
    min-width: 80px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-transform: capitalize;
}

.distribution-bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.distribution-bar {
    height: 8px;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    border-radius: var(--border-radius-sm);
    transition: width 0.3s ease;
}

.distribution-value {
    font-size: var(--font-size-xs);
    color: var(--gray-600);
    min-width: 35px;
    text-align: right;
}

.kelly-stake {
    font-size: var(--font-size-xs);
    color: var(--success);
    margin-top: var(--space-xs);
}

.value-summary {
    font-size: var(--font-size-sm);
    color: var(--gray-700);
    line-height: 1.4;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = insightsStyles;
document.head.appendChild(styleSheet);
