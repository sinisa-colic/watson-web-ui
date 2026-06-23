import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { envLabel } from "../../server/clientConfig.js";

describe("envLabel", () => {
  const original = process.env.SALON_DART_CLIENT_LABEL;

  beforeEach(() => {
    delete process.env.SALON_DART_CLIENT_LABEL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SALON_DART_CLIENT_LABEL;
    } else {
      process.env.SALON_DART_CLIENT_LABEL = original;
    }
  });

  it("repairs dotenv truncation when an apostrophe is unquoted", () => {
    process.env.SALON_DART_CLIENT_LABEL = "Salon D";

    expect(envLabel("SALON_DART_CLIENT_LABEL", "Salon D'Art")).toBe("Salon D'Art");
  });

  it("keeps an explicitly quoted env value", () => {
    process.env.SALON_DART_CLIENT_LABEL = "Salon D'Art";

    expect(envLabel("SALON_DART_CLIENT_LABEL", "Salon D'Art")).toBe("Salon D'Art");
  });
});
