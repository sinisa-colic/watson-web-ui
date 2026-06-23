import type { ClientOption, WatsonFrame } from "../../types";
import { frameDuration } from "../../utils/time";
import type { TimeTrackerDayReport, TimeTrackerSourceReport } from "./types";

export const WATSON_TIME_TRACKER_ID = "watson";

export function buildWatsonTimeTrackerReport(
  frames: WatsonFrame[],
  clients: ClientOption[]
): TimeTrackerSourceReport {
  const clientByTag = new Map(clients.map((client) => [client.tag, client.label]));
  const byClientTotals = new Map<string, number>();
  const byProjectTotals = new Map<string, number>();
  const dayMap = new Map<
    string,
    { totalMs: number; byClient: Map<string, number>; byProject: Map<string, number> }
  >();

  for (const frame of frames) {
    const duration = frameDuration(frame);
    byProjectTotals.set(frame.project, (byProjectTotals.get(frame.project) ?? 0) + duration);

    const clientTag = frame.tags.find((tag) => clientByTag.has(tag));
    const clientLabel = clientTag ? (clientByTag.get(clientTag) ?? clientTag) : null;
    if (clientLabel) {
      byClientTotals.set(clientLabel, (byClientTotals.get(clientLabel) ?? 0) + duration);
    }

    const dateKey = new Date(frame.start).toLocaleDateString("en-CA");
    const day =
      dayMap.get(dateKey) ??
      { totalMs: 0, byClient: new Map<string, number>(), byProject: new Map<string, number>() };

    day.totalMs += duration;
    day.byProject.set(frame.project, (day.byProject.get(frame.project) ?? 0) + duration);
    if (clientLabel) {
      day.byClient.set(clientLabel, (day.byClient.get(clientLabel) ?? 0) + duration);
    }
    dayMap.set(dateKey, day);
  }

  const daily: TimeTrackerDayReport[] = Array.from(dayMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, day]) => ({
      date,
      totalMs: day.totalMs,
      byClient: mapTotals(day.byClient),
      byProject: mapTotals(day.byProject)
    }));

  return {
    id: WATSON_TIME_TRACKER_ID,
    label: "Watson",
    totalMs: frames.reduce((sum, frame) => sum + frameDuration(frame), 0),
    byClient: mapTotals(byClientTotals),
    byProject: mapTotals(byProjectTotals),
    daily
  };
}

function mapTotals(totals: Map<string, number>) {
  return Array.from(totals.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((left, right) => right.duration - left.duration);
}
