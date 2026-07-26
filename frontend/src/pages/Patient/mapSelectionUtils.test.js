import { describe, expect, it } from "vitest";
import { shouldShowMapSelectionCard } from "./mapSelectionUtils";

describe("shouldShowMapSelectionCard", () => {
  it("hides the hospital detail card until a hospital is selected from the map", () => {
    expect(shouldShowMapSelectionCard("", "")).toBe(false);
    expect(shouldShowMapSelectionCard(null, null)).toBe(false);
  });

  it("shows the detail card once a map marker is selected", () => {
    expect(shouldShowMapSelectionCard("hospital-123", "hospital-123")).toBe(true);
  });
});
