import type { ClientOption } from "../types";
import { integrations, type ClientIntegrationDefinition } from "./registry";
import type { IntegrationEnabledCounts, IntegrationId } from "./types";

export const ALL_CLIENTS_KEY = "__all__";

export function buildIntegrationEndpoint(
  integration: ClientIntegrationDefinition,
  endpoint: string,
  selectedClientKey: string,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams(extra);
  if (selectedClientKey !== ALL_CLIENTS_KEY) {
    params.set("client", selectedClientKey);
  }

  const query = params.toString();
  const path = `${integration.apiPrefix}${endpoint}`;
  return query ? `${path}?${query}` : path;
}

export function readEnabledCount(
  integration: ClientIntegrationDefinition,
  counts: IntegrationEnabledCounts
): number {
  return counts[integration.enabledCountKey];
}

export function isClientIntegrationConfigured(
  integration: ClientIntegrationDefinition,
  client: ClientOption | null | undefined
): boolean {
  return Boolean(client?.[integration.clientConfiguredKey]);
}

export function shouldLoadIntegration(
  integration: ClientIntegrationDefinition,
  selectedClientKey: string,
  selectedClient: ClientOption | null,
  enabledClientCount: number
): boolean {
  if (selectedClientKey !== ALL_CLIENTS_KEY) {
    return isClientIntegrationConfigured(integration, selectedClient);
  }

  return enabledClientCount <= 1;
}

export function shouldShowIntegration(
  integration: ClientIntegrationDefinition,
  selectedClientKey: string,
  selectedClient: ClientOption | null,
  enabledClientCount: number,
  apiConfigured: boolean
): boolean {
  if (selectedClientKey === ALL_CLIENTS_KEY) {
    return enabledClientCount <= 1 && apiConfigured;
  }

  return isClientIntegrationConfigured(integration, selectedClient) && apiConfigured;
}

export function integrationById(id: IntegrationId): ClientIntegrationDefinition {
  const match = integrations.find((entry) => entry.id === id);
  if (!match) {
    throw new Error(`Unknown integration: ${id}`);
  }
  return match;
}
