import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MatchIntelligenceCard,
  type MatchIntelligenceFixture,
} from './match-intelligence-card';

function fixture(overrides: Partial<MatchIntelligenceFixture> = {}): MatchIntelligenceFixture {
  return {
    matchId: 'fix-1',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoffUtc: '2026-08-15T15:00:00Z',
    league: 'EPL',
    predictionAvailable: true,
    prediction: { home_win: 0.5, draw: 0.25, away_win: 0.25, confidence: 0.7 },
    edge_pct: 5.0,
    ...overrides,
  };
}

describe('MatchIntelligenceCard', () => {
  it('renders the home and away team names from props', () => {
    render(<MatchIntelligenceCard fixture={fixture()} />);
    expect(screen.getByTestId('home-team')).toHaveTextContent('Arsenal');
    expect(screen.getByTestId('away-team')).toHaveTextContent('Chelsea');
  });

  it('shows the value-bet edge badge at the 4.2 threshold', () => {
    render(<MatchIntelligenceCard fixture={fixture({ edge_pct: 4.2 })} />);
    expect(screen.getByLabelText('Value bet identified')).toBeInTheDocument();
    expect(screen.getByText('+4.2% edge')).toBeInTheDocument();
  });

  it('hides the value-bet badge below the 4.2 threshold', () => {
    render(<MatchIntelligenceCard fixture={fixture({ edge_pct: 1.0 })} />);
    expect(screen.queryByLabelText('Value bet identified')).not.toBeInTheDocument();
  });

  it('hides the value-bet badge when edge_pct is undefined', () => {
    render(<MatchIntelligenceCard fixture={fixture({ edge_pct: undefined })} />);
    expect(screen.queryByLabelText('Value bet identified')).not.toBeInTheDocument();
  });

  it('renders the unavailable reason instead of probability bars when prediction is unavailable', () => {
    render(
      <MatchIntelligenceCard
        fixture={fixture({ predictionAvailable: false, prediction: null, unavailableReason: 'Lineups pending' })}
      />
    );
    expect(screen.getByText('Lineups pending')).toBeInTheDocument();
    expect(screen.queryByLabelText('Match outcome probabilities')).not.toBeInTheDocument();
  });

  it('falls back to the default unavailable message when no reason is given', () => {
    render(
      <MatchIntelligenceCard fixture={fixture({ predictionAvailable: false, prediction: null })} />
    );
    expect(screen.getByText('Prediction not yet available')).toBeInTheDocument();
  });
});
