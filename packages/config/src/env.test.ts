import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_VARS = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  DATABASE_URL: "postgres://user:pass@localhost:5432/allinvites",
};

describe("getEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns validated env when all required variables are present", async () => {
    Object.assign(process.env, REQUIRED_VARS);

    const { getEnv } = await import("./env.ts");
    const env = getEnv();

    expect(env.SUPABASE_URL).toBe(REQUIRED_VARS.SUPABASE_URL);
    expect(env.DATABASE_URL).toBe(REQUIRED_VARS.DATABASE_URL);
  });

  it("throws a readable error when a required variable is missing", async () => {
    process.env.SUPABASE_URL = REQUIRED_VARS.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = REQUIRED_VARS.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.DATABASE_URL = REQUIRED_VARS.DATABASE_URL;

    const { getEnv } = await import("./env.ts");

    expect(() => getEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
