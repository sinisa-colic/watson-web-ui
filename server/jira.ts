type JiraIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;
const CACHE_TTL_MS = 5 * 60 * 1000;

const issueCache = new Map<string, CacheEntry<JiraIssue>>();
let cloudIdCache: CacheEntry<string> | null = null;
let issuesListCache: CacheEntry<JiraIssue[]> | null = null;

function jiraConfigured(): boolean {
  return Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

function baseUrl(): string {
  return (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
}

function authHeader(): string {
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_API_TOKEN ?? "";
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

function defaultJql(): string {
  return (
    process.env.JIRA_JQL ??
    "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC"
  );
}

export function looksLikeIssueKey(value: string): boolean {
  return ISSUE_KEY_PATTERN.test(value.trim());
}

export function jiraStatus() {
  return {
    configured: jiraConfigured(),
    baseUrl: jiraConfigured() ? baseUrl() : null
  };
}

async function jiraFetch(path: string): Promise<Response> {
  const gatewayBase = await resolveGatewayBase();
  if (gatewayBase) {
    const response = await fetchJiraUrl(`${gatewayBase}${path}`);
    if (isAuthenticatedResponse(response)) {
      return response;
    }
  }

  const response = await fetchJiraUrl(`${baseUrl()}${path}`);
  if (!isAuthenticatedResponse(response)) {
    await throwJiraError(response);
  }

  return response;
}

async function fetchJiraUrl(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: authHeader(),
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

async function resolveGatewayBase(): Promise<string | null> {
  try {
    const cloudId = await getCloudId();
    return `https://api.atlassian.com/ex/jira/${cloudId}`;
  } catch {
    return null;
  }
}

async function getCloudId(): Promise<string> {
  if (cloudIdCache && cloudIdCache.expiresAt > Date.now()) {
    return cloudIdCache.value;
  }

  const response = await fetchJiraUrl(`${baseUrl()}/_edge/tenant_info`);
  if (!response.ok) {
    throw new Error("Could not resolve Jira cloud ID");
  }

  const data = (await response.json()) as { cloudId?: string };
  if (!data.cloudId) {
    throw new Error("Jira tenant info did not include cloudId");
  }

  cloudIdCache = { value: data.cloudId, expiresAt: Date.now() + CACHE_TTL_MS };
  return data.cloudId;
}

function mapIssue(raw: {
  key: string;
  fields?: { summary?: string; status?: { name?: string } };
}): JiraIssue {
  return {
    key: raw.key,
    summary: raw.fields?.summary ?? raw.key,
    status: raw.fields?.status?.name ?? "Unknown",
    url: `${baseUrl()}/browse/${raw.key}`
  };
}

async function searchIssues(jql: string, maxResults = 100): Promise<JiraIssue[]> {
  const params = new URLSearchParams({
    jql,
    fields: "summary,status",
    maxResults: String(maxResults)
  });

  const response = await jiraFetch(`/rest/api/3/search/jql?${params.toString()}`);
  const data = (await response.json()) as {
    issues?: Array<{ key: string; fields?: { summary?: string; status?: { name?: string } } }>;
  };

  return (data.issues ?? []).map(mapIssue);
}

function getCachedIssue(key: string): JiraIssue | null {
  const entry = issueCache.get(key.toUpperCase());
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.value;
}

function setCachedIssue(issue: JiraIssue) {
  issueCache.set(issue.key.toUpperCase(), {
    value: issue,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export async function fetchMyIssues(): Promise<JiraIssue[]> {
  if (!jiraConfigured()) {
    return [];
  }

  if (issuesListCache && issuesListCache.expiresAt > Date.now()) {
    return issuesListCache.value;
  }

  const issues = await searchIssues(defaultJql(), 100);
  for (const issue of issues) {
    setCachedIssue(issue);
  }

  issuesListCache = { value: issues, expiresAt: Date.now() + CACHE_TTL_MS };
  return issues;
}

export async function fetchIssueMap(keys: string[]): Promise<Record<string, JiraIssue>> {
  if (!jiraConfigured()) {
    return {};
  }

  const normalized = [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(looksLikeIssueKey))];
  const result: Record<string, JiraIssue> = {};
  const missing: string[] = [];

  for (const key of normalized) {
    const cached = getCachedIssue(key);
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
    const issues = await searchIssues(jql, chunk.length);
    for (const issue of issues) {
      setCachedIssue(issue);
      result[issue.key.toUpperCase()] = issue;
    }
  }

  return result;
}
