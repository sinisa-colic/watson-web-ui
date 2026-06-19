import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type ClientJiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
};

export type ClientConfig = {
  key: string;
  label: string;
  tag: string;
  jira?: ClientJiraConfig;
};

export type WatsonLocalUiConfig = {
  defaultClientKey?: string;
  clients: ClientConfig[];
};

export type ClientOption = {
  key: string;
  label: string;
  tag: string;
  jiraConfigured: boolean;
  configured: boolean;
};

export type ResolvedJiraConfig = ClientJiraConfig & {
  clientKey: string;
};

const DEFAULT_JQL = "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC";

let loadedConfig: WatsonLocalUiConfig | null | undefined;
let loadError: Error | null = null;

export function env(key: string, fallback = ""): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value.trim();
}

function normalizeJiraConfig(jira: ClientJiraConfig | undefined): ClientJiraConfig | undefined {
  if (!jira) {
    return undefined;
  }

  const baseUrl = jira.baseUrl.trim();
  const email = jira.email.trim();
  const apiToken = jira.apiToken.trim();
  const jql = jira.jql.trim() || DEFAULT_JQL;

  const values = [baseUrl, email, apiToken];
  const filled = values.filter(Boolean).length;

  if (filled === 0) {
    return undefined;
  }

  if (filled !== 3) {
    throw new Error("Jira config must include baseUrl, email, and apiToken together, or leave all empty.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    email,
    apiToken,
    jql
  };
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
      jira: normalizeJiraConfig(entry.jira)
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

export async function getConfiguredClients(): Promise<ClientOption[]> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return [];
  }

  return registry.clients.map((client) => ({
    key: client.key,
    label: client.label,
    tag: client.tag,
    jiraConfigured: Boolean(client.jira),
    configured: true
  }));
}

export async function getDefaultClientKey(): Promise<string | null> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return null;
  }

  return registry.defaultClientKey ?? registry.clients[0]?.key ?? null;
}

export async function resolveJiraConfig(clientKey?: string | null): Promise<ResolvedJiraConfig | null> {
  const registry = await loadClientRegistry();

  if (registry) {
    if (clientKey) {
      const client = registry.clients.find((entry) => entry.key === clientKey);
      if (client?.jira) {
        return { ...client.jira, clientKey: client.key };
      }
      return null;
    }

    const jiraClients = registry.clients.filter((client) => client.jira);
    if (jiraClients.length === 1) {
      const client = jiraClients[0];
      return { ...client.jira!, clientKey: client.key };
    }

    return null;
  }

  const legacy = legacyGlobalJiraConfig();
  if (!legacy) {
    return null;
  }

  return { ...legacy, clientKey: "legacy" };
}

export async function jiraEnabledClientCount(): Promise<number> {
  const registry = await loadClientRegistry();
  if (!registry) {
    return legacyGlobalJiraConfig() ? 1 : 0;
  }

  return registry.clients.filter((client) => client.jira).length;
}

export async function getClientTag(clientKey: string | null): Promise<string | null> {
  if (!clientKey) {
    return null;
  }

  const registry = await loadClientRegistry();
  return registry?.clients.find((client) => client.key === clientKey)?.tag ?? null;
}
