import { describe, expect, it } from "vitest";
import { Email } from "../value-objects/email.ts";
import { FullName } from "../value-objects/full-name.ts";
import { User } from "./user.ts";

describe("User.register", () => {
  it("starts with email_verified false, per API_SPEC.md §21a", () => {
    const user = User.register({
      id: "11111111-1111-1111-1111-111111111111",
      email: Email.create("user@example.com"),
      fullName: FullName.create("Jane Doe"),
    });

    expect(user.emailVerified).toBe(false);
    expect(user.id).toBe("11111111-1111-1111-1111-111111111111");
  });
});
