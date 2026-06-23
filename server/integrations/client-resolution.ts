import { loadClientRegistry, type ClientConfig } from "../clientConfig.js";
import type { ResolvedIntegrationConfig, ServerIntegration } from "./types.js";

export type IntegrationResolver<TConfig> = Pick<
  ServerIntegration<TConfig>,
  "legacyGlobalConfig" | "isConfigured" | "readClientConfig"
>;

export async function resolveIntegrationConfig<TConfig>(
  resolver: IntegrationResolver<TConfig>,
  clientKey?: string | null
): Promise<ResolvedIntegrationConfig<TConfig> | null> {
  const registry = await loadClientRegistry();

  if (registry) {
    if (clientKey) {
      const client = registry.clients.find((entry) => entry.key === clientKey);
      const config = client ? resolver.readClientConfig(client) : undefined;
      if (config) {
        return { ...config, clientKey: client!.key };
      }
      return null;
    }

    const configuredClients = registry.clients.filter((client) =>
      resolver.isConfigured(resolver.readClientConfig(client))
    );

    if (configuredClients.length === 1) {
      const client = configuredClients[0];
      return { ...resolver.readClientConfig(client)!, clientKey: client.key };
    }

    return null;
  }

  const legacy = resolver.legacyGlobalConfig();
  if (!legacy) {
    return null;
  }

  return { ...legacy, clientKey: "legacy" };
}

export async function integrationEnabledClientCount<TConfig>(
  integration: IntegrationResolver<TConfig>
): Promise<number> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return integration.isConfigured(integration.legacyGlobalConfig()) ? 1 : 0;
  }

  return registry.clients.filter((client) =>
    integration.isConfigured(integration.readClientConfig(client))
  ).length;
}
