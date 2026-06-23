import type { HubstaffReport, HubstaffProjectTotal } from "../types";

export function mergeHubstaffReports(
  entries: Array<{ clientLabel: string; report: HubstaffReport }>
): HubstaffReport | null {
  const configured = entries.filter((entry) => entry.report.configured);
  if (!configured.length) {
    return null;
  }

  const multiClient = configured.length > 1;
  const projectTotals = new Map<string, number>();
  const dailyMap = new Map<string, Map<string, number>>();
  let totalSeconds = 0;

  for (const { clientLabel, report } of configured) {
    totalSeconds += report.totalSeconds;

    for (const project of report.projects) {
      addProjectTotal(projectTotals, labelProject(project.name, clientLabel, multiClient), project.seconds);
    }

    for (const day of report.daily) {
      const dayProjects = dailyMap.get(day.date) ?? new Map<string, number>();
      for (const project of day.projects) {
        addProjectTotal(dayProjects, labelProject(project.name, clientLabel, multiClient), project.seconds);
      }
      dailyMap.set(day.date, dayProjects);
    }
  }

  const projects = mapToProjectTotals(projectTotals);
  const daily = Array.from(dailyMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayProjects]) => {
      const dayProjectTotals = mapToProjectTotals(dayProjects);
      return {
        date,
        totalSeconds: dayProjectTotals.reduce((sum, project) => sum + project.seconds, 0),
        projects: dayProjectTotals
      };
    });

  return {
    configured: true,
    totalSeconds,
    daily,
    projects
  };
}

function labelProject(name: string, clientLabel: string, multiClient: boolean): string {
  return multiClient ? `${clientLabel} — ${name}` : name;
}

function addProjectTotal(totals: Map<string, number>, name: string, seconds: number) {
  totals.set(name, (totals.get(name) ?? 0) + seconds);
}

function mapToProjectTotals(totals: Map<string, number>): HubstaffProjectTotal[] {
  return Array.from(totals.entries())
    .map(([name, seconds]) => ({
      projectId: 0,
      name,
      seconds
    }))
    .sort((left, right) => right.seconds - left.seconds);
}
