import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CachedLogo } from "./cached-logo";

describe("CachedLogo", () => {
  it("uses native eager loading for a priority image without forwarding an unsupported prop", () => {
    const onLoad = vi.fn();

    render(
      <CachedLogo
        url="https://example.test/logo.svg"
        alt="Example FC logo"
        placeholder="E"
        priority
        onLoad={onLoad}
      />,
    );

    const logo = screen.getByRole("img", { name: "Example FC logo" });
    expect(logo).toHaveAttribute("loading", "eager");
    expect(logo).not.toHaveAttribute("fetchpriority");

    fireEvent.load(logo);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
