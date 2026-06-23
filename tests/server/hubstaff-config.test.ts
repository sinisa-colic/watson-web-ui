import { describe, expect, it } from "vitest";
import { isHubstaffConfigured, normalizeHubstaffConfig } from "../../integrations/hubstaff/definition";

describe("normalizeHubstaffConfig", () => {
  it("returns undefined when refresh token and org id are empty", () => {
    expect(normalizeHubstaffConfig(undefined)).toBeUndefined();
    expect(
      normalizeHubstaffConfig({ refreshToken: "", organizationId: 0 })
    ).toBeUndefined();
  });

  it("parses comma-separated project ids", () => {
    const config = normalizeHubstaffConfig({
      refreshToken: "refresh-token",
      organizationId: 42,
      projectIds: [1, 2, 3]
    });

    expect(config).toEqual({
      refreshToken: "refresh-token",
      organizationId: 42,
      projectIds: [1, 2, 3]
    });
  });

  it("throws on invalid project ids", () => {
    expect(() =>
      normalizeHubstaffConfig({
        refreshToken: "refresh-token",
        organizationId: 42,
        projectIds: [1, -2]
      })
    ).toThrow(/positive integers/);
  });

  it("throws when only one required field is set", () => {
    expect(() =>
      normalizeHubstaffConfig({
        refreshToken: "refresh-token",
        organizationId: 0
      })
    ).toThrow(/refreshToken and organizationId together/);
  });
});

describe("isHubstaffConfigured", () => {
  it("requires refresh token and positive organization id", () => {
    expect(
      isHubstaffConfigured({
        refreshToken: "refresh-token",
        organizationId: 42
      })
    ).toBe(true);
    expect(isHubstaffConfigured(undefined)).toBe(false);
  });
});
