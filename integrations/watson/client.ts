import { ref, type ComputedRef } from "vue";
import type { ClientOption, WatsonFrame } from "../../src/types";
import { api } from "../../src/utils/api";
import { frameDuration } from "../../src/utils/time";
import type { DayReport, PickerItem, ReportDateRange, SourceReport } from "../types";
import { watsonDefinition } from "./definition";

type WatsonLoaderContext = {
  clientOptions: ComputedRef<ClientOption[]>;
  reportDateRange: ComputedRef<ReportDateRange>;
};

function buildFramesPath(reportDateRange: ReportDateRange): string {
  const { from, to } = reportDateRange;
  if (from === to) {
    return `/api/frames?range=day`;
  }
  return `/api/frames?range=week&from=${from}&to=${to}`;
}

export function buildReport(frames: WatsonFrame[], clients: ClientOption[]): SourceReport {
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

  const daily: DayReport[] = Array.from(dayMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, day]) => ({
      date,
      totalMs: day.totalMs,
      byClient: sortedTotals(day.byClient),
      byProject: sortedTotals(day.byProject)
    }));

  return {
    id: watsonDefinition.id,
    label: watsonDefinition.label,
    totalMs: frames.reduce((sum, frame) => sum + frameDuration(frame), 0),
    byClient: sortedTotals(byClientTotals),
    byProject: sortedTotals(byProjectTotals),
    daily,
    supportsIssueKeys: true,
    editable: true
  };
}

function sortedTotals(totals: Map<string, number>) {
  return Array.from(totals.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((left, right) => right.duration - left.duration);
}

export function createLoader(context: WatsonLoaderContext) {
  const frames = ref<WatsonFrame[]>([]);
  const allFrames = ref<WatsonFrame[]>([]);
  const sourceReports = ref<SourceReport[]>([]);
  const issues = ref<PickerItem[]>([]);
  const issueMap = ref<Record<string, PickerItem>>({});

  async function load() {
    const [nextFrames, nextAllFrames] = await Promise.all([
      api<WatsonFrame[]>(buildFramesPath(context.reportDateRange.value)),
      api<WatsonFrame[]>("/api/frames?range=all")
    ]);
    frames.value = nextFrames;
    allFrames.value = nextAllFrames;

    const report = buildReport(nextFrames, context.clientOptions.value);
    sourceReports.value = report.totalMs === 0 && report.daily.length === 0 ? [] : [report];
  }

  function reset() {
    frames.value = [];
    allFrames.value = [];
    sourceReports.value = [];
  }

  return { frames, allFrames, sourceReports, issues, issueMap, load, reset };
}
