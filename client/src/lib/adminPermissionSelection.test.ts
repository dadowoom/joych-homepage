import { describe, expect, it } from "vitest";
import { buildAssignedPermissionSubjectSelection } from "./adminPermissionSelection";

describe("assigned admin permission subject selection", () => {
  it("links the selected account to both the search input and submitted search", () => {
    expect(buildAssignedPermissionSubjectSelection({
      memberId: 17,
      name: " 이기쁨 ",
    })).toEqual({
      selectedMemberId: 17,
      searchInput: "이기쁨",
      submittedSearchTerm: "이기쁨",
    });
  });
});
