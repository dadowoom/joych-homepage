/**
 * 내 예약 현황 페이지 (/facility/my-reservations)
 * - 로그인한 성도의 시설 예약 목록 표시
 * - 반복 예약은 하나의 묶음으로 표시하고 일괄 취소 가능
 * - 상태/장소/일자 검색 지원
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatKoreanDateKey } from "@/lib/koreanDate";
import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import {
  Loader2,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Clock3,
  Ban,
  RefreshCw,
  Search,
  RotateCcw,
  Layers3,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
  pending: { label: "승인 대기", color: "bg-amber-50 text-amber-600 border-amber-200", icon: <Clock3 className="h-3.5 w-3.5" /> },
  approved: { label: "승인 완료", color: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "거절됨", color: "bg-red-50 text-red-600 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "취소됨", color: "bg-gray-50 text-gray-500 border-gray-200", icon: <Ban className="h-3.5 w-3.5" /> },
};

const FILTER_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "pending", label: "승인 대기" },
  { value: "approved", label: "승인 완료" },
  { value: "rejected", label: "거절됨" },
  { value: "cancelled", label: "취소됨" },
];

function formatDate(dateStr: string) {
  return formatKoreanDateKey(dateStr);
}

function getGroupStatus(statuses: string[]) {
  if (statuses.some((status) => status === "pending")) return "pending";
  if (statuses.some((status) => status === "approved")) return "approved";
  if (statuses.some((status) => status === "rejected")) return "rejected";
  return "cancelled";
}

export default function MyReservations() {
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery();
  const isAuthenticated = Boolean(memberMe);
  const [filter, setFilter] = useState("all");
  const [facilityQuery, setFacilityQuery] = useState("");
  const [dateQuery, setDateQuery] = useState("");

  const { data: reservations, isLoading, refetch } = trpc.home.myReservations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const cancelReservation = trpc.home.cancelReservation.useMutation({
    onSuccess: () => {
      toast.success("예약을 취소했습니다.");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "취소 중 오류가 발생했습니다.");
    },
  });

  const cancelReservationGroup = trpc.home.cancelReservationGroup.useMutation({
    onSuccess: (result) => {
      toast.success(`반복 예약 ${result.count}건을 일괄 취소했습니다.`);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "반복 예약 취소 중 오류가 발생했습니다.");
    },
  });

  type Reservation = NonNullable<typeof reservations>[number];

  const reservationGroups = useMemo(() => {
    const map = new Map<string, Reservation[]>();

    for (const reservation of reservations ?? []) {
      const key = reservation.recurrenceGroupId
        ? `group:${reservation.recurrenceGroupId}`
        : `single:${reservation.id}`;
      const group = map.get(key) ?? [];
      group.push(reservation);
      map.set(key, group);
    }

    return Array.from(map.entries())
      .map(([key, groupReservations]) => {
        const sorted = [...groupReservations].sort((a, b) => {
          const dateCompare = a.reservationDate.localeCompare(b.reservationDate);
          if (dateCompare !== 0) return dateCompare;
          return a.startTime.localeCompare(b.startTime);
        });
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const statuses = sorted.map((reservation) => reservation.status);
        const groupStatus = getGroupStatus(statuses);
        const isRecurring = Boolean(first.recurrenceGroupId) || sorted.length > 1;
        const sameTime = sorted.every(
          (reservation) => reservation.startTime === first.startTime && reservation.endTime === first.endTime
        );

        return {
          key,
          id: first.id,
          groupId: first.recurrenceGroupId,
          isRecurring,
          status: groupStatus,
          reservations: sorted,
          count: sorted.length,
          facilityName: first.facilityName ?? `시설 #${first.facilityId}`,
          facilityId: first.facilityId,
          purpose: first.purpose,
          attendees: first.attendees,
          recurrenceLabel: first.recurrenceLabel,
          dateLabel:
            first.reservationDate === last.reservationDate
              ? formatDate(first.reservationDate)
              : `${formatDate(first.reservationDate)} ~ ${formatDate(last.reservationDate)}`,
          timeLabel: sameTime ? `${first.startTime} ~ ${first.endTime}` : `${sorted.length}회 일정`,
          createdAt: first.createdAt,
          canCancel: sorted.some((reservation) => reservation.status === "pending" || reservation.status === "approved"),
        };
      })
      .sort((a, b) => {
        const aDate = a.reservations[0]?.reservationDate ?? "";
        const bDate = b.reservations[0]?.reservationDate ?? "";
        const dateCompare = bDate.localeCompare(aDate);
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
  }, [reservations]);

  const normalizedFacilityQuery = facilityQuery.trim().toLowerCase();
  const filteredGroups = reservationGroups.filter((group) => {
    const statusOk = filter === "all" || group.status === filter || group.reservations.some((r) => r.status === filter);
    const facilityOk =
      !normalizedFacilityQuery ||
      group.facilityName.toLowerCase().includes(normalizedFacilityQuery) ||
      group.purpose.toLowerCase().includes(normalizedFacilityQuery);
    const dateOk = !dateQuery || group.reservations.some((reservation) => reservation.reservationDate === dateQuery);
    return statusOk && facilityOk && dateOk;
  });

  const counts = {
    all: reservationGroups.length,
    pending: reservationGroups.filter((group) => group.status === "pending").length,
    approved: reservationGroups.filter((group) => group.status === "approved").length,
    rejected: reservationGroups.filter((group) => group.status === "rejected").length,
    cancelled: reservationGroups.filter((group) => group.status === "cancelled").length,
  };

  if (memberLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <MemberOnlyContentNotice
            resourceLabel="내 예약 현황"
            description="예약 현황은 성도 로그인 후 확인할 수 있습니다. 성도 로그인 후 다시 확인해 주세요."
            fallbackPath="/facility/my-reservations"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs text-green-200">
            <Link href="/" className="transition-colors hover:text-white">홈</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/facility" className="transition-colors hover:text-white">시설 사용 예약</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">내 예약 현황</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                내 예약 현황
              </h1>
              <p className="mt-1 text-sm text-green-200">{memberMe?.name}님의 시설 예약 내역</p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-green-200 transition-colors hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 새로고침
            </button>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: "pending", label: "승인 대기", color: "text-amber-600" },
              { key: "approved", label: "승인 완료", color: "text-green-700" },
              { key: "rejected", label: "거절됨", color: "text-red-500" },
              { key: "cancelled", label: "취소됨", color: "text-gray-400" },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-xl border bg-white p-4 text-center transition-all ${
                  filter === key ? "border-[#1B5E20] shadow-sm" : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <p className={`text-2xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
                <p className="mt-0.5 text-xs text-gray-500">{label}</p>
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  filter === opt.value
                    ? "bg-[#1B5E20] text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && (
                  <span className="ml-1 text-xs opacity-70">({counts[opt.value as keyof typeof counts]})</span>
                )}
              </button>
            ))}
          </div>

          <div className="mb-4 grid gap-2 rounded-xl border border-gray-100 bg-white p-3 sm:grid-cols-[1fr_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                value={facilityQuery}
                onChange={(event) => setFacilityQuery(event.target.value)}
                placeholder="장소명 또는 목적 검색"
                className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-[#1B5E20]"
              />
            </label>
            <input
              type="date"
              value={dateQuery}
              onChange={(event) => setDateQuery(event.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1B5E20]"
            />
            <button
              onClick={() => {
                setFacilityQuery("");
                setDateQuery("");
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:border-gray-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-16 text-center">
              <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-200" />
              <p className="font-medium text-gray-500">
                {filter === "all" ? "예약 내역이 없습니다." : `${FILTER_OPTIONS.find((o) => o.value === filter)?.label} 예약이 없습니다.`}
              </p>
              <Link href="/facility" className="mt-4 inline-block text-sm font-medium text-[#1B5E20] hover:underline">
                시설 예약하러 가기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => {
                const statusConf = STATUS_CONFIG[group.status] ?? STATUS_CONFIG.pending;
                const isCancelling =
                  cancelReservation.isPending || cancelReservationGroup.isPending;

                return (
                  <div key={group.key} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                            {group.facilityName}
                          </p>
                          {group.isRecurring && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                              <Layers3 className="h-3.5 w-3.5" />
                              반복 {group.count}건
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {group.isRecurring ? "반복 예약 묶음" : `예약번호 #${group.id}`}
                        </p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusConf.color}`}>
                        {statusConf.icon}
                        {statusConf.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-gray-300" />
                        <span>{group.dateLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-gray-300" />
                        <span>{group.timeLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-gray-300" />
                        <span>{group.attendees}명</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-gray-300" />
                        <span className="truncate">{group.purpose}</span>
                      </div>
                    </div>

                    {group.recurrenceLabel && (
                      <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        <span className="font-medium">반복 예약: </span>{group.recurrenceLabel}
                      </div>
                    )}

                    {group.isRecurring && (
                      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50">
                        {group.reservations.slice(0, 6).map((reservation) => {
                          const rowStatus = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.pending;
                          return (
                            <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0">
                              <span className="text-xs font-medium text-gray-700">
                                {formatDate(reservation.reservationDate)} · {reservation.startTime}~{reservation.endTime}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${rowStatus.color}`}>
                                {rowStatus.label}
                              </span>
                            </div>
                          );
                        })}
                        {group.reservations.length > 6 && (
                          <div className="px-3 py-2 text-xs text-gray-400">
                            외 {group.reservations.length - 6}건의 일정이 같은 묶음에 포함되어 있습니다.
                          </div>
                        )}
                      </div>
                    )}

                    {group.reservations.some((reservation) => reservation.status === "rejected" && reservation.adminComment) && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <span className="font-medium">거절 사유: </span>
                          {group.reservations.find((reservation) => reservation.status === "rejected" && reservation.adminComment)?.adminComment}
                        </div>
                      </div>
                    )}

                    {group.reservations[0]?.notes && (
                      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">요청사항: </span>{group.reservations[0].notes}
                      </div>
                    )}

                    {group.canCancel && (
                      <div className="mt-4 flex justify-end border-t border-gray-50 pt-3">
                        <button
                          onClick={() => {
                            if (group.isRecurring && group.groupId) {
                              if (confirm(`반복 예약 ${group.count}건을 모두 취소할까요?`)) {
                                cancelReservationGroup.mutate({ groupId: group.groupId });
                              }
                              return;
                            }
                            if (confirm("정말 예약을 취소하시겠습니까?")) {
                              cancelReservation.mutate({ id: group.id });
                            }
                          }}
                          disabled={isCancelling}
                          className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> 취소 중...
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3" />
                              {group.isRecurring ? "일괄 취소" : "예약 취소"}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            <p className="mb-1 font-medium">예약 안내</p>
            <ul className="list-inside list-disc space-y-1 text-xs text-blue-600">
              <li>승인 대기 또는 승인 완료 예약은 직접 취소할 수 있습니다.</li>
              <li>반복 예약은 하나의 묶음으로 표시되며, 일괄 취소할 수 있습니다.</li>
              <li>취소 후 다시 사용이 필요하면 새 예약을 신청해 주세요.</li>
              <li>문의: 교회 사무국 (054-270-1000)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
