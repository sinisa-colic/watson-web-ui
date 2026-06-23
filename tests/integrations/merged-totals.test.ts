import { describe, expect, it } from "vitest";
import { mergeTrackerTotals } from "../../integrations/merged-totals";
import type { SourceReport } from "../../integrations/types";

describe("mergeTrackerTotals", () => {
  it("merges Watson and Hubstaff reports by client and project", () => {
    const watson: SourceReport = {
      id: "watson",
      label: "Watson",
      totalMs: 3_600_000,
      byClient: [{ name: "Movo", duration: 3_600_000 }],
      byProject: [{ name: "optimization", duration: 3_600_000 }],
      daily: [],
      supportsIssueKeys: true,
      editable: true
    };

    const hubstaff: SourceReport = {
      id: "hubstaff:salon",
      label: "Salon D'Art",
      totalMs: 14_040_000,
      byClient: [],
      byProject: [{ name: "Salon D'Art", duration: 14_040_000 }],
      daily: []
    };

    const merged = mergeTrackerTotals([watson, hubstaff]);

    expect(merged.totalMs).toBe(17_640_000);
    expect(merged.byClient).toEqual([
      { name: "Salon D'Art", duration: 14_040_000 },
      { name: "Movo", duration: 3_600_000 }
    ]);
    expect(merged.byProject).toEqual([
      { name: "Salon D'Art", duration: 14_040_000, supportsIssueKeys: false },
      { name: "optimization", duration: 3_600_000, supportsIssueKeys: true }
    ]);
  });

  it("returns empty breakdowns when there are no reports", () => {
    expect(mergeTrackerTotals([])).toEqual({
      totalMs: 0,
      byClient: [],
      byProject: []
    });
  });
});
