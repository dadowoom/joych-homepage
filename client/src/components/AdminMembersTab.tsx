/**
 * AdminMembersTab.tsx
 * 관리자 성도 관리 탭
 * - 전체 성도 목록 조회
 * - 상태별 / 구역별 / 직분별 필터 + 보기 방식 + 이름/연락처 검색
 * - 20명씩 페이징
 * - 가입 승인/거절 (빠른 버튼)
 * - 성도 삭제(탈퇴 처리)
 * - 수정 버튼 → MemberEditModal 모달 오픈
 */
import { useState, useMemo } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
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
  { key: "position", label: "직분별" },
  { key: "list", label: "전체보기" },
  { key: "district", label: "구역/순별" },
  { key: "department", label: "부서별" },
];

const PAGE_SIZE = 20;

type Member = inferRouterOutputs<AppRouter>["members"]["adminList"][number];

export default function AdminMembersTab() {
  const utils = trpc.useUtils();

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [districtFilter, setDistrictFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("position");

  // 페이징 상태
  const [page, setPage] = useState(1);

  // 모달 상태
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // 데이터 조회
  const { data: members = [], isLoading } = trpc.members.adminList.useQuery();
  const { data: fieldOptions = [] } = trpc.members.adminFieldOptions.useQuery();

  // 필터 선택지 (활성화된 것만)
  const districtOptions = useMemo(() => fieldOptions.filter(o => o.fieldType === "district" && o.isActive), [fieldOptions]);
  const positionOptions = useMemo(() => fieldOptions.filter(o => o.fieldType === "position" && o.isActive), [fieldOptions]);

  // 빠른 승인/거절 뮤테이션
  const quickMutation = trpc.members.updateChurchInfo.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("상태가 변경됐습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.members.updateChurchInfo.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("성도를 삭제 처리했습니다. 탈퇴 상태에서 다시 확인할 수 있습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  // 필터링 (필터 변경 시 페이지 1로 리셋)
  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchStatus   = statusFilter === "all" || m.status === statusFilter;
      const matchDistrict = !districtFilter || m.district === districtFilter;
      const matchPosition = !positionFilter || m.position === positionFilter;
      const matchSearch   =
        !searchQuery ||
        m.name.includes(searchQuery) ||
        (m.phone ?? "").includes(searchQuery) ||
        (m.email ?? "").includes(searchQuery);
      return matchStatus && matchDistrict && matchPosition && matchSearch;
    });
  }, [members, statusFilter, districtFilter, positionFilter, searchQuery]);

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
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const quickApprove = (id: number) => quickMutation.mutate({ id, status: "approved" });
  const quickReject  = (id: number) => quickMutation.mutate({ id, status: "rejected" });
  const deleteMember = (member: Member) => {
    const confirmed = window.confirm(
      `${member.name} 성도를 삭제 처리할까요?\n\n실제 데이터는 탈퇴 상태로 보관되며, 탈퇴 탭에서 다시 확인할 수 있습니다.`
    );
    if (!confirmed) return;
    deleteMutation.mutate({ id: member.id, status: "withdrawn" });
  };

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  const pendingCount = members.filter(m => m.status === "pending").length;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">성도 관리</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            전체 {members.length}명
            {filtered.length !== members.length && (
              <span className="ml-1 text-[#1B5E20] font-medium">· 검색결과 {filtered.length}명</span>
            )}
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">· 승인 대기 {pendingCount}명</span>
            )}
          </p>
        </div>
      </div>

      {/* ── 필터 영역 ── */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
        {/* 상태 필터 */}
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

        {/* 구역 / 직분 / 검색 */}
        <div className="flex flex-col sm:flex-row gap-2">
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
            value={positionFilter}
            onChange={(e) => changeFilter(setPositionFilter)(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
          >
            <option value="">전체 직분</option>
            {positionOptions.map(o => (
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

          {/* 필터 초기화 */}
          {(statusFilter !== "all" || districtFilter || positionFilter || searchQuery || viewMode !== "position") && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setDistrictFilter("");
                setPositionFilter("");
                setSearchQuery("");
                setViewMode("position");
                setPage(1);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 whitespace-nowrap"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* ── 성도 목록 ── */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="fas fa-users text-4xl mb-3 block"></i>
          <p className="text-sm">해당하는 성도가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((group) => (
            <div key={group.label || "list"} className="space-y-2">
              {viewMode !== "list" && (
                <div className="flex items-center gap-2 pt-2 first:pt-0">
                  <p className="text-xs font-semibold text-gray-600">{group.label}</p>
                  <span className="text-[11px] text-gray-400">{group.members.length}명</span>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>
              )}
              {group.members.map((member) => {
                const status = STATUS_LABELS[member.status ?? "pending"] ?? STATUS_LABELS.pending;
                return (
                  <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-user text-[#1B5E20] text-sm"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">{member.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                              {status.text}
                            </span>
                            {member.position && (
                              <span className="text-xs text-[#1B5E20] font-medium">{member.position}</span>
                            )}
                            {member.district && (
                              <span className="text-xs text-gray-400">{member.district}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {member.phone ?? member.email ?? "-"}
                            {member.department && ` · ${member.department}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.status === "pending" && (
                          <>
                            <button
                              onClick={() => quickApprove(member.id)}
                              disabled={quickMutation.isPending || deleteMutation.isPending}
                              className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => quickReject(member.id)}
                              disabled={quickMutation.isPending || deleteMutation.isPending}
                              className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors font-medium"
                            >
                              거절
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setEditingMember(member as Member)}
                          disabled={deleteMutation.isPending}
                          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                        >
                          수정
                        </button>
                        {member.status !== "withdrawn" && (
                          <button
                            onClick={() => deleteMember(member)}
                            disabled={quickMutation.isPending || deleteMutation.isPending}
                            className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            삭제
                          </button>
                        )}
                      </div>
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
      <MemberEditModal
        member={editingMember}
        fieldOptions={fieldOptions}
        open={!!editingMember}
        onClose={() => setEditingMember(null)}
        onSaved={() => {
          utils.members.adminList.invalidate();
          utils.members.pendingList.invalidate();
        }}
      />
    </div>
  );
}
