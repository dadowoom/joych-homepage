/**
 * 시설 사용 예약 신청 페이지 (/facility/:id/apply)
 * - DB에서 시설 정보, 운영 시간, 예약 현황을 실시간으로 가져옴
 * - 날짜/시작시간/종료시간을 URL 파라미터로 자동 적용
 * - 시간 선택은 슬롯 버튼 클릭 방식 (드롭다운 없음)
 * - 신청 완료 시 DB에 저장 + 관리자 알림
 */

import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Loader2, ChevronRight, Clock, Users, MapPin, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── 목적 옵션 ────────────────────────────────────────────────
const PURPOSE_OPTIONS = [
  "주일 예배", "수요 예배", "새벽 기도", "소그룹 모임", "부서 행사",
  "찬양 연습", "강의/세미나", "회의", "바자회/전시", "외부 단체 행사", "기타",
];

// ── 시간 슬롯 생성 헬퍼 ──────────────────────────────────────
function generateTimeSlots(openTime: string, closeTime: string, unitMinutes: number): string[] {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (current <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += unitMinutes;
  }
  return slots;
}

// 요일 숫자 (0=일, 1=월 ... 6=토)
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

// ── 입력 필드 공통 컴포넌트 ──────────────────────────────────
function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── 완료 화면 ────────────────────────────────────────────────
function SuccessScreen({ facilityName, status, onReset }: {
  facilityName: string; status: string; onReset: () => void;
}) {
  const isPending = status === "pending";
  return (
    <div className="text-center py-16 px-4">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${isPending ? "bg-amber-50" : "bg-[#E8F5E9]"}`}>
        {isPending
          ? <Clock className="w-10 h-10 text-amber-500" />
          : <CheckCircle2 className="w-10 h-10 text-[#1B5E20]" />
        }
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
        {isPending ? "예약 신청이 접수되었습니다" : "예약이 자동 승인되었습니다"}
      </h2>
      <p className="text-gray-500 text-sm leading-relaxed mb-2">
        <span className="font-medium text-gray-700">{facilityName}</span> 사용 신청이 정상적으로 접수되었습니다.
      </p>
      {isPending && (
        <p className="text-gray-500 text-sm mb-2">
          담당자 확인 후 입력하신 연락처로 안내드리겠습니다. <br className="hidden sm:block" />
          (평일 기준 1~2일 소요)
        </p>
      )}
      <p className="text-xs text-gray-400 mb-8">내 예약 현황에서 승인 상태를 확인하실 수 있습니다.</p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link href="/facility">
          <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            시설 목록으로
          </button>
        </Link>
        <Link href="/facility/my-reservations">
          <button className="px-5 py-2.5 rounded-lg bg-[#1B5E20] text-white text-sm hover:bg-[#2E7D32] transition-colors">
            내 예약 현황 보기
          </button>
        </Link>
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
        >
          추가 신청하기
        </button>
      </div>
    </div>
  );
}

// ── 시간 슬롯 선택 컴포넌트 ──────────────────────────────────
function TimeSlotPicker({
  allSlots,
  bookedSlots,
  startTime,
  endTime,
  onSelect,
}: {
  allSlots: string[];
  bookedSlots: Set<string>;
  startTime: string;
  endTime: string;
  onSelect: (start: string, end: string) => void;
}) {
  function handleSlotClick(slot: string) {
    if (bookedSlots.has(slot)) return;

    // 아무것도 선택 안 됐거나 둘 다 선택된 경우 → 시작 시간 재선택
    if (!startTime || (startTime && endTime)) {
      onSelect(slot, "");
      return;
    }

    // 시작 시간만 있는 경우
    if (slot <= startTime) {
      // 시작 시간보다 앞이면 시작 시간 재선택
      onSelect(slot, "");
      return;
    }

    // 범위 내 예약 충돌 확인
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = slot.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    let hasConflict = false;
    while (cur < end) {
      const h = Math.floor(cur / 60).toString().padStart(2, "0");
      const m = (cur % 60).toString().padStart(2, "0");
      if (bookedSlots.has(`${h}:${m}`)) {
        hasConflict = true;
        break;
      }
      cur += 30;
    }

    if (hasConflict) {
      onSelect(slot, "");
    } else {
      onSelect(startTime, slot);
    }
  }

  const guideText = !startTime
    ? "시작 시간을 클릭하세요"
    : !endTime
    ? `${startTime} 선택됨 — 종료 시간을 클릭하세요`
    : `${startTime} ~ ${endTime} 선택됨 — 다시 클릭하면 변경`;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-[#1B5E20]">{guideText}</p>
      <div className="flex flex-wrap gap-1.5">
        {allSlots.map((slot) => {
          const isBooked = bookedSlots.has(slot);
          const isStart = slot === startTime;
          const isEnd = slot === endTime;
          const isInRange = startTime && endTime && slot > startTime && slot < endTime;

          return (
            <button
              key={slot}
              type="button"
              disabled={isBooked}
              onClick={() => handleSlotClick(slot)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-all ${
                isBooked
                  ? "bg-red-100 text-red-400 line-through cursor-not-allowed"
                  : isStart || isEnd
                  ? "bg-[#1B5E20] text-white ring-2 ring-[#1B5E20] ring-offset-1 scale-105"
                  : isInRange
                  ? "bg-[#2E7D32] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 cursor-pointer"
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> 예약 가능</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> 예약됨</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1B5E20] inline-block" /> 선택됨</span>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function FacilityApply() {
  const params = useParams<{ id: string }>();
  const facilityId = Number(params.id);
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // URL 쿼리 파라미터에서 날짜/시간 읽기
  const searchString = useSearch();
  const { urlDate, urlStartTime, urlEndTime } = useMemo(() => {
    const p = new URLSearchParams(searchString);
    return {
      urlDate: p.get("date") ?? "",
      urlStartTime: p.get("startTime") ?? "",
      urlEndTime: p.get("endTime") ?? "",
    };
  }, [searchString]);

  // 폼 상태 — URL에서 날짜/시간 자동 적용
  const [form, setForm] = useState(() => ({
    reserverName: user?.name ?? "",
    reserverPhone: "",
    department: "",
    purpose: "",
    date: urlDate,
    startTime: urlStartTime,
    endTime: urlEndTime,
    attendees: "",
    notes: "",
    agreePrivacy: false,
  }));
  const [submitted, setSubmitted] = useState(false);
  const [reservedStatus, setReservedStatus] = useState<string>("pending");

  // URL 파라미터 변경 시 폼 동기화
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      date: urlDate || prev.date,
      startTime: urlStartTime || prev.startTime,
      endTime: urlEndTime || prev.endTime,
    }));
  }, [urlDate, urlStartTime, urlEndTime]);

  // ── API 쿼리 ─────────────────────────────────────────────
  const { data: facility, isLoading: loadingFacility } = trpc.home.facility.useQuery(
    { id: facilityId },
    { enabled: !!facilityId && !isNaN(facilityId) }
  );
  const { data: facilityImages } = trpc.home.facilityImages.useQuery(
    { facilityId },
    { enabled: !!facilityId }
  );
  const { data: facilityHours } = trpc.home.facilityHours.useQuery(
    { facilityId },
    { enabled: !!facilityId }
  );
  const { data: blockedDates } = trpc.home.facilityBlockedDates.useQuery(
    { facilityId },
    { enabled: !!facilityId }
  );
  const { data: reservationsByDate } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId, date: form.date },
    { enabled: !!facilityId && !!form.date }
  );

  const createReservation = trpc.home.createReservation.useMutation({
    onSuccess: (data) => {
      setReservedStatus(data.status);
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "예약 신청 중 오류가 발생했습니다.");
    },
  });

  // ── 시간 슬롯 계산 ────────────────────────────────────────
  const dayOfWeek = form.date ? getDayOfWeek(form.date) : -1;
  const todayHour = facilityHours?.find(h => h.dayOfWeek === dayOfWeek);
  const unitMinutes = facility?.slotMinutes ?? 60;

  const allTimeSlots = useMemo(() => {
    if (!todayHour || !todayHour.isOpen || !todayHour.openTime || !todayHour.closeTime) return [];
    return generateTimeSlots(todayHour.openTime, todayHour.closeTime, unitMinutes);
  }, [todayHour, unitMinutes]);

  // 이미 예약된 시간 슬롯 (승인 대기 + 승인 완료)
  const bookedSlots = useMemo(() => {
    if (!reservationsByDate) return new Set<string>();
    const booked = new Set<string>();
    reservationsByDate.forEach(r => {
      if (r.status === 'cancelled') return;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60).toString().padStart(2, "0");
        const m = (cur % 60).toString().padStart(2, "0");
        booked.add(`${h}:${m}`);
        cur += unitMinutes;
      }
    });
    return booked;
  }, [reservationsByDate, unitMinutes]);

  // 날짜 비활성화 여부
  const blockedDateSet = useMemo(() => {
    return new Set((blockedDates ?? []).map(b => b.blockedDate));
  }, [blockedDates]);

  // ── 이벤트 핸들러 ─────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      // 날짜 변경 시 시간 초기화
      ...(name === "date" ? { startTime: "", endTime: "" } : {}),
    }));
  }

  // 시간 슬롯 선택 핸들러
  function handleTimeSelect(start: string, end: string) {
    setForm(prev => ({ ...prev, startTime: start, endTime: end }));
  }

  function validate(): string | null {
    if (!form.reserverName.trim()) return "신청자 이름을 입력해 주세요.";
    if (!form.reserverPhone.trim()) return "연락처를 입력해 주세요.";
    if (!form.department.trim()) return "소속 부서/단체를 입력해 주세요.";
    if (!form.purpose) return "사용 목적을 선택해 주세요.";
    if (!form.date) return "사용 날짜를 선택해 주세요.";
    if (blockedDateSet.has(form.date)) return "해당 날짜는 예약이 불가능합니다.";
    if (!form.startTime) return "시작 시간을 선택해 주세요.";
    if (!form.endTime) return "종료 시간을 선택해 주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (!form.attendees || Number(form.attendees) < 1) return "예상 인원을 입력해 주세요.";
    if (facility && Number(form.attendees) > facility.capacity) return `최대 수용 인원(${facility.capacity}명)을 초과합니다.`;
    if (!form.agreePrivacy) return "개인정보 수집·이용에 동의해 주세요.";
    // 선택한 시간대에 이미 예약이 있는지 확인
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur < end) {
      const h = Math.floor(cur / 60).toString().padStart(2, "0");
      const m = (cur % 60).toString().padStart(2, "0");
      if (bookedSlots.has(`${h}:${m}`)) return "선택하신 시간대에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.";
      cur += unitMinutes;
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("예약 신청은 로그인 후 이용하실 수 있습니다.");
      window.location.href = getLoginUrl();
      return;
    }
    const error = validate();
    if (error) { toast.error(error); return; }
    createReservation.mutate({
      facilityId,
      reserverName: form.reserverName,
      reserverPhone: form.reserverPhone,
      reservationDate: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose,
      department: form.department || undefined,
      attendees: Number(form.attendees),
      notes: form.notes || undefined,
    });
  }

  // ── 로딩/에러 상태 ────────────────────────────────────────
  if (loadingFacility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">시설 정보를 찾을 수 없습니다.</p>
          <Link href="/facility" className="text-[#1B5E20] font-medium hover:underline">시설 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const thumbnailImage = facilityImages?.find(img => img.isThumbnail) ?? facilityImages?.[0];
  const inputClass = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-colors bg-white disabled:bg-gray-50 disabled:text-gray-400";

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
            <Link href={`/facility/${facilityId}`} className="hover:text-white transition-colors">{facility.name}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">예약 신청</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {facility.name} 예약 신청
          </h1>
        </div>
      </section>

      {/* 본문 */}
      <section className="py-10">
        <div className="container max-w-3xl mx-auto">
          {submitted ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <SuccessScreen
                facilityName={facility.name}
                status={reservedStatus}
                onReset={() => { setSubmitted(false); setForm(prev => ({ ...prev, date: "", startTime: "", endTime: "" })); }}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* 선택된 시설 요약 */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6 flex items-center gap-4">
                {thumbnailImage ? (
                  <img src={thumbnailImage.imageUrl} alt={facility.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {facility.location && <p className="text-xs text-gray-400 mb-0.5">{facility.location}</p>}
                  <p className="font-bold text-gray-900 truncate" style={{ fontFamily: "'Noto Serif KR', serif" }}>{facility.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 최대 {facility.capacity}명</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {facility.slotMinutes}분 단위</span>
                  </div>
                </div>
                <Link href={`/facility/${facilityId}`} className="ml-auto text-xs text-gray-400 hover:text-[#1B5E20] transition-colors shrink-0">
                  ← 변경
                </Link>
              </div>

              {/* 로그인 안내 */}
              {!isAuthenticated && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">로그인이 필요합니다</p>
                    <p className="text-xs text-amber-600 mt-0.5">예약 신청은 로그인 후 이용하실 수 있습니다.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                    onClick={() => { window.location.href = getLoginUrl(); }}>
                    로그인
                  </Button>
                </div>
              )}

              {/* 신청 정보 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-5">
                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  신청자 정보
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="신청자 이름" required>
                    <input type="text" name="reserverName" value={form.reserverName} onChange={handleChange} placeholder="홍길동" className={inputClass} />
                  </Field>
                  <Field label="연락처" required>
                    <input type="tel" name="reserverPhone" value={form.reserverPhone} onChange={handleChange} placeholder="010-0000-0000" className={inputClass} />
                  </Field>
                </div>

                <Field label="소속 부서/단체" required>
                  <input type="text" name="department" value={form.department} onChange={handleChange} placeholder="예: 청년부, 찬양팀, 외부단체명" className={inputClass} />
                </Field>

                <Field label="사용 목적" required>
                  <select name="purpose" value={form.purpose} onChange={handleChange} className={inputClass}>
                    <option value="">선택해 주세요</option>
                    {PURPOSE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100 pt-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  사용 일정
                </h2>

                {/* 사용 날짜 */}
                <Field label="사용 날짜" required hint={blockedDates && blockedDates.length > 0 ? ("예약 불가 날짜: " + blockedDates.map((b: any) => b.blockedDate).join(", ")) : undefined}>
                  {urlDate ? (
                    <div className="flex items-center gap-2">
                      <div className={`${inputClass} flex items-center gap-2 bg-gray-50 cursor-default`}>
                        <Calendar className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span className="font-medium text-gray-800">{form.date}</span>
                      </div>
                      <Link
                        href={`/facility/${facilityId}`}
                        className="text-xs text-[#1B5E20] hover:underline shrink-0 whitespace-nowrap"
                      >
                        ← 날짜 변경
                      </Link>
                    </div>
                  ) : (
                    <input
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      min={new Date().toISOString().split("T")[0]}
                      className={inputClass}
                    />
                  )}
                  {form.date && todayHour && !todayHour.isOpen && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 해당 요일은 휴무일입니다.
                    </p>
                  )}
                  {form.date && blockedDateSet.has(form.date) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 해당 날짜는 예약이 불가능합니다.
                    </p>
                  )}
                </Field>

                {/* 시간 선택 — 슬롯 버튼 방식 */}
                {form.date && (!todayHour || todayHour.isOpen) && !blockedDateSet.has(form.date) && (
                  <Field
                    label="사용 시간"
                    required
                    hint={`${unitMinutes}분 단위 · 시작 시간 클릭 후 종료 시간 클릭`}
                  >
                    {allTimeSlots.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        해당 날짜의 운영 시간 정보가 없습니다.
                      </p>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        {/* 선택 결과 표시 */}
                        {form.startTime && (
                          <div className="mb-3 px-3 py-2 bg-[#E8F5E9] rounded-lg text-sm text-[#1B5E20] font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0" />
                            {form.endTime
                              ? `선택된 시간: ${form.startTime} ~ ${form.endTime}`
                              : `시작: ${form.startTime} — 종료 시간을 선택하세요`}
                          </div>
                        )}
                        <TimeSlotPicker
                          allSlots={allTimeSlots}
                          bookedSlots={bookedSlots}
                          startTime={form.startTime}
                          endTime={form.endTime}
                          onSelect={handleTimeSelect}
                        />
                      </div>
                    )}
                  </Field>
                )}

                {/* 예상 인원 */}
                <Field label="예상 인원" required hint={("최대 수용 인원: " + facility.capacity.toLocaleString() + "명")}>
                  <input
                    type="number"
                    name="attendees"
                    value={form.attendees}
                    onChange={handleChange}
                    placeholder={`1 ~ ${facility.capacity}`}
                    min={1}
                    max={facility.capacity}
                    className={inputClass}
                  />
                </Field>

                <Field label="추가 요청사항">
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="장비 요청, 특이사항 등을 입력해 주세요. (선택)"
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                {/* 개인정보 동의 */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    수집 항목: 이름, 연락처, 소속 부서<br />
                    수집 목적: 시설 사용 예약 신청 및 안내<br />
                    보유 기간: 예약 완료 후 1년
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agreePrivacy"
                      checked={form.agreePrivacy}
                      onChange={handleChange}
                      className="w-4 h-4 accent-[#1B5E20]"
                    />
                    <span className="text-sm text-gray-700 font-medium">
                      개인정보 수집·이용에 동의합니다. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>

                {/* 제출 버튼 */}
                <button
                  type="submit"
                  disabled={createReservation.isPending}
                  className="w-full bg-[#1B5E20] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#2E7D32] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createReservation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> 신청 중...</>
                  ) : (
                    <><Calendar className="w-5 h-5" /> 예약 신청하기</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
