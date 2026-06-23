import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { ClientOption, WatsonFrame, WatsonStatus } from "../types";
import { api } from "../utils/api";
import { parseIssueKey } from "../utils/jira";
import { ALL_CLIENTS_KEY, buildIntegrationEndpoint, shouldLoadIntegration, shouldShowIntegration } from "./client-selection";
import type { PickerItem, SourceReport } from "./types";

export const jiraDefinition = {
  id: "jira" as const,
  label: "Jira",
  apiPrefix: "/api/jira" as const,
  clientConfiguredKey: "jiraConfigured" as const,
  enabledCountKey: "jiraEnabledClientCount" as const
};

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

type JiraLoaderContext = {
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<ClientOption | null>;
  jiraEnabledClientCount: Ref<number>;
};

export function createJiraIntegration(context: JiraLoaderContext) {
  const configured = ref(false);
  const sourceReports = ref<SourceReport[]>([]);
  const issues = ref<PickerItem[]>([]);
  const issueMap = ref<Record<string, PickerItem>>({});

  const showIssues = computed(() =>
    shouldShowIntegration(
      jiraDefinition,
      context.selectedClientKey.value,
      context.selectedClient.value,
      context.jiraEnabledClientCount.value,
      configured.value
    )
  );

  function looksLikeIssueKey(value: string) {
    return Boolean(parseIssueKey(value) || ISSUE_KEY_PATTERN.test(value.trim()));
  }

  function collectIssueKeys(...sources: Array<string | null | undefined>) {
    return [...new Set(sources.filter((value): value is string => Boolean(value)).filter(looksLikeIssueKey))];
  }

  function issueForProject(name: string): PickerItem | null {
    return issueMap.value[name.toUpperCase()] ?? null;
  }

  function projectLabel(name: string) {
    const issue = issueForProject(name);
    return issue ? `${name} - ${issue.summary}` : name;
  }

  function reset() {
    configured.value = false;
    issues.value = [];
    issueMap.value = {};
  }

  async function load(nextStatus: WatsonStatus, nextFrames: WatsonFrame[], nextProjects: string[]) {
    if (
      !shouldLoadIntegration(
        jiraDefinition,
        context.selectedClientKey.value,
        context.selectedClient.value,
        context.jiraEnabledClientCount.value
      )
    ) {
      reset();
      return;
    }

    const keys = collectIssueKeys(
      nextStatus.project ?? undefined,
      ...nextFrames.map((frame) => frame.project),
      ...nextProjects
    );
    const shouldFetchIssueMap = keys.length > 0;
    const shouldFetchIssues = shouldLoadIntegration(
      jiraDefinition,
      context.selectedClientKey.value,
      context.selectedClient.value,
      context.jiraEnabledClientCount.value
    );

    const [statusResponse, issuesResponse, mapResponse] = await Promise.all([
      api<{ configured: boolean }>(
        buildIntegrationEndpoint(jiraDefinition, "/status", context.selectedClientKey.value)
      ).catch(() => ({ configured: false })),
      shouldFetchIssues
        ? api<{ configured: boolean; issues: PickerItem[] }>(
            buildIntegrationEndpoint(jiraDefinition, "/issues", context.selectedClientKey.value)
          ).catch(() => ({ configured: false, issues: [] as PickerItem[] }))
        : Promise.resolve({ configured: false, issues: [] as PickerItem[] }),
      shouldFetchIssueMap
        ? api<Record<string, PickerItem>>(
            buildIntegrationEndpoint(jiraDefinition, "/issue-map", context.selectedClientKey.value, {
              keys: keys.join(",")
            })
          ).catch(() => ({}))
        : Promise.resolve({} as Record<string, PickerItem>)
    ]);

    configured.value = statusResponse.configured;
    issues.value = issuesResponse.issues ?? [];
    issueMap.value = mapResponse;
  }

  async function loadMissingIssueMap(...sources: Array<string | null | undefined>) {
    if (context.selectedClientKey.value === ALL_CLIENTS_KEY && context.jiraEnabledClientCount.value > 1) {
      return;
    }

    if (!configured.value) {
      return;
    }

    const keys = collectIssueKeys(...sources).filter((key) => !issueMap.value[key.toUpperCase()]);
    if (!keys.length) {
      return;
    }

    const nextIssues = await api<Record<string, PickerItem>>(
      buildIntegrationEndpoint(jiraDefinition, "/issue-map", context.selectedClientKey.value, {
        keys: keys.join(",")
      })
    ).catch(() => ({}));
    issueMap.value = { ...issueMap.value, ...nextIssues };
  }

  return {
    configured,
    sourceReports,
    issues,
    issueMap,
    showIssues,
    issueForProject,
    projectLabel,
    load,
    loadMissingIssueMap,
    reset
  };
}
