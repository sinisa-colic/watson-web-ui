import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ClientHubstaffConfig } from "./config.js";

export type HubstaffTokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const tokenDir = path.join(process.cwd(), ".hubstaff-tokens");
const refreshPromises = new Map<string, Promise<HubstaffTokenState>>();

/** Stable key for OAuth credentials — clients sharing the same account reuse one token file. */
export function hubstaffCredentialScope(
  config: Pick<ClientHubstaffConfig, "organizationId" | "refreshToken">
): string {
  const digest = createHash("sha256")
    .update(`${config.organizationId}:${config.refreshToken}`)
    .digest("hex")
    .slice(0, 16);

  return `org-${config.organizationId}-${digest}`;
}

function tokenFilePath(scope: string): string {
  return path.join(tokenDir, `${scope}.json`);
}

function readTokenFile(filePath: string): HubstaffTokenState | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<HubstaffTokenState>;
    if (!raw.accessToken || !raw.refreshToken || !raw.expiresAt) {
      return null;
    }

    return {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      expiresAt: raw.expiresAt
    };
  } catch {
    return null;
  }
}

export function loadHubstaffToken(scope: string, legacyClientKey?: string): HubstaffTokenState | null {
  const scoped = readTokenFile(tokenFilePath(scope));
  if (scoped) {
    return scoped;
  }

  if (legacyClientKey) {
    return readTokenFile(path.join(tokenDir, `${legacyClientKey}.json`));
  }

  return null;
}

export function persistHubstaffToken(scope: string, token: HubstaffTokenState) {
  mkdirSync(tokenDir, { recursive: true });
  const filePath = tokenFilePath(scope);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(token, null, 2));
  renameSync(tempPath, filePath);
}

export function resolveHubstaffRefreshToken(
  scope: string,
  configRefreshToken: string,
  inMemoryToken: HubstaffTokenState | null,
  legacyClientKey?: string
): string {
  return (
    inMemoryToken?.refreshToken ??
    loadHubstaffToken(scope, legacyClientKey)?.refreshToken ??
    configRefreshToken
  );
}

export function hydrateHubstaffToken(scope: string, legacyClientKey?: string): HubstaffTokenState | null {
  return loadHubstaffToken(scope, legacyClientKey);
}

export function invalidateHubstaffAccessToken(token: HubstaffTokenState): HubstaffTokenState {
  return {
    ...token,
    accessToken: "",
    expiresAt: 0
  };
}

export async function refreshHubstaffTokenOnce(
  scope: string,
  refreshToken: string,
  exchange: (token: string) => Promise<HubstaffTokenState>
): Promise<HubstaffTokenState> {
  const inFlight = refreshPromises.get(scope);
  if (inFlight) {
    return inFlight;
  }

  const promise = exchange(refreshToken).finally(() => {
    refreshPromises.delete(scope);
  });
  refreshPromises.set(scope, promise);
  return promise;
}

export function clearHubstaffRefreshPromise(scope: string) {
  refreshPromises.delete(scope);
}
