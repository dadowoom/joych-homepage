import { describe, expect, it } from "vitest";
import { getManagementPageHref } from "./managementEntry";

describe("management entry", () => {
  it("sends administrators and delegated content managers to the admin dashboard", () => {
    expect(getManagementPageHref({ role: "admin" }, ["/education/academy"]))
      .toBe("/admin_joych_2026");
    expect(getManagementPageHref({ role: "user", contentPermissions: ["content:vehicles"] }, []))
      .toBe("/admin_joych_2026");
  });

  it("sends a course-room-only manager to the assigned course page in management mode", () => {
    expect(getManagementPageHref(null, ["/education/academy"]))
      .toBe("/education/academy?manage=1");
  });

  it("does not expose a management entry to ordinary members", () => {
    expect(getManagementPageHref(null, [])).toBeNull();
  });
});
