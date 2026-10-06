import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateInvitationToken, hashInvitationToken } from "./invitation-token.service";

describe("invitation-token.service", () => {
  it("generates a sufficiently long, URL-safe opaque token", () => {
    const { token } = generateInvitationToken();

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates distinct tokens on each call", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("returns a token hash that never equals the raw token", () => {
    const { token, tokenHash } = generateInvitationToken();

    expect(tokenHash).not.toBe(token);
  });

  it("hashes deterministically as SHA-256, so the raw token is never needed again to verify it", () => {
    const token = "a-fixed-token-value";

    const expected = createHash("sha256").update(token).digest("hex");
    expect(hashInvitationToken(token)).toBe(expected);
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
  });
});
