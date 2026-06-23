import type { HubstaffReport } from "../../types";
import { formatDay } from "../../utils/time";
import type { TimeTrackerDayReport, TimeTrackerSourceReport, UnifiedDaySummary } from "./types";

export function hubstaffReportToTimeTrackerSource(
  clientKey: string,
  clientLabel: string,
  report: HubstaffReport
): TimeTrackerSourceReport | null {
  if (!report.configured) {
    return null;
  }

  const byClient = report.projects.map((project) => ({
    name: project.name,
    duration: project.seconds * 1000
  }));

  const daily: TimeTrackerDayReport[] = report.daily.map((day) => ({
    date: day.date,
    totalMs: day.totalSeconds * 1000,
    byClient: day.projects.map((project) => ({
      name: project.name,
      duration: project.seconds * 1000
    })),
    byProject: []
  }));

  return {
    id: `hubstaff:${clientKey}`,
    label: `Hubstaff — ${clientLabel}`,
    totalMs: report.totalSeconds * 1000,
    byClient,
    byProject: [],
    daily
  };
}

export function mergeUnifiedDays(reports: TimeTrackerSourceReport[]): UnifiedDaySummary[] {
  const dayMap = new Map<string, UnifiedDaySummary>();

  for (const report of reports) {
    for (const day of report.daily) {
      const existing = dayMap.get(day.date) ?? {
        key: day.date,
        label: formatDay(new Date(`${day.date}T12:00:00`)),
        totalMs: 0,
        sources: []
      };

      existing.totalMs += day.totalMs;
      existing.sources.push({
        id: report.id,
        label: report.label,
        totalMs: day.totalMs,
        byClient: day.byClient,
        byProject: day.byProject
      });
      dayMap.set(day.date, existing);
    }
  }

  return Array.from(dayMap.values()).sort((left, right) => left.key.localeCompare(right.key));
}
