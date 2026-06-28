import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceBadge, ConfidenceMeter } from './confidence-meter';

describe('ConfidenceMeter', () => {
  it('renders HIGH at the 0.75 threshold', () => {
    render(<ConfidenceMeter confidence={0.75} />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('shows the disagreement warning for critical severity', () => {
    render(<ConfidenceMeter confidence={0.5} disagreementSeverity="critical" />);
    expect(screen.getByText('Model Disagreement Detected')).toBeInTheDocument();
  });

  it('omits the disagreement warning for low severity', () => {
    render(<ConfidenceMeter confidence={0.5} disagreementSeverity="low" />);
    expect(screen.queryByText('Model Disagreement Detected')).not.toBeInTheDocument();
  });
});

describe('ConfidenceBadge', () => {
  it('renders without throwing at the 0 boundary', () => {
    render(<ConfidenceBadge confidence={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders without throwing at the 1 boundary', () => {
    render(<ConfidenceBadge confidence={1} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
