import { env } from "../../../clientConfig.js";

export type ClientJiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
};

export type ResolvedJiraConfig = ClientJiraConfig & {
  clientKey: string;
};

const DEFAULT_JQL = "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC";

export function normalizeJiraConfig(jira: ClientJiraConfig | undefined): ClientJiraConfig | undefined {
  if (!jira) {
    return undefined;
  }

  const baseUrl = jira.baseUrl.trim();
  const email = jira.email.trim();
  const apiToken = jira.apiToken.trim();
  const jql = jira.jql.trim() || DEFAULT_JQL;

  const values = [baseUrl, email, apiToken];
  const filled = values.filter(Boolean).length;

  if (filled === 0) {
    return undefined;
  }

  if (filled !== 3) {
    throw new Error("Jira config must include baseUrl, email, and apiToken together, or leave all empty.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    email,
    apiToken,
    jql
  };
}

export function legacyGlobalJiraConfig(): ClientJiraConfig | undefined {
  const baseUrl = env("JIRA_BASE_URL");
  const email = env("JIRA_EMAIL");
  const apiToken = env("JIRA_API_TOKEN");

  if (!baseUrl || !email || !apiToken) {
    return undefined;
  }

  return normalizeJiraConfig({
    baseUrl,
    email,
    apiToken,
    jql: env("JIRA_JQL", DEFAULT_JQL)
  });
}

export function isJiraConfigured(config: ClientJiraConfig | undefined): config is ClientJiraConfig {
  return Boolean(config?.baseUrl && config.email && config.apiToken);
}
