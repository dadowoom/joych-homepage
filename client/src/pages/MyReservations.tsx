/**
 * 내 예약 현황 페이지 (/facility/my-reservations)
 * - 로그인한 성도의 예약 목록 표시
 * - 상태별 필터링 (전체/대기중/승인/거절/취소)
 * - 승인 대기 중인 예약 취소 가능
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import type { Reservation } from "../../../drizzle/schema";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, Calendar, Clock, MapPin, Users,
  CheckCircle2, XCircle, AlertCircle, Clock3, Ban, RefreshCw
} from "lucide-react";

// ── 상태 배지 ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "승인 대기", color: "bg-amber-50 text-amber-600 border-amber-200",   icon: <Clock3 className="w-3.5 h-3.5" /> },
  approved:  { label: "승인 완료", color: "bg-green-50 text-green-700 border-green-200",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:  { label: "거절됨",   color: "bg-red-50 text-red-600 border-red-200",         icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "취소됨",   color: "bg-gray-50 text-gray-500 border-gray-200",      icon: <Ban className="w-3.5 h-3.5" /> },
};

const FILTER_OPTIONS = [
  { value: "all",       label: "전체" },
  { value: "pending",   label: "승인 대기" },
  { value: "approved",  label: "승인 완료" },
  { value: "rejected",  label: "거절됨" },
  { value: "cancelled", label: "취소됨" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export default function MyReservations() {
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery();
  const isAuthenticated = Boolean(memberMe);
  const [filter, setFilter] = useState("all");

  const { data: reservations, isLoading, refetch } = trpc.home.myReservations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const cancelReservation = trpc.home.cancelReservation.useMutation({
    onSuccess: () => {
      toast.success("예약이 취소되었습니다.");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "취소 중 오류가 발생했습니다.");
    },
  });

  // ── 로그인 안내 ───────────────────────────────────────────
  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F7F5]">
        <section className="bg-[#1B5E20] py-10">
          <div className="container text-white">
            <nav className="flex items-center gap-2 text-xs text-green-200 mb-3">
              <Link href="/" className="hover:text-white">홈</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/facility" className="hover:text-white">시설 사용 예약</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">내 예약 현황</span>
            </nav>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              내 예약 현황
            </h1>
          </div>
        </section>
        <section className="py-20">
          <div className="container max-w-lg mx-auto text-center">
            <AlertCircle className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">로그인이 필요합니다</h2>
            <p className="text-gray-500 text-sm mb-6">예약 현황은 로그인 후 확인하실 수 있습니다.</p>
            <button
              onClick={() => window.location.href = '/member/login'}
              className="px-6 py-3 bg-[#1B5E20] text-white rounded-xl font-medium hover:bg-[#2E7D32] transition-colors"
            >
              로그인하기
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ── 필터링 ────────────────────────────────────────────────
  const filtered = (reservations ?? []).filter(r =>
    filter === "all" ? true : r.status === filter
  );

  const counts = {
    all: reservations?.length ?? 0,
    pending: reservations?.filter(r => r.status === "pending").length ?? 0,
    approved: reservations?.filter(r => r.status === "approved").length ?? 0,
    rejected: reservations?.filter(r => r.status === "rejected").length ?? 0,
    cancelled: reservations?.filter(r => r.status === "cancelled").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* 상단 배너 */}
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="flex items-center gap-2 text-xs text-green-200 mb-3 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/facility" className="hover:text-white transition-colors">시설 사용 예약</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">내 예약 현황</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                내 예약 현황
              </h1>
              <p className="text-green-200 text-sm mt-1">{memberMe?.name}님의 시설 예약 내역</p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-green-200 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 새로고침
            </button>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container max-w-3xl mx-auto">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { key: "pending", label: "승인 대기", color: "text-amber-600" },
              { key: "approved", label: "승인 완료", color: "text-green-700" },
              { key: "rejected", label: "거절됨", color: "text-red-500" },
              { key: "cancelled", label: "취소됨", color: "text-gray-400" },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`bg-white rounded-xl p-4 border text-center transition-all ${
                  filter === key ? "border-[#1B5E20] shadow-sm" : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <p className={`text-2xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </button>
            ))}
          </div>

          {/* 필터 탭 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === opt.value
                    ? "bg-[#1B5E20] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && (
                  <span className="ml-1 text-xs opacity-70">
                    ({counts[opt.value as keyof typeof counts]})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 예약 목록 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {filter === "all" ? "예약 내역이 없습니다." : `${FILTER_OPTIONS.find(o => o.value === filter)?.label} 예약이 없습니다.`}
              </p>
              <Link href="/facility" className="inline-block mt-4 text-sm text-[#1B5E20] font-medium hover:underline">
                시설 예약하러 가기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const statusConf = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                const canCancel = r.status === "pending";
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-base truncate" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                          {`시설 #${r.facilityId}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">예약번호 #{r.id}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${statusConf.color} shrink-0`}>
                        {statusConf.icon}
                        {statusConf.label}
                      </span>
                    </div>

                    {/* 상세 정보 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-300 shrink-0" />
                        <span>{formatDate(r.reservationDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-300 shrink-0" />
                        <span>{r.startTime} ~ {r.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-300 shrink-0" />
                        <span>{r.attendees}명</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-300 shrink-0" />
                        <span className="truncate">{r.purpose}</span>
                      </div>
                    </div>

                    {/* 거절 사유 */}
                    {r.status === "rejected" && r.adminComment && (
                      <div className="mt-3 bg-red-50 rounded-lg px-3 py-2.5 text-sm text-red-600 flex items-start gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium">거절 사유: </span>
                          {r.adminComment}
                        </div>
                      </div>
                    )}

                    {/* 추가 요청사항 */}
                    {r.notes && (
                      <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">요청사항: </span>{r.notes}
                      </div>
                    )}

                    {/* 취소 버튼 */}
                    {canCancel && (
                      <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                        <button
                          onClick={() => {
                            if (confirm("정말 예약을 취소하시겠습니까?")) {
                              cancelReservation.mutate({ id: r.id });
                            }
                          }}
                          disabled={cancelReservation.isPending}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {cancelReservation.isPending
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> 취소 중...</>
                            : <><Ban className="w-3 h-3" /> 예약 취소</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 하단 안내 */}
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">예약 안내</p>
            <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
              <li>승인 대기 중인 예약은 직접 취소하실 수 있습니다.</li>
              <li>이미 승인된 예약의 취소는 교회 사무국에 문의해 주세요.</li>
              <li>문의: 교회 사무국 (031-000-0000)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
