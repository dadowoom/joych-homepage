/**
 * AdminReservationsTab.tsx
 * 관리자 예약 승인/거절 관리 탭
 * - 전체 예약 목록 조회 (시설별 필터링)
 * - 예약 상태별 필터 (대기/승인/거절/취소)
 * - 승인/거절 처리 + 거절 사유 입력
 * - 달력 형태 예약 현황 보기
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Reservation, Facility, FacilityBlockedDate } from "../../../drizzle/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, List, ChevronDown, Trash2, Search, X, Ban } from "lucide-react";
import { getKstDateKey } from "@/lib/facilityReservationTime";
import { formatKoreanDateKey, formatKoreanDateTime, formatKoreanDateTimeText, formatKoreanNumericDateKey } from "@/lib/koreanDate";

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
  createdAtText?: string | null;
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

type BlockedDateEditForm = {
  blockedDate: string;
  reason: string;
};

type CalendarBlockedDateRow = FacilityBlockedDate & {
  facilityName?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "승인 대기", color: "bg-amber-100 text-amber-700",  icon: <Clock className="w-3 h-3" /> },
  checking:  { label: "확인중",    color: "bg-blue-100 text-blue-700",    icon: <AlertCircle className="w-3 h-3" /> },
  approved:  { label: "승인 완료", color: "bg-green-100 text-green-700",  icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:  { label: "거절",      color: "bg-red-100 text-red-700",      icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "취소",      color: "bg-gray-100 text-gray-500",    icon: <AlertCircle className="w-3 h-3" /> },
};

function formatDate(dateStr: string) {
  return formatKoreanDateKey(dateStr);
}

function formatTime(ts: number | Date | string) {
  return formatKoreanDateTime(ts);
}

function formatCreatedAt(reservation: Pick<AdminReservationRow, "createdAt" | "createdAtText">) {
  return formatKoreanDateTimeText(reservation.createdAtText) || formatTime(reservation.createdAt);
}

function formatShortDate(dateStr: string) {
  return formatKoreanNumericDateKey(dateStr);
}

function getLocalDateKey() {
  return getKstDateKey();
}

function getReservationName(reservation: AdminReservationRow) {
  return reservation.reserverName || reservation.userName || "이름 없음";
}

function getReservationPosition(reservation: AdminReservationRow) {
  if (reservation.reservationType === "course") return "강좌";
  if (reservation.reservationType === "external") return reservation.department || "외부인";
  return reservation.memberPosition || reservation.department || "-";
}

function isExternalReservation(reservation: Pick<AdminReservationRow, "reservationType">) {
  return reservation.reservationType === "external";
}

function getReservationAudienceBadgeClass(reservation: Pick<AdminReservationRow, "reservationType">) {
  return isExternalReservation(reservation)
    ? "bg-orange-100 text-orange-700"
    : "bg-green-100 text-green-700";
}

function getReservationAudienceLabel(reservation: Pick<AdminReservationRow, "reservationType">) {
  return isExternalReservation(reservation) ? "외부인" : "성도";
}

function getReservationPhone(reservation: AdminReservationRow) {
  return reservation.reserverPhone || reservation.memberPhone || "-";
}

function getReservationDepartment(reservation: AdminReservationRow) {
  return reservation.department || "-";
}

function formatReservationTimeRange(reservation: Pick<AdminReservationRow, "startTime" | "endTime">) {
  return `${reservation.startTime}~${reservation.endTime}`;
}

function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function getFacilitySearchText(reservation: AdminReservationRow, facility?: Facility) {
  return normalizeSearchText([
    reservation.facilityName,
    facility?.name,
    facility?.location,
    facility?.building,
    reservation.purpose,
    reservation.notes,
    reservation.department,
    getReservationName(reservation),
    getReservationPosition(reservation),
  ].filter(Boolean).join(" "));
}

function reservationMatchesFacilitySearch(
  reservation: AdminReservationRow,
  searchQuery: string,
  facilityById: Map<number, Facility>,
) {
  const query = normalizeSearchText(searchQuery);
  if (!query) return true;
  return getFacilitySearchText(reservation, facilityById.get(reservation.facilityId)).includes(query);
}

function getBlockedDateSearchText(blockedDate: Pick<CalendarBlockedDateRow, "facilityName" | "reason" | "blockStart" | "blockEnd">, facility?: Facility) {
  return normalizeSearchText([
    blockedDate.facilityName,
    facility?.name,
    facility?.location,
    facility?.building,
    blockedDate.reason,
    blockedDate.blockStart,
    blockedDate.blockEnd,
  ].filter(Boolean).join(" "));
}

function blockedDateMatchesFacilitySearch(
  blockedDate: CalendarBlockedDateRow,
  searchQuery: string,
  facilityById: Map<number, Facility>,
) {
  const query = normalizeSearchText(searchQuery);
  if (!query) return true;
  return getBlockedDateSearchText(blockedDate, blockedDate.facilityId ? facilityById.get(blockedDate.facilityId) : undefined).includes(query);
}

function formatBlockedTimeLabel(blockedDate: Pick<CalendarBlockedDateRow, "isPartialBlock" | "blockStart" | "blockEnd">) {
  if (!blockedDate.isPartialBlock) return "종일";
  return `${blockedDate.blockStart ?? "--:--"}~${blockedDate.blockEnd ?? "--:--"}`;
}

function getBlockedDateCreatedAtKey(value: FacilityBlockedDate["createdAt"]) {
  if (value instanceof Date) return value.toISOString().slice(0, 19);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 19);
}

function getBlockedDateBatchKey(blockedDate: FacilityBlockedDate) {
  return [
    blockedDate.facilityId ?? "all",
    blockedDate.reason?.trim() ?? "",
    blockedDate.isPartialBlock ? "partial" : "full",
    blockedDate.blockStart ?? "",
    blockedDate.blockEnd ?? "",
    getBlockedDateCreatedAtKey(blockedDate.createdAt),
  ].join("|");
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
  const [facilitySearch, setFacilitySearch] = useState("");
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
  const [editingBlockedDateId, setEditingBlockedDateId] = useState<number | null>(null);
  const [blockedDateEditForm, setBlockedDateEditForm] = useState<BlockedDateEditForm>({
    blockedDate: "",
    reason: "",
  });

  // 시설 목록 (필터용)
  const { data: facilities } = trpc.home.facilities.useQuery();
  const { data: blockedDates = [] } = trpc.cms.facilities.blockedDates.list.useQuery(
    facilityFilter ? { facilityId: facilityFilter } : {},
    { refetchInterval: 30000 }
  );

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

  const updateBlockedDateMutation = trpc.cms.facilities.blockedDates.update.useMutation({
    onSuccess: () => {
      utils.cms.facilities.blockedDates.list.invalidate();
      setEditingBlockedDateId(null);
      toast.success("예약불가 일정이 수정되었습니다.");
    },
    onError: (error) => toast.error(error.message || "예약불가 일정 수정에 실패했습니다."),
  });

  const deleteBlockedDateMutation = trpc.cms.facilities.blockedDates.delete.useMutation({
    onSuccess: () => {
      utils.cms.facilities.blockedDates.list.invalidate();
      setEditingBlockedDateId(null);
      toast.success("예약불가 일정이 삭제되었습니다.");
    },
    onError: (error) => toast.error(error.message || "예약불가 일정 삭제에 실패했습니다."),
  });

  const deleteBlockedDatesMutation = trpc.cms.facilities.blockedDates.deleteMany.useMutation({
    onSuccess: (_, variables) => {
      utils.cms.facilities.blockedDates.list.invalidate();
      setEditingBlockedDateId(null);
      toast.success(`${variables.ids.length}일 예약불가 일정 묶음을 삭제했습니다.`);
    },
    onError: (error) => toast.error(error.message || "예약불가 일정 묶음 삭제에 실패했습니다."),
  });

  const facilityById = new Map((facilities ?? []).map(f => [f.id, f]));
  const searchFilteredBlockedDates = useMemo(() => {
    return (blockedDates as FacilityBlockedDate[])
      .map((blockedDate) => ({
        ...blockedDate,
        facilityName: blockedDate.facilityId ? (facilityById.get(blockedDate.facilityId)?.name ?? null) : "전체 시설",
      }))
      .filter((blockedDate) => blockedDateMatchesFacilitySearch(blockedDate, facilitySearch, facilityById));
  }, [blockedDates, facilityById, facilitySearch]);
  const searchFilteredReservations = ((reservations ?? []) as AdminReservationRow[]).filter(reservation =>
    reservationMatchesFacilitySearch(reservation, facilitySearch, facilityById)
  );
  const groupedReservations = buildReservationGroups(searchFilteredReservations);
  const blockedDateBatchIdsById = useMemo(() => {
    const grouped = new Map<string, number[]>();
    (blockedDates as FacilityBlockedDate[]).forEach((blockedDate) => {
      const key = getBlockedDateBatchKey(blockedDate);
      const ids = grouped.get(key) ?? [];
      ids.push(blockedDate.id);
      grouped.set(key, ids);
    });

    const byId = new Map<number, number[]>();
    grouped.forEach((ids) => ids.forEach((id) => byId.set(id, ids)));
    return byId;
  }, [blockedDates]);

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
    deleteGroupMutation.isPending ||
    updateBlockedDateMutation.isPending ||
    deleteBlockedDateMutation.isPending ||
    deleteBlockedDatesMutation.isPending;

  const startBlockedDateEdit = (blockedDate: CalendarBlockedDateRow) => {
    setEditingBlockedDateId(blockedDate.id);
    setBlockedDateEditForm({
      blockedDate: blockedDate.blockedDate,
      reason: blockedDate.reason ?? "",
    });
  };

  const saveBlockedDateEdit = (blockedDate: CalendarBlockedDateRow) => {
    updateBlockedDateMutation.mutate({
      id: blockedDate.id,
      facilityId: blockedDate.facilityId ?? null,
      blockedDate: blockedDateEditForm.blockedDate,
      reason: blockedDateEditForm.reason || undefined,
      isPartialBlock: blockedDate.isPartialBlock,
      blockStart: blockedDate.blockStart ?? null,
      blockEnd: blockedDate.blockEnd ?? null,
    });
  };

  const removeBlockedDate = (blockedDate: CalendarBlockedDateRow) => {
    const ids = blockedDateBatchIdsById.get(blockedDate.id) ?? [blockedDate.id];
    const message = ids.length > 1
      ? `같이 설정한 예약불가 일정 ${ids.length}일을 모두 삭제하시겠습니까?`
      : "이 예약불가 일정을 삭제하시겠습니까?";
    if (!confirm(message)) return;
    if (ids.length > 1) {
      deleteBlockedDatesMutation.mutate({ ids });
      return;
    }
    deleteBlockedDateMutation.mutate({ id: blockedDate.id });
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

  const startEditSingleReservationTime = (reservation: AdminReservationRow) => {
    setRejectingKey(null);
    setEditingKey(`reservation:${reservation.id}`);
    setTimeEditForm({
      reservationDate: reservation.reservationDate,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    });
  };

  const saveSingleReservationTime = (reservation: AdminReservationRow) => {
    if (!timeEditForm.startTime || !timeEditForm.endTime) {
      toast.error("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }
    if (timeEditForm.startTime >= timeEditForm.endTime) {
      toast.error("시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    updateTimeMutation.mutate({
      id: reservation.id,
      reservationDate: timeEditForm.reservationDate,
      startTime: timeEditForm.startTime,
      endTime: timeEditForm.endTime,
    });
  };

  const cancelSingleReservation = (reservation: AdminReservationRow) => {
    if (!confirm("예약을 취소 처리하시겠습니까?")) return;
    cancelMutation.mutate({ id: reservation.id });
  };

  const deleteSingleReservation = (reservation: AdminReservationRow) => {
    if (!confirm("예약을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.")) return;
    deleteMutation.mutate({ id: reservation.id });
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">예약 승인 관리</h3>
          <p className="text-sm text-gray-500 mt-0.5">시설 예약 신청을 검토하고 승인 또는 거절합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={"flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1.5 " + (viewMode === "list" ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          >
            <List className="w-4 h-4" /> 목록
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={"flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1.5 " + (viewMode === "calendar" ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
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
            className="min-h-11 appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 sm:min-h-0 sm:py-1.5"
          >
            <option value="">전체 시설</option>
            {(facilities ?? []).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={facilitySearch}
            onChange={e => setFacilitySearch(e.target.value)}
            placeholder="실명, 위치, 목적 검색"
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 sm:min-h-0 sm:py-1.5"
          />
          {facilitySearch && (
            <button
              type="button"
              onClick={() => setFacilitySearch("")}
              className="absolute right-2 top-1/2 rounded p-1 text-gray-400 transition-colors -translate-y-1/2 hover:bg-gray-100 hover:text-gray-600"
              aria-label="시설 검색어 지우기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 상태 필터 */}
        {(["all", "pending", "checking", "approved", "rejected", "cancelled"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={"min-h-11 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 " + (
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
                    className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center"
                    onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                  >
                    <div className={"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 " + st.color}>
                      {st.icon} {st.label}
                    </div>
                    <div className={"px-2 py-1 rounded-full text-xs font-medium shrink-0 " + getReservationAudienceBadgeClass(r)}>
                      {getReservationAudienceLabel(r)}
                    </div>
                    {group.isRecurring && (
                      <div className="px-2 py-1 rounded-full text-xs font-medium shrink-0 bg-blue-50 text-blue-700">
                        반복 {group.count}회
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="break-keep text-sm font-medium leading-5 text-gray-800">
                        {r.facilityName ?? "시설"} — {getReservationDepartment(r)}
                      </p>
                      <p className="mt-0.5 break-keep text-xs text-gray-500">
                        {dateSummary} · {r.startTime}~{r.endTime} · {getReservationName(r)} ({getReservationPosition(r)})
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:shrink-0">
                      {(group.status === "pending" || group.status === "checking") && (
                        <>
                          {group.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 border-blue-300 px-3 text-xs text-blue-600 hover:bg-blue-50 sm:h-7 sm:min-h-0"
                              onClick={e => { e.stopPropagation(); markReservationChecking(group); }}
                              disabled={isMutating}
                            >
                              확인중
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="min-h-11 bg-green-600 px-3 text-xs text-white hover:bg-green-700 sm:h-7 sm:min-h-0"
                            onClick={e => { e.stopPropagation(); approveReservation(group); }}
                            disabled={isMutating}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 border-red-300 px-3 text-xs text-red-600 hover:bg-red-50 sm:h-7 sm:min-h-0"
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
                          className="min-h-11 border-gray-300 px-2.5 text-xs text-gray-600 hover:bg-gray-50 sm:h-7 sm:min-h-0"
                          onClick={e => { e.stopPropagation(); cancelReservationStatus(group); }}
                          disabled={isMutating}
                        >
                          취소 처리
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 px-2.5 text-xs sm:h-7 sm:min-h-0"
                        onClick={e => { e.stopPropagation(); startEditTime(group); }}
                        disabled={isMutating}
                      >
                        시간 수정
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 sm:h-7 sm:min-h-0"
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
                          className="min-h-11 bg-red-600 text-xs text-white hover:bg-red-700 sm:min-h-0"
                          onClick={() => rejectReservation(group)}
                          disabled={!rejectComment.trim() || isMutating}
                        >
                          거절 확정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 text-xs sm:min-h-0"
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
                      <div className="grid gap-x-6 gap-y-3 mt-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div><span className="text-gray-500 text-xs">신청자</span><p className="font-medium">{getReservationName(r)} <span className="text-gray-500">({getReservationPosition(r)})</span></p></div>
                        <div><span className="text-gray-500 text-xs">연락처</span><p className="font-medium">{getReservationPhone(r)}</p></div>
                        <div><span className="text-gray-500 text-xs">사용 목적</span><p className="font-medium">{r.purpose || "-"}</p></div>
                        <div><span className="text-gray-500 text-xs">예상 인원</span><p className="font-medium">{r.attendees}명</p></div>
                        <div><span className="text-gray-500 text-xs">신청 일시</span><p className="font-medium">{formatCreatedAt(r)}</p></div>
                        {group.isRecurring && (
                          <div className="sm:col-span-2 lg:col-span-3">
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
                          <div className="sm:col-span-2 lg:col-span-3"><span className="text-gray-500 text-xs">추가 요청사항</span><p className="font-medium whitespace-pre-wrap">{r.notes}</p></div>
                        )}
                        {r.adminComment && (
                          <div className="sm:col-span-2 lg:col-span-3">
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
        <CalendarView
          searchFilteredReservations={searchFilteredReservations}
          searchFilteredBlockedDates={searchFilteredBlockedDates}
          facilityFilter={facilityFilter}
          facilitySearch={facilitySearch}
          facilities={facilities ?? []}
          editingKey={editingKey}
          timeEditForm={timeEditForm}
          setEditingKey={setEditingKey}
          setTimeEditForm={setTimeEditForm}
          isMutating={isMutating}
          editingBlockedDateId={editingBlockedDateId}
          blockedDateEditForm={blockedDateEditForm}
          setEditingBlockedDateId={setEditingBlockedDateId}
          setBlockedDateEditForm={setBlockedDateEditForm}
          onStartEditTime={startEditSingleReservationTime}
          onSaveTime={saveSingleReservationTime}
          onStartBlockedDateEdit={startBlockedDateEdit}
          onSaveBlockedDateEdit={saveBlockedDateEdit}
          onDeleteBlockedDate={removeBlockedDate}
          getBlockedDateBatchSize={(blockedDate) => (blockedDateBatchIdsById.get(blockedDate.id) ?? [blockedDate.id]).length}
          onCancelReservation={cancelSingleReservation}
          onDeleteReservation={deleteSingleReservation}
        />
      )}
    </div>
  );
}

function CalendarView({ searchFilteredReservations, searchFilteredBlockedDates, facilityFilter, facilitySearch, facilities, editingKey, timeEditForm, setEditingKey, setTimeEditForm, isMutating, editingBlockedDateId, blockedDateEditForm, setEditingBlockedDateId, setBlockedDateEditForm, onStartEditTime, onSaveTime, onStartBlockedDateEdit, onSaveBlockedDateEdit, onDeleteBlockedDate, getBlockedDateBatchSize, onCancelReservation, onDeleteReservation }: {
  searchFilteredReservations: AdminReservationRow[];
  searchFilteredBlockedDates: CalendarBlockedDateRow[];
  facilityFilter: number | undefined;
  facilitySearch: string;
  facilities: Facility[];
  editingKey: string | null;
  timeEditForm: ReservationTimeEditForm;
  setEditingKey: Dispatch<SetStateAction<string | null>>;
  setTimeEditForm: Dispatch<SetStateAction<ReservationTimeEditForm>>;
  isMutating: boolean;
  editingBlockedDateId: number | null;
  blockedDateEditForm: BlockedDateEditForm;
  setEditingBlockedDateId: Dispatch<SetStateAction<number | null>>;
  setBlockedDateEditForm: Dispatch<SetStateAction<BlockedDateEditForm>>;
  onStartEditTime: (reservation: AdminReservationRow) => void;
  onSaveTime: (reservation: AdminReservationRow) => void;
  onStartBlockedDateEdit: (blockedDate: CalendarBlockedDateRow) => void;
  onSaveBlockedDateEdit: (blockedDate: CalendarBlockedDateRow) => void;
  onDeleteBlockedDate: (blockedDate: CalendarBlockedDateRow) => void;
  getBlockedDateBatchSize: (blockedDate: CalendarBlockedDateRow) => number;
  onCancelReservation: (reservation: AdminReservationRow) => void;
  onDeleteReservation: (reservation: AdminReservationRow) => void;
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
  searchFilteredReservations.forEach(r => {
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

  const blockedDatesByDate: Record<string, CalendarBlockedDateRow[]> = {};
  searchFilteredBlockedDates.forEach((blockedDate) => {
    const key = blockedDate.blockedDate;
    if (!blockedDatesByDate[key]) blockedDatesByDate[key] = [];
    blockedDatesByDate[key].push(blockedDate);
  });
  Object.values(blockedDatesByDate).forEach((items) => {
    items.sort((a, b) =>
      Number(a.isPartialBlock) - Number(b.isPartialBlock)
      || (a.blockStart ?? "").localeCompare(b.blockStart ?? "")
      || (a.facilityName ?? "").localeCompare(b.facilityName ?? "")
      || (a.reason ?? "").localeCompare(b.reason ?? "")
    );
  });

  const selectedReservations = reservationsByDate[selectedDate] ?? [];
  const selectedBlockedDates = blockedDatesByDate[selectedDate] ?? [];
  const selectedDateLabel = formatDate(selectedDate);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
      {facilitySearch.trim() && (
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          현재 실 검색: {facilitySearch.trim()}
        </div>
      )}

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={"empty-" + idx} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayReservations = reservationsByDate[dateKey] ?? [];
          const dayBlockedDates = blockedDatesByDate[dateKey] ?? [];
          const activeReservations = dayReservations.filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "rejected");
          const groupCounts = Array.from(
            activeReservations.reduce((map, reservation) => {
              const label = getReservationAudienceLabel(reservation);
              map.set(label, (map.get(label) ?? 0) + 1);
              return map;
            }, new Map<string, number>()),
          );
          const fullBlockedCount = dayBlockedDates.filter((blockedDate) => !blockedDate.isPartialBlock).length;
          const partialBlockedCount = dayBlockedDates.length - fullBlockedCount;
          const isToday = getLocalDateKey() === dateKey;
          const isSelected = selectedDate === dateKey;
          const isSun = (idx % 7) === 0;
          const isSat = (idx % 7) === 6;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={"relative min-h-[78px] rounded-lg border p-1.5 text-left transition-colors " + (
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
              {groupCounts.slice(0, 3).map(([label, count]) => (
                <div
                  key={label}
                  className={
                    "mb-0.5 truncate rounded px-1 py-0.5 text-[10px] "
                    + (label === "외부인" ? "bg-orange-100 text-orange-700" : "bg-green-50 text-green-700")
                  }
                >
                  {label} {count}
                </div>
              ))}
              {groupCounts.length > 3 && (
                <div className="mb-0.5 truncate rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">
                  +{groupCounts.length - 3}
                </div>
              )}
              {fullBlockedCount > 0 && (
                <div className="text-[10px] bg-red-100 text-red-700 rounded px-1 py-0.5 mb-0.5 truncate">
                  예약불가 {fullBlockedCount}건
                </div>
              )}
              {partialBlockedCount > 0 && (
                <div className="text-[10px] bg-rose-50 text-rose-700 rounded px-1 py-0.5 truncate">
                  부분차단 {partialBlockedCount}건
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block"></span>성도 예약</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block"></span>외부인 예약</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"></span>예약불가</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-50 border border-rose-200 inline-block"></span>부분차단</span>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{selectedDateLabel} 예약 상세</p>
            <p className="text-xs text-gray-500">날짜를 누르면 해당 날짜 예약자 정보가 바로 바뀝니다.</p>
          </div>
          <span className="text-xs font-medium text-[#1B5E20]">예약 {selectedReservations.length}건 · 차단 {selectedBlockedDates.length}건</span>
        </div>

        {selectedReservations.length === 0 && selectedBlockedDates.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            이 날짜에는 예약이 없습니다.
          </div>
        ) : (
          <div className="min-w-0">
            {selectedBlockedDates.length > 0 && (
              <div className="border-b border-red-100 bg-red-50/70 px-4 py-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
                  <Ban className="h-4 w-4" /> 예약 불가 설정
                </p>
                <div className="space-y-2">
                  {selectedBlockedDates.map((blockedDate) => (
                    <div key={`selected-blocked-${blockedDate.id}`} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          {formatBlockedTimeLabel(blockedDate)}
                        </span>
                        <span className="font-semibold text-gray-900">{blockedDate.facilityName ?? "시설"}</span>
                        <span className="text-gray-500">{blockedDate.reason?.trim() || "예약 불가 날짜"}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            onClick={() => onStartBlockedDateEdit(blockedDate)}
                            disabled={isMutating}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50"
                            onClick={() => onDeleteBlockedDate(blockedDate)}
                            disabled={isMutating}
                          >
                            {getBlockedDateBatchSize(blockedDate) > 1 ? `일괄 삭제 (${getBlockedDateBatchSize(blockedDate)}일)` : "삭제"}
                          </Button>
                        </div>
                      </div>
                      {editingBlockedDateId === blockedDate.id && (
                        <div className="mt-3 grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto_auto]">
                          <input
                            type="date"
                            value={blockedDateEditForm.blockedDate}
                            onChange={(event) => setBlockedDateEditForm((prev) => ({ ...prev, blockedDate: event.target.value }))}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                          />
                          <input
                            type="text"
                            value={blockedDateEditForm.reason}
                            onChange={(event) => setBlockedDateEditForm((prev) => ({ ...prev, reason: event.target.value }))}
                            placeholder="차단 사유"
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                          />
                          <Button
                            size="sm"
                            className="h-10 px-3 text-xs"
                            onClick={() => onSaveBlockedDateEdit(blockedDate)}
                            disabled={isMutating}
                          >
                            저장
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 px-3 text-xs"
                            onClick={() => setEditingBlockedDateId(null)}
                            disabled={isMutating}
                          >
                            취소
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-[94px_minmax(0,1fr)_80px] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-500 md:hidden">
              <div>시간</div>
              <div>시설 / 목적 / 예약자</div>
              <div>관리</div>
            </div>
            <div className="hidden grid-cols-[94px_minmax(128px,1fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_80px_44px_148px] gap-2 border-b border-gray-100 bg-gray-50 px-2 py-3 text-sm font-semibold text-gray-500 md:grid">
              <div>시간</div>
              <div>시설</div>
              <div>목적</div>
              <div>부서/모임명</div>
              <div>예약자/연락처</div>
              <div>상태</div>
              <div>인원</div>
              <div>관리</div>
            </div>

            <div className="divide-y divide-gray-100">
              {selectedReservations.map((reservation) => {
                const statusMeta = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.pending;
                const calendarStatusLabel = reservation.status === "approved" ? "승인" : statusMeta.label;
                const rowEditKey = `reservation:${reservation.id}`;
                const isEditingRow = editingKey === rowEditKey;
                const isCancelable = reservation.status !== "cancelled" && reservation.status !== "rejected";

                return (
                  <div key={reservation.id}>
                    <div className="grid grid-cols-[94px_minmax(0,1fr)_80px] gap-2 px-3 py-3 text-sm md:grid-cols-[94px_minmax(128px,1fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_80px_44px_148px] md:items-center md:px-2">
                      <div className="row-span-2 pr-1 md:row-span-1">
                        <p className="text-xs text-gray-400 md:hidden">시간</p>
                        <p className="whitespace-nowrap font-semibold text-gray-900">{formatReservationTimeRange(reservation)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 md:hidden">시설</p>
                        <p className="break-words font-semibold leading-5 text-gray-900" title={reservation.facilityName ?? "시설"}>
                          {reservation.facilityName ?? "시설"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500 md:hidden">{getReservationName(reservation)} ({getReservationPosition(reservation)}) · {getReservationPhone(reservation)}</p>
                      </div>
                      <div className="col-start-2 min-w-0 md:col-start-auto">
                        <p className="text-xs text-gray-400 md:hidden">목적</p>
                        <p className="truncate font-semibold text-gray-900">{reservation.purpose || "-"}</p>
                        <p className="mt-0.5 break-words text-xs text-gray-500 md:hidden">부서/모임: {getReservationDepartment(reservation)}</p>
                      </div>
                      <div className="min-w-0 hidden md:block">
                        <p className="break-words font-semibold text-gray-900">{getReservationDepartment(reservation)}</p>
                      </div>
                      <div className="hidden min-w-0 md:block">
                        <p className="text-xs text-gray-400 md:hidden">예약자/연락처</p>
                        <span className={"mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold " + getReservationAudienceBadgeClass(reservation)}>
                          {getReservationAudienceLabel(reservation)}
                        </span>
                        <p className="truncate font-semibold text-gray-900">
                          {getReservationName(reservation)}
                          <span className="ml-1 text-xs font-medium text-gray-500">({getReservationPosition(reservation)})</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-gray-700">{getReservationPhone(reservation)}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-xs text-gray-400 md:hidden">상태</p>
                        <span className={"inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium " + statusMeta.color}>
                          {statusMeta.icon} {calendarStatusLabel}
                        </span>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-xs text-gray-400 md:hidden">인원</p>
                        <p className="font-semibold text-gray-900">{reservation.attendees}명</p>
                      </div>
                      <div className="col-start-3 row-span-2 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto md:justify-self-end">
                        <p className="text-xs text-gray-400 md:hidden">관리</p>
                        <div
                          className={"grid min-w-0 grid-cols-1 gap-1 " + (isCancelable ? "md:min-w-[148px] md:grid-cols-3" : "md:min-w-[100px] md:grid-cols-2")}
                        >
                          {isCancelable && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full border-gray-300 px-1 text-[10px] text-gray-600 hover:bg-gray-50"
                              onClick={() => onCancelReservation(reservation)}
                              disabled={isMutating}
                            >
                              취소
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-full px-1 text-[10px]"
                            onClick={() => onStartEditTime(reservation)}
                            disabled={isMutating}
                          >
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-full border-red-200 px-1 text-[10px] text-red-600 hover:bg-red-50"
                            onClick={() => onDeleteReservation(reservation)}
                            disabled={isMutating}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isEditingRow && (
                      <div className="border-t border-green-100 bg-green-50 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-green-800">예약 날짜</span>
                            <input
                              type="date"
                              value={timeEditForm.reservationDate}
                              onChange={e => setTimeEditForm(prev => ({ ...prev, reservationDate: e.target.value }))}
                              className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
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
                              onClick={() => onSaveTime(reservation)}
                              disabled={isMutating}
                            >
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingKey(null)}>
                              취소
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
