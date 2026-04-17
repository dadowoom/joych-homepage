/**
 * AdminMembersTab.tsx
 * 관리자 성도 관리 탭
 * - 전체 성도 목록 조회
 * - 가입 승인/거절 (빠른 버튼)
 * - 수정 버튼 → MemberEditModal 모달 오픈
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import MemberEditModal from "./MemberEditModal";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "대기", color: "bg-yellow-100 text-yellow-700" },
  approved: { text: "승인", color: "bg-green-100 text-green-700" },
  rejected: { text: "거절", color: "bg-red-100 text-red-700" },
  withdrawn: { text: "탈퇴", color: "bg-gray-100 text-gray-500" },
};

type Member = ReturnType<typeof trpc.members.adminList.useQuery>["data"] extends (infer T)[] | undefined ? T : never;

export default function AdminMembersTab() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // 데이터 조회
  const { data: members = [], isLoading } = trpc.members.adminList.useQuery();
  const { data: fieldOptions = [] } = trpc.members.adminFieldOptions.useQuery();

  // 빠른 승인/거절 뮤테이션
  const quickMutation = trpc.members.updateChurchInfo.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("상태가 변경됐습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  // 필터링
  const filtered = members.filter((m) => {
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      m.name.includes(searchQuery) ||
      (m.phone ?? "").includes(searchQuery) ||
      (m.department ?? "").includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const quickApprove = (id: number) => quickMutation.mutate({ id, status: "approved" });
  const quickReject = (id: number) => quickMutation.mutate({ id, status: "rejected" });

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
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">
                · 승인 대기 {pendingCount}명
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1">
          {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[#1B5E20] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "전체" : STATUS_LABELS[s]?.text}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름, 연락처, 부서 검색..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
        />
      </div>

      {/* 성도 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <i className="fas fa-users text-4xl mb-3 block"></i>
          <p className="text-sm">해당하는 성도가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => {
            const status = STATUS_LABELS[member.status ?? "pending"] ?? STATUS_LABELS.pending;

            return (
              <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 성도 헤더 */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-user text-[#1B5E20] text-sm"></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">{member.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.text}
                        </span>
                        {member.position && (
                          <span className="text-xs text-[#1B5E20] font-medium">{member.position}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {member.phone ?? member.email ?? "-"}
                        {member.department && ` · ${member.department}`}
                        {member.district && ` · ${member.district}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 빠른 승인/거절 (대기 중일 때만) */}
                    {member.status === "pending" && (
                      <>
                        <button
                          onClick={() => quickApprove(member.id)}
                          disabled={quickMutation.isPending}
                          className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => quickReject(member.id)}
                          disabled={quickMutation.isPending}
                          className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors font-medium"
                        >
                          거절
                        </button>
                      </>
                    )}
                    {/* 수정 버튼 → 모달 오픈 */}
                    <button
                      onClick={() => setEditingMember(member as Member)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      수정
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
