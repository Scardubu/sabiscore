import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BettingRecommendation, MonteCarloResult } from '@/lib/betting/kelly-optimizer';
import { KellyStakeCard, KellyStakeCardSkeleton } from './kelly-stake-card';

const monteCarlo: MonteCarloResult = {
  meanReturn: 0,
  winRate: 0.6,
  ruinProbability: 0.01,
  p5: 100,
  p50: 500,
  p95: 900,
  paths: [],
  volatility: 0.2,
  sharpeRatio: 1.2,
};

function recommendation(overrides: Partial<BettingRecommendation> = {}): BettingRecommendation {
  return {
    recommendation: 'bet',
    stake: 1000,
    market: 'home',
    edge: 0.05,
    expectedValue: 50,
    kellyFraction: 0.1,
    monteCarlo,
    reasoning: 'Sufficient edge identified',
    confidenceLevel: 'high',
    riskLevel: 'moderate',
    ...overrides,
  };
}

describe('KellyStakeCard', () => {
  it('renders VALUE BET badge and formatted stake when recommendation is bet', () => {
    render(<KellyStakeCard recommendation={recommendation()} />);
    expect(screen.getByText('VALUE BET')).toBeInTheDocument();
    expect(screen.getByText('₦1,000')).toBeInTheDocument();
  });

  it('renders NO BET badge and falls back to default reasoning text when skipped', () => {
    render(
      <KellyStakeCard
        recommendation={recommendation({ recommendation: 'skip', stake: 0, reasoning: '' })}
      />
    );
    expect(screen.getByText('NO BET')).toBeInTheDocument();
    expect(screen.getByText('No betting edge identified')).toBeInTheDocument();
  });
});

describe('KellyStakeCardSkeleton', () => {
  it('renders structural placeholders without throwing', () => {
    const { container } = render(<KellyStakeCardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
