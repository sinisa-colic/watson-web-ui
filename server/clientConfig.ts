import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildClientIntegrationFlags,
  normalizeClientIntegrations
} from "../integrations/server-manifest.js";

import type { ClientJiraConfig } from "../integrations/jira/definition.js";
import type { ClientHubstaffConfig } from "../integrations/hubstaff/definition.js";

export type { ClientJiraConfig, ClientHubstaffConfig };

export type ClientConfig = {
  key: string;
  label: string;
  tag: string;
  /** When false, time for this client is tracked outside Watson (e.g. Hubstaff only). Defaults to true. */
  watsonTracking?: boolean;
  jira?: ClientJiraConfig;
  hubstaff?: ClientHubstaffConfig;
};

export type WatsonLocalUiConfig = {
  defaultClientKey?: string;
  clients: ClientConfig[];
};

export type ClientOption = {
  key: string;
  label: string;
  tag: string;
  integrations: Record<string, boolean>;
  configured: boolean;
  watsonTracking: boolean;
};

let loadedConfig: WatsonLocalUiConfig | null | undefined;
let loadError: Error | null = null;

export function env(key: string, fallback = ""): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

/** Dotenv treats unquoted apostrophes as delimiters (Salon D'Art → Salon D). */
export function envLabel(key: string, fallback: string): string {
  const value = env(key, fallback);
  if (value.includes("'") || !fallback.includes("'")) {
    return value;
  }

  if (fallback.startsWith(value) && value.length < fallback.length) {
    return fallback;
  }

  return value;
}

function validateConfig(raw: unknown): WatsonLocalUiConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("clients.config must export a default object.");
  }

  const config = raw as WatsonLocalUiConfig;
  if (!Array.isArray(config.clients)) {
    throw new Error("clients.config.clients must be an array.");
  }

  const seenKeys = new Set<string>();
  const seenTags = new Set<string>();
  const clients: ClientConfig[] = [];

  for (const entry of config.clients) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each client entry must be an object.");
    }

    const key = String(entry.key ?? "").trim();
    const label = String(entry.label ?? "").trim();
    const tag = String(entry.tag ?? "").trim();

    if (!key || !tag) {
      throw new Error("Each client must have a key and tag.");
    }

    if (seenKeys.has(key)) {
      throw new Error(`Duplicate client key: ${key}`);
    }
    if (seenTags.has(tag)) {
      throw new Error(`Duplicate client tag: ${tag}`);
    }

    seenKeys.add(key);
    seenTags.add(tag);

    clients.push({
      key,
      label: label || key,
      tag,
      watsonTracking: entry.watsonTracking !== false,
      ...normalizeClientIntegrations(entry)
    });
  }

  const defaultClientKey = config.defaultClientKey?.trim() || undefined;
  if (defaultClientKey && !seenKeys.has(defaultClientKey)) {
    throw new Error(`defaultClientKey "${defaultClientKey}" does not match any configured client.`);
  }

  return {
    defaultClientKey,
    clients
  };
}

async function importClientConfigFile(filePath: string): Promise<WatsonLocalUiConfig> {
  const module = await import(pathToFileURL(filePath).href);
  return validateConfig(module.default);
}

export async function loadClientRegistry(): Promise<WatsonLocalUiConfig | null> {
  if (loadedConfig !== undefined) {
    if (loadError) {
      throw loadError;
    }
    return loadedConfig;
  }

  const root = process.cwd();
  const candidates = ["clients.config.ts", "clients.config.js", "clients.config.mjs"];

  for (const fileName of candidates) {
    const filePath = path.join(root, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    try {
      loadedConfig = await importClientConfigFile(filePath);
      loadError = null;
      return loadedConfig;
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      throw loadError;
    }
  }

  loadedConfig = null;
  return null;
}

export async function getConfiguredClients(): Promise<ClientOption[]> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return [];
  }

  return registry.clients.map((client) => ({
    key: client.key,
    label: client.label,
    tag: client.tag,
    configured: true,
    watsonTracking: client.watsonTracking !== false,
    ...buildClientIntegrationFlags(client)
  }));
}

export async function getDefaultClientKey(): Promise<string | null> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return null;
  }

  return registry.defaultClientKey ?? registry.clients[0]?.key ?? null;
}

export async function getClientTag(clientKey: string | null): Promise<string | null> {
  if (!clientKey) {
    return null;
  }

  const registry = await loadClientRegistry();
  return registry?.clients.find((client) => client.key === clientKey)?.tag ?? null;
}
