/**
 * MemberMyPage.tsx
 * 성도 마이페이지 — 내 정보 확인 (기본 정보 + 관리자가 입력한 교회 정보)
 * + 믿음PLUS 유저 ID 수정 기능
 */
import { useState, type ChangeEvent } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { finishDomainLogout } from "@/lib/mainHomepageDomain";

type ChurchForm = {
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};

type PasswordFormErrors = Partial<Record<keyof PasswordForm, string>>;

const EMPTY_CHURCH_FORM: ChurchForm = {
  position: "",
  department: "",
  district: "",
  baptismType: "",
  baptismDate: "",
  registeredAt: "",
  pastor: "",
};

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  newPasswordConfirm: "",
};

export default function MemberMyPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: me, isLoading, error } = trpc.members.me.useQuery();
  const { data: churchFieldOptions = [] } = trpc.members.fieldOptions.useQuery({});

  const [editingFaithPlus, setEditingFaithPlus] = useState(false);
  const [faithPlusInput, setFaithPlusInput] = useState("");
  const [editingChurchInfo, setEditingChurchInfo] = useState(false);
  const [churchForm, setChurchForm] = useState<ChurchForm>(EMPTY_CHURCH_FORM);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({});
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState("");

  const logoutMutation = trpc.members.logout.useMutation({
    onSuccess: (data) => {
      toast.success("로그아웃됐습니다.");
      finishDomainLogout("/member/login", data.domainLogoutIntent);
    },
  });

  const updateInfoMutation = trpc.members.updateMyInfo.useMutation({
    onSuccess: () => {
      toast.success("믿음PLUS 유저 ID가 저장됐습니다.");
      setEditingFaithPlus(false);
      utils.members.me.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "저장에 실패했습니다.");
    },
  });

  const updateChurchMutation = trpc.members.updateMyChurchInfo.useMutation({
    onSuccess: () => {
      toast.success("교회 정보가 저장됐습니다.");
      setEditingChurchInfo(false);
      utils.members.me.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "저장에 실패했습니다.");
    },
  });

  const changePasswordMutation = trpc.members.changeMyPassword.useMutation({
    onSuccess: () => {
      toast.success("비밀번호가 변경됐습니다. 새 비밀번호로 다시 로그인해주세요.");
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordErrors({});
      setPasswordOpen(false);
      void utils.members.me.invalidate();
      navigate("/member/login");
    },
    onError: (e) => {
      toast.error(e.message || "비밀번호 변경에 실패했습니다.");
    },
  });

  const withdrawMutation = trpc.members.withdraw.useMutation({
    onSuccess: () => {
      toast.success("회원 탈퇴가 완료됐습니다.");
      utils.members.me.invalidate();
      navigate("/member/login");
    },
    onError: (e) => {
      toast.error(e.message || "탈퇴 처리에 실패했습니다.");
    },
  });

  const handleFaithPlusSave = () => {
    updateInfoMutation.mutate({ faithPlusUserId: faithPlusInput || undefined });
  };

  const handleFaithPlusEdit = () => {
    setFaithPlusInput(me?.faithPlusUserId ?? "");
    setEditingFaithPlus(true);
  };

  const handleChurchEdit = () => {
    setChurchForm({
      position: me?.position ?? "",
      department: me?.department ?? "",
      district: me?.district ?? "",
      baptismType: me?.baptismType ?? "",
      baptismDate: me?.baptismDate ?? "",
      registeredAt: me?.registeredAt ?? "",
      pastor: me?.pastor ?? "",
    });
    setEditingChurchInfo(true);
  };

  const handleChurchSave = () => {
    updateChurchMutation.mutate({
      position: churchForm.position,
      department: churchForm.department,
      district: churchForm.district,
      baptismType: churchForm.baptismType,
      baptismDate: churchForm.baptismDate,
      registeredAt: churchForm.registeredAt,
      pastor: churchForm.pastor,
    });
  };

  const setPasswordField =
    (key: keyof PasswordForm) => (e: ChangeEvent<HTMLInputElement>) => {
      setPasswordForm(prev => ({ ...prev, [key]: e.target.value }));
      setPasswordErrors(prev => ({ ...prev, [key]: undefined }));
    };

  const handlePasswordSave = () => {
    const errors: PasswordFormErrors = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = "현재 비밀번호를 입력해주세요.";
    }
    if (passwordForm.newPassword.length < 8) {
      errors.newPassword = "새 비밀번호는 8자 이상이어야 합니다.";
    } else if (
      !/[A-Za-z]/.test(passwordForm.newPassword) ||
      !/\d/.test(passwordForm.newPassword)
    ) {
      errors.newPassword = "새 비밀번호는 영문과 숫자를 모두 포함해야 합니다.";
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      errors.newPassword = "현재 비밀번호와 다른 비밀번호를 입력해주세요.";
    }
    if (passwordForm.newPasswordConfirm !== passwordForm.newPassword) {
      errors.newPasswordConfirm = "새 비밀번호가 일치하지 않습니다.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const closePasswordForm = () => {
    setPasswordOpen(false);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordErrors({});
  };

  const setChurchField = (key: keyof ChurchForm) => (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setChurchForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleWithdraw = () => {
    if (withdrawConfirm.trim() !== "탈퇴") {
      toast.error("확인 문구로 '탈퇴'를 입력해주세요.");
      return;
    }
    withdrawMutation.mutate({ confirm: "탈퇴" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-lock text-gray-400 text-2xl"></i>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">로그인이 필요합니다</h2>
          <p className="text-sm text-gray-500 mb-6">마이페이지를 이용하려면 로그인해주세요.</p>
          <Link
            href="/member/login"
            className="inline-block px-6 py-3 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18]"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = {
    pending: { text: "승인 대기 중", color: "bg-yellow-100 text-yellow-700" },
    approved: { text: "승인 완료", color: "bg-green-100 text-green-700" },
    rejected: { text: "가입 거절", color: "bg-red-100 text-red-700" },
    withdrawn: { text: "탈퇴", color: "bg-gray-100 text-gray-500" },
  }[me.status ?? "pending"] ?? { text: "대기 중", color: "bg-gray-100 text-gray-500" };

  const positionOptions = churchFieldOptions.filter((option) => option.fieldType === "position");
  const departmentOptions = churchFieldOptions.filter((option) => option.fieldType === "department");
  const districtOptions = churchFieldOptions.filter((option) => option.fieldType === "district");
  const baptismOptions = churchFieldOptions.filter((option) => option.fieldType === "baptism");

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </Link>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-4">
          <PushNotificationToggle
            title="교회 알림 받기"
            enabledDescription="이 기기에서 교회 공지와 안내 푸시를 받을 준비가 되어 있습니다."
            disabledDescription="공지사항, 주보, 구역별 안내 푸시를 받으려면 알림을 켜주세요."
          />
        </div>
        {/* 프로필 헤더 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-user text-[#1B5E20] text-2xl"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{me.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel.color}`}>
                  {statusLabel.text}
                </span>
              </div>
              {me.position && (
                <p className="text-sm text-[#1B5E20] font-medium mt-0.5">{me.position}</p>
              )}
              <p className="text-sm text-gray-500 mt-0.5">{me.email}</p>
            </div>
          </div>

          {me.status === "pending" && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-xs text-yellow-700">
                <i className="fas fa-info-circle mr-1"></i>
                회원가입 신청이 접수됐습니다. 관리자 승인 후 모든 서비스를 이용하실 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-user-circle text-[#1B5E20]"></i>
            기본 정보
          </h2>
          <div className="space-y-3">
            <InfoRow label="이름" value={me.name} />
            <InfoRow label="이메일" value={me.email} />
            <InfoRow label="연락처" value={me.phone} />
            <InfoRow label="생년월일" value={me.birthDate} />
            <InfoRow label="성별" value={me.gender} />
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                <i className="fas fa-lock text-[#1B5E20]"></i>
                비밀번호 변경
              </h2>
              <p className="text-xs text-gray-400">
                {me.hasPassword
                  ? "안전한 계정 사용을 위해 비밀번호를 변경할 수 있습니다."
                  : "간편가입 계정은 연결된 소셜 계정으로 로그인합니다."}
              </p>
            </div>
            {me.hasPassword && !passwordOpen && (
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="text-xs text-[#1B5E20] border border-[#1B5E20] rounded-lg px-3 py-1.5 hover:bg-[#E8F5E9] transition-colors flex-shrink-0"
              >
                변경
              </button>
            )}
          </div>

          {me.hasPassword && passwordOpen && (
            <form
              className="space-y-3 mt-4"
              onSubmit={e => {
                e.preventDefault();
                handlePasswordSave();
              }}
            >
              <PasswordInput
                label="현재 비밀번호"
                value={passwordForm.currentPassword}
                onChange={setPasswordField("currentPassword")}
                autoComplete="current-password"
                error={passwordErrors.currentPassword}
              />
              <PasswordInput
                label="새 비밀번호"
                value={passwordForm.newPassword}
                onChange={setPasswordField("newPassword")}
                autoComplete="new-password"
                placeholder="8자 이상, 영문과 숫자 포함"
                error={passwordErrors.newPassword}
              />
              <PasswordInput
                label="새 비밀번호 확인"
                value={passwordForm.newPasswordConfirm}
                onChange={setPasswordField("newPasswordConfirm")}
                autoComplete="new-password"
                placeholder="새 비밀번호를 한 번 더 입력해주세요"
                error={passwordErrors.newPasswordConfirm}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18] disabled:opacity-50"
                >
                  {changePasswordMutation.isPending ? "변경 중..." : "변경"}
                </button>
                <button
                  type="button"
                  onClick={closePasswordForm}
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 교회 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                <i className="fas fa-church text-[#1B5E20]"></i>
                교회 정보
              </h2>
              <p className="text-xs text-gray-400">내 교회 정보를 확인하고 수정할 수 있습니다.</p>
            </div>
            {!editingChurchInfo && (
              <button
                onClick={handleChurchEdit}
                className="text-xs text-[#1B5E20] border border-[#1B5E20] rounded-lg px-3 py-1.5 hover:bg-[#E8F5E9] transition-colors flex-shrink-0"
              >
                수정
              </button>
            )}
          </div>

          {editingChurchInfo ? (
            <div className="space-y-3">
              <SelectInfoRow
                label="직분"
                value={churchForm.position}
                onChange={setChurchField("position")}
                options={positionOptions}
              />
              <SelectInfoRow
                label="소속 부서"
                value={churchForm.department}
                onChange={setChurchField("department")}
                options={departmentOptions}
              />
              <SelectInfoRow
                label="구역 / 순"
                value={churchForm.district}
                onChange={setChurchField("district")}
                options={districtOptions}
              />
              <SelectInfoRow
                label="세례 구분"
                value={churchForm.baptismType}
                onChange={setChurchField("baptismType")}
                options={baptismOptions}
              />
              <TextInfoRow
                label="세례일"
                value={churchForm.baptismDate}
                onChange={setChurchField("baptismDate")}
                placeholder="YYYY-MM-DD"
              />
              <TextInfoRow
                label="등록일"
                value={churchForm.registeredAt}
                onChange={setChurchField("registeredAt")}
                placeholder="YYYY-MM-DD"
              />
              <TextInfoRow
                label="담당 교역자"
                value={churchForm.pastor}
                onChange={setChurchField("pastor")}
                placeholder="담당 교역자 이름"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleChurchSave}
                  disabled={updateChurchMutation.isPending}
                  className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18] disabled:opacity-50"
                >
                  {updateChurchMutation.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditingChurchInfo(false)}
                  disabled={updateChurchMutation.isPending}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="직분" value={me.position} placeholder="미입력" />
              <InfoRow label="소속 부서" value={me.department} placeholder="미입력" />
              <InfoRow label="구역 / 순" value={me.district} placeholder="미입력" />
              <InfoRow label="세례 구분" value={me.baptismType} placeholder="미입력" />
              <InfoRow label="세례일" value={me.baptismDate} placeholder="미입력" />
              <InfoRow label="등록일" value={me.registeredAt} placeholder="미입력" />
              <InfoRow label="담당 교역자" value={me.pastor} placeholder="미입력" />
            </div>
          )}
        </div>

        {/* 믿음PLUS 연동 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
            <i className="fas fa-mobile-alt text-[#1B5E20]"></i>
            믿음PLUS 연동
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            믿음PLUS 앱을 사용하신다면 유저 ID를 등록해주세요. 교적부에서 프로필 연결에 사용됩니다.
          </p>

          {editingFaithPlus ? (
            <div className="space-y-3">
              <input
                type="text"
                value={faithPlusInput}
                onChange={(e) => setFaithPlusInput(e.target.value)}
                placeholder="믿음PLUS 앱에서 확인한 유저 ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleFaithPlusSave}
                  disabled={updateInfoMutation.isPending}
                  className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18] disabled:opacity-50"
                >
                  {updateInfoMutation.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditingFaithPlus(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                {me.faithPlusUserId ? (
                  <div>
                    <p className="text-sm font-medium text-gray-800">유저 ID: {me.faithPlusUserId}</p>
                    <a
                      href={`https://faithplus.co.kr/search?user=${me.faithPlusUserId}`}
                      className="text-xs text-[#1B5E20] hover:underline mt-0.5 inline-block"
                    >
                      믿음PLUS에서 보기 →
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">등록된 유저 ID가 없습니다.</p>
                )}
              </div>
              <button
                onClick={handleFaithPlusEdit}
                className="text-xs text-[#1B5E20] border border-[#1B5E20] rounded-lg px-3 py-1.5 hover:bg-[#E8F5E9] transition-colors"
              >
                {me.faithPlusUserId ? "수정" : "등록"}
              </button>
            </div>
          )}
        </div>

        {/* 회원 탈퇴 */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
            <i className="fas fa-user-slash text-red-500"></i>
            회원 탈퇴
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            탈퇴하면 로그인 정보와 개인정보, 간편가입 연결이 삭제되고 작성한 간증글과 댓글은 삭제 처리됩니다.
          </p>

          {withdrawOpen ? (
            <div className="space-y-3">
              <input
                type="text"
                value={withdrawConfirm}
                onChange={(e) => setWithdrawConfirm(e.target.value)}
                placeholder="탈퇴"
                className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {withdrawMutation.isPending ? "처리 중..." : "탈퇴하기"}
                </button>
                <button
                  onClick={() => {
                    setWithdrawOpen(false);
                    setWithdrawConfirm("");
                  }}
                  disabled={withdrawMutation.isPending}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setWithdrawOpen(true)}
              className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              회원 탈퇴
            </button>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  placeholder = "-",
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 flex-shrink-0 w-28">{label}</span>
      <span className={`text-sm text-right flex-1 ${value ? "text-gray-800 font-medium" : "text-gray-300"}`}>
        {value || placeholder}
      </span>
    </div>
  );
}

type FieldOption = {
  id: number;
  label: string;
};

function SelectInfoRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: FieldOption[];
}) {
  const hasCurrentValue = Boolean(value) && !options.some((option) => option.label === value);

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <label className="text-sm text-gray-500 flex-shrink-0 w-28">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
      >
        <option value="">선택 안함</option>
        {hasCurrentValue && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextInfoRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <label className="text-sm text-gray-500 flex-shrink-0 w-28">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
      />
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        maxLength={128}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
          error ? "border-red-400" : "border-gray-300"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
