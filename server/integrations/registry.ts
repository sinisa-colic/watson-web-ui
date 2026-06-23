import type { Express } from "express";
import type { ClientConfig } from "../clientConfig.js";
import { integrationEnabledClientCount } from "./client-resolution.js";
import {
  isJiraConfigured,
  legacyGlobalJiraConfig,
  normalizeJiraConfig,
  type ClientJiraConfig
} from "./issue-tracker/jira/config.js";
import { registerJiraRoutes } from "./issue-tracker/jira/routes.js";
import {
  isHubstaffConfigured,
  legacyGlobalHubstaffConfig,
  normalizeHubstaffConfig,
  type ClientHubstaffConfig
} from "./time-tracker/hubstaff/config.js";
import { registerHubstaffRoutes } from "./time-tracker/hubstaff/routes.js";
import type { IntegrationId, ReadClientQuery, ServerIntegration } from "./types.js";

export const jiraIntegration: ServerIntegration<ClientJiraConfig> = {
  id: "jira",
  kind: "issue-tracker",
  label: "Jira",
  configKey: "jira",
  enabledCountKey: "jiraEnabledClientCount",
  clientConfiguredKey: "jiraConfigured",
  normalizeConfig: normalizeJiraConfig,
  legacyGlobalConfig: legacyGlobalJiraConfig,
  isConfigured: isJiraConfigured,
  readClientConfig: (client) => client.jira,
  registerRoutes: registerJiraRoutes
};

export const hubstaffIntegration: ServerIntegration<ClientHubstaffConfig> = {
  id: "hubstaff",
  kind: "time-tracker",
  label: "Hubstaff",
  configKey: "hubstaff",
  enabledCountKey: "hubstaffEnabledClientCount",
  clientConfiguredKey: "hubstaffConfigured",
  normalizeConfig: normalizeHubstaffConfig,
  legacyGlobalConfig: legacyGlobalHubstaffConfig,
  isConfigured: isHubstaffConfigured,
  readClientConfig: (client) => client.hubstaff,
  registerRoutes: registerHubstaffRoutes
};

export const integrations = [jiraIntegration, hubstaffIntegration] as const;

export type IntegrationEnabledCounts = {
  jiraEnabledClientCount: number;
  hubstaffEnabledClientCount: number;
};

export function normalizeClientIntegrations(entry: Partial<ClientConfig>) {
  return {
    jira: jiraIntegration.normalizeConfig(entry.jira),
    hubstaff: hubstaffIntegration.normalizeConfig(entry.hubstaff)
  };
}

export function buildClientIntegrationFlags(client: ClientConfig): Record<`${IntegrationId}Configured`, boolean> {
  return {
    jiraConfigured: jiraIntegration.isConfigured(client.jira),
    hubstaffConfigured: hubstaffIntegration.isConfigured(client.hubstaff)
  };
}

export async function getIntegrationEnabledCounts(): Promise<IntegrationEnabledCounts> {
  const [jiraEnabledClientCount, hubstaffEnabledClientCount] = await Promise.all([
    integrationEnabledClientCount(jiraIntegration),
    integrationEnabledClientCount(hubstaffIntegration)
  ]);

  return {
    jiraEnabledClientCount,
    hubstaffEnabledClientCount
  };
}

export function mountIntegrationRoutes(app: Express, readClientQuery: ReadClientQuery) {
  for (const integration of integrations) {
    integration.registerRoutes(app, readClientQuery);
  }
}
