import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MatchLoadingExperience,
  MatchLoadingExperienceSkeleton,
} from "./match-loading-experience";

/**
 * The loading interstitial's width has regressed four times (vΩ.14, vΩ.20,
 * vΩ.25, vΩ.31). It must match the results page container (`max-w-6xl` in
 * app/match/[id]/page.tsx) or the screen visibly snaps when the analysis lands.
 */
describe("MatchLoadingExperience layout", () => {
  it("uses the same container width as the results page", () => {
    const { container } = render(
      <MatchLoadingExperience homeTeam="Arsenal" awayTeam="Aston Villa" league="EPL" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("max-w-6xl");
  });

  // The root <main> already applies px-4 py-5 sm:px-6 lg:px-8 and the results
  // page adds none, so any self-padding here inset the loading content and made
  // it jump wider the instant results replaced it.
  it("adds no padding of its own on top of the root <main> padding", () => {
    const { container } = render(
      <MatchLoadingExperience homeTeam="Arsenal" awayTeam="Aston Villa" league="EPL" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).not.toMatch(/\bp-4\b/);
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
    expect(root?.className).not.toMatch(/\bp-4\b/);
  });
});
