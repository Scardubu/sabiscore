import React, { useState } from 'react';
import TeamPicker from './TeamPicker';
import SafeImage from './SafeImage';

interface Team {
  id: number;
  name: string;
  shortName: string;
  league: string;
  country: string;
  crest: string;
}

const TeamPickerDemo: React.FC = () => {
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);

  const handleHomeTeamSelect = (team: Team) => {
    setHomeTeam(team);
  };

  const handleAwayTeamSelect = (team: Team) => {
    setAwayTeam(team);
  };

  const canAnalyze = homeTeam && awayTeam;

  return (
    <div className="team-picker-demo">
      <div className="demo-header">
        <h1 className="demo-title">Select Teams</h1>
        <p className="demo-subtitle">
          Search from 1,200+ teams across major leagues
        </p>
      </div>

      <div className="demo-content">
        <div className="team-selection-section">
          <label className="team-label">
            <span className="label-text">Home Team</span>
            <TeamPicker
              onTeamSelect={handleHomeTeamSelect}
              placeholder="Search home team..."
              ariaLabel="Search 1,200 teams for home team"
              selectedTeam={homeTeam}
            />
          </label>
        </div>

        <div className="vs-divider">
          <span className="vs-text">VS</span>
        </div>

        <div className="team-selection-section">
          <label className="team-label">
            <span className="label-text">Away Team</span>
            <TeamPicker
              onTeamSelect={handleAwayTeamSelect}
              placeholder="Search away team..."
              ariaLabel="Search 1,200 teams for away team"
              selectedTeam={awayTeam}
            />
          </label>
        </div>

        <div className="demo-actions">
          <button
            className={`analyze-button ${canAnalyze ? 'active' : 'disabled'}`}
            disabled={!canAnalyze}
            onClick={() => {
              if (canAnalyze) {
                console.log('Analyzing match:', {
                  home: homeTeam.name,
                  away: awayTeam.name,
                });
              }
            }}
          >
            {canAnalyze ? (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 2L3 7v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V7l-7-5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Analyze Match
              </>
            ) : (
              'Select both teams to analyze'
            )}
          </button>
        </div>

        {canAnalyze && (
          <div className="match-preview-card">
            <div className="match-preview-header">Match Preview</div>
            <div className="match-preview-teams">
              <div className="preview-team">
                <SafeImage
                  src={homeTeam.crest}
                  alt={homeTeam.name}
                  className="preview-crest"
                  width={48}
                  height={48}
                />
                <div className="preview-info">
                  <div className="preview-name">{homeTeam.shortName}</div>
                  <div className="preview-league">{homeTeam.league}</div>
                </div>
              </div>
              <div className="preview-vs">vs</div>
              <div className="preview-team">
                <SafeImage
                  src={awayTeam.crest}
                  alt={awayTeam.name}
                  className="preview-crest"
                  width={48}
                  height={48}
                />
                <div className="preview-info">
                  <div className="preview-name">{awayTeam.shortName}</div>
                  <div className="preview-league">{awayTeam.league}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="demo-features">
        <div className="feature-item">
          <svg
            className="feature-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Fuzzy search with Fuse.js</span>
        </div>
        <div className="feature-item">
          <svg
            className="feature-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>3 recent teams saved</span>
        </div>
        <div className="feature-item">
          <svg
            className="feature-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>Keyboard navigation support</span>
        </div>
      </div>
    </div>
  );
};

export default TeamPickerDemo;
