import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientConfig } from "../../server/clientConfig.js";

vi.mock("../../server/clientConfig.js", () => ({
  loadClientRegistry: vi.fn()
}));

import { loadClientRegistry } from "../../server/clientConfig.js";
import { resolveIntegrationConfig } from "../../server/client-resolution.js";
import type { ClientJiraConfig } from "../../integrations/jira/definition.js";

const jiraConfig: ClientJiraConfig = {
  baseUrl: "https://example.atlassian.net",
  email: "you@example.com",
  apiToken: "token",
  jql: "project = PI"
};

const jiraResolver = {
  legacyGlobalConfig: () => jiraConfig,
  isConfigured: (config: ClientJiraConfig | undefined): config is ClientJiraConfig =>
    Boolean(config?.baseUrl && config.email && config.apiToken),
  readClientConfig: (client: ClientConfig) => client.jira
};

describe("resolveIntegrationConfig", () => {
  beforeEach(() => {
    vi.mocked(loadClientRegistry).mockReset();
  });

  it("returns legacy config when no client registry is loaded", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue(null);

    const resolved = await resolveIntegrationConfig(jiraResolver, null);

    expect(resolved).toMatchObject({ ...jiraConfig, clientKey: "legacy" });
  });

  it("returns a specific client config when client key is provided", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue({
      clients: [
        {
          key: "client-a",
          label: "Client A",
          tag: "client-a",
          jira: jiraConfig
        }
      ]
    });

    const resolved = await resolveIntegrationConfig(jiraResolver, "client-a");

    expect(resolved).toMatchObject({ ...jiraConfig, clientKey: "client-a" });
  });

  it("returns null when the requested client has no config", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue({
      clients: [
        {
          key: "client-a",
          label: "Client A",
          tag: "client-a"
        }
      ]
    });

    expect(await resolveIntegrationConfig(jiraResolver, "client-a")).toBeNull();
  });

  it("auto-selects the sole configured client when no key is provided", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue({
      clients: [
        {
          key: "client-a",
          label: "Client A",
          tag: "client-a"
        },
        {
          key: "client-b",
          label: "Client B",
          tag: "client-b",
          jira: jiraConfig
        }
      ]
    });

    const resolved = await resolveIntegrationConfig(jiraResolver, null);

    expect(resolved?.clientKey).toBe("client-b");
  });
});
