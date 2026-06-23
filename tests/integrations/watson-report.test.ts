import { describe, expect, it } from "vitest";
import type { ClientOption } from "../../src/types";
import { buildReport } from "../../integrations/watson/client";

const clients: ClientOption[] = [
  {
    key: "client-a",
    label: "Client A",
    tag: "client-a",
    integrations: {},
    configured: true
  }
];

describe("buildReport", () => {
  it("totals frame duration and groups by project and client tag", () => {
    const report = buildReport(
      [
        {
          id: "1",
          project: "PI-491",
          start: "2026-06-23T09:00:00",
          stop: "2026-06-23T10:00:00",
          tags: ["client-a"]
        },
        {
          id: "2",
          project: "PI-492",
          start: "2026-06-23T11:00:00",
          stop: "2026-06-23T11:30:00",
          tags: ["client-a"]
        }
      ],
      clients
    );

    expect(report.id).toBe("watson");
    expect(report.totalMs).toBe(5_400_000);
    expect(report.byProject).toEqual([
      { name: "PI-491", duration: 3_600_000 },
      { name: "PI-492", duration: 1_800_000 }
    ]);
    expect(report.byClient).toEqual([{ name: "Client A", duration: 5_400_000 }]);
    expect(report.supportsIssueKeys).toBe(true);
    expect(report.editable).toBe(true);
  });

  it("builds daily breakdown sorted by date", () => {
    const report = buildReport(
      [
        {
          id: "1",
          project: "PI-491",
          start: "2026-06-24T09:00:00",
          stop: "2026-06-24T10:00:00",
          tags: []
        },
        {
          id: "2",
          project: "PI-491",
          start: "2026-06-23T09:00:00",
          stop: "2026-06-23T10:00:00",
          tags: []
        }
      ],
      clients
    );

    expect(report.daily.map((day) => day.date)).toEqual(["2026-06-23", "2026-06-24"]);
    expect(report.daily[0]?.totalMs).toBe(3_600_000);
  });
});
