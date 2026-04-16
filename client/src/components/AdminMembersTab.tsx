/**
 * AdminMembersTab.tsx
 * 관리자 성도 관리 탭
 * - 전체 성도 목록 조회
 * - 가입 승인/거절
 * - 직분/부서/구역/세례 등 교회 정보 입력 및 수정
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "대기", color: "bg-yellow-100 text-yellow-700" },
  approved: { text: "승인", color: "bg-green-100 text-green-700" },
  rejected: { text: "거절", color: "bg-red-100 text-red-700" },
  withdrawn: { text: "탈퇴", color: "bg-gray-100 text-gray-500" },
};

export default function AdminMembersTab() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    position: string;
    department: string;
    district: string;
    baptismType: string;
    baptismDate: string;
    registeredAt: string;
    pastor: string;
    adminMemo: string;
    status: string;
    faithPlusUserId: string;
  }>({
    position: "", department: "", district: "", baptismType: "",
    baptismDate: "", registeredAt: "", pastor: "", adminMemo: "", status: "pending", faithPlusUserId: "",
  });

  // 데이터 조회
  const { data: members = [], isLoading } = trpc.members.adminList.useQuery();
  const { data: fieldOptions = [] } = trpc.members.adminFieldOptions.useQuery();

  // 선택지 분류
  const positionOptions = fieldOptions.filter(o => o.fieldType === "position" && o.isActive);
  const departmentOptions = fieldOptions.filter(o => o.fieldType === "department" && o.isActive);
  const districtOptions = fieldOptions.filter(o => o.fieldType === "district" && o.isActive);
  const baptismOptions = fieldOptions.filter(o => o.fieldType === "baptism" && o.isActive);

  // 교회 정보 수정 뮤테이션
  const updateMutation = trpc.members.updateChurchInfo.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      setEditingId(null);
      toast.success("성도 정보가 수정됐습니다.");
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

  const startEdit = (m: typeof members[0]) => {
    setEditingId(m.id);
    setEditData({
      position: m.position ?? "",
      department: m.department ?? "",
      district: m.district ?? "",
      baptismType: m.baptismType ?? "",
      baptismDate: m.baptismDate ?? "",
      registeredAt: m.registeredAt ?? "",
      pastor: m.pastor ?? "",
      adminMemo: m.adminMemo ?? "",
      status: m.status ?? "pending",
      faithPlusUserId: m.faithPlusUserId ?? "",
    });
  };

  const handleSave = (id: number) => {
    updateMutation.mutate({
      id,
      position: editData.position || undefined,
      department: editData.department || undefined,
      district: editData.district || undefined,
      baptismType: editData.baptismType || undefined,
      baptismDate: editData.baptismDate || undefined,
      registeredAt: editData.registeredAt || undefined,
      pastor: editData.pastor || undefined,
      adminMemo: editData.adminMemo || undefined,
      status: editData.status as "pending" | "approved" | "rejected" | "withdrawn",
      faithPlusUserId: editData.faithPlusUserId || undefined,
    });
  };

  const quickApprove = (id: number) => {
    updateMutation.mutate({ id, status: "approved" });
  };

  const quickReject = (id: number) => {
    updateMutation.mutate({ id, status: "rejected" });
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
            const isEditing = editingId === member.id;

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
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 빠른 승인/거절 (대기 중일 때만) */}
                    {member.status === "pending" && !isEditing && (
                      <>
                        <button
                          onClick={() => quickApprove(member.id)}
                          disabled={updateMutation.isPending}
                          className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors font-medium"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => quickReject(member.id)}
                          disabled={updateMutation.isPending}
                          className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors font-medium"
                        >
                          거절
                        </button>
                      </>
                    )}
                    {/* 수정/저장/취소 */}
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSave(member.id)}
                          disabled={updateMutation.isPending}
                          className="text-xs px-3 py-1 bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
                      >
                        교회 정보 수정
                      </button>
                    )}
                  </div>
                </div>

                {/* 수정 폼 */}
                {isEditing && (
                  <div className="p-4 bg-white border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 상태 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">승인 상태</label>
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData(p => ({ ...p, status: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          <option value="pending">대기</option>
                          <option value="approved">승인</option>
                          <option value="rejected">거절</option>
                          <option value="withdrawn">탈퇴</option>
                        </select>
                      </div>
                      {/* 직분 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">직분</label>
                        <select
                          value={editData.position}
                          onChange={(e) => setEditData(p => ({ ...p, position: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">선택 안 함</option>
                          {positionOptions.map(o => (
                            <option key={o.id} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* 소속 부서 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">소속 부서</label>
                        <select
                          value={editData.department}
                          onChange={(e) => setEditData(p => ({ ...p, department: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">선택 안 함</option>
                          {departmentOptions.map(o => (
                            <option key={o.id} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* 구역/순 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">구역 / 순</label>
                        <select
                          value={editData.district}
                          onChange={(e) => setEditData(p => ({ ...p, district: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">선택 안 함</option>
                          {districtOptions.map(o => (
                            <option key={o.id} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* 세례 구분 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">세례 구분</label>
                        <select
                          value={editData.baptismType}
                          onChange={(e) => setEditData(p => ({ ...p, baptismType: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">선택 안 함</option>
                          {baptismOptions.map(o => (
                            <option key={o.id} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      {/* 세례일 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">세례일</label>
                        <input
                          type="date"
                          value={editData.baptismDate}
                          onChange={(e) => setEditData(p => ({ ...p, baptismDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      {/* 등록일 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">등록일</label>
                        <input
                          type="date"
                          value={editData.registeredAt}
                          onChange={(e) => setEditData(p => ({ ...p, registeredAt: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      {/* 담당 교역자 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">담당 교역자</label>
                        <input
                          type="text"
                          value={editData.pastor}
                          onChange={(e) => setEditData(p => ({ ...p, pastor: e.target.value }))}
                          placeholder="예: 박진석 목사"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      {/* 믿음PLUS 유저 ID */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          믿음PLUS 유저 ID
                          <span className="ml-1 text-gray-400">(선택사항 — 연동 시 교적부에서 링크 활성화)</span>
                        </label>
                        <input
                          type="text"
                          value={editData.faithPlusUserId}
                          onChange={(e) => setEditData(p => ({ ...p, faithPlusUserId: e.target.value }))}
                          placeholder="예: 370  (믿음PLUS 앱에서 확인)"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        />
                      </div>
                      {/* 관리자 메모 */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">관리자 메모 (성도에게 보이지 않음)</label>
                        <textarea
                          value={editData.adminMemo}
                          onChange={(e) => setEditData(p => ({ ...p, adminMemo: e.target.value }))}
                          placeholder="특이사항, 상담 내용 등 내부 메모"
                          rows={2}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 간략 정보 (수정 모드 아닐 때) */}
                {!isEditing && (
                  <div className="px-4 py-2.5 bg-white border-t border-gray-50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {member.department && <span>부서: <span className="text-gray-700">{member.department}</span></span>}
                      {member.district && <span>구역: <span className="text-gray-700">{member.district}</span></span>}
                      {member.baptismType && <span>세례: <span className="text-gray-700">{member.baptismType}</span></span>}
                      {member.registeredAt && <span>등록일: <span className="text-gray-700">{member.registeredAt}</span></span>}
                      {member.gender && <span>성별: <span className="text-gray-700">{member.gender}</span></span>}
                      {member.birthDate && <span>생년월일: <span className="text-gray-700">{member.birthDate}</span></span>}
                      {member.faithPlusUserId ? (
                        <span>믿음PLUS: <a href={`https://faithplus.co.kr/search?user=${member.faithPlusUserId}`} target="_blank" rel="noopener noreferrer" className="text-[#1B5E20] underline">{member.faithPlusUserId}</a></span>
                      ) : (
                        <span className="text-gray-300">믿음PLUS 미연동</span>
                      )}
                      {!member.department && !member.district && !member.baptismType && (
                        <span className="text-gray-300">교회 정보 미입력</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
