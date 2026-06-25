/**
 * Search/Match Selector Component
 * Handles match input and league selection
 */

export function renderMatchSelector(container, { apiClient, onMatchSelected, onError }) {
  const leagues = [
    { value: 'EPL', label: 'Premier League' },
    { value: 'La Liga', label: 'La Liga' },
    { value: 'Bundesliga', label: 'Bundesliga' },
    { value: 'Serie A', label: 'Serie A' },
    { value: 'Ligue 1', label: 'Ligue 1' },
    { value: 'Champions League', label: 'Champions League' },
    { value: 'Europa League', label: 'Europa League' }
  ];

  container.innerHTML = `
    <div class="match-selector-container">
      <div class="match-input-section">
        <h2 class="section-title">Select Teams & League</h2>
        <p class="section-subtitle">Choose your matchup and league to unlock AI-powered betting intelligence tailored to the fixture.</p>
        <form id="match-form" class="match-form">
          <div class="form-row">
            <div class="form-group">
              <label for="home-team">Home Team</label>
              <input
                type="text"
                id="home-team"
                placeholder="e.g. Manchester United"
                required
                aria-label="Home team name"
              />
            </div>
            <div class="vs-indicator">
              <span>VS</span>
            </div>
            <div class="form-group">
              <label for="away-team">Away Team</label>
              <input
                type="text"
                id="away-team"
                placeholder="e.g. Liverpool"
                required
                aria-label="Away team name"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group league-select">
              <label for="league-select">League</label>
              <select id="league-select" required aria-label="Select league">
                <option value="">Choose League...</option>
                ${leagues.map(league => `<option value="${league.value}">${league.label}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="analyze-button">
              <svg class="analyze-icon" viewBox="0 0 24 24">
                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              Analyze Match
            </button>
          </div>
        </form>
      </div>
      <div class="match-preview">
        <div id="match-preview-content" class="match-preview-content hidden">
          <!-- Match preview will be shown here -->
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#match-form');
  const homeInput = container.querySelector('#home-team');
  const awayInput = container.querySelector('#away-team');
  const leagueSelect = container.querySelector('#league-select');
  const previewContent = container.querySelector('#match-preview-content');

  // Update preview when inputs change
  function updatePreview() {
    const home = homeInput.value.trim();
    const away = awayInput.value.trim();
    const league = leagueSelect.value;

    if (home && away && league) {
      previewContent.classList.remove('hidden');
      previewContent.innerHTML = `
        <div class="match-preview-card">
          <h3>Match Preview</h3>
          <div class="preview-teams">
            <span class="preview-home">${home}</span>
            <span class="preview-vs">vs</span>
            <span class="preview-away">${away}</span>
          </div>
          <div class="preview-league">${leagues.find(l => l.value === league)?.label || league}</div>
          <p class="preview-note">Click "Analyze Match" to visualize probabilities, xG projections, and betting value in seconds.</p>
        </div>
      `;
    } else {
      previewContent.classList.add('hidden');
    }
  }

  homeInput.addEventListener('input', updatePreview);
  awayInput.addEventListener('input', updatePreview);
  leagueSelect.addEventListener('change', updatePreview);

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const home = homeInput.value.trim();
    const away = awayInput.value.trim();
    const league = leagueSelect.value;

    if (!home || !away || !league) {
      onError?.('Please fill in all fields');
      return;
    }

    const matchup = `${home} vs ${away}`;
    onMatchSelected({
      homeTeam: home,
      awayTeam: away,
      league,
      matchup
    });
  });
}
