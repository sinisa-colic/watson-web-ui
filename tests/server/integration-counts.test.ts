import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientConfig } from "../../server/clientConfig.js";

vi.mock("../../server/clientConfig.js", () => ({
  loadClientRegistry: vi.fn()
}));

import { loadClientRegistry } from "../../server/clientConfig.js";
import { integrationEnabledClientCount } from "../../server/client-resolution.js";
import type { ClientHubstaffConfig } from "../../integrations/hubstaff/definition.js";

const hubstaffResolver = {
  legacyGlobalConfig: (): ClientHubstaffConfig | undefined => ({
    refreshToken: "legacy-token",
    organizationId: 99
  }),
  isConfigured: (config: ClientHubstaffConfig | undefined): config is ClientHubstaffConfig =>
    Boolean(config?.refreshToken && config.organizationId > 0),
  readClientConfig: (client: ClientConfig) => client.hubstaff
};

describe("integrationEnabledClientCount", () => {
  beforeEach(() => {
    vi.mocked(loadClientRegistry).mockReset();
  });

  it("counts configured clients from the registry", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue({
      clients: [
        {
          key: "client-a",
          label: "Client A",
          tag: "client-a",
          hubstaff: { refreshToken: "a", organizationId: 1 }
        },
        {
          key: "client-b",
          label: "Client B",
          tag: "client-b"
        },
        {
          key: "client-c",
          label: "Client C",
          tag: "client-c",
          hubstaff: { refreshToken: "c", organizationId: 3 }
        }
      ]
    });

    expect(await integrationEnabledClientCount(hubstaffResolver)).toBe(2);
  });

  it("falls back to legacy config when no registry exists", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue(null);

    expect(await integrationEnabledClientCount(hubstaffResolver)).toBe(1);
  });

  it("returns zero when legacy config is not configured", async () => {
    vi.mocked(loadClientRegistry).mockResolvedValue(null);

    const emptyResolver = {
      ...hubstaffResolver,
      legacyGlobalConfig: () => undefined
    };

    expect(await integrationEnabledClientCount(emptyResolver)).toBe(0);
  });
});
