import { describe, expect, it } from "vitest";
import { isJiraConfigured, looksLikeIssueKey, normalizeJiraConfig, parseIssueKey } from "../../integrations/jira/definition";

describe("looksLikeIssueKey", () => {
  it("accepts standard Jira keys", () => {
    expect(looksLikeIssueKey("PI-491")).toBe(true);
    expect(looksLikeIssueKey(" pi-491 ")).toBe(true);
  });

  it("rejects non-issue strings", () => {
    expect(looksLikeIssueKey("PI491")).toBe(false);
    expect(looksLikeIssueKey("project-name")).toBe(false);
  });
});

describe("parseIssueKey", () => {
  it("extracts the leading issue key from project names", () => {
    expect(parseIssueKey("PI-491 billing fix")).toBe("PI-491");
    expect(parseIssueKey("  pi-99 ")).toBe("PI-99");
  });

  it("returns null when no key prefix is present", () => {
    expect(parseIssueKey("internal task")).toBeNull();
  });
});

describe("normalizeJiraConfig", () => {
  it("returns undefined when all fields are empty", () => {
    expect(normalizeJiraConfig(undefined)).toBeUndefined();
    expect(
      normalizeJiraConfig({ baseUrl: "", email: "", apiToken: "", jql: "" })
    ).toBeUndefined();
  });

  it("normalizes trailing slash and default jql", () => {
    const config = normalizeJiraConfig({
      baseUrl: "https://example.atlassian.net/",
      email: "you@example.com",
      apiToken: "token",
      jql: ""
    });

    expect(config).toMatchObject({
      baseUrl: "https://example.atlassian.net",
      email: "you@example.com",
      apiToken: "token"
    });
    expect(config?.jql).toContain("assignee=currentUser()");
  });

  it("throws when only some fields are provided", () => {
    expect(() =>
      normalizeJiraConfig({
        baseUrl: "https://example.atlassian.net",
        email: "",
        apiToken: "",
        jql: ""
      })
    ).toThrow(/baseUrl, email, and apiToken together/);
  });
});

describe("isJiraConfigured", () => {
  it("requires baseUrl, email, and apiToken", () => {
    expect(
      isJiraConfigured({
        baseUrl: "https://example.atlassian.net",
        email: "you@example.com",
        apiToken: "token",
        jql: "project = PI"
      })
    ).toBe(true);
    expect(isJiraConfigured(undefined)).toBe(false);
  });
});
