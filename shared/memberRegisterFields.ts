export const MEMBER_REGISTER_FIELD_CONFIG_KEY = "member_register_field_config";

export type MemberRegisterFieldKey =
  | "phone"
  | "birthDate"
  | "gender"
  | "address"
  | "emergencyPhone"
  | "position"
  | "department"
  | "district"
  | "faithPlusUserId"
  | "joinPath";

export type MemberRegisterFieldSetting = {
  visible: boolean;
  required: boolean;
};

export type MemberRegisterFieldConfig = Record<MemberRegisterFieldKey, MemberRegisterFieldSetting>;

export type MemberRegisterFieldDefinition = {
  key: MemberRegisterFieldKey;
  label: string;
  description: string;
  section: "basic" | "church";
};

export const REQUIRED_MEMBER_REGISTER_FIELD_KEYS = [
  "phone",
  "birthDate",
  "gender",
] as const satisfies readonly MemberRegisterFieldKey[];

const REQUIRED_MEMBER_REGISTER_FIELD_KEY_SET = new Set<MemberRegisterFieldKey>(
  REQUIRED_MEMBER_REGISTER_FIELD_KEYS,
);

export function isRequiredMemberRegisterField(key: MemberRegisterFieldKey) {
  return REQUIRED_MEMBER_REGISTER_FIELD_KEY_SET.has(key);
}

export const MEMBER_REGISTER_FIELD_DEFINITIONS: MemberRegisterFieldDefinition[] = [
  { key: "phone", label: "연락처", description: "회원 연락 및 승인 확인에 사용하는 전화번호", section: "basic" },
  { key: "birthDate", label: "생년월일", description: "성도 기본 정보에 저장되는 생년월일", section: "basic" },
  { key: "gender", label: "성별", description: "남/여 선택 항목", section: "basic" },
  { key: "address", label: "주소", description: "성도 주소 입력 항목", section: "basic" },
  { key: "emergencyPhone", label: "비상연락처", description: "긴급 연락처 입력 항목", section: "basic" },
  { key: "position", label: "직분", description: "관리자가 등록한 직분 선택 목록", section: "church" },
  { key: "department", label: "소속 부서", description: "관리자가 등록한 부서 선택 목록", section: "church" },
  { key: "district", label: "구역 / 순", description: "관리자가 등록한 구역 선택 목록", section: "church" },
  { key: "faithPlusUserId", label: "믿음PLUS 사용자 ID", description: "믿음PLUS 연동 확인용 사용자 ID", section: "church" },
  { key: "joinPath", label: "가입 경로", description: "회원가입 경로 선택 항목", section: "church" },
];

export const DEFAULT_MEMBER_REGISTER_FIELD_CONFIG: MemberRegisterFieldConfig = {
  phone: { visible: true, required: true },
  birthDate: { visible: true, required: true },
  gender: { visible: true, required: true },
  address: { visible: false, required: false },
  emergencyPhone: { visible: false, required: false },
  position: { visible: true, required: false },
  department: { visible: true, required: false },
  district: { visible: true, required: false },
  faithPlusUserId: { visible: true, required: false },
  joinPath: { visible: true, required: false },
};

function enforceRequiredMemberRegisterFields(config: MemberRegisterFieldConfig) {
  for (const key of REQUIRED_MEMBER_REGISTER_FIELD_KEYS) {
    config[key] = { visible: true, required: true };
  }
  return config;
}

export const FIXED_MEMBER_REGISTER_FIELDS = [
  { label: "이름", description: "회원 식별을 위한 필수 항목" },
  { label: "이메일", description: "로그인 계정으로 사용하는 필수 항목" },
  { label: "비밀번호", description: "로그인을 위한 필수 항목" },
  { label: "개인정보 동의", description: "회원가입 신청 전 필수 동의 항목" },
];

export function parseMemberRegisterFieldConfig(value?: string | null): MemberRegisterFieldConfig {
  const fallback = { ...DEFAULT_MEMBER_REGISTER_FIELD_CONFIG };
  for (const key of Object.keys(fallback) as MemberRegisterFieldKey[]) {
    fallback[key] = { ...fallback[key] };
  }
  if (!value) return enforceRequiredMemberRegisterFields(fallback);

  try {
    const parsed = JSON.parse(value) as Partial<Record<MemberRegisterFieldKey, Partial<MemberRegisterFieldSetting>>>;
    for (const definition of MEMBER_REGISTER_FIELD_DEFINITIONS) {
      const current = parsed[definition.key];
      if (!current || typeof current !== "object") continue;
      fallback[definition.key] = {
        visible: typeof current.visible === "boolean" ? current.visible : fallback[definition.key].visible,
        required: typeof current.required === "boolean" ? current.required : fallback[definition.key].required,
      };
      if (!fallback[definition.key].visible) {
        fallback[definition.key].required = false;
      }
    }
    return enforceRequiredMemberRegisterFields(fallback);
  } catch {
    return enforceRequiredMemberRegisterFields(fallback);
  }
}
