/**
 * SabiScore Main Application
 * Handles the overall application state and UI coordination
 */

import apiClient, { APIClient } from './api-client.js';
import { renderMatchSelector } from './components/search.js';
import { renderInsights } from './components/insights.js';
import { initTypography } from './utils/typography.js';
import LoadingExperience from './components/loading-experience.js';

class SabiScoreApp {
    constructor({ api = apiClient } = {}) {
        this.apiClient = api instanceof APIClient ? api : new APIClient();
        this.currentMatchup = null;
        this.currentInsights = null;
        this.isLoading = false;
        this.isOnline = true;
        this.loadingExperience = null; // Enhanced loading experience instance
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading screen
            this.showLoading();

            // Test API connection
            const healthy = await this.testConnection();
            this.isOnline = healthy;

            // Setup UI
            this.setupUI();

        } catch (error) {
            console.warn('API connection failed, proceeding offline:', error);
            // Show offline message but still load UI
            this.showOfflineMessage();
            this.setupUI();
        } finally {
            this.hideLoading();
            this.renderInitialComponents();
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const health = await this.apiClient.healthCheck();
            console.log('API connection successful:', health);
            return true;
        } catch (error) {
            console.warn('API connection failed:', error);
            // For development, we'll proceed even if API is down
            return false;
        }
    }

    /**
     * Setup the user interface
     */
    setupUI() {
        const app = document.getElementById('app');

        // Create main container
        const container = document.createElement('div');
        container.className = 'container';

        // Create header
        const header = this.createHeader();
        container.appendChild(header);

        // Create match selector
        const matchSelector = this.createMatchSelector();
        container.appendChild(matchSelector);

        // Create insights container (initially hidden)
        const insightsContainer = this.createInsightsContainer();
        container.appendChild(insightsContainer);

        // Create footer
        const footer = this.createFooter();
        container.appendChild(footer);

        app.appendChild(container);

        // Ensure typography assets are loaded once
        initTypography();

        // Setup event listeners
        this.setupEventListeners();

        // Render interactive components after structure exists
        this.renderInitialComponents();
    }

    /**
     * Create application header
     */
    createHeader() {
        const header = document.createElement('header');
        header.className = 'hero py-12';
        header.innerHTML = `
            <div class="hero-content">
                <!-- New SABISCORE Logo & Branding -->
                <div class="logo-wordmark-container">
                    <img 
                        src="/sabiscore-wordmark.svg" 
                        alt="SABISCORE" 
                        class="sabiscore-logo"
                        style="width: min(240px, 80vw); height: auto;"
                    />
                    <p class="logo-tagline">Live Scores • Zero Ads</p>
                </div>
                
                <span class="gradient-chip" style="margin-top: 24px;">AI Match Intelligence</span>
                <p class="hero-subtitle text-soft" style="margin-top: 16px;">
                    Data-driven forecasts, value betting edges, and Monte Carlo simulations for every elite European clash.
                </p>
                <div class="hero-actions">
                    <button id="cta-analyze" class="btn btn-primary hero-btn">Analyze a Match</button>
                    <button id="cta-latest" class="btn btn-outline hero-btn">View Latest Insights</button>
                </div>
                <div class="hero-metrics">
                    <div class="metric-card">
                        <span class="metric-label">Leagues Covered</span>
                        <span class="metric-value">7</span>
                        <span class="metric-caption">Top European + UCL</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Model Accuracy</span>
                        <span class="metric-value">65%+</span>
                        <span class="metric-caption">Ensemble Verified</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Simulations</span>
                        <span class="metric-value">10K</span>
                        <span class="metric-caption">Monte Carlo Runs</span>
                    </div>
                </div>
            </div>
        `;
        return header;
    }

    /**
     * Create match selector component
     */
    createMatchSelector() {
        const selector = document.createElement('div');
        selector.id = 'match-selector';
        selector.className = 'match-selector';
        return selector;
    }

    /**
     * Create insights container
     */
    createInsightsContainer() {
        const container = document.createElement('div');
        container.id = 'insights-container';
        container.className = 'insights-dashboard hidden';
        return container;
    }

    /**
     * Create application footer
     */
    createFooter() {
        const footer = document.createElement('footer');
        footer.className = 'text-center py-8 mt-auto';
        footer.innerHTML = `
            <div class="footer-content">
                <p class="text-slate-400">
                    <img src="/sabiscore-monogram.svg" alt="SABISCORE" class="inline-block w-4 h-4 mr-2" />
                    SABISCORE © ${new Date().getFullYear()} · AI Football Intelligence
                </p>
            </div>
        `;
        return footer;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const analyzeCta = document.getElementById('cta-analyze');
        const latestCta = document.getElementById('cta-latest');

        if (analyzeCta) {
            analyzeCta.addEventListener('click', () => {
                document.getElementById('match-selector')?.scrollIntoView({ behavior: 'smooth' });
            });
        }

        if (latestCta) {
            latestCta.addEventListener('click', () => {
                document.getElementById('insights-container')?.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');

        if (loading) loading.style.display = 'block';
        if (error) error.style.display = 'none';
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    /**
     * Show offline message
     */
    showOfflineMessage(message = '⚠️ Backend offline - Running in demo mode') {
        const existing = document.querySelector('.offline-banner');
        if (existing) {
            existing.querySelector('span').textContent = message;
            return;
        }

        const app = document.getElementById('app');
        const offlineMsg = document.createElement('div');
        offlineMsg.className = 'offline-banner';
        offlineMsg.innerHTML = `
            <div class="offline-banner-content">
                <span>${message}</span>
                <button class="btn btn-outline" onclick="location.reload()">Retry Connection</button>
            </div>
        `;
        app.insertBefore(offlineMsg, app.firstChild);
    }

    /**
     * Handle match selection
     */
    async onMatchSelected(matchInfo, fallbackLeague) {
        try {
            const normalized = this.normalizeMatchInfo(matchInfo, fallbackLeague);
            this.currentMatchup = normalized;
            this.isLoading = true;

            // Show enhanced loading state
            this.showInsightsLoading();

            // Generate insights
            const insights = await this.apiClient.generateInsights(normalized.matchup, normalized.league);
            this.currentInsights = insights;

            // Complete loading animation
            if (this.loadingExperience) {
                this.loadingExperience.complete();
                // Wait for completion animation
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Render insights
            this.renderInsightsUI(insights);

        } catch (error) {
            console.error('Failed to generate insights:', error);
            
            // Stop loading animation on error
            if (this.loadingExperience) {
                this.loadingExperience.stop();
                this.loadingExperience = null;
            }
            
            this.showInsightsError('Failed to generate insights. Please try again.');
            if (error.status === 503) {
                this.showOfflineMessage('⚠️ Predictions unavailable - ensure backend models are loaded.');
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Show insights loading state with enhanced experience
     */
    showInsightsLoading() {
        const container = document.getElementById('insights-container');
        const selector = document.getElementById('match-selector');

        if (container) {
            container.classList.remove('hidden');
            
            // Initialize enhanced loading experience
            this.loadingExperience = new LoadingExperience();
            container.innerHTML = this.loadingExperience.start();
            
            // Start the loading animation sequence
            setTimeout(() => {
                if (this.loadingExperience) {
                    this.loadingExperience.updateStepDisplay();
                }
            }, 100);
        }

        // Scroll to insights
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Collapse selector on mobile
        if (selector && window.innerWidth < 768) {
            selector.style.marginBottom = '0';
        }
    }

    /**
     * Show insights error state
     */
    showInsightsError(message) {
        const container = document.getElementById('insights-container');
        if (container) {
            container.innerHTML = `
                <div class="error-card">
                    <h3>Analysis Failed</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
                </div>
            `;
        }
    }

    /**
     * Render insights using the insights component
     */
    renderInsightsUI(insights) {
        const container = document.getElementById('insights-container');
        if (container) {
            renderInsights(container, insights);
        }
    }

    /**
     * Render initial UI components
     */
    renderInitialComponents() {
        // Render match selector
        const selectorElement = document.getElementById('match-selector');
        if (selectorElement) {
            renderMatchSelector(selectorElement, {
                apiClient: this.apiClient,
                onMatchSelected: (matchData) => this.onMatchSelected(matchData),
                onError: (msg) => this.showToast(msg),
            });
        }

        // Render initial insights if available (e.g., hydration from server)
        if (this.currentInsights) {
            this.renderInsightsUI(this.currentInsights);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        if (!message) return;
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    async searchMatches(query) {
        try {
            const matches = await this.apiClient.searchMatches(query);
            this.renderMatchResults(matches);
        } catch (error) {
            this.showError('Search failed');
        }
    }

    async analyzeMatch(match) {
        try {
            const insights = await this.apiClient.generateInsights(
                `${match.home_team} vs ${match.away_team}`,
                match.league
            );
            this.renderInsightsUI(insights);
        } catch (error) {
            this.showError('Analysis failed');
        }
    }

    renderMatchResults(matches) {
        // Find the search results container
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (!matches || matches.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state">No matches found</div>';
            return;
        }

        resultsContainer.innerHTML = matches
            .map(match => `
                <div class="match-card" data-match-id="${match.id || Math.random()}">
                    <div class="match-teams">
                        <span class="home-team">${match.home_team || 'Home'}</span>
                        <span class="vs">vs</span>
                        <span class="away-team">${match.away_team || 'Away'}</span>
                    </div>
                    <div class="match-meta">
                        <span class="league">${match.league || 'Unknown League'}</span>
                        <span class="date">${match.match_date ? new Date(match.match_date).toLocaleDateString() : 'TBD'}</span>
                    </div>
                    <button class="analyze-btn"
                        data-matchup="${match.home_team || 'Home'} vs ${match.away_team || 'Away'}"
                        data-league="${match.league || ''}"
                        data-home-team="${match.home_team || ''}"
                        data-away-team="${match.away_team || ''}"
                        data-match-id="${match.id || ''}">
                        Analyze
                    </button>
                </div>
            `)
            .join('');

        // Add click handlers
        resultsContainer.querySelectorAll('.analyze-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.onMatchSelected({
                    matchup: btn.dataset.matchup,
                    league: btn.dataset.league,
                    homeTeam: btn.dataset.homeTeam,
                    awayTeam: btn.dataset.awayTeam,
                    matchId: btn.dataset.matchId
                });
            });
        });
    }

    normalizeMatchInfo(matchInfo, fallbackLeague) {
        if (matchInfo && typeof matchInfo === 'object' && !Array.isArray(matchInfo)) {
            const matchup = matchInfo.matchup || `${matchInfo.homeTeam || ''} vs ${matchInfo.awayTeam || ''}`.trim();
            return {
                matchup,
                league: matchInfo.league || fallbackLeague || '',
                homeTeam: matchInfo.homeTeam || matchup.split(' vs ')[0]?.trim() || '',
                awayTeam: matchInfo.awayTeam || matchup.split(' vs ')[1]?.trim() || '',
                matchId: matchInfo.matchId || matchInfo.id || null,
            };
        }

        const matchup = typeof matchInfo === 'string' ? matchInfo : '';
        const [homeTeam = '', awayTeam = ''] = matchup.split(' vs ');
        return {
            matchup,
            league: fallbackLeague || '',
            homeTeam: homeTeam.trim(),
            awayTeam: awayTeam.trim(),
            matchId: null,
        };
    }

    showError(message) {
        console.error('Application error:', message);
        this.showToast(message || 'An error occurred');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new SabiScoreApp();
    app.init();

    // Make app globally available for debugging
    window.sabiScoreApp = app;
});
