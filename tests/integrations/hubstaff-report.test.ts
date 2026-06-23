import { describe, expect, it } from "vitest";
import { projectsToPickerItems, reportToSource } from "../../integrations/hubstaff/client";
import type { HubstaffReport } from "../../integrations/types";

const sampleReport: HubstaffReport = {
  configured: true,
  totalSeconds: 5400,
  projects: [
    { projectId: 1, name: "PI-491", seconds: 3600 },
    { projectId: 2, name: "PI-492", seconds: 1800 }
  ],
  daily: [
    {
      date: "2026-06-23",
      totalSeconds: 5400,
      projects: [
        { projectId: 1, name: "PI-491", seconds: 3600 },
        { projectId: 2, name: "PI-492", seconds: 1800 }
      ]
    }
  ]
};

describe("reportToSource", () => {
  it("returns null when Hubstaff is not configured", () => {
    expect(reportToSource("client-a", "Client A", { ...sampleReport, configured: false })).toBeNull();
  });

  it("converts seconds to milliseconds and maps client totals", () => {
    const source = reportToSource("client-a", "Client A", sampleReport);

    expect(source).toMatchObject({
      id: "hubstaff:client-a",
      label: "Hubstaff — Client A",
      totalMs: 5_400_000,
      byProject: []
    });
    expect(source?.byClient).toEqual([
      { name: "PI-491", duration: 3_600_000 },
      { name: "PI-492", duration: 1_800_000 }
    ]);
    expect(source?.daily[0]?.totalMs).toBe(5_400_000);
  });
});

describe("projectsToPickerItems", () => {
  it("builds picker items with client label and tracked minutes", () => {
    expect(projectsToPickerItems(sampleReport, "Client A")).toEqual([
      { key: "PI-491", summary: "Client A — tracked 60m" },
      { key: "PI-492", summary: "Client A — tracked 30m" }
    ]);
  });
});
