import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { ClientOption, WatsonFrame, WatsonOptions, WatsonStatus } from "../types";
import { addDays, endOfMonth } from "../utils/time";
import { buildReportDateRange } from "#integrations/hubstaff/client";
import { ALL_CLIENTS_KEY } from "#integrations/client-selection";
import { createHubstaffLoader, createJiraLoader, createWatsonLoader } from "#integrations/client-manifest";
import type { PickerItem, SourceReport, UnifiedDaySummary } from "#integrations/types";
import { mergeUnifiedDays } from "#integrations/unified-days";

export function useReportIntegrations(input: {
  range: Ref<string>;
  weekStart: Ref<Date>;
  monthStart: Ref<Date>;
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<ClientOption | null>;
  clientOptions: ComputedRef<ClientOption[]>;
}) {
  const enabledCounts = ref<Record<string, number>>({});

  const weekEnd = computed(() => addDays(input.weekStart.value, 6));
  const monthEnd = computed(() => endOfMonth(input.monthStart.value));

  const reportDateRange = computed(() =>
    buildReportDateRange({
      range: input.range.value,
      weekStart: input.weekStart.value,
      weekEnd: weekEnd.value,
      monthStart: input.monthStart.value,
      monthEnd: monthEnd.value
    })
  );

  const jira = createJiraLoader({
    selectedClientKey: input.selectedClientKey,
    selectedClient: input.selectedClient,
    enabledCount: computed(() => enabledCounts.value["jira"] ?? 0)
  });

  const watson = createWatsonLoader({
    clientOptions: input.clientOptions,
    reportDateRange
  });

  const hubstaff = createHubstaffLoader({
    selectedClientKey: input.selectedClientKey,
    selectedClient: input.selectedClient,
    enabledCount: computed(() => enabledCounts.value["hubstaff"] ?? 0),
    clientOptions: input.clientOptions,
    reportDateRange
  });

  const sourceReports = computed<SourceReport[]>(() => {
    const showWatson =
      input.selectedClientKey.value === ALL_CLIENTS_KEY ||
      input.selectedClient.value?.watsonTracking !== false;

    return [
      ...(showWatson ? watson.sourceReports.value : []),
      ...hubstaff.sourceReports.value,
      ...jira.sourceReports.value
    ];
  });

  const unifiedDailySummaries = computed<UnifiedDaySummary[]>(() =>
    mergeUnifiedDays(sourceReports.value)
  );

  const maxUnifiedDailyMs = computed(() =>
    Math.max(...unifiedDailySummaries.value.map((day) => day.totalMs), 1)
  );

  const allIssues = computed<PickerItem[]>(() => [
    ...jira.issues.value,
    ...hubstaff.issues.value,
    ...watson.issues.value
  ]);

  const allIssueMap = computed<Record<string, PickerItem>>(() => ({
    ...watson.issueMap.value,
    ...hubstaff.issueMap.value,
    ...jira.issueMap.value
  }));

  function issueForProject(name: string): PickerItem | null {
    return allIssueMap.value[name.toUpperCase()] ?? null;
  }

  function projectLabel(name: string): string {
    const item = issueForProject(name);
    return item ? `${name} - ${item.summary}` : name;
  }

  function applyOptions(options: WatsonOptions) {
    enabledCounts.value = options.integrationEnabledCounts ?? {};
  }

  function localFrames(): WatsonFrame[] {
    if (
      input.selectedClientKey.value !== ALL_CLIENTS_KEY &&
      input.selectedClient.value?.watsonTracking === false
    ) {
      return [];
    }

    return watson.frames.value;
  }

  async function loadMissingEnrichment(...sources: Array<string | null | undefined>) {
    await jira.loadMissingIssueMap(...sources);
  }

  async function reloadLocalFrames() {
    await watson.load();
  }

  async function loadForReport(nextStatus: WatsonStatus, nextProjects: string[]) {
    await Promise.all([watson.load(), hubstaff.load()]);
    await jira.load(nextStatus, watson.frames.value, nextProjects);
  }

  async function resetOnClientChange(nextStatus: WatsonStatus, nextProjects: string[]) {
    watson.reset();
    hubstaff.reset();
    jira.reset();
    await loadForReport(nextStatus, nextProjects);
  }

  return {
    sourceReports,
    unifiedDailySummaries,
    maxUnifiedDailyMs,
    allIssues,
    allIssueMap,
    issueForProject,
    projectLabel,
    localFrames,
    localAllFrames: watson.allFrames,
    loadMissingEnrichment,
    reloadLocalFrames,
    applyOptions,
    loadForReport,
    resetOnClientChange
  };
}
