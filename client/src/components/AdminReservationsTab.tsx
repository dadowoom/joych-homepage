/**
 * AdminReservationsTab.tsx
 * 관리자 예약 승인/거절 관리 탭
 * - 전체 예약 목록 조회 (시설별 필터링)
 * - 예약 상태별 필터 (대기/승인/거절/취소)
 * - 승인/거절 처리 + 거절 사유 입력
 * - 달력 형태 예약 현황 보기
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Reservation, Facility } from "../../../drizzle/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, List, ChevronDown, Trash2 } from "lucide-react";

type StatusFilter = "all" | "pending" | "checking" | "approved" | "rejected" | "cancelled";
type ViewMode = "list" | "calendar";
type ReservationStatus = Reservation["status"];

type AdminReservationRow = Pick<
  Reservation,
  | "id"
  | "facilityId"
  | "userId"
  | "reservationType"
  | "reserverName"
  | "reserverPhone"
  | "reservationDate"
  | "startTime"
  | "endTime"
  | "status"
  | "purpose"
  | "department"
  | "attendees"
  | "notes"
  | "recurrenceGroupId"
  | "recurrenceLabel"
  | "recurrenceSequence"
  | "adminComment"
  | "createdAt"
> & {
  facilityName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  memberPosition?: string | null;
  memberPhone?: string | null;
};

type ReservationGroup = {
  key: string;
  groupId: string | null;
  first: AdminReservationRow;
  reservations: AdminReservationRow[];
  status: ReservationStatus;
  isRecurring: boolean;
  count: number;
  startDate: string;
  endDate: string;
};

type ReservationTimeEditForm = {
  reservationDate: string;
  startTime: string;
  endTime: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "승인 대기", color: "bg-amber-100 text-amber-700",  icon: <Clock className="w-3 h-3" /> },
  checking:  { label: "확인중",    color: "bg-blue-100 text-blue-700",    icon: <AlertCircle className="w-3 h-3" /> },
  approved:  { label: "승인 완료", color: "bg-green-100 text-green-700",  icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:  { label: "거절",      color: "bg-red-100 text-red-700",      icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "취소",      color: "bg-gray-100 text-gray-500",    icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatTime(ts: number | Date | string) {
  return new Date(ts).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getReservationName(reservation: AdminReservationRow) {
  return reservation.reserverName || reservation.userName || "이름 없음";
}

function getReservationPosition(reservation: AdminReservationRow) {
  if (reservation.reservationType === "external") return reservation.department || "외부인";
  return reservation.memberPosition || reservation.department || "-";
}

function getReservationPhone(reservation: AdminReservationRow) {
  return reservation.reserverPhone || reservation.memberPhone || "-";
}

function formatReservationTimeRange(reservation: Pick<AdminReservationRow, "startTime" | "endTime">) {
  return `${reservation.startTime}~${reservation.endTime}`;
}

function getGroupStatus(items: AdminReservationRow[]): ReservationStatus {
  if (items.some(r => r.status === "pending")) return "pending";
  if (items.some(r => r.status === "checking")) return "checking";
  if (items.every(r => r.status === "approved")) return "approved";
  if (items.some(r => r.status === "rejected")) return "rejected";
  if (items.some(r => r.status === "cancelled")) return "cancelled";
  return items[0]?.status ?? "pending";
}

function buildReservationGroups(rows: AdminReservationRow[]): ReservationGroup[] {
  const grouped = new Map<string, AdminReservationRow[]>();

  rows.forEach(row => {
    const key = row.recurrenceGroupId ? `group:${row.recurrenceGroupId}` : `single:${row.id}`;
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  });

  return Array.from(grouped.entries())
    .map(([key, items]) => {
      const reservations = [...items].sort((a, b) =>
        a.reservationDate.localeCompare(b.reservationDate)
        || a.startTime.localeCompare(b.startTime)
        || (a.recurrenceSequence ?? 0) - (b.recurrenceSequence ?? 0)
      );
      const first = reservations[0]!;
      const last = reservations[reservations.length - 1]!;

      return {
        key,
        groupId: first.recurrenceGroupId ?? null,
        first,
        reservations,
        status: getGroupStatus(reservations),
        isRecurring: Boolean(first.recurrenceGroupId) && reservations.length > 1,
        count: reservations.length,
        startDate: first.reservationDate,
        endDate: last.reservationDate,
      };
    })
    .sort((a, b) =>
      new Date(b.first.createdAt).getTime() - new Date(a.first.createdAt).getTime()
      || b.startDate.localeCompare(a.startDate)
    );
}

export default function AdminReservationsTab() {
  const utils = trpc.useUtils();
  const [facilityFilter, setFacilityFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [timeEditForm, setTimeEditForm] = useState<ReservationTimeEditForm>({
    reservationDate: "",
    startTime: "",
    endTime: "",
  });

  // 시설 목록 (필터용)
  const { data: facilities } = trpc.home.facilities.useQuery();

  // 예약 목록
  const { data: reservations, isLoading } = trpc.cms.reservations.list.useQuery(
    { facilityId: facilityFilter },
    { refetchInterval: 30000 }
  );

  const approveMutation = trpc.cms.reservations.approve.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("예약이 승인됐습니다.");
    },
    onError: () => toast.error("승인에 실패했습니다."),
  });

  const approveGroupMutation = trpc.cms.reservations.approveGroup.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("반복 예약 묶음이 승인됐습니다.");
    },
    onError: () => toast.error("승인에 실패했습니다."),
  });

  const rejectMutation = trpc.cms.reservations.reject.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setRejectingKey(null);
      setRejectComment("");
      toast.success("예약이 거절됐습니다.");
    },
    onError: () => toast.error("거절 처리에 실패했습니다."),
  });

  const rejectGroupMutation = trpc.cms.reservations.rejectGroup.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setRejectingKey(null);
      setRejectComment("");
      toast.success("반복 예약 묶음이 거절됐습니다.");
    },
    onError: () => toast.error("거절 처리에 실패했습니다."),
  });

  const markCheckingMutation = trpc.cms.reservations.markChecking.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("예약 상태를 확인중으로 변경했습니다.");
    },
    onError: () => toast.error("확인중 처리에 실패했습니다."),
  });

  const markCheckingGroupMutation = trpc.cms.reservations.markCheckingGroup.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("반복 예약 묶음을 확인중으로 변경했습니다.");
    },
    onError: () => toast.error("확인중 처리에 실패했습니다."),
  });

  const cancelMutation = trpc.cms.reservations.cancel.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("예약이 취소 처리되었습니다.");
    },
    onError: () => toast.error("취소 처리에 실패했습니다."),
  });

  const cancelGroupMutation = trpc.cms.reservations.cancelGroup.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      toast.success("반복 예약 묶음이 취소 처리되었습니다.");
    },
    onError: () => toast.error("취소 처리에 실패했습니다."),
  });

  const updateTimeMutation = trpc.cms.reservations.updateTime.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setEditingKey(null);
      toast.success("예약 시간이 수정되었습니다.");
    },
    onError: (error) => toast.error(error.message || "예약 시간 수정에 실패했습니다."),
  });

  const updateGroupTimeMutation = trpc.cms.reservations.updateGroupTime.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setEditingKey(null);
      toast.success("반복 예약 시간이 수정되었습니다.");
    },
    onError: (error) => toast.error(error.message || "반복 예약 시간 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.cms.reservations.delete.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setExpandedKey(null);
      toast.success("예약이 삭제되었습니다.");
    },
    onError: () => toast.error("예약 삭제에 실패했습니다."),
  });

  const deleteGroupMutation = trpc.cms.reservations.deleteGroup.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setExpandedKey(null);
      toast.success("반복 예약 묶음이 삭제되었습니다.");
    },
    onError: () => toast.error("반복 예약 삭제에 실패했습니다."),
  });

  const groupedReservations = buildReservationGroups((reservations ?? []) as AdminReservationRow[]);

  // 필터 적용
  const filtered = groupedReservations.filter(group =>
    statusFilter === "all" ? true : group.status === statusFilter || group.reservations.some(r => r.status === statusFilter)
  );

  // 통계
  const stats = {
    total: groupedReservations.length,
    pending: groupedReservations.filter(group => group.status === "pending").length,
    checking: groupedReservations.filter(group => group.status === "checking").length,
    approved: groupedReservations.filter(group => group.status === "approved").length,
    rejected: groupedReservations.filter(group => group.status === "rejected").length,
    cancelled: groupedReservations.filter(group => group.status === "cancelled").length,
  };

  const approveReservation = (group: ReservationGroup) => {
    if (group.isRecurring && group.groupId) {
      approveGroupMutation.mutate({ groupId: group.groupId });
      return;
    }
    approveMutation.mutate({ id: group.first.id });
  };

  const rejectReservation = (group: ReservationGroup) => {
    if (group.isRecurring && group.groupId) {
      rejectGroupMutation.mutate({ groupId: group.groupId, comment: rejectComment });
      return;
    }
    rejectMutation.mutate({ id: group.first.id, comment: rejectComment });
  };

  const markReservationChecking = (group: ReservationGroup) => {
    if (group.isRecurring && group.groupId) {
      markCheckingGroupMutation.mutate({ groupId: group.groupId });
      return;
    }
    markCheckingMutation.mutate({ id: group.first.id });
  };

  const cancelReservationStatus = (group: ReservationGroup) => {
    const message = group.isRecurring
      ? "반복 예약 묶음을 모두 취소 처리하시겠습니까?"
      : "예약을 취소 처리하시겠습니까?";
    if (!confirm(message)) return;
    if (group.isRecurring && group.groupId) {
      cancelGroupMutation.mutate({ groupId: group.groupId });
      return;
    }
    cancelMutation.mutate({ id: group.first.id });
  };

  const deleteReservation = (group: ReservationGroup) => {
    const message = group.isRecurring
      ? "반복 예약 묶음을 모두 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다."
      : "예약을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.";
    if (!confirm(message)) return;
    if (group.isRecurring && group.groupId) {
      deleteGroupMutation.mutate({ groupId: group.groupId });
      return;
    }
    deleteMutation.mutate({ id: group.first.id });
  };

  const startEditTime = (group: ReservationGroup) => {
    setRejectingKey(null);
    setExpandedKey(group.key);
    setEditingKey(group.key);
    setTimeEditForm({
      reservationDate: group.first.reservationDate,
      startTime: group.first.startTime,
      endTime: group.first.endTime,
    });
  };

  const saveReservationTime = (group: ReservationGroup) => {
    if (!timeEditForm.startTime || !timeEditForm.endTime) {
      toast.error("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }
    if (timeEditForm.startTime >= timeEditForm.endTime) {
      toast.error("시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    if (group.isRecurring && group.groupId) {
      updateGroupTimeMutation.mutate({
        groupId: group.groupId,
        startTime: timeEditForm.startTime,
        endTime: timeEditForm.endTime,
      });
      return;
    }
    updateTimeMutation.mutate({
      id: group.first.id,
      reservationDate: timeEditForm.reservationDate,
      startTime: timeEditForm.startTime,
      endTime: timeEditForm.endTime,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">예약 승인 관리</h3>
          <p className="text-sm text-gray-500 mt-0.5">시설 예약 신청을 검토하고 승인 또는 거절합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (viewMode === "list" ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          >
            <List className="w-4 h-4" /> 목록
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " + (viewMode === "calendar" ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          >
            <Calendar className="w-4 h-4" /> 달력
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {[
          { label: "전체", value: stats.total, color: "bg-gray-50 border-gray-200", textColor: "text-gray-700" },
          { label: "승인 대기", value: stats.pending, color: "bg-amber-50 border-amber-200", textColor: "text-amber-700" },
          { label: "확인중", value: stats.checking, color: "bg-blue-50 border-blue-200", textColor: "text-blue-700" },
          { label: "승인 완료", value: stats.approved, color: "bg-green-50 border-green-200", textColor: "text-green-700" },
          { label: "거절", value: stats.rejected, color: "bg-red-50 border-red-200", textColor: "text-red-700" },
          { label: "취소", value: stats.cancelled, color: "bg-gray-50 border-gray-200", textColor: "text-gray-500" },
        ].map(s => (
          <div key={s.label} className={"rounded-xl border p-3 text-center " + s.color}>
            <p className={"text-2xl font-bold " + s.textColor}>{s.value}</p>
            <p className={"text-xs mt-0.5 " + s.textColor}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* 시설 필터 */}
        <div className="relative">
          <select
            value={facilityFilter ?? ""}
            onChange={e => setFacilityFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
          >
            <option value="">전체 시설</option>
            {(facilities ?? []).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* 상태 필터 */}
        {(["all", "pending", "checking", "approved", "rejected", "cancelled"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={"px-3 py-1.5 text-xs font-medium rounded-lg transition-colors " + (
              statusFilter === s
                ? "bg-[#1B5E20] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {s === "all" ? "전체" : STATUS_LABELS[s]?.label ?? s}
            {s === "pending" && stats.pending > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.pending}</span>
            )}
            {s === "checking" && stats.checking > 0 && (
              <span className="ml-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.checking}</span>
            )}
          </button>
        ))}
      </div>

      {stats.pending === 0 && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          현재 승인 대기 예약이 없습니다. 승인/거절 버튼은 승인 대기 상태의 예약에만 표시되며,
          자동 승인 시설은 신청 즉시 승인 완료로 표시됩니다.
        </div>
      )}

      {/* 목록 뷰 */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">해당 조건의 예약이 없습니다.</p>
            </div>
          ) : (
            filtered.map(group => {
              const r = group.first;
              const st = STATUS_LABELS[group.status] ?? STATUS_LABELS.pending;
              const isExpanded = expandedKey === group.key;
              const dateSummary = group.isRecurring
                ? `${formatShortDate(group.startDate)} ~ ${formatShortDate(group.endDate)} · ${group.count}회`
                : formatDate(r.reservationDate);
              const isMutating =
                approveMutation.isPending ||
                approveGroupMutation.isPending ||
                rejectMutation.isPending ||
                rejectGroupMutation.isPending ||
                markCheckingMutation.isPending ||
                markCheckingGroupMutation.isPending ||
                cancelMutation.isPending ||
                cancelGroupMutation.isPending ||
                updateTimeMutation.isPending ||
                updateGroupTimeMutation.isPending ||
                deleteMutation.isPending ||
                deleteGroupMutation.isPending;
              return (
                <div key={group.key} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 요약 행 */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                  >
                    <div className={"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 " + st.color}>
                      {st.icon} {st.label}
                    </div>
                    {r.reservationType === "external" && (
                      <div className="px-2 py-1 rounded-full text-xs font-medium shrink-0 bg-sky-50 text-sky-700">
                        외부인
                      </div>
                    )}
                    {group.isRecurring && (
                      <div className="px-2 py-1 rounded-full text-xs font-medium shrink-0 bg-blue-50 text-blue-700">
                        반복 {group.count}회
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {r.facilityName ?? "시설"} — {r.reserverName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dateSummary} · {r.startTime}~{r.endTime} · {getReservationPosition(r)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(group.status === "pending" || group.status === "checking") && (
                        <>
                          {group.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-600 hover:bg-blue-50 text-xs h-7 px-3"
                              onClick={e => { e.stopPropagation(); markReservationChecking(group); }}
                              disabled={isMutating}
                            >
                              확인중
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                            onClick={e => { e.stopPropagation(); approveReservation(group); }}
                            disabled={isMutating}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-7 px-3"
                            onClick={e => { e.stopPropagation(); setRejectingKey(group.key); setRejectComment(""); }}
                          >
                            거절
                          </Button>
                        </>
                      )}
                      {group.status !== "pending" && group.status !== "checking" && (
                        <span className="hidden sm:inline-flex text-xs text-gray-400">
                          처리 완료
                        </span>
                      )}
                      {group.status !== "cancelled" && group.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-300 text-gray-600 hover:bg-gray-50 text-xs h-7 px-2.5"
                          onClick={e => { e.stopPropagation(); cancelReservationStatus(group); }}
                          disabled={isMutating}
                        >
                          취소 처리
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2.5"
                        onClick={e => { e.stopPropagation(); startEditTime(group); }}
                        disabled={isMutating}
                      >
                        시간 수정
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 px-2.5"
                        onClick={e => { e.stopPropagation(); deleteReservation(group); }}
                        disabled={isMutating}
                        title={group.isRecurring ? "반복 예약 묶음 삭제" : "예약 삭제"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">삭제</span>
                      </Button>
                      <ChevronDown className={"w-4 h-4 text-gray-400 transition-transform " + (isExpanded ? "rotate-180" : "")} />
                    </div>
                  </div>

                  {/* 거절 사유 입력 */}
                  {rejectingKey === group.key && (
                    <div className="px-4 pb-4 bg-red-50 border-t border-red-100">
                      <p className="text-xs font-medium text-red-700 mt-3 mb-1.5">거절 사유를 입력해 주세요 (신청자에게 전달됩니다)</p>
                      <textarea
                        value={rejectComment}
                        onChange={e => setRejectComment(e.target.value)}
                        placeholder="예: 해당 날짜에 다른 행사가 예정되어 있습니다."
                        rows={2}
                        className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs"
                          onClick={() => rejectReservation(group)}
                          disabled={!rejectComment.trim() || isMutating}
                        >
                          거절 확정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setRejectingKey(null)}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  )}

                  {editingKey === group.key && (
                    <div className="px-4 pb-4 bg-green-50 border-t border-green-100">
                      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-green-800">예약 날짜</span>
                          <input
                            type="date"
                            value={timeEditForm.reservationDate}
                            disabled={group.isRecurring}
                            onChange={e => setTimeEditForm(prev => ({ ...prev, reservationDate: e.target.value }))}
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-green-800">시작 시간</span>
                          <input
                            type="time"
                            value={timeEditForm.startTime}
                            onChange={e => setTimeEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-green-800">종료 시간</span>
                          <input
                            type="time"
                            value={timeEditForm.endTime}
                            onChange={e => setTimeEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
                            onClick={() => saveReservationTime(group)}
                            disabled={isMutating}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingKey(null)}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                      {group.isRecurring && (
                        <p className="mt-2 text-xs text-green-700">
                          반복 예약은 날짜는 유지하고 모든 회차의 시간만 한 번에 수정합니다.
                        </p>
                      )}
                    </div>
                  )}

                  {/* 상세 정보 펼치기 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 text-sm">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                        <div><span className="text-gray-500 text-xs">연락처</span><p className="font-medium">{getReservationPhone(r)}</p></div>
                        <div><span className="text-gray-500 text-xs">직분/구분</span><p className="font-medium">{getReservationPosition(r)}</p></div>
                        <div><span className="text-gray-500 text-xs">예상 인원</span><p className="font-medium">{r.attendees}명</p></div>
                        <div><span className="text-gray-500 text-xs">사용 목적</span><p className="font-medium">{r.purpose}</p></div>
                        <div><span className="text-gray-500 text-xs">신청 일시</span><p className="font-medium">{formatTime(r.createdAt)}</p></div>
                        {group.isRecurring && (
                          <div className="col-span-2">
                            <span className="text-gray-500 text-xs">반복 예약</span>
                            <p className="font-medium text-blue-700">{r.recurrenceLabel ?? `${group.count}회 반복 예약`}</p>
                            <div className="mt-2 max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 pr-1">
                              {group.reservations.map((reservation, index) => (
                                <span key={reservation.id} className="text-xs text-gray-600 bg-white border border-gray-100 rounded px-2 py-1">
                                  {index + 1}. {formatDate(reservation.reservationDate)} {reservation.startTime}~{reservation.endTime}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {r.notes && (
                          <div className="col-span-2"><span className="text-gray-500 text-xs">추가 요청사항</span><p className="font-medium">{r.notes}</p></div>
                        )}
                        {r.adminComment && (
                          <div className="col-span-2">
                            <span className="text-gray-500 text-xs">관리자 코멘트</span>
                            <p className={"font-medium " + (r.status === "rejected" ? "text-red-600" : "text-green-700")}>{r.adminComment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 달력 뷰 */}
      {viewMode === "calendar" && (
        <CalendarView reservations={reservations ?? []} facilityFilter={facilityFilter} facilities={facilities ?? []} />
      )}
    </div>
  );
}

function CalendarView({ reservations, facilityFilter, facilities }: {
  reservations: AdminReservationRow[];
  facilityFilter: number | undefined;
  facilities: Facility[];
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // 날짜별 예약 수 집계
  const reservationsByDate: Record<string, AdminReservationRow[]> = {};
  reservations.forEach(r => {
    const key = r.reservationDate;
    if (!reservationsByDate[key]) reservationsByDate[key] = [];
    reservationsByDate[key].push(r);
  });
  Object.values(reservationsByDate).forEach(items => {
    items.sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
      || (a.facilityName ?? "").localeCompare(b.facilityName ?? "")
      || getReservationName(a).localeCompare(getReservationName(b))
    );
  });

  const selectedReservations = reservationsByDate[selectedDate] ?? [];
  const selectedDateLabel = formatDate(selectedDate);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div>
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
        <h4 className="font-bold text-gray-800">{year}년 {month + 1}월</h4>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={"text-center text-xs font-medium py-1 " + (i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500")}>
            {d}
          </div>
        ))}
      </div>

      {facilityFilter && (
        <div className="mb-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
          현재 시설 필터: {facilities.find(f => f.id === facilityFilter)?.name ?? "선택 시설"}
        </div>
      )}

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={"empty-" + idx} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayReservations = reservationsByDate[dateKey] ?? [];
          const pending = dayReservations.filter(r => r.status === "pending").length;
          const checking = dayReservations.filter(r => r.status === "checking").length;
          const approved = dayReservations.filter(r => r.status === "approved").length;
          const isToday = getLocalDateKey() === dateKey;
          const isSelected = selectedDate === dateKey;
          const isSun = (idx % 7) === 0;
          const isSat = (idx % 7) === 6;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={"group relative min-h-[74px] rounded-lg border p-1.5 text-left transition-colors " + (
                isSelected
                  ? "border-[#1B5E20] bg-[#F1F8E9] ring-1 ring-[#1B5E20]"
                  : isToday
                  ? "border-[#1B5E20]/40 bg-[#F8FCF8]"
                  : "border-gray-100 hover:border-gray-300"
              )}
            >
              <p className={"text-xs font-medium mb-1 " + (isToday ? "text-[#1B5E20]" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-700")}>
                {day}
              </p>
              {pending > 0 && (
                <div className="text-[10px] bg-amber-100 text-amber-700 rounded px-1 py-0.5 mb-0.5 truncate">
                  대기 {pending}
                </div>
              )}
              {checking > 0 && (
                <div className="text-[10px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 mb-0.5 truncate">
                  확인 {checking}
                </div>
              )}
              {approved > 0 && (
                <div className="text-[10px] bg-green-100 text-green-700 rounded px-1 py-0.5 truncate">
                  승인 {approved}
                </div>
              )}
              {dayReservations.length > 0 && (
                <div className="mt-1 hidden text-[10px] leading-4 text-gray-500 sm:block">
                  {dayReservations.slice(0, 2).map(reservation => (
                    <p key={reservation.id} className="truncate">
                      {reservation.startTime} {getReservationName(reservation)}
                    </p>
                  ))}
                  {dayReservations.length > 2 && <p className="text-gray-400">+{dayReservations.length - 2}건</p>}
                </div>
              )}
              {dayReservations.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg group-hover:block">
                  <p className="mb-2 text-xs font-bold text-gray-800">{formatDate(dateKey)} 예약</p>
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {dayReservations.map(reservation => (
                      <div key={reservation.id} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                        <p className="truncate text-xs font-semibold text-gray-800">
                          {formatReservationTimeRange(reservation)} · {getReservationName(reservation)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
                          {reservation.facilityName ?? "시설"} · {getReservationPosition(reservation)} · {getReservationPhone(reservation)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block"></span>승인 대기</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block"></span>확인중</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span>승인 완료</span>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{selectedDateLabel} 예약 상세</p>
            <p className="text-xs text-gray-500">날짜를 누르면 해당 날짜 예약자 정보가 바로 바뀝니다.</p>
          </div>
          <span className="text-xs font-medium text-[#1B5E20]">총 {selectedReservations.length}건</span>
        </div>

        {selectedReservations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            이 날짜에는 예약이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {selectedReservations.map(reservation => {
              const st = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.pending;
              return (
                <div key={reservation.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_120px_150px_120px] md:items-center">
                  <div>
                    <p className="text-xs text-gray-400">시간</p>
                    <p className="font-semibold text-gray-900">{formatReservationTimeRange(reservation)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">시설 / 목적</p>
                    <p className="truncate font-semibold text-gray-900">{reservation.facilityName ?? "시설"} · {reservation.purpose}</p>
                    {reservation.notes && <p className="mt-0.5 truncate text-xs text-gray-500">요청: {reservation.notes}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">이름 / 직분</p>
                    <p className="font-semibold text-gray-900">{getReservationName(reservation)}</p>
                    <p className="text-xs text-gray-500">
                      {reservation.reservationType === "external" ? "외부인 · " : ""}{getReservationPosition(reservation)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">전화번호</p>
                    <p className="font-semibold text-gray-900">{getReservationPhone(reservation)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">상태 / 인원</p>
                    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium " + st.color}>
                      {st.icon} {st.label}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">{reservation.attendees}명</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
