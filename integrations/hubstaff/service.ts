import type { ClientConfig } from "../../server/clientConfig.js";
import { resolveIntegrationConfig } from "../../server/client-resolution.js";
import type { HubstaffDailyEntry, HubstaffProjectTotal, HubstaffTimeReport } from "./definition.js";
import {
  isHubstaffConfigured,
  type ClientHubstaffConfig,
  type ResolvedHubstaffConfig
} from "./definition.js";
import { legacyGlobalHubstaffConfig } from "./legacy-config.js";
import {
  hubstaffCredentialScope,
  hydrateHubstaffToken,
  invalidateHubstaffAccessToken,
  loadHubstaffToken,
  persistHubstaffToken,
  refreshHubstaffTokenOnce,
  resolveHubstaffRefreshToken,
  type HubstaffTokenState
} from "./token-store.js";

const hubstaffResolver = {
  legacyGlobalConfig: legacyGlobalHubstaffConfig,
  isConfigured: isHubstaffConfigured,
  readClientConfig: (client: ClientConfig) => client.hubstaff
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type DailyActivity = {
  date?: string;
  user_id?: number;
  project_id?: number;
  tracked?: number;
};

type HubstaffRuntime = {
  config: ResolvedHubstaffConfig;
  credentialScope: string;
  token: HubstaffTokenState | null;
  userIdCache: CacheEntry<number> | null;
  projectsCache: CacheEntry<Map<number, string>> | null;
  reportCache: Map<string, CacheEntry<HubstaffTimeReport>>;
};

const API_BASE = "https://api.hubstaff.com/v2";
const TOKEN_URL = "https://account.hubstaff.com/access_tokens";
const REPORT_CACHE_TTL_MS = 15 * 60 * 1000;
const PROJECTS_CACHE_TTL_MS = 60 * 60 * 1000;
const USER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 500;
const MAX_DAILY_CHUNK_DAYS = 31;
const TOKEN_REFRESH_SKEW_MS = 120 * 1000;

const runtimes = new Map<string, HubstaffRuntime>();
const runtimesByCredentialScope = new Map<string, Set<string>>();

function syncTokenForScope(scope: string, token: HubstaffTokenState) {
  for (const clientKey of runtimesByCredentialScope.get(scope) ?? []) {
    const runtime = runtimes.get(clientKey);
    if (!runtime) {
      continue;
    }

    runtime.token = token;
    runtime.config.refreshToken = token.refreshToken;
  }
}

function runtimeForConfig(resolved: ResolvedHubstaffConfig): HubstaffRuntime {
  const existing = runtimes.get(resolved.clientKey);
  if (existing) {
    return existing;
  }

  const credentialScope = hubstaffCredentialScope(resolved);
  const runtime: HubstaffRuntime = {
    config: resolved,
    credentialScope,
    token: hydrateHubstaffToken(credentialScope, resolved.clientKey),
    userIdCache: null,
    projectsCache: null,
    reportCache: new Map()
  };
  runtimes.set(resolved.clientKey, runtime);

  const scopedRuntimes = runtimesByCredentialScope.get(credentialScope) ?? new Set<string>();
  scopedRuntimes.add(resolved.clientKey);
  runtimesByCredentialScope.set(credentialScope, scopedRuntimes);

  if (runtime.token) {
    syncTokenForScope(credentialScope, runtime.token);
  }

  return runtime;
}

function ensureTokenLoaded(runtime: HubstaffRuntime) {
  if (runtime.token) {
    return;
  }

  runtime.token = loadHubstaffToken(runtime.credentialScope, runtime.config.clientKey);
  if (runtime.token) {
    syncTokenForScope(runtime.credentialScope, runtime.token);
  }
}

export function hubstaffStatusFromConfig(config: ClientHubstaffConfig | undefined) {
  const configured = isHubstaffConfigured(config);
  return {
    configured,
    organizationId: configured ? config.organizationId : null
  };
}

export async function hubstaffStatusForClient(clientKey?: string | null) {
  const resolved = await resolveHubstaffConfig(clientKey);
  return hubstaffStatusFromConfig(resolved ?? undefined);
}

export async function resolveHubstaffConfig(clientKey?: string | null): Promise<ResolvedHubstaffConfig | null> {
  return resolveIntegrationConfig(hubstaffResolver, clientKey);
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Dates must use YYYY-MM-DD.");
  }

  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }

  return date;
}

function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

async function exchangeRefreshToken(refreshToken: string): Promise<HubstaffTokenState> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`Hubstaff token exchange failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Hubstaff token exchange did not return access_token and refresh_token.");
  }

  const expiresInMs = Math.max((data.expires_in ?? 3600) * 1000, 60_000);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + expiresInMs
  };
}

async function ensureAccessToken(runtime: HubstaffRuntime, forceRefresh = false): Promise<string> {
  ensureTokenLoaded(runtime);

  const scope = runtime.credentialScope;
  const current = runtime.token;
  if (
    !forceRefresh &&
    current?.accessToken &&
    current.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()
  ) {
    return current.accessToken;
  }

  const refreshToken = resolveHubstaffRefreshToken(
    scope,
    runtime.config.refreshToken,
    runtime.token,
    runtime.config.clientKey
  );
  const nextToken = await refreshHubstaffTokenOnce(scope, refreshToken, exchangeRefreshToken);
  persistHubstaffToken(scope, nextToken);
  syncTokenForScope(scope, nextToken);
  return nextToken.accessToken;
}

async function hubstaffFetch<T>(
  runtime: HubstaffRuntime,
  pathSuffix: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const accessToken = await ensureAccessToken(runtime);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  const url = `${API_BASE}${pathSuffix}${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (response.status === 401) {
    ensureTokenLoaded(runtime);
    if (runtime.token) {
      runtime.token = invalidateHubstaffAccessToken(runtime.token);
    }
    const retryToken = await ensureAccessToken(runtime, true);
    const retryResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json"
      }
    });

    if (!retryResponse.ok) {
      const detail = (await retryResponse.text()).slice(0, 200);
      throw new Error(`Hubstaff request failed (${retryResponse.status}): ${detail}`);
    }

    return (await retryResponse.json()) as T;
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`Hubstaff request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

async function getMyUserId(runtime: HubstaffRuntime): Promise<number> {
  if (runtime.userIdCache && runtime.userIdCache.expiresAt > Date.now()) {
    return runtime.userIdCache.value;
  }

  const data = await hubstaffFetch<{ user?: { id?: number } }>(runtime, "/users/me");

  const userId = data.user?.id;
  if (!userId) {
    throw new Error("Hubstaff did not return the authenticated user id.");
  }

  runtime.userIdCache = { value: userId, expiresAt: Date.now() + USER_CACHE_TTL_MS };
  return userId;
}

async function getProjectNames(runtime: HubstaffRuntime): Promise<Map<number, string>> {
  if (runtime.projectsCache && runtime.projectsCache.expiresAt > Date.now()) {
    return runtime.projectsCache.value;
  }

  const names = new Map<number, string>();
  let pageStartId: number | undefined;

  do {
    const data = await hubstaffFetch<{
      pagination?: { next_page_start_id?: number };
      projects?: Array<{ id?: number; name?: string }>;
    }>(runtime, `/organizations/${runtime.config.organizationId}/projects`, {
      page_limit: PAGE_LIMIT,
      page_start_id: pageStartId,
      status: "all"
    });

    for (const project of data.projects ?? []) {
      if (project.id && project.name) {
        names.set(project.id, project.name);
      }
    }

    pageStartId = data.pagination?.next_page_start_id;
  } while (pageStartId);

  runtime.projectsCache = { value: names, expiresAt: Date.now() + PROJECTS_CACHE_TTL_MS };
  return names;
}

function projectAllowed(runtime: HubstaffRuntime, projectId: number | undefined): projectId is number {
  if (!projectId) {
    return false;
  }

  if (!runtime.config.projectIds?.length) {
    return true;
  }

  return runtime.config.projectIds.includes(projectId);
}

async function fetchDailyActivitiesChunk(
  runtime: HubstaffRuntime,
  userId: number,
  from: Date,
  to: Date
): Promise<DailyActivity[]> {
  const activities: DailyActivity[] = [];
  let pageStartId: number | undefined;
  const projectFilter = runtime.config.projectIds?.length
    ? runtime.config.projectIds.join(",")
    : undefined;

  do {
    const data = await hubstaffFetch<{
      pagination?: { next_page_start_id?: number };
      daily_activities?: DailyActivity[];
    }>(runtime, `/organizations/${runtime.config.organizationId}/activities/daily`, {
      page_limit: PAGE_LIMIT,
      page_start_id: pageStartId,
      user_ids: userId,
      project_ids: projectFilter,
      "date[start]": `${formatIsoDate(from)}T00:00:00.000Z`,
      "date[stop]": `${formatIsoDate(to)}T23:59:59.999Z`
    });

    activities.push(...(data.daily_activities ?? []));
    pageStartId = data.pagination?.next_page_start_id;
  } while (pageStartId);

  return activities;
}

function aggregateActivities(
  activities: DailyActivity[],
  projectNames: Map<number, string>,
  runtime: HubstaffRuntime
): HubstaffTimeReport {
  const dailyMap = new Map<string, Map<number, number>>();
  const projectTotals = new Map<number, number>();

  for (const activity of activities) {
    const projectId = activity.project_id;
    const tracked = activity.tracked ?? 0;
    const date = activity.date?.slice(0, 10);

    if (!date || tracked <= 0 || !projectAllowed(runtime, projectId)) {
      continue;
    }

    const dayProjects = dailyMap.get(date) ?? new Map<number, number>();
    dayProjects.set(projectId, (dayProjects.get(projectId) ?? 0) + tracked);
    dailyMap.set(date, dayProjects);
    projectTotals.set(projectId, (projectTotals.get(projectId) ?? 0) + tracked);
  }

  const daily: HubstaffDailyEntry[] = Array.from(dailyMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, projectsForDay]) => {
      const projects = Array.from(projectsForDay.entries())
        .map(([projectId, seconds]) => ({
          projectId,
          name: projectNames.get(projectId) ?? `Project ${projectId}`,
          seconds
        }))
        .sort((left, right) => right.seconds - left.seconds);

      return {
        date,
        totalSeconds: projects.reduce((sum, project) => sum + project.seconds, 0),
        projects
      };
    });

  const projects: HubstaffProjectTotal[] = Array.from(projectTotals.entries())
    .map(([projectId, seconds]) => ({
      projectId,
      name: projectNames.get(projectId) ?? `Project ${projectId}`,
      seconds
    }))
    .sort((left, right) => right.seconds - left.seconds);

  return {
    totalSeconds: projects.reduce((sum, project) => sum + project.seconds, 0),
    daily,
    projects
  };
}

async function fetchDailyActivities(runtime: HubstaffRuntime, from: Date, to: Date): Promise<DailyActivity[]> {
  const userId = await getMyUserId(runtime);
  const activities: DailyActivity[] = [];
  let chunkStart = new Date(from);

  while (chunkStart <= to) {
    const chunkEnd = addDays(chunkStart, MAX_DAILY_CHUNK_DAYS - 1);
    const boundedEnd = chunkEnd > to ? to : chunkEnd;
    activities.push(...(await fetchDailyActivitiesChunk(runtime, userId, chunkStart, boundedEnd)));
    chunkStart = addDays(boundedEnd, 1);
  }

  return activities;
}

async function fetchReportForRuntime(runtime: HubstaffRuntime, from: string, to: string): Promise<HubstaffTimeReport> {
  const cacheKey = `${from}:${to}`;
  const cached = runtime.reportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (fromDate > toDate) {
    throw new Error("'from' must be on or before 'to'.");
  }

  const [projectNames, activities] = await Promise.all([
    getProjectNames(runtime),
    fetchDailyActivities(runtime, fromDate, toDate)
  ]);

  const report = aggregateActivities(activities, projectNames, runtime);
  runtime.reportCache.set(cacheKey, { value: report, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
  return report;
}

export async function fetchHubstaffReport(
  from: string,
  to: string,
  clientKey?: string | null
): Promise<HubstaffTimeReport | null> {
  const resolved = await resolveHubstaffConfig(clientKey);
  if (!resolved) {
    return null;
  }

  return fetchReportForRuntime(runtimeForConfig(resolved), from, to);
}

export type {
  HubstaffDailyEntry,
  HubstaffProjectTotal,
  HubstaffTimeReport as HubstaffReport
};
