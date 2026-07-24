import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NarrativeBlock } from "./full-analysis-dashboard";

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
