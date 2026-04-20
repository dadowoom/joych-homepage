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
import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, List, ChevronDown } from "lucide-react";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";
type ViewMode = "list" | "calendar";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "승인 대기", color: "bg-amber-100 text-amber-700",  icon: <Clock className="w-3 h-3" /> },
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

export default function AdminReservationsTab() {
  const utils = trpc.useUtils();
  const [facilityFilter, setFacilityFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const rejectMutation = trpc.cms.reservations.reject.useMutation({
    onSuccess: () => {
      utils.cms.reservations.list.invalidate();
      setRejectingId(null);
      setRejectComment("");
      toast.success("예약이 거절됐습니다.");
    },
    onError: () => toast.error("거절 처리에 실패했습니다."),
  });

  // 필터 적용
  const filtered = (reservations ?? []).filter(r =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  // 통계
  const stats = {
    total: (reservations ?? []).length,
    pending: (reservations ?? []).filter(r => r.status === "pending").length,
    approved: (reservations ?? []).filter(r => r.status === "approved").length,
    rejected: (reservations ?? []).filter(r => r.status === "rejected").length,
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "전체", value: stats.total, color: "bg-gray-50 border-gray-200", textColor: "text-gray-700" },
          { label: "승인 대기", value: stats.pending, color: "bg-amber-50 border-amber-200", textColor: "text-amber-700" },
          { label: "승인 완료", value: stats.approved, color: "bg-green-50 border-green-200", textColor: "text-green-700" },
          { label: "거절", value: stats.rejected, color: "bg-red-50 border-red-200", textColor: "text-red-700" },
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
        {(["all", "pending", "approved", "rejected", "cancelled"] as StatusFilter[]).map(s => (
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
          </button>
        ))}
      </div>

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
            filtered.map(r => {
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending;
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 요약 행 */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    <div className={"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 " + st.color}>
                      {st.icon} {st.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {r.facilityName ?? "시설"} — {r.reserverName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(r.reservationDate)} {r.startTime}~{r.endTime} · {r.department}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                            onClick={e => { e.stopPropagation(); approveMutation.mutate({ id: r.id }); }}
                            disabled={approveMutation.isPending}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-7 px-3"
                            onClick={e => { e.stopPropagation(); setRejectingId(r.id); setRejectComment(""); }}
                          >
                            거절
                          </Button>
                        </>
                      )}
                      <ChevronDown className={"w-4 h-4 text-gray-400 transition-transform " + (isExpanded ? "rotate-180" : "")} />
                    </div>
                  </div>

                  {/* 거절 사유 입력 */}
                  {rejectingId === r.id && (
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
                          onClick={() => rejectMutation.mutate({ id: r.id, comment: rejectComment })}
                          disabled={!rejectComment.trim() || rejectMutation.isPending}
                        >
                          거절 확정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setRejectingId(null)}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 상세 정보 펼치기 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 text-sm">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                        <div><span className="text-gray-500 text-xs">연락처</span><p className="font-medium">{r.reserverPhone}</p></div>
                        <div><span className="text-gray-500 text-xs">예상 인원</span><p className="font-medium">{r.attendees}명</p></div>
                        <div><span className="text-gray-500 text-xs">사용 목적</span><p className="font-medium">{r.purpose}</p></div>
                        <div><span className="text-gray-500 text-xs">신청 일시</span><p className="font-medium">{formatTime(r.createdAt)}</p></div>
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

// ── 달력 뷰 컴포넌트 ──────────────────────────────────────────
type ReservationRow = Pick<Reservation, 'id' | 'facilityId' | 'reservationDate' | 'status'> & {
  reserverName: string;
  facilityName?: string | null;
  userEmail?: string | null;
};

function CalendarView({ reservations, facilityFilter, facilities }: {
  reservations: ReservationRow[];
  facilityFilter: number | undefined;
  facilities: Facility[];
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // 날짜별 예약 수 집계
  const reservationsByDate: Record<string, any[]> = {};
  reservations.forEach(r => {
    const key = r.reservationDate;
    if (!reservationsByDate[key]) reservationsByDate[key] = [];
    reservationsByDate[key].push(r);
  });

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

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={"empty-" + idx} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayReservations = reservationsByDate[dateKey] ?? [];
          const pending = dayReservations.filter(r => r.status === "pending").length;
          const approved = dayReservations.filter(r => r.status === "approved").length;
          const isToday = new Date().toISOString().split("T")[0] === dateKey;
          const isSun = (idx % 7) === 0;
          const isSat = (idx % 7) === 6;

          return (
            <div
              key={day}
              className={"min-h-[60px] rounded-lg p-1.5 border transition-colors " + (
                isToday ? "border-[#1B5E20] bg-[#F1F8E9]" : "border-gray-100 hover:border-gray-300"
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
              {approved > 0 && (
                <div className="text-[10px] bg-green-100 text-green-700 rounded px-1 py-0.5 truncate">
                  승인 {approved}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block"></span>승인 대기</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span>승인 완료</span>
      </div>
    </div>
  );
}
