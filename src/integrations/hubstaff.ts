import { ref, type ComputedRef } from "vue";
import type { ClientOption } from "../types";
import { api } from "../utils/api";
import { formatDay, toLocalDate, addDays } from "../utils/time";
import { buildIntegrationEndpoint } from "./client-selection";
import type {
  DayReport,
  HubstaffReport,
  PickerItem,
  ReportDateRange,
  SourceReport
} from "./types";

export const hubstaffDefinition = {
  id: "hubstaff" as const,
  label: "Hubstaff",
  apiPrefix: "/api/hubstaff" as const,
  clientConfiguredKey: "hubstaffConfigured" as const,
  enabledCountKey: "hubstaffEnabledClientCount" as const
};

type HubstaffLoaderContext = {
  clientOptions: ComputedRef<ClientOption[]>;
  reportDateRange: ComputedRef<ReportDateRange>;
};

function configuredClients(clientOptions: ClientOption[]): ClientOption[] {
  return clientOptions.filter((client) => client.hubstaffConfigured);
}

function reportToSource(
  clientKey: string,
  clientLabel: string,
  report: HubstaffReport
): SourceReport | null {
  if (!report.configured) {
    return null;
  }

  const byClient = report.projects.map((project) => ({
    name: project.name,
    duration: project.seconds * 1000
  }));

  const daily: DayReport[] = report.daily.map((day) => ({
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

function projectsToPickerItems(report: HubstaffReport, clientLabel: string): PickerItem[] {
  return report.projects.map((project) => ({
    key: project.name,
    summary: `${clientLabel} — tracked ${Math.round(project.seconds / 60)}m`
  }));
}

export function createHubstaffIntegration(context: HubstaffLoaderContext) {
  const configured = ref(false);
  const sourceReports = ref<SourceReport[]>([]);
  const issues = ref<PickerItem[]>([]);
  const issueMap = ref<Record<string, PickerItem>>({});

  function reset() {
    configured.value = false;
    sourceReports.value = [];
    issues.value = [];
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

    issues.value = entries
      .filter((entry) => entry.statusConfigured)
      .flatMap((entry) => projectsToPickerItems(entry.report, entry.client.label));
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
