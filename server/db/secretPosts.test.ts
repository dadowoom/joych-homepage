import { describe, expect, it } from "vitest";
import { canViewSecretPost, isSecretPostHidden } from "./secretPosts";

describe("secretPosts access", () => {
  const adminUser = { role: "admin", contentPermissions: [] };
  const permissionUser = { role: "user", contentPermissions: ["content:testimonies"] };
  const outsider = { role: "user", contentPermissions: [] };

  it("allows admins to read secret posts", () => {
    expect(canViewSecretPost({ user: adminUser }, "content:testimonies")).toBe(true);
  });

  it("allows users with the matching permission", () => {
    expect(canViewSecretPost({ user: permissionUser }, "content:testimonies")).toBe(true);
  });

  it("allows the author member", () => {
    expect(canViewSecretPost({ user: outsider, memberId: 12 }, "content:testimonies", 12)).toBe(true);
  });

  it("hides secret posts from unauthorized viewers", () => {
    expect(isSecretPostHidden(true, { user: outsider, memberId: 3 }, "content:testimonies", 12)).toBe(true);
  });

  it("does not hide normal posts", () => {
    expect(isSecretPostHidden(false, { user: outsider }, "content:testimonies")).toBe(false);
  });
});
