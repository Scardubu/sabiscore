import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InsightsErrorState } from "./insights-error-state";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("InsightsErrorState recovery", () => {
  it("re-runs the server component instead of reloading the document", () => {
    // A full window.location.reload() discards the 6-layer analysis and Phase 8
    // sections that loaded independently, and restarts the loading interstitial.
    render(<InsightsErrorState errorType="backend_internal_error" matchup="A vs B" />);
    fireEvent.click(screen.getByRole("button", { name: /retry now/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it("offers no retry for insufficient evidence", () => {
    // Retrying cannot produce evidence that does not exist yet, so the only
    // action offered is picking a different matchup.
    render(<InsightsErrorState errorType="insufficient_evidence" matchup="A vs B" />);
    expect(screen.queryByRole("button", { name: /retry now/i })).toBeNull();
    expect(screen.getByRole("link", { name: /pick another matchup/i })).toBeTruthy();
  });

  it("never renders an auto-retry countdown", () => {
    // Regression guard: vΩ.20 removed a countdown that flashed "Auto-retrying in
    // 30s" for a retry that could never fire.
    const { container } = render(
      <InsightsErrorState errorType="upstream_timeout" matchup="A vs B" />,
    );
    expect(container.textContent).not.toMatch(/auto-retry/i);
  });
});
