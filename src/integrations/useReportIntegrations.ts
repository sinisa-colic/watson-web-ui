import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { ClientOption, WatsonFrame, WatsonOptions, WatsonStatus } from "../types";
import { addDays, endOfMonth } from "../utils/time";
import { createJiraIntegration } from "./issue-tracker/jira";
import { buildReportDateRange, createHubstaffIntegration } from "./time-tracker/hubstaff";

export function useReportIntegrations(input: {
  range: Ref<string>;
  weekStart: Ref<Date>;
  monthStart: Ref<Date>;
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<ClientOption | null>;
}) {
  const jiraEnabledClientCount = ref(0);
  const hubstaffEnabledClientCount = ref(0);

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

  const jira = createJiraIntegration({
    selectedClientKey: input.selectedClientKey,
    selectedClient: input.selectedClient,
    jiraEnabledClientCount
  });

  const hubstaff = createHubstaffIntegration({
    selectedClientKey: input.selectedClientKey,
    selectedClient: input.selectedClient,
    hubstaffEnabledClientCount,
    reportDateRange
  });

  function applyOptions(options: WatsonOptions) {
    jiraEnabledClientCount.value = options.jiraEnabledClientCount ?? 0;
    hubstaffEnabledClientCount.value = options.hubstaffEnabledClientCount ?? 0;
  }

  async function loadForReport(nextStatus: WatsonStatus, nextFrames: WatsonFrame[], nextProjects: string[]) {
    await Promise.all([jira.load(nextStatus, nextFrames, nextProjects), hubstaff.load()]);
  }

  async function resetOnClientChange(nextStatus: WatsonStatus, nextFrames: WatsonFrame[], nextProjects: string[]) {
    jira.reset();
    hubstaff.reset();
    await loadForReport(nextStatus, nextFrames, nextProjects);
  }

  return {
    jiraEnabledClientCount,
    hubstaffEnabledClientCount,
    jira,
    hubstaff,
    applyOptions,
    loadForReport,
    resetOnClientChange
  };
}
