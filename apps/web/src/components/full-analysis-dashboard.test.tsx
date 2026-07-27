import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EloContextCard, NarrativeBlock, UncertaintyCard } from "./full-analysis-dashboard";

describe("NarrativeBlock accessibility", () => {
  it("supports keyboard-operable disclosure with a valid controlled region", () => {
    const text = "Evidence detail. ".repeat(30);
    render(<NarrativeBlock text={text} />);
    const button = screen.getByRole("button", { name: /show more/i });
    const narrative = document.getElementById("narrative-text");
    expect(button).toHaveAttribute("aria-controls", "narrative-text");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(narrative).not.toHaveTextContent(text);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(narrative).toHaveTextContent(text.trim());
  });
});

describe("reduced-evidence display honesty", () => {
  // The backend fills absent ratings with a neutral 1500 and still emits a
  // placeholder credible interval. Rendering either as a measurement presents
  // a default as data — the same class of defect as the vΩ.23 backend fix.
  const neutralElo = {
    home_elo: 1500,
    away_elo: 1500,
    elo_difference: 0,
    home_elo_trend_5: 0,
    away_elo_trend_5: 0,
    elo_momentum_cross: 0,
  };

  it("hides neutral-default Elo ratings on a reduced-evidence baseline", () => {
    const { container } = render(<EloContextCard elo={neutralElo} measured={false} />);
    expect(container.textContent).not.toContain("1500");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("shows Elo ratings when the analysis is evidence-backed", () => {
    const { container } = render(
      <EloContextCard elo={{ ...neutralElo, home_elo: 1712, away_elo: 1588 }} measured />,
    );
    expect(container.textContent).toContain("1712");
    expect(container.textContent).toContain("1588");
  });

  it("hides the credible interval when no prediction was produced", () => {
    const unc = {
      epistemic_unc: 1,
      aleatoric_unc: 0,
      concentration: 1.0001,
      credible_interval: [0, 0.002] as [number, number],
      confidence_tier: "LOW_EVIDENCE" as const,
    };
    const { container } = render(<UncertaintyCard unc={unc} available={false} />);
    expect(container.textContent).not.toContain("0.2%");
    expect(container.textContent).toContain("—");
  });
});
