import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseAuthProvider } from "./supabase-auth-provider.ts";

const {
  signInWithPassword,
  getUser,
  refreshSession,
  adminSignOut,
  resetPasswordForEmail,
  verifyOtp,
  adminUpdateUserById,
} = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  adminSignOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  adminUpdateUserById: vi.fn(),
}));

vi.mock("@allinvites/auth", () => ({
  getSupabaseAdminClient: () => ({
    auth: { admin: { signOut: adminSignOut, updateUserById: adminUpdateUserById } },
  }),
  getSupabasePublicClient: () => ({
    auth: { signInWithPassword, getUser, refreshSession, resetPasswordForEmail, verifyOtp },
  }),
}));

/**
 * Unit-level coverage of the Supabase error-code mapping only (Supabase's
 * client itself is mocked — no live project is available in this
 * environment, consistent with README.md "Known gaps").
 */
describe("SupabaseAuthProvider.signIn", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    signInWithPassword.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("maps email_not_confirmed to INVALID_CREDENTIALS rather than UNEXPECTED", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    const result = await provider.signIn({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "INVALID_CREDENTIALS" });
  });

  it("maps invalid_credentials to INVALID_CREDENTIALS, matching a wrong password and a non-existent account identically", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    const result = await provider.signIn({ email: "user@example.com", password: "wrong-password" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "INVALID_CREDENTIALS" });
  });

  it("never leaks the Supabase error code or message for an email_not_confirmed failure", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    const result = await provider.signIn({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(JSON.stringify(result.error)).not.toContain("email_not_confirmed");
    expect(JSON.stringify(result.error)).not.toContain("Email not confirmed");
  });

  it("maps an unrelated provider error to UNEXPECTED, not INVALID_CREDENTIALS", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "over_request_rate_limit", message: "Rate limit exceeded" },
    });

    const result = await provider.signIn({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("returns the session on success", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "11111111-1111-1111-1111-111111111111" },
        session: { access_token: "access-token", refresh_token: "refresh-token" },
      },
      error: null,
    });

    const result = await provider.signIn({
      email: "user@example.com",
      password: "a-valid-password",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.accessToken).toBe("access-token");
  });
});

describe("SupabaseAuthProvider.getUserFromAccessToken", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    getUser.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("returns the verified identity for a valid access token", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "11111111-1111-1111-1111-111111111111" } },
      error: null,
    });

    const result = await provider.getUserFromAccessToken("a-valid-access-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("maps a 401 error to UNAUTHORIZED", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401, code: "bad_jwt", message: "invalid JWT" },
    });

    const result = await provider.getUserFromAccessToken("an-invalid-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("maps a non-401 error to UNEXPECTED, not UNAUTHORIZED", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.getUserFromAccessToken("a-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("never leaks the underlying provider error message in the UNAUTHORIZED result", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401, code: "bad_jwt", message: "invalid JWT signature" },
    });

    const result = await provider.getUserFromAccessToken("an-invalid-token");

    expect(JSON.stringify(result)).not.toContain("invalid JWT signature");
  });
});

describe("SupabaseAuthProvider.refresh", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    refreshSession.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("returns a new session for a valid refresh token", async () => {
    refreshSession.mockResolvedValue({
      data: {
        user: { id: "11111111-1111-1111-1111-111111111111" },
        session: { access_token: "new-access-token", refresh_token: "new-refresh-token" },
      },
      error: null,
    });

    const result = await provider.refresh("a-valid-refresh-token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.accessToken).toBe("new-access-token");
    expect(result.value.session.refreshToken).toBe("new-refresh-token");
  });

  it("maps a 401 error (invalid or expired refresh token) to UNAUTHORIZED", async () => {
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 401, code: "refresh_token_not_found", message: "invalid refresh token" },
    });

    const result = await provider.refresh("not-a-real-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("maps a non-401 error to UNEXPECTED", async () => {
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.refresh("a-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});

describe("SupabaseAuthProvider.revoke", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    adminSignOut.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("revokes the session for a valid access token", async () => {
    adminSignOut.mockResolvedValue({ data: null, error: null });

    const result = await provider.revoke("a-valid-access-token");

    expect(result.ok).toBe(true);
    expect(adminSignOut).toHaveBeenCalledWith("a-valid-access-token");
  });

  it("maps a 401 error to UNAUTHORIZED", async () => {
    adminSignOut.mockResolvedValue({
      data: null,
      error: { status: 401, code: "bad_jwt", message: "invalid JWT" },
    });

    const result = await provider.revoke("an-invalid-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "UNAUTHORIZED" });
  });

  it("maps a non-401 error to UNEXPECTED", async () => {
    adminSignOut.mockResolvedValue({
      data: null,
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.revoke("a-token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});

describe("SupabaseAuthProvider.initiateRecovery", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("succeeds for an existing account", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await provider.initiateRecovery("user@example.com");

    expect(result.ok).toBe(true);
  });

  it("succeeds identically when Supabase reports no matching account (non-enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 400, code: "user_not_found", message: "User not found" },
    });

    const result = await provider.initiateRecovery("no-such-account@example.com");

    expect(result.ok).toBe(true);
  });

  it("succeeds even when Supabase reports a rate limit (non-enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "over_email_send_rate_limit", message: "rate limited" },
    });

    const result = await provider.initiateRecovery("user@example.com");

    expect(result.ok).toBe(true);
  });

  it("returns UNEXPECTED only for a genuine technical/5xx failure", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.initiateRecovery("user@example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });
});

describe("SupabaseAuthProvider.resetPassword", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    verifyOtp.mockReset();
    adminUpdateUserById.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("verifies the token and sets the new password for a valid token", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "11111111-1111-1111-1111-111111111111" }, session: null },
      error: null,
    });
    adminUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(true);
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      type: "recovery",
    });
    expect(adminUpdateUserById).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", {
      password: "a-valid-password",
    });
  });

  it("returns INVALID_OR_EXPIRED_TOKEN for an expired token without calling updateUserById", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 401, code: "otp_expired", message: "Token has expired" },
    });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "an-expired-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "INVALID_OR_EXPIRED_TOKEN" });
    expect(adminUpdateUserById).not.toHaveBeenCalled();
  });

  it("returns INVALID_OR_EXPIRED_TOKEN for a wrong token, identically to an expired one", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 401, code: "bad_jwt", message: "invalid token" },
    });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "not-a-real-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ type: "INVALID_OR_EXPIRED_TOKEN" });
  });

  it("returns UNEXPECTED for a genuine technical failure verifying the token", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "a-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("returns UNEXPECTED if setting the new password fails after a valid token", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "11111111-1111-1111-1111-111111111111" }, session: null },
      error: null,
    });
    adminUpdateUserById.mockResolvedValue({
      data: null,
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "a-valid-recovery-token",
      newPassword: "a-valid-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
  });

  it("never leaks the recovery token or new password in the result", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 401, code: "otp_expired", message: "Token has expired" },
    });

    const result = await provider.resetPassword({
      email: "user@example.com",
      token: "super-secret-recovery-token",
      newPassword: "super-secret-new-password",
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("super-secret-recovery-token");
    expect(serialized).not.toContain("super-secret-new-password");
  });
});

describe("SupabaseAuthProvider.updatePassword", () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    adminUpdateUserById.mockReset();
    provider = new SupabaseAuthProvider();
  });

  it("sets the new password for the given user id", async () => {
    adminUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await provider.updatePassword(
      "11111111-1111-1111-1111-111111111111",
      "a-new-valid-password",
    );

    expect(result.ok).toBe(true);
    expect(adminUpdateUserById).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", {
      password: "a-new-valid-password",
    });
  });

  it("returns UNEXPECTED without leaking provider details when the update fails", async () => {
    adminUpdateUserById.mockResolvedValue({
      data: null,
      error: { status: 500, code: "unexpected_failure", message: "server error" },
    });

    const result = await provider.updatePassword(
      "11111111-1111-1111-1111-111111111111",
      "a-new-valid-password",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UNEXPECTED");
    expect(JSON.stringify(result)).not.toContain("a-new-valid-password");
  });
});
