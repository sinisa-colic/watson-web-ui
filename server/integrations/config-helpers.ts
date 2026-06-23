import { env } from "../clientConfig.js";
import {
  legacyGlobalHubstaffConfig,
  normalizeHubstaffConfig,
  type ClientHubstaffConfig
} from "./time-tracker/hubstaff/config.js";
import { legacyGlobalJiraConfig, normalizeJiraConfig, type ClientJiraConfig } from "./issue-tracker/jira/config.js";

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
  /** Fall back to global JIRA_* / HUBSTAFF_* env vars when per-client vars are empty. */
  fallbackToGlobal?: boolean;
};

/** Per-client Jira block from `<PREFIX>_JIRA_*` env vars (returns undefined when unset). */
export function jiraFromEnv(prefix: string, options: EnvPrefixOptions = {}): ClientJiraConfig | undefined {
  const global = options.fallbackToGlobal ? legacyGlobalJiraConfig() : undefined;

  return normalizeJiraConfig({
    baseUrl: env(`${prefix}_JIRA_BASE_URL`, global?.baseUrl ?? ""),
    email: env(`${prefix}_JIRA_EMAIL`, global?.email ?? ""),
    apiToken: env(`${prefix}_JIRA_API_TOKEN`, global?.apiToken ?? ""),
    jql: env(`${prefix}_JIRA_JQL`, global?.jql ?? "")
  });
}

/** Per-client Hubstaff block from `<PREFIX>_HUBSTAFF_*` env vars (returns undefined when unset). */
export function hubstaffFromEnv(
  prefix: string,
  projectIds?: number[],
  options: EnvPrefixOptions = {}
): ClientHubstaffConfig | undefined {
  const global = options.fallbackToGlobal ? legacyGlobalHubstaffConfig() : undefined;
  const envProjectIds = parseProjectIds(env(`${prefix}_HUBSTAFF_PROJECT_IDS`, ""));

  return normalizeHubstaffConfig({
    refreshToken: env(`${prefix}_HUBSTAFF_REFRESH_TOKEN`, global?.refreshToken ?? ""),
    organizationId: Number(
      env(`${prefix}_HUBSTAFF_ORGANIZATION_ID`, global ? String(global.organizationId) : "0")
    ),
    projectIds: projectIds ?? envProjectIds ?? global?.projectIds
  });
}
