/**
 * SabiScore API Client
 * Handles all communication with the backend API
 */

export class APIClient {
    constructor(baseURL = null) {
        // Resolve base URL from Vite env (VITE_API_BASE) or constructor param.
        // If none provided, default to empty string so relative paths like
        // '/api/v1/...' work both in dev and deployed environments.
        let envBase = null;
        try {
            envBase = (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : null;
        } catch (e) {
            // import.meta may be unavailable in some test runners — ignore
            envBase = null;
        }

        this.baseURL = baseURL || envBase || '';
        // Optional API prefix (e.g. '/api/v1') via VITE_API_PREFIX
        let envPrefix = null;
        try {
            envPrefix = (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_PREFIX) ? import.meta.env.VITE_API_PREFIX : null;
        } catch (e) {
            envPrefix = null;
        }
        this.apiPrefix = envPrefix || '/api/v1';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        // Build URL robustly: ensure single slash separators
        const prefix = this.baseURL ? this.baseURL.replace(/\/+$/, '') : '';
        const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${prefix}${ep}`;
        const config = {
            headers: { ...this.defaultHeaders },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Handle new backend error format with error_code and timestamp
                const error = new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.errorCode = errorData.error_code;
                error.timestamp = errorData.timestamp;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ===== API ENDPOINTS =====

    /**
     * Health check
     */
    async healthCheck() {
        // Backend exposes a root /health endpoint
        return this.get('/health');
    }

    /**
     * Search matches
     */
    async searchMatches(query, league = null) {
        const params = { q: query };
        if (league) params.league = league;
        return this.get(`${this.apiPrefix}/matches/search`, params);
    }

    /**
     * Generate match insights
     */
    async generateInsights(matchup, league = null) {
        return this.post(`${this.apiPrefix}/insights`, { matchup, league });
    }

    /**
     * Get model status
     */
    async getModelStatus() {
        return this.get(`${this.apiPrefix}/models/status`);
    }

    /**
     * Get league information
     */
    async getLeagues() {
        return this.get(`${this.apiPrefix}/leagues`);
    }

    /**
     * Get upcoming matches
     */
    async getUpcomingMatches(leagueId = null) {
        const params = {};
        if (leagueId) params.leagueId = leagueId;
        return this.get(`${this.apiPrefix}/matches/upcoming`, params);
    }

    /**
     * Get detailed match analysis
     */
    async getMatchAnalysis(matchId) {
        return this.get(`${this.apiPrefix}/matches/${matchId}/analysis`);
    }

    /**
     * Get analytics dashboard data
     */
    async getAnalytics() {
        return this.get(`${this.apiPrefix}/analytics`);
    }

    /**
     * Get team statistics
     */
    async getTeamStats(teamId) {
        return this.get(`${this.apiPrefix}/teams/${teamId}/stats`);
    }
}

// Export singleton instance
const apiClient = new APIClient();
export default apiClient;
