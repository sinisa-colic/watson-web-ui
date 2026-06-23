import type { Express } from "express";
import type { ClientConfig } from "../server/clientConfig.js";
import type { IntegrationDefinition } from "./contract.js";
import {
  hubstaffDefinition,
  isHubstaffConfigured,
  normalizeHubstaffConfig,
  type ClientHubstaffConfig
} from "./hubstaff/definition.js";
import { legacyGlobalHubstaffConfig } from "./hubstaff/legacy-config.js";
import { registerRoutes as registerHubstaffRoutes } from "./hubstaff/server.js";
import {
  isJiraConfigured,
  jiraDefinition,
  normalizeJiraConfig,
  type ClientJiraConfig
} from "./jira/definition.js";
import { legacyGlobalJiraConfig } from "./jira/legacy-config.js";
import { registerRoutes as registerJiraRoutes } from "./jira/server.js";
import { integrationEnabledClientCount, type IntegrationResolver, type ReadClientQuery } from "../server/client-resolution.js";

interface ServerIntegration<TConfig> extends IntegrationDefinition<TConfig> {
  readClientConfig(client: ClientConfig): TConfig | undefined;
  registerRoutes(app: Express, readClientQuery: ReadClientQuery): void;
}

const jiraIntegration: ServerIntegration<ClientJiraConfig> = {
  ...jiraDefinition,
  normalizeConfig: normalizeJiraConfig,
  isConfigured: isJiraConfigured,
  legacyGlobalConfig: legacyGlobalJiraConfig,
  readClientConfig: (client) => client.jira,
  registerRoutes: registerJiraRoutes
};

const hubstaffIntegration: ServerIntegration<ClientHubstaffConfig> = {
  ...hubstaffDefinition,
  normalizeConfig: normalizeHubstaffConfig,
  isConfigured: isHubstaffConfigured,
  legacyGlobalConfig: legacyGlobalHubstaffConfig,
  readClientConfig: (client) => client.hubstaff,
  registerRoutes: registerHubstaffRoutes
};

const integrations = [jiraIntegration, hubstaffIntegration] as const;

export type { ReadClientQuery };

export function normalizeClientIntegrations(entry: Partial<ClientConfig>) {
  return {
    jira: jiraIntegration.normalizeConfig(entry.jira),
    hubstaff: hubstaffIntegration.normalizeConfig(entry.hubstaff)
  };
}

export function buildClientIntegrationFlags(client: ClientConfig): { integrations: Record<string, boolean> } {
  const flags: Record<string, boolean> = {};
  for (const integration of integrations) {
    const resolver = integration as IntegrationResolver<unknown>;
    flags[integration.id] = resolver.isConfigured(resolver.readClientConfig(client));
  }
  return { integrations: flags };
}

export async function getIntegrationEnabledCounts(): Promise<{ integrationEnabledCounts: Record<string, number> }> {
  const results = await Promise.all(
    integrations.map(async (integration) => ({
      id: integration.id,
      count: await integrationEnabledClientCount(integration as IntegrationResolver<unknown>)
    }))
  );
  const counts: Record<string, number> = {};
  for (const { id, count } of results) {
    counts[id] = count;
  }
  return { integrationEnabledCounts: counts };
}

export function mountIntegrationRoutes(app: Express, readClientQuery: ReadClientQuery) {
  for (const integration of integrations) {
    integration.registerRoutes(app, readClientQuery);
  }
}
