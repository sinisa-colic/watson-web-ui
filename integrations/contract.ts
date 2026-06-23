export interface IntegrationDefinition<TConfig = unknown> {
  id: string;
  label: string;
  apiPrefix: string;
  normalizeConfig(raw: TConfig | undefined): TConfig | undefined;
  isConfigured(config: TConfig | undefined): config is TConfig;
  legacyGlobalConfig(): TConfig | undefined;
}
