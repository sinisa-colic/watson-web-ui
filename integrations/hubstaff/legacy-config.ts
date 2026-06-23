import { env } from "../../server/clientConfig.js";
import { normalizeHubstaffConfig, type ClientHubstaffConfig } from "./definition.js";

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
