/**
 * SabiScore API Client
 * Handles all communication with the backend API
 */

export class APIClient {
    constructor(baseURL = null) {
        // Use localhost:8000 for development, fallback to relative path for production
        this.baseURL = baseURL || 'http://localhost:8000/api';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
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
        return this.get('/v1/health');
    }

    /**
     * Search matches
     */
    async searchMatches(query, league = null) {
        const params = { q: query };
        if (league) params.league = league;
        return this.get('/v1/matches/search', params);
    }

    /**
     * Generate match insights
     */
    async generateInsights(matchup, league = null) {
        return this.post('/v1/insights', { matchup, league });
    }

    /**
     * Get model status
     */
    async getModelStatus() {
        return this.get('/v1/models/status');
    }

    /**
     * Get league information
     */
    async getLeagues() {
        return this.get('/leagues');
    }

    /**
     * Get upcoming matches
     */
    async getUpcomingMatches(leagueId = null) {
        const params = {};
        if (leagueId) params.leagueId = leagueId;
        return this.get('/matches/upcoming', params);
    }

    /**
     * Get detailed match analysis
     */
    async getMatchAnalysis(matchId) {
        return this.get(`/matches/${matchId}/analysis`);
    }

    /**
     * Get analytics dashboard data
     */
    async getAnalytics() {
        return this.get('/analytics');
    }

    /**
     * Get team statistics
     */
    async getTeamStats(teamId) {
        return this.get(`/teams/${teamId}/stats`);
    }
}

// Export singleton instance
const apiClient = new APIClient();
export default apiClient;
