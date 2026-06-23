import { ref, type ComputedRef, type Ref } from "vue";
import type { ClientOption } from "../../src/types";
import { api } from "../../src/utils/api";
import { addDays, toLocalDate } from "../../src/utils/time";
import {
  ALL_CLIENTS_KEY,
  buildIntegrationEndpoint,
  shouldLoadIntegration
} from "../client-selection";
import { hubstaffDefinition } from "./definition";
import type {
  DayReport,
  HubstaffReport,
  HubstaffTaskOption,
  PickerItem,
  ReportDateRange,
  SourceReport
} from "../types";

type HubstaffLoaderContext = {
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<ClientOption | null>;
  enabledCount: ComputedRef<number>;
  clientOptions: ComputedRef<ClientOption[]>;
  reportDateRange: ComputedRef<ReportDateRange>;
};

function configuredClients(clientOptions: ClientOption[]): ClientOption[] {
  return clientOptions.filter((client) => client.integrations["hubstaff"]);
}

function clientsForHubstaffPicker(context: HubstaffLoaderContext): ClientOption[] {
  if (
    !shouldLoadIntegration(
      hubstaffDefinition,
      context.selectedClientKey.value,
      context.selectedClient.value,
      context.enabledCount.value
    )
  ) {
    return [];
  }

  if (context.selectedClientKey.value !== ALL_CLIENTS_KEY) {
    const client = context.selectedClient.value;
    return client?.integrations.hubstaff ? [client] : [];
  }

  return configuredClients(context.clientOptions.value);
}

export function reportToSource(
  clientKey: string,
  clientLabel: string,
  report: HubstaffReport
): SourceReport | null {
  if (!report.configured) {
    return null;
  }

  const byProject = report.projects.map((project) => ({
    name: project.name,
    duration: project.seconds * 1000
  }));

  const daily: DayReport[] = report.daily.map((day) => ({
    date: day.date,
    totalMs: day.totalSeconds * 1000,
    byClient: [],
    byProject: day.projects.map((project) => ({
      name: project.name,
      duration: project.seconds * 1000
    }))
  }));

  return {
    id: `hubstaff:${clientKey}`,
    label: clientLabel,
    totalMs: report.totalSeconds * 1000,
    byClient: [],
    byProject,
    daily
  };
}

export function projectsToPickerItems(report: HubstaffReport, clientLabel: string): PickerItem[] {
  return report.projects.map((project) => ({
    key: project.name,
    summary: `${clientLabel} — tracked ${Math.round(project.seconds / 60)}m`
  }));
}

export function hubstaffTasksToPickerItems(tasks: HubstaffTaskOption[], clientLabel: string): PickerItem[] {
  const uniqueTasks: HubstaffTaskOption[] = [];
  const seenTaskKeys = new Set<string>();

  for (const task of tasks) {
    const dedupeKey = `${task.projectId}:${task.summary}`;
    if (seenTaskKeys.has(dedupeKey)) {
      continue;
    }
    seenTaskKeys.add(dedupeKey);
    uniqueTasks.push(task);
  }

  const summaryCounts = new Map<string, number>();
  for (const task of uniqueTasks) {
    summaryCounts.set(task.summary, (summaryCounts.get(task.summary) ?? 0) + 1);
  }

  return uniqueTasks.map((task) => {
    const duplicateSummary = (summaryCounts.get(task.summary) ?? 0) > 1;
    const key = duplicateSummary ? `${task.projectName}: ${task.summary}` : task.summary;

    return {
      key,
      summary: duplicateSummary ? `${clientLabel} · ${task.projectName}` : clientLabel
    };
  });
}

export function buildHubstaffIssueMap(items: PickerItem[], tasks: HubstaffTaskOption[]): Record<string, PickerItem> {
  const map: Record<string, PickerItem> = {};
  const itemsByKey = new Map(items.map((item) => [item.key, item]));

  for (const item of items) {
    map[item.key.toUpperCase()] = item;
  }

  for (const task of tasks) {
    const item = itemsByKey.get(`${task.projectName}: ${task.summary}`) ?? itemsByKey.get(task.summary);
    if (item) {
      map[task.summary.toUpperCase()] = item;
    }
  }

  return map;
}

export function createLoader(context: HubstaffLoaderContext) {
  const configured = ref(false);
  const sourceReports = ref<SourceReport[]>([]);
  const issues = ref<PickerItem[]>([]);
  const issueMap = ref<Record<string, PickerItem>>({});

  function reset() {
    configured.value = false;
    sourceReports.value = [];
    issues.value = [];
    issueMap.value = {};
  }

  async function loadPickerTasks() {
    const clients = clientsForHubstaffPicker(context);
    if (!clients.length) {
      issues.value = [];
      issueMap.value = {};
      return;
    }

    const entries = await Promise.all(
      clients.map(async (client) => {
        const response = await api<{ configured: boolean; tasks: HubstaffTaskOption[] }>(
          buildIntegrationEndpoint(hubstaffDefinition, "/tasks", client.key)
        ).catch(() => ({ configured: false, tasks: [] as HubstaffTaskOption[] }));

        return { client, tasks: response.tasks ?? [] };
      })
    );

    issues.value = entries.flatMap(({ client, tasks }) => hubstaffTasksToPickerItems(tasks, client.label));
    const allTasks = entries.flatMap(({ tasks }) => tasks);
    issueMap.value = buildHubstaffIssueMap(issues.value, allTasks);
  }

  async function load() {
    const clients = configuredClients(context.clientOptions.value);
    if (!clients.length) {
      reset();
      return;
    }

    const { from, to } = context.reportDateRange.value;
    const entries = await Promise.all(
      clients.map(async (client) => {
        const [statusResponse, reportResponse] = await Promise.all([
          api<{ configured: boolean }>(
            buildIntegrationEndpoint(hubstaffDefinition, "/status", client.key)
          ).catch(() => ({ configured: false })),
          api<HubstaffReport>(
            buildIntegrationEndpoint(hubstaffDefinition, "/report", client.key, { from, to })
          ).catch(() => ({
            configured: false,
            totalSeconds: 0,
            daily: [],
            projects: []
          }))
        ]);

        return { client, statusConfigured: statusResponse.configured, report: reportResponse };
      })
    );

    configured.value = entries.some((entry) => entry.statusConfigured);

    sourceReports.value = entries
      .filter((entry) => entry.statusConfigured)
      .map((entry) => reportToSource(entry.client.key, entry.client.label, entry.report))
      .filter((entry): entry is SourceReport => entry !== null);

    await loadPickerTasks();
  }

  return { configured, sourceReports, issues, issueMap, load, reset };
}

export function buildReportDateRange(input: {
  range: string;
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  monthEnd: Date;
}): ReportDateRange {
  const today = toLocalDate(new Date());

  if (input.range === "day") {
    return { from: today, to: today };
  }

  if (input.range === "month") {
    return { from: toLocalDate(input.monthStart), to: toLocalDate(input.monthEnd) };
  }

  if (input.range === "week") {
    return { from: toLocalDate(input.weekStart), to: toLocalDate(input.weekEnd) };
  }

  return { from: toLocalDate(addDays(new Date(), -364)), to: today };
}
