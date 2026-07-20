/**
 * AdminMembersTab.tsx
 * 관리자 성도 관리 탭
 * - 전체 성도 목록 조회
 * - 상태별 / 구역별 / 직분별 필터 + 보기 방식 + 이름/연락처 검색
 * - 기본정보 미입력 성도 빠른 확인
 * - 20명씩 페이징
 * - 가입 승인/거절 (빠른 버튼)
 * - 성도 삭제(탈퇴 처리)
 * - 탈퇴 처리된 성도 복구
 * - 수정 버튼 → MemberEditModal 모달 오픈
 */
import { useState, useMemo } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageAdminTab } from "@/lib/contentPermissions";
import { formatPhoneNumber } from "@/lib/phoneNumber";
import { PRIMARY_SITE_ORIGIN } from "@/lib/mainHomepageDomain";
import { toast } from "sonner";
import MemberEditModal from "./MemberEditModal";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "withdrawn";
type ViewMode = "position" | "list" | "district" | "department";

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending:   { text: "대기",  color: "bg-yellow-100 text-yellow-700" },
  approved:  { text: "승인",  color: "bg-green-100 text-green-700" },
  rejected:  { text: "거절",  color: "bg-red-100 text-red-700" },
  withdrawn: { text: "탈퇴",  color: "bg-gray-100 text-gray-500" },
};

const VIEW_LABELS: { key: ViewMode; label: string }[] = [
  { key: "list", label: "전체보기" },
  { key: "position", label: "직분별" },
  { key: "district", label: "구역/순별" },
  { key: "department", label: "부서별" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

type AdminMember = inferRouterOutputs<AppRouter>["members"]["adminList"][number];
type Member = AdminMember;
type PasswordResetDelivery = {
  resetUrl: string;
  expiresAt: Date;
  pushSentCount: number;
};

function MemberSummary({ member, number }: { member: Member; number: number }) {
  const status = STATUS_LABELS[member.status ?? "pending"] ?? STATUS_LABELS.pending;
  const phone = formatPhoneNumber(member.phone);

  return (
    <dl className="grid min-w-0 flex-1 grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
      <dt className="text-gray-400">번호</dt>
      <dd className="text-gray-600">{number}</dd>
      <dt className="text-gray-400">승인여부</dt>
      <dd>
        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${status.color}`}>{status.text}</span>
      </dd>
      <dt className="text-gray-400">이름</dt>
      <dd className="font-semibold text-gray-800">{member.name}</dd>
      <dt className="text-gray-400">성별</dt>
      <dd className="text-gray-600">{member.gender || "-"}</dd>
      <dt className="text-gray-400">직분</dt>
      <dd className="text-gray-600">{member.position || "-"}</dd>
      <dt className="text-gray-400">연락처</dt>
      <dd className="break-all text-gray-600">
        {phone || <span className="font-medium text-red-500">미입력</span>}
      </dd>
      <dt className="text-gray-400">생년월일</dt>
      <dd className="text-gray-600">
        {member.birthDate || <span className="font-medium text-red-500">미입력</span>}
      </dd>
    </dl>
  );
}

export default function AdminMembersTab() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isFullAdmin = user?.role === "admin";
  const canManageMemberRegistry = canManageAdminTab(user, "members");

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [districtFilter, setDistrictFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [basicMissingOnly, setBasicMissingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // 페이징 상태
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  // 모달 상태
  const [editingMember, setEditingMember] = useState<AdminMember | null>(null);
  const [editingInitialTab, setEditingInitialTab] = useState<"basic" | "account">("basic");
  const [passwordResetDelivery, setPasswordResetDelivery] = useState<PasswordResetDelivery | null>(null);

  // 데이터 조회
  const adminListQuery = trpc.members.adminList.useQuery(undefined, { enabled: canManageMemberRegistry });
  const members: Member[] = adminListQuery.data ?? [];
  const isLoading = adminListQuery.isLoading;
  const passwordResetRequestsQuery = trpc.members.passwordResetRequests.useQuery(undefined, { enabled: isFullAdmin });
  const passwordResetRequests = passwordResetRequestsQuery.data ?? [];
  const { data: fieldOptions = [] } = trpc.members.fieldOptions.useQuery({});

  const approvePasswordResetMutation = trpc.members.approvePasswordResetRequest.useMutation({
    onSuccess: (result) => {
      const resetUrl = new URL(result.resetPath, PRIMARY_SITE_ORIGIN).toString();
      setPasswordResetDelivery({
        resetUrl,
        expiresAt: new Date(result.expiresAt),
        pushSentCount: result.pushSentCount,
      });
      utils.members.passwordResetRequests.invalidate();
      toast.success(
        result.pushSentCount > 0
          ? "본인 확인을 완료하고 성도에게 재설정 푸시를 보냈습니다."
          : "일회용 링크를 만들었습니다. 푸시 기기가 없어 링크를 직접 전달해주세요.",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const copyPasswordResetLink = async () => {
    if (!passwordResetDelivery) return;
    try {
      await navigator.clipboard.writeText(passwordResetDelivery.resetUrl);
      toast.success("일회용 재설정 링크를 복사했습니다.");
    } catch {
      toast.error("링크를 복사하지 못했습니다. 주소를 직접 선택해 복사해주세요.");
    }
  };

  // 필터 선택지 (활성화된 것만)
  const districtOptions = useMemo(() => fieldOptions.filter(o => o.fieldType === "district" && o.isActive), [fieldOptions]);
  const positionOptions = useMemo(() => fieldOptions.filter(o => o.fieldType === "position" && o.isActive), [fieldOptions]);
  const departmentOptions = useMemo(() => fieldOptions.filter(o => o.fieldType === "department" && o.isActive), [fieldOptions]);

  // 빠른 승인/거절 뮤테이션
  const approvalMutation = trpc.members.updateApprovalStatus.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      utils.members.approvalList.invalidate();
      utils.cms.notifications.summary.invalidate();
      toast.success("상태가 변경됐습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const adminStatusMutation = trpc.members.updateChurchInfo.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("상태가 변경됐습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.members.archiveMember.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      utils.members.approvalList.invalidate();
      utils.cms.notifications.summary.invalidate();
      toast.success("성도를 삭제 처리했습니다. 탈퇴 상태에서 다시 확인할 수 있습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const hardDeleteMutation = trpc.members.hardDelete.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("성도를 완전히 삭제했습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  // 필터링 (필터 변경 시 페이지 1로 리셋)
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");
    return members.filter((m) => {
      const matchStatus   = statusFilter === "all" || m.status === statusFilter;
      const matchDistrict = !districtFilter || m.district === districtFilter;
      const matchPosition = !positionFilter || m.position === positionFilter;
      const matchDepartment = !departmentFilter || m.department === departmentFilter;
      const matchBasicInfo = !basicMissingOnly || !m.phone || !m.birthDate;
      const matchSearch   =
        !query ||
        m.name.toLowerCase().includes(query) ||
        (m.phone ?? "").toLowerCase().includes(query) ||
        (queryDigits.length > 0 && (m.phone ?? "").replace(/\D/g, "").includes(queryDigits)) ||
        (m.email ?? "").toLowerCase().includes(query);
      return matchStatus && matchDistrict && matchPosition && matchDepartment && matchBasicInfo && matchSearch;
    });
  }, [members, statusFilter, districtFilter, positionFilter, departmentFilter, basicMissingOnly, searchQuery]);

  // 필터 변경 시 페이지 초기화 헬퍼
  const changeFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const getGroupLabel = (member: Member) => {
    if (viewMode === "position") return member.position || "직분 미입력";
    if (viewMode === "district") return member.district || "구역/순 미입력";
    if (viewMode === "department") return member.department || "부서 미입력";
    return "";
  };

  const sortedFiltered = useMemo(() => {
    if (viewMode === "list") return filtered;
    return [...filtered].sort((a, b) => {
      const groupCompare = getGroupLabel(a).localeCompare(getGroupLabel(b), "ko");
      if (groupCompare !== 0) return groupCompare;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [filtered, viewMode]);

  // 페이징 계산
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sortedFiltered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const grouped = useMemo(() => {
    if (viewMode === "list") return [{ label: "", members: paginated }];
    return paginated.reduce<{ label: string; members: Member[] }[]>((acc, member) => {
      const label = getGroupLabel(member);
      const current = acc[acc.length - 1];
      if (current?.label === label) {
        current.members.push(member);
      } else {
        acc.push({ label, members: [member] });
      }
      return acc;
    }, []);
  }, [paginated, viewMode]);

  const quickApprove = (id: number) => approvalMutation.mutate({ id, status: "approved" });
  const quickReject  = (id: number) => approvalMutation.mutate({ id, status: "rejected" });
  const openMemberEditor = (member: AdminMember, initialTab: "basic" | "account" = "basic") => {
    setEditingInitialTab(initialTab);
    setEditingMember(member);
  };
  const restoreMember = (member: Member) => {
    const confirmed = window.confirm(
      `${member.name} 성도를 대기 상태로 복구할까요?\n\n복구 후 다시 승인하거나 정보를 수정할 수 있습니다.`
    );
    if (!confirmed) return;
    adminStatusMutation.mutate({ id: member.id, status: "pending" });
  };
  const deleteMember = (member: Member) => {
    const confirmed = window.confirm(
      `${member.name} 성도를 삭제 처리할까요?\n\n실제 데이터는 탈퇴 상태로 보관되며, 탈퇴 탭에서 다시 확인할 수 있습니다.`
    );
    if (!confirmed) return;
    deleteMutation.mutate({ id: member.id });
  };

  const hardDeleteMember = (member: Member) => {
    if (member.status !== "withdrawn") {
      toast.error("완전삭제는 탈퇴 상태 성도에게만 사용할 수 있습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${member.name} 성도를 완전히 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다. 게시글, 신청, 예약 등 연결 기록이 있으면 서버에서 삭제를 막습니다.`
    );
    if (!confirmed) return;
    hardDeleteMutation.mutate({ id: member.id });
  };

  const isMutating = approvalMutation.isPending || adminStatusMutation.isPending || deleteMutation.isPending || hardDeleteMutation.isPending;

  const renderMemberActions = (member: Member) => (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {member.status === "pending" && (
        <>
          <button
            onClick={() => quickApprove(member.id)}
            disabled={isMutating}
            className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
          >
            승인
          </button>
          <button
            onClick={() => quickReject(member.id)}
            disabled={isMutating}
            className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors font-medium"
          >
            거절
          </button>
        </>
      )}
      {canManageMemberRegistry && (
        <button
          onClick={() => openMemberEditor(member as AdminMember)}
          disabled={isMutating}
          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
        >
          수정
        </button>
      )}
      {canManageMemberRegistry && member.status !== "withdrawn" && (
        <button
          onClick={() => deleteMember(member)}
          disabled={isMutating}
          className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
        >
          삭제
        </button>
      )}
      {isFullAdmin && member.status === "withdrawn" && (
        <>
          <button
            onClick={() => restoreMember(member)}
            disabled={isMutating}
            className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            복구
          </button>
          <button
            onClick={() => hardDeleteMember(member)}
            disabled={isMutating}
            className="text-xs px-3 py-1 border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
          >
            완전삭제
          </button>
        </>
      )}
    </div>
  );

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  const pendingCount = members.filter(m => m.status === "pending").length;
  const basicMissingCount = members.filter(m => m.status !== "withdrawn" && (!m.phone || !m.birthDate)).length;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800">
              교적부/성도 관리
            </h3>
            <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
              {isFullAdmin ? "관리자 전용" : "가입 승인/교적부 권한"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            전체 {members.length}명
            {filtered.length !== members.length && (
              <span className="ml-1 text-[#1B5E20] font-medium">· 검색결과 {filtered.length}명</span>
            )}
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">· 승인 대기 {pendingCount}명</span>
            )}
            {basicMissingCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">· 기본정보 미입력 {basicMissingCount}명</span>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isFullAdmin
              ? "공개 홈페이지가 아니라 관리자 화면에서만 확인하는 교적부입니다."
              : "가입 승인 권한으로 전체 교적부를 조회·수정하고 신규 가입 승인 또는 탈퇴 보관을 처리합니다."}
          </p>
        </div>
      </div>

      {isFullAdmin && passwordResetDelivery && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-900">비밀번호 재설정 전달 준비 완료</p>
          <p className="mt-1 text-xs leading-5 text-green-800">
            {passwordResetDelivery.pushSentCount > 0
              ? `성도의 등록 기기 ${passwordResetDelivery.pushSentCount}곳에 푸시를 보냈습니다.`
              : "등록된 푸시 기기가 없습니다. 아래 링크를 등록 연락처로 직접 전달해주세요."}
            {" "}이 링크는 24시간 동안 한 번만 사용할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={passwordResetDelivery.resetUrl}
              className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-gray-700"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copyPasswordResetLink}
              className="shrink-0 rounded-lg bg-[#1B5E20] px-4 py-2 text-xs font-semibold text-white hover:bg-[#154a18]"
            >
              링크 복사
            </button>
          </div>
          <p className="mt-2 text-[11px] text-green-700">
            만료: {passwordResetDelivery.expiresAt.toLocaleString("ko-KR")}
          </p>
        </div>
      )}

      {isFullAdmin && passwordResetRequests.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-amber-900">
                비밀번호 재설정 요청 {passwordResetRequests.length}건
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                등록된 전화번호로 본인을 확인한 뒤 일회용 재설정 링크를 발급해주세요.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {passwordResetRequests.map((request) => {
              return (
                <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-800">
                      {request.name}{request.position ? ` (${request.position})` : ""}
                    </p>
                    <p className="mt-1 break-all text-xs text-gray-500">
                      {formatPhoneNumber(request.phone) || "연락처 미입력"} · {request.email || "이메일 미입력"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      요청 {new Date(request.requestedAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm(
                        `${request.name}${request.position ? ` (${request.position})` : ""}님의 등록 전화번호로 본인 확인을 마쳤습니까?\n\n확인을 누르면 24시간짜리 일회용 재설정 링크가 발급됩니다.`,
                      );
                      if (confirmed) {
                        setPasswordResetDelivery(null);
                        approvePasswordResetMutation.mutate({ requestId: request.id });
                      }
                    }}
                    disabled={approvePasswordResetMutation.isPending}
                    className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
                  >
                    {approvePasswordResetMutation.isPending && approvePasswordResetMutation.variables?.requestId === request.id
                      ? "링크 발급 중..."
                      : "본인 확인 완료"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 필터 영역 ── */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-3">
        {/* 상태 필터 */}
        {canManageMemberRegistry && <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <span className="w-20 shrink-0 text-xs font-semibold text-gray-500">전체상태</span>
          <div className="flex flex-wrap gap-1">
            {(["all", "pending", "approved", "rejected", "withdrawn"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => changeFilter(setStatusFilter)(s)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-[#1B5E20] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s === "all" ? "전체 상태" : STATUS_LABELS[s]?.text}
              </button>
            ))}
          </div>
        </div>}

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <span className="w-20 shrink-0 text-xs font-semibold text-gray-500">전체보기</span>
          <div className="flex flex-wrap gap-1">
            {VIEW_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => changeFilter(setViewMode)(key)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  viewMode === key
                    ? "bg-[#1B5E20] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <span className="w-20 shrink-0 text-xs font-semibold text-gray-500">기본정보</span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => changeFilter(setBasicMissingOnly)(!basicMissingOnly)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                basicMissingOnly
                  ? "bg-[#1B5E20] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              기본정보 미입력
            </button>
          </div>
        </div>

        {/* 구역 / 직분 / 검색 */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <span className="w-20 shrink-0 pt-2 text-xs font-semibold text-gray-500">상세분류</span>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <select
              value={positionFilter}
              onChange={(e) => changeFilter(setPositionFilter)(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
            >
              <option value="">전체 직분</option>
              {positionOptions.map(o => (
                <option key={o.id} value={o.label}>{o.label}</option>
              ))}
            </select>

            <select
              value={districtFilter}
              onChange={(e) => changeFilter(setDistrictFilter)(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
            >
              <option value="">전체 구역/순</option>
              {districtOptions.map(o => (
                <option key={o.id} value={o.label}>{o.label}</option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => changeFilter(setDepartmentFilter)(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
            >
              <option value="">전체 부서</option>
              {departmentOptions.map(o => (
                <option key={o.id} value={o.label}>{o.label}</option>
              ))}
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { changeFilter(setSearchQuery)(e.target.value); }}
              placeholder="이름, 연락처, 이메일 검색..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
            />

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSize);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}명씩</option>
              ))}
            </select>

            {/* 필터 초기화 */}
            {(statusFilter !== "all" || districtFilter || positionFilter || departmentFilter || basicMissingOnly || searchQuery || viewMode !== "list" || pageSize !== 50) && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setDistrictFilter("");
                  setPositionFilter("");
                  setDepartmentFilter("");
                  setBasicMissingOnly(false);
                  setSearchQuery("");
                  setViewMode("list");
                  setPageSize(50);
                  setPage(1);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 whitespace-nowrap"
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 성도 목록 ── */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="fas fa-users text-4xl mb-3 block"></i>
          <p className="text-sm">해당하는 성도가 없습니다.</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white xl:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <tr>
                  <th className="w-12 px-2 py-2 text-left font-semibold">번호</th>
                  <th className="w-[72px] px-2 py-2 text-left font-semibold">승인여부</th>
                  <th className="w-24 px-2 py-2 text-left font-semibold">이름</th>
                  <th className="w-12 px-2 py-2 text-left font-semibold">성별</th>
                  <th className="w-28 px-2 py-2 text-left font-semibold">직분</th>
                  <th className="w-36 px-2 py-2 text-left font-semibold">연락처</th>
                  <th className="w-28 px-2 py-2 text-left font-semibold">생년월일</th>
                  <th className="w-[180px] px-2 py-2 text-right font-semibold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((member, index) => {
                  const status = STATUS_LABELS[member.status ?? "pending"] ?? STATUS_LABELS.pending;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-400">
                        {(safePage - 1) * pageSize + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="break-keep px-2 py-2 font-semibold text-gray-800">{member.name}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600">{member.gender || "-"}</td>
                      <td className="break-words px-2 py-2 text-gray-600">{member.position || "-"}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600">
                        {formatPhoneNumber(member.phone) || <span className="text-xs text-red-500 font-medium">미입력</span>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600">
                        {member.birthDate || <span className="text-xs text-red-500 font-medium">미입력</span>}
                      </td>
                      <td className="px-2 py-2">
                        {renderMemberActions(member)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 xl:hidden">
            {paginated.map((member, index) => {
              return (
                <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 space-y-3">
                    <MemberSummary member={member} number={(safePage - 1) * pageSize + index + 1} />
                    {renderMemberActions(member)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((group) => (
            <div key={group.label || "list"} className="space-y-2">
              <div className="flex items-center gap-2 pt-2 first:pt-0">
                <p className="text-xs font-semibold text-gray-600">{group.label}</p>
                <span className="text-[11px] text-gray-400">{group.members.length}명</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
              {group.members.map((member) => {
                const memberIndex = paginated.findIndex((item) => item.id === member.id);
                return (
                  <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-gray-50">
                      <MemberSummary
                        member={member}
                        number={(safePage - 1) * pageSize + memberIndex + 1}
                      />
                      {renderMemberActions(member)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── 페이징 ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "..." ? (
                <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item as number)}
                  className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-medium transition-colors ${
                    safePage === item
                      ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                      : "border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item}
                </button>
              )
            )}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
          >
            ›
          </button>

          <span className="ml-2 text-xs text-gray-400">
            {safePage} / {totalPages} 페이지
          </span>
        </div>
      )}

      {/* 성도 수정 모달 */}
      {canManageMemberRegistry && (
        <MemberEditModal
          member={editingMember}
          fieldOptions={fieldOptions}
          isFullAdmin={isFullAdmin}
          initialTab={editingInitialTab}
          open={!!editingMember}
          onClose={() => {
            setEditingMember(null);
            setEditingInitialTab("basic");
          }}
          onSaved={() => {
            utils.members.adminList.invalidate();
            utils.members.pendingList.invalidate();
            utils.members.approvalList.invalidate();
            utils.members.passwordResetRequests.invalidate();
          }}
        />
      )}
    </div>
  );
}
