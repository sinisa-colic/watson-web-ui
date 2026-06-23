export {
  buildClientIntegrationFlags,
  getIntegrationEnabledCounts,
  hubstaffIntegration,
  integrations,
  jiraIntegration,
  mountIntegrationRoutes,
  normalizeClientIntegrations,
  type IntegrationEnabledCounts
} from "./registry.js";

export type { IntegrationId, IntegrationKind, ReadClientQuery, ServerIntegration } from "./types.js";

export type { ClientJiraConfig, ResolvedJiraConfig } from "./issue-tracker/jira/config.js";
export type { ClientHubstaffConfig, ResolvedHubstaffConfig } from "./time-tracker/hubstaff/config.js";

export {
  fetchIssueMap,
  fetchMyIssues,
  jiraStatusForClient,
  looksLikeIssueKey,
  type JiraIssue
} from "./issue-tracker/jira/service.js";

export { fetchHubstaffReport, hubstaffStatusForClient, type HubstaffReport } from "./time-tracker/hubstaff/service.js";
