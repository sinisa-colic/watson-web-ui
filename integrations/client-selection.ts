import type { ClientOption } from "../src/types";
import { definitions } from "./definitions";
import type { ApiIntegrationDefinition, IntegrationId } from "./types";

export const ALL_CLIENTS_KEY = "__all__";

export function buildIntegrationEndpoint(
  integration: ApiIntegrationDefinition,
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

export function isClientIntegrationConfigured(
  integration: ApiIntegrationDefinition,
  client: ClientOption | null | undefined
): boolean {
  return Boolean(client?.integrations[integration.id]);
}

export function shouldLoadIntegration(
  integration: ApiIntegrationDefinition,
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
  integration: ApiIntegrationDefinition,
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

export function integrationById(id: IntegrationId): ApiIntegrationDefinition {
  const match = definitions.find((entry) => entry.id === id);
  if (!match) {
    throw new Error(`Unknown integration: ${id}`);
  }
  return match;
}
