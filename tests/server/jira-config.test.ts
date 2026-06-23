import { describe, expect, it } from "vitest";
import { isJiraConfigured, normalizeJiraConfig } from "../../integrations/jira/definition";

describe("normalizeJiraConfig", () => {
  it("strips trailing slash from baseUrl", () => {
    const config = normalizeJiraConfig({
      baseUrl: "https://example.atlassian.net/",
      email: "you@example.com",
      apiToken: "token",
      jql: "project = PI"
    });

    expect(config?.baseUrl).toBe("https://example.atlassian.net");
  });
});

describe("isJiraConfigured", () => {
  it("is false for partial config objects", () => {
    expect(
      isJiraConfigured({
        baseUrl: "https://example.atlassian.net",
        email: "",
        apiToken: "token",
        jql: ""
      })
    ).toBe(false);
  });
});
