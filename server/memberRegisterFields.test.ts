import { describe, expect, it } from "vitest";
import { MEMBER_APPROVAL_PERMISSION_KEY, STATIC_ADMIN_PERMISSIONS } from "../shared/adminPermissions";
import {
  MEMBER_REGISTER_FIELD_DEFINITIONS,
  parseMemberRegisterFieldConfig,
} from "../shared/memberRegisterFields";

describe("member registration field configuration", () => {
  it("기존 저장값에 직분이 없어도 직분 항목을 기본 표시한다", () => {
    const config = parseMemberRegisterFieldConfig(JSON.stringify({
      phone: { visible: true, required: true },
      department: { visible: false, required: false },
    }));

    expect(MEMBER_REGISTER_FIELD_DEFINITIONS).toContainEqual(expect.objectContaining({
      key: "position",
      label: "직분",
      section: "church",
    }));
    expect(config.position).toEqual({ visible: true, required: false });
  });

  it("숨긴 직분 항목은 필수 상태가 남지 않는다", () => {
    const config = parseMemberRegisterFieldConfig(JSON.stringify({
      position: { visible: false, required: true },
    }));

    expect(config.position).toEqual({ visible: false, required: false });
  });
});

describe("member approval permission", () => {
  it("성도/사역 관리의 회원가입 승인 권한으로 members 탭을 연다", () => {
    expect(STATIC_ADMIN_PERMISSIONS).toContainEqual({
      key: MEMBER_APPROVAL_PERMISSION_KEY,
      label: "회원가입 승인 관리",
      group: "성도/사역 관리",
      tab: "members",
      description: "신규 성도 가입 신청을 확인하고 승인/거절합니다.",
    });
  });
});
