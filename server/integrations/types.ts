import type { Express, Request } from "express";
import type { ClientConfig } from "../clientConfig.js";

export type IntegrationKind = "issue-tracker" | "time-tracker";

export type IntegrationId = "jira" | "hubstaff";

export type ReadClientQuery = (request: Request) => string | undefined;

export type ServerIntegration<TConfig> = {
  id: IntegrationId;
  kind: IntegrationKind;
  label: string;
  configKey: IntegrationConfigKey;
  enabledCountKey: `${IntegrationId}EnabledClientCount`;
  clientConfiguredKey: `${IntegrationId}Configured`;
  normalizeConfig: (raw: TConfig | undefined) => TConfig | undefined;
  legacyGlobalConfig: () => TConfig | undefined;
  isConfigured: (config: TConfig | undefined) => config is TConfig;
  readClientConfig: (client: ClientConfig) => TConfig | undefined;
  registerRoutes: (app: Express, readClientQuery: ReadClientQuery) => void;
};

export type IntegrationConfigKey = "jira" | "hubstaff";

export type ResolvedIntegrationConfig<TConfig> = TConfig & {
  clientKey: string;
};
