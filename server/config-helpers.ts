import { env } from "./clientConfig.js";
import { legacyGlobalHubstaffConfig } from "../integrations/hubstaff/legacy-config.js";
import { normalizeHubstaffConfig, type ClientHubstaffConfig } from "../integrations/hubstaff/definition.js";
import { legacyGlobalJiraConfig } from "../integrations/jira/legacy-config.js";
import { normalizeJiraConfig, type ClientJiraConfig } from "../integrations/jira/definition.js";

function parseProjectIds(raw: string): number[] | undefined {
  const values = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.length) {
    return undefined;
  }

  const projectIds = values
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return projectIds.length ? projectIds : undefined;
}

type EnvPrefixOptions = {
  fallbackToGlobal?: boolean;
  taskProjectIds?: number[];
};

export function jiraFromEnv(prefix: string, options: EnvPrefixOptions = {}): ClientJiraConfig | undefined {
  const global = options.fallbackToGlobal ? legacyGlobalJiraConfig() : undefined;

  return normalizeJiraConfig({
    baseUrl: env(`${prefix}_JIRA_BASE_URL`, global?.baseUrl ?? ""),
    email: env(`${prefix}_JIRA_EMAIL`, global?.email ?? ""),
    apiToken: env(`${prefix}_JIRA_API_TOKEN`, global?.apiToken ?? ""),
    jql: env(`${prefix}_JIRA_JQL`, global?.jql ?? "")
  });
}

export function hubstaffFromEnv(
  prefix: string,
  projectIds?: number[],
  options: EnvPrefixOptions = {}
): ClientHubstaffConfig | undefined {
  const global = options.fallbackToGlobal ? legacyGlobalHubstaffConfig() : undefined;
  const envProjectIds = parseProjectIds(env(`${prefix}_HUBSTAFF_PROJECT_IDS`, ""));
  const envTaskProjectIds = parseProjectIds(env(`${prefix}_HUBSTAFF_TASK_PROJECT_IDS`, ""));

  return normalizeHubstaffConfig({
    refreshToken: env(`${prefix}_HUBSTAFF_REFRESH_TOKEN`, global?.refreshToken ?? ""),
    organizationId: Number(
      env(`${prefix}_HUBSTAFF_ORGANIZATION_ID`, global ? String(global.organizationId) : "0")
    ),
    projectIds: projectIds ?? envProjectIds ?? global?.projectIds,
    taskProjectIds: options.taskProjectIds ?? envTaskProjectIds
  });
}
