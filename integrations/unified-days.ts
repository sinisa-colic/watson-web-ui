import { formatDay } from "../src/utils/time";
import type { SourceReport, UnifiedDaySummary } from "./types";

export function mergeUnifiedDays(reports: SourceReport[]): UnifiedDaySummary[] {
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
        byProject: day.byProject,
        supportsIssueKeys: report.supportsIssueKeys
      });
      dayMap.set(day.date, existing);
    }
  }

  return Array.from(dayMap.values()).sort((left, right) => left.key.localeCompare(right.key));
}
