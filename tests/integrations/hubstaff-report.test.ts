import { describe, expect, it } from "vitest";
import { hubstaffTasksToPickerItems, projectsToPickerItems, reportToSource } from "../../integrations/hubstaff/client";
import type { HubstaffReport, HubstaffTaskOption } from "../../integrations/types";

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

  it("converts seconds to milliseconds and maps project totals", () => {
    const source = reportToSource("client-a", "Client A", sampleReport);

    expect(source).toMatchObject({
      id: "hubstaff:client-a",
      label: "Client A",
      totalMs: 5_400_000,
      byClient: []
    });
    expect(source?.byProject).toEqual([
      { name: "PI-491", duration: 3_600_000 },
      { name: "PI-492", duration: 1_800_000 }
    ]);
    expect(source?.daily[0]?.byProject).toEqual([
      { name: "PI-491", duration: 3_600_000 },
      { name: "PI-492", duration: 1_800_000 }
    ]);
    expect(source?.daily[0]?.totalMs).toBe(5_400_000);
  });
});

describe("hubstaffTasksToPickerItems", () => {
  it("lists Hubstaff task summaries for the picker", () => {
    const tasks: HubstaffTaskOption[] = [
      { taskId: 1, projectId: 3888799, summary: "Invoice follow-up", projectName: "Salon D'Art" },
      { taskId: 2, projectId: 3888799, summary: "Website copy", projectName: "Salon D'Art" }
    ];

    expect(hubstaffTasksToPickerItems(tasks, "Salon D'Art")).toEqual([
      { key: "Invoice follow-up", summary: "Salon D'Art" },
      { key: "Website copy", summary: "Salon D'Art" }
    ]);
  });

  it("disambiguates duplicate summaries across projects", () => {
    const tasks: HubstaffTaskOption[] = [
      { taskId: 1, projectId: 1, summary: "Salon D'Art", projectName: "Legacy" },
      { taskId: 2, projectId: 2, summary: "Salon D'Art", projectName: "Current" }
    ];

    expect(hubstaffTasksToPickerItems(tasks, "Salon D'Art")).toEqual([
      { key: "Legacy: Salon D'Art", summary: "Salon D'Art · Legacy" },
      { key: "Current: Salon D'Art", summary: "Salon D'Art · Current" }
    ]);
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
