import { describe, expect, it } from "vitest";
import { mergeUnifiedDays } from "../../integrations/unified-days";
import type { SourceReport } from "../../integrations/types";

describe("mergeUnifiedDays", () => {
  it("merges the same date across sources and sorts days", () => {
    const watson: SourceReport = {
      id: "watson",
      label: "Watson",
      totalMs: 3600000,
      byClient: [],
      byProject: [{ name: "PI-491", duration: 3600000 }],
      daily: [
        {
          date: "2026-06-23",
          totalMs: 3600000,
          byClient: [],
          byProject: [{ name: "PI-491", duration: 3600000 }]
        }
      ],
      supportsIssueKeys: true
    };

    const hubstaff: SourceReport = {
      id: "hubstaff:client-a",
      label: "Client A",
      totalMs: 1800000,
      byClient: [],
      byProject: [{ name: "PI-492", duration: 1800000 }],
      daily: [
        {
          date: "2026-06-23",
          totalMs: 1800000,
          byClient: [],
          byProject: [{ name: "PI-492", duration: 1800000 }]
        },
        {
          date: "2026-06-24",
          totalMs: 900000,
          byClient: [],
          byProject: [{ name: "PI-492", duration: 900000 }]
        }
      ]
    };

    const merged = mergeUnifiedDays([watson, hubstaff]);

    expect(merged.map((day) => day.key)).toEqual(["2026-06-23", "2026-06-24"]);
    expect(merged[0]?.totalMs).toBe(5400000);
    expect(merged[0]?.sources).toHaveLength(2);
    expect(merged[0]?.sources[0]?.supportsIssueKeys).toBe(true);
    expect(merged[0]?.sources[1]?.supportsIssueKeys).toBeUndefined();
  });
});
