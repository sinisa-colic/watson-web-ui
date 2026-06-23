import { env } from "../../../clientConfig.js";

export type ClientHubstaffConfig = {
  refreshToken: string;
  organizationId: number;
  projectIds?: number[];
};

export type ResolvedHubstaffConfig = ClientHubstaffConfig & {
  clientKey: string;
};

function parseProjectIds(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }

  const values = Array.isArray(raw)
    ? raw.map((entry) => String(entry).trim()).filter(Boolean)
    : String(raw)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

  const projectIds = values
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  if (projectIds.length !== values.length) {
    throw new Error("Hubstaff projectIds must be a comma-separated list of positive integers.");
  }

  return projectIds.length ? projectIds : undefined;
}

export function normalizeHubstaffConfig(hubstaff: ClientHubstaffConfig | undefined): ClientHubstaffConfig | undefined {
  if (!hubstaff) {
    return undefined;
  }

  const refreshToken = hubstaff.refreshToken.trim();
  const organizationId = Number(hubstaff.organizationId);
  const projectIds = parseProjectIds(hubstaff.projectIds);

  const values = [refreshToken, Number.isFinite(organizationId) && organizationId > 0 ? String(organizationId) : ""];
  const filled = values.filter(Boolean).length;

  if (filled === 0) {
    return undefined;
  }

  if (filled !== 2) {
    throw new Error("Hubstaff config must include refreshToken and organizationId together, or leave all empty.");
  }

  return {
    refreshToken,
    organizationId,
    projectIds
  };
}

export function legacyGlobalHubstaffConfig(): ClientHubstaffConfig | undefined {
  const refreshToken = env("HUBSTAFF_REFRESH_TOKEN");
  const organizationId = Number(env("HUBSTAFF_ORGANIZATION_ID"));

  if (!refreshToken && !env("HUBSTAFF_ORGANIZATION_ID")) {
    return undefined;
  }

  return normalizeHubstaffConfig({
    refreshToken,
    organizationId,
    projectIds: parseProjectIds(env("HUBSTAFF_PROJECT_IDS"))
  });
}

export function isHubstaffConfigured(config: ClientHubstaffConfig | undefined): config is ClientHubstaffConfig {
  return Boolean(config?.refreshToken && config.organizationId > 0);
}
