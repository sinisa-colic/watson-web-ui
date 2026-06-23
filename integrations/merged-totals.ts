import type { ProjectTotal, SourceReport } from "./types.js";

export type MergedProjectTotal = ProjectTotal & {
  supportsIssueKeys?: boolean;
};

export type MergedTrackerTotals = {
  totalMs: number;
  byClient: ProjectTotal[];
  byProject: MergedProjectTotal[];
};

function addDuration(totals: Map<string, number>, name: string, duration: number) {
  totals.set(name, (totals.get(name) ?? 0) + duration);
}

function sortedClientTotals(totals: Map<string, number>): ProjectTotal[] {
  return Array.from(totals.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((left, right) => right.duration - left.duration);
}

export function mergeTrackerTotals(reports: SourceReport[]): MergedTrackerTotals {
  const clientTotals = new Map<string, number>();
  const projectTotals = new Map<string, MergedProjectTotal>();

  for (const report of reports) {
    if (report.id.startsWith("hubstaff:")) {
      addDuration(clientTotals, report.label, report.totalMs);

      for (const item of report.byProject) {
        const existing = projectTotals.get(item.name);
        projectTotals.set(item.name, {
          name: item.name,
          duration: (existing?.duration ?? 0) + item.duration,
          supportsIssueKeys: existing?.supportsIssueKeys ?? false
        });
      }

      continue;
    }

    for (const item of report.byClient) {
      addDuration(clientTotals, item.name, item.duration);
    }

    for (const item of report.byProject) {
      const existing = projectTotals.get(item.name);
      projectTotals.set(item.name, {
        name: item.name,
        duration: (existing?.duration ?? 0) + item.duration,
        supportsIssueKeys: existing?.supportsIssueKeys ?? report.supportsIssueKeys ?? false
      });
    }
  }

  return {
    totalMs: reports.reduce((sum, report) => sum + report.totalMs, 0),
    byClient: sortedClientTotals(clientTotals),
    byProject: Array.from(projectTotals.values()).sort((left, right) => right.duration - left.duration)
  };
}
