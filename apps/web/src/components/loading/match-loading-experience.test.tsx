import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MatchLoadingExperience,
  MatchLoadingExperienceSkeleton,
} from "./match-loading-experience";

/**
 * The loading interstitial's width has regressed three times (vΩ.14, vΩ.20,
 * vΩ.25). It must match the results page container (`max-w-6xl` in
 * app/match/[id]/page.tsx) or the screen visibly snaps ~480px wider when the
 * analysis lands.
 */
describe("MatchLoadingExperience layout", () => {
  it("uses the same container width as the results page", () => {
    const { container } = render(
      <MatchLoadingExperience homeTeam="Arsenal" awayTeam="Aston Villa" league="EPL" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("max-w-6xl");
  });

  it("splits into two columns on large screens instead of one tall strip", () => {
    const { container } = render(
      <MatchLoadingExperience homeTeam="Arsenal" awayTeam="Aston Villa" league="EPL" />,
    );
    expect(container.querySelector(".lg\\:grid-cols-5")).not.toBeNull();
    expect(container.querySelector(".lg\\:col-span-3")).not.toBeNull();
    expect(container.querySelector(".lg\\:col-span-2")).not.toBeNull();
  });

  it("keeps the SSR skeleton on the same grid so hydration does not shift it", () => {
    const { container } = render(<MatchLoadingExperienceSkeleton />);
    const root = container.firstElementChild;
    expect(root?.className).toContain("max-w-6xl");
    expect(root?.className).toContain("lg:grid-cols-5");
  });
});
