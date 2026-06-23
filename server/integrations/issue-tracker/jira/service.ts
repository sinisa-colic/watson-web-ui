import type { ClientConfig } from "../../../clientConfig.js";
import { resolveIntegrationConfig } from "../../client-resolution.js";
import type { IssueTrackerIssue } from "../types.js";
import {
  isJiraConfigured,
  legacyGlobalJiraConfig,
  type ClientJiraConfig,
  type ResolvedJiraConfig
} from "./config.js";

const jiraResolver = {
  legacyGlobalConfig: legacyGlobalJiraConfig,
  isConfigured: isJiraConfigured,
  readClientConfig: (client: ClientConfig) => client.jira
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;
const CACHE_TTL_MS = 5 * 60 * 1000;

type JiraRuntime = {
  cacheKey: string;
  config: ClientJiraConfig;
  issueCache: Map<string, CacheEntry<IssueTrackerIssue>>;
  cloudIdCache: CacheEntry<string> | null;
  issuesListCache: CacheEntry<IssueTrackerIssue[]> | null;
};

const runtimes = new Map<string, JiraRuntime>();

function runtimeForConfig(resolved: ResolvedJiraConfig): JiraRuntime {
  const cacheKey = `${resolved.clientKey}:${resolved.baseUrl}`;
  const existing = runtimes.get(cacheKey);
  if (existing) {
    return existing;
  }

  const runtime: JiraRuntime = {
    cacheKey,
    config: resolved,
    issueCache: new Map(),
    cloudIdCache: null,
    issuesListCache: null
  };
  runtimes.set(cacheKey, runtime);
  return runtime;
}

function authHeader(config: ClientJiraConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

export function looksLikeIssueKey(value: string): boolean {
  return ISSUE_KEY_PATTERN.test(value.trim());
}

export function jiraStatusFromConfig(config: ClientJiraConfig | undefined) {
  const configured = isJiraConfigured(config);
  return {
    configured,
    baseUrl: configured ? config.baseUrl : null
  };
}

export function legacyJiraStatus() {
  return jiraStatusFromConfig(legacyGlobalJiraConfig());
}

export async function jiraStatusForClient(clientKey?: string | null) {
  const resolved = await resolveJiraConfig(clientKey);
  return jiraStatusFromConfig(resolved ?? undefined);
}

export async function resolveJiraConfig(clientKey?: string | null): Promise<ResolvedJiraConfig | null> {
  return resolveIntegrationConfig(jiraResolver, clientKey);
}

async function fetchJiraUrl(config: ClientJiraConfig, url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: authHeader(config),
      Accept: "application/json"
    }
  });
}

function isAuthenticatedResponse(response: Response): boolean {
  return response.ok && response.headers.get("x-seraph-loginreason") !== "AUTHENTICATED_FAILED";
}

async function throwJiraError(response: Response): Promise<never> {
  const body = await response.text();
  throw new Error(`Jira request failed (${response.status}): ${body.slice(0, 200)}`);
}

async function getCloudId(runtime: JiraRuntime): Promise<string> {
  if (runtime.cloudIdCache && runtime.cloudIdCache.expiresAt > Date.now()) {
    return runtime.cloudIdCache.value;
  }

  const response = await fetchJiraUrl(runtime.config, `${runtime.config.baseUrl}/_edge/tenant_info`);
  if (!response.ok) {
    throw new Error("Could not resolve Jira cloud ID");
  }

  const data = (await response.json()) as { cloudId?: string };
  if (!data.cloudId) {
    throw new Error("Jira tenant info did not include cloudId");
  }

  runtime.cloudIdCache = { value: data.cloudId, expiresAt: Date.now() + CACHE_TTL_MS };
  return data.cloudId;
}

async function resolveGatewayBase(runtime: JiraRuntime): Promise<string | null> {
  try {
    const cloudId = await getCloudId(runtime);
    return `https://api.atlassian.com/ex/jira/${cloudId}`;
  } catch {
    return null;
  }
}

async function jiraFetch(runtime: JiraRuntime, path: string): Promise<Response> {
  const gatewayBase = await resolveGatewayBase(runtime);
  if (gatewayBase) {
    const response = await fetchJiraUrl(runtime.config, `${gatewayBase}${path}`);
    if (isAuthenticatedResponse(response)) {
      return response;
    }
  }

  const response = await fetchJiraUrl(runtime.config, `${runtime.config.baseUrl}${path}`);
  if (!isAuthenticatedResponse(response)) {
    await throwJiraError(response);
  }

  return response;
}

function mapIssue(runtime: JiraRuntime, raw: {
  key: string;
  fields?: { summary?: string; status?: { name?: string } };
}): IssueTrackerIssue {
  return {
    key: raw.key,
    summary: raw.fields?.summary ?? raw.key,
    status: raw.fields?.status?.name ?? "Unknown",
    url: `${runtime.config.baseUrl}/browse/${raw.key}`
  };
}

async function searchIssues(runtime: JiraRuntime, jql: string, maxResults = 100): Promise<IssueTrackerIssue[]> {
  const params = new URLSearchParams({
    jql,
    fields: "summary,status",
    maxResults: String(maxResults)
  });

  const response = await jiraFetch(runtime, `/rest/api/3/search/jql?${params.toString()}`);
  const data = (await response.json()) as {
    issues?: Array<{ key: string; fields?: { summary?: string; status?: { name?: string } } }>;
  };

  return (data.issues ?? []).map((issue) => mapIssue(runtime, issue));
}

function getCachedIssue(runtime: JiraRuntime, key: string): IssueTrackerIssue | null {
  const entry = runtime.issueCache.get(key.toUpperCase());
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.value;
}

function setCachedIssue(runtime: JiraRuntime, issue: IssueTrackerIssue) {
  runtime.issueCache.set(issue.key.toUpperCase(), {
    value: issue,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

async function fetchMyIssuesForRuntime(runtime: JiraRuntime): Promise<IssueTrackerIssue[]> {
  if (runtime.issuesListCache && runtime.issuesListCache.expiresAt > Date.now()) {
    return runtime.issuesListCache.value;
  }

  const issues = await searchIssues(runtime, runtime.config.jql, 100);
  for (const issue of issues) {
    setCachedIssue(runtime, issue);
  }

  runtime.issuesListCache = { value: issues, expiresAt: Date.now() + CACHE_TTL_MS };
  return issues;
}

async function fetchIssueMapForRuntime(runtime: JiraRuntime, keys: string[]): Promise<Record<string, IssueTrackerIssue>> {
  const normalized = [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(looksLikeIssueKey))];
  const result: Record<string, IssueTrackerIssue> = {};
  const missing: string[] = [];

  for (const key of normalized) {
    const cached = getCachedIssue(runtime, key);
    if (cached) {
      result[key] = cached;
    } else {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    return result;
  }

  const chunks: string[][] = [];
  for (let index = 0; index < missing.length; index += 50) {
    chunks.push(missing.slice(index, index + 50));
  }

  for (const chunk of chunks) {
    const jql = `key in (${chunk.join(",")})`;
    const issues = await searchIssues(runtime, jql, chunk.length);
    for (const issue of issues) {
      setCachedIssue(runtime, issue);
      result[issue.key.toUpperCase()] = issue;
    }
  }

  return result;
}

export async function fetchMyIssues(clientKey?: string | null): Promise<IssueTrackerIssue[]> {
  const resolved = await resolveJiraConfig(clientKey);
  if (!resolved) {
    return [];
  }

  return fetchMyIssuesForRuntime(runtimeForConfig(resolved));
}

export async function fetchIssueMap(keys: string[], clientKey?: string | null): Promise<Record<string, IssueTrackerIssue>> {
  const resolved = await resolveJiraConfig(clientKey);
  if (!resolved) {
    return {};
  }

  return fetchIssueMapForRuntime(runtimeForConfig(resolved), keys);
}

export type { IssueTrackerIssue as JiraIssue };
