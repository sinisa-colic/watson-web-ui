import { env } from "../../server/clientConfig.js";
import { normalizeJiraConfig, type ClientJiraConfig } from "./definition.js";

const DEFAULT_JQL = "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC";

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
