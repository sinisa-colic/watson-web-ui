import type { IntegrationId, IntegrationKind } from "./types";

export type ClientIntegrationDefinition = {
  id: IntegrationId;
  kind: IntegrationKind;
  label: string;
  apiPrefix: `/api/${IntegrationId}`;
  clientConfiguredKey: `${IntegrationId}Configured`;
  enabledCountKey: `${IntegrationId}EnabledClientCount`;
};

export const jiraIntegration: ClientIntegrationDefinition = {
  id: "jira",
  kind: "issue-tracker",
  label: "Jira",
  apiPrefix: "/api/jira",
  clientConfiguredKey: "jiraConfigured",
  enabledCountKey: "jiraEnabledClientCount"
};

export const hubstaffIntegration: ClientIntegrationDefinition = {
  id: "hubstaff",
  kind: "time-tracker",
  label: "Hubstaff",
  apiPrefix: "/api/hubstaff",
  clientConfiguredKey: "hubstaffConfigured",
  enabledCountKey: "hubstaffEnabledClientCount"
};

export const issueTrackerIntegrations = [jiraIntegration] as const;
export const timeTrackerIntegrations = [hubstaffIntegration] as const;
export const integrations = [...issueTrackerIntegrations, ...timeTrackerIntegrations] as const;
