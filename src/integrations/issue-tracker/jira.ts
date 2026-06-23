import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { JiraIssue, WatsonFrame, WatsonStatus } from "../types";
import { api } from "../utils/api";
import { parseIssueKey } from "../utils/jira";
import {
  ALL_CLIENTS_KEY,
  buildIntegrationEndpoint,
  shouldLoadIntegration,
  shouldShowIntegration
} from "../client-selection";
import { jiraIntegration } from "../registry";

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

type JiraLoaderContext = {
  selectedClientKey: Ref<string>;
  selectedClient: ComputedRef<{ jiraConfigured?: boolean } | null>;
  jiraEnabledClientCount: Ref<number>;
};

export function createJiraIntegration(context: JiraLoaderContext) {
  const configured = ref(false);
  const issues = ref<JiraIssue[]>([]);
  const issueMap = ref<Record<string, JiraIssue>>({});

  const showIssues = computed(() =>
    shouldShowIntegration(
      jiraIntegration,
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

  function issueForProject(name: string): JiraIssue | null {
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
        jiraIntegration,
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
    const shouldFetchIssueMap =
      keys.length > 0 &&
      shouldLoadIntegration(
        jiraIntegration,
        context.selectedClientKey.value,
        context.selectedClient.value,
        context.jiraEnabledClientCount.value
      );
    const shouldFetchIssues = shouldLoadIntegration(
      jiraIntegration,
      context.selectedClientKey.value,
      context.selectedClient.value,
      context.jiraEnabledClientCount.value
    );

    const [statusResponse, issuesResponse, mapResponse] = await Promise.all([
      api<{ configured: boolean }>(
        buildIntegrationEndpoint(jiraIntegration, "/status", context.selectedClientKey.value)
      ).catch(() => ({ configured: false })),
      shouldFetchIssues
        ? api<{ configured: boolean; issues: JiraIssue[] }>(
            buildIntegrationEndpoint(jiraIntegration, "/issues", context.selectedClientKey.value)
          ).catch(() => ({
            configured: false,
            issues: []
          }))
        : Promise.resolve({ configured: false, issues: [] }),
      shouldFetchIssueMap
        ? api<Record<string, JiraIssue>>(
            buildIntegrationEndpoint(jiraIntegration, "/issue-map", context.selectedClientKey.value, {
              keys: keys.join(",")
            })
          ).catch(() => ({}))
        : Promise.resolve({})
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

    const nextIssues = await api<Record<string, JiraIssue>>(
      buildIntegrationEndpoint(jiraIntegration, "/issue-map", context.selectedClientKey.value, {
        keys: keys.join(",")
      })
    ).catch(() => ({}));
    issueMap.value = { ...issueMap.value, ...nextIssues };
  }

  return {
    configured,
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
