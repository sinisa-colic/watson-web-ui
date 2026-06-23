import { describe, expect, it } from "vitest";
import {
  ALL_CLIENTS_KEY,
  buildIntegrationEndpoint,
  integrationById,
  shouldLoadIntegration,
  shouldShowIntegration
} from "../../integrations/client-selection";
import type { ClientOption } from "../../src/types";

const client: ClientOption = {
  key: "client-a",
  label: "Client A",
  tag: "client-a",
  integrations: { jira: true, hubstaff: false },
  configured: true
};

describe("buildIntegrationEndpoint", () => {
  it("appends client query for a specific client", () => {
    const jira = integrationById("jira");
    expect(buildIntegrationEndpoint(jira, "/issues", "client-a", { from: "2026-06-01" })).toBe(
      "/api/jira/issues?from=2026-06-01&client=client-a"
    );
  });

  it("omits client query for all-clients view", () => {
    const jira = integrationById("jira");
    expect(buildIntegrationEndpoint(jira, "/status", ALL_CLIENTS_KEY)).toBe("/api/jira/status");
  });
});

describe("shouldLoadIntegration", () => {
  it("loads when the selected client has the integration enabled", () => {
    const jira = integrationById("jira");
    expect(shouldLoadIntegration(jira, "client-a", client, 2)).toBe(true);

    const clientWithoutJira: ClientOption = {
      ...client,
      key: "client-b",
      integrations: { jira: false, hubstaff: false }
    };
    expect(shouldLoadIntegration(jira, "client-b", clientWithoutJira, 2)).toBe(false);
  });

  it("loads in all-clients view only when at most one client has it", () => {
    const jira = integrationById("jira");
    expect(shouldLoadIntegration(jira, ALL_CLIENTS_KEY, null, 1)).toBe(true);
    expect(shouldLoadIntegration(jira, ALL_CLIENTS_KEY, null, 2)).toBe(false);
  });
});

describe("shouldShowIntegration", () => {
  it("requires API configured flag in all-clients view", () => {
    const jira = integrationById("jira");
    expect(shouldShowIntegration(jira, ALL_CLIENTS_KEY, null, 1, true)).toBe(true);
    expect(shouldShowIntegration(jira, ALL_CLIENTS_KEY, null, 1, false)).toBe(false);
  });

  it("requires client flag and API configured for a specific client", () => {
    const jira = integrationById("jira");
    expect(shouldShowIntegration(jira, "client-a", client, 2, true)).toBe(true);
    expect(shouldShowIntegration(jira, "client-a", client, 2, false)).toBe(false);
  });
});
