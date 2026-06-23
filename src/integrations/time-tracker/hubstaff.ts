import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { HubstaffReport, ProjectTotal } from "../../types";
import { api } from "../../utils/api";
import { addDays, toLocalDate } from "../../utils/time";
import { buildIntegrationEndpoint, shouldLoadIntegration, shouldShowIntegration } from "../client-selection";
import { hubstaffIntegration } from "../registry";
import type { ReportDateRange } from "../types";

type HubstaffLoaderContext = {
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<{ hubstaffConfigured?: boolean } | null>;
  hubstaffEnabledClientCount: Ref<number>;
  reportDateRange: ComputedRef<ReportDateRange>;
};

export function createHubstaffIntegration(context: HubstaffLoaderContext) {
  const configured = ref(false);
  const report = ref<HubstaffReport | null>(null);

  const showReport = computed(() =>
    shouldShowIntegration(
      hubstaffIntegration,
      context.selectedClientKey.value,
      context.selectedClient.value,
      context.hubstaffEnabledClientCount.value,
      configured.value
    )
  );

  const totalMs = computed(() => (report.value?.totalSeconds ?? 0) * 1000);

  const totalsByProject = computed<ProjectTotal[]>(() =>
    (report.value?.projects ?? [])
      .map((project) => ({
        name: project.name,
        duration: project.seconds * 1000
      }))
      .sort((left, right) => right.duration - left.duration)
  );

  const dailySeconds = computed(() => {
    const map = new Map<string, number>();
    for (const day of report.value?.daily ?? []) {
      map.set(day.date, day.totalSeconds);
    }
    return map;
  });

  const dailyProjects = computed(() => {
    const map = new Map<string, ProjectTotal[]>();
    for (const day of report.value?.daily ?? []) {
      map.set(
        day.date,
        day.projects
          .map((project) => ({
            name: project.name,
            duration: project.seconds * 1000
          }))
          .sort((left, right) => right.duration - left.duration)
      );
    }
    return map;
  });

  function reset() {
    configured.value = false;
    report.value = null;
  }

  async function load() {
    if (
      !shouldLoadIntegration(
        hubstaffIntegration,
        context.selectedClientKey.value,
        context.selectedClient.value,
        context.hubstaffEnabledClientCount.value
      )
    ) {
      reset();
      return;
    }

    const { from, to } = context.reportDateRange.value;
    const [statusResponse, reportResponse] = await Promise.all([
      api<{ configured: boolean }>(
        buildIntegrationEndpoint(hubstaffIntegration, "/status", context.selectedClientKey.value)
      ).catch(() => ({ configured: false })),
      api<HubstaffReport>(
        buildIntegrationEndpoint(hubstaffIntegration, "/report", context.selectedClientKey.value, { from, to })
      ).catch(() => ({
        configured: false,
        totalSeconds: 0,
        daily: [],
        projects: []
      }))
    ]);

    configured.value = statusResponse.configured;
    report.value = reportResponse.configured ? reportResponse : null;
  }

  return {
    configured,
    report,
    showReport,
    totalMs,
    totalsByProject,
    dailySeconds,
    dailyProjects,
    load,
    reset
  };
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
