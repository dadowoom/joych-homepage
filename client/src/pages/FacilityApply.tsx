/**
 * 시설 사용 예약 신청 페이지 (/facility/:id/apply)
 * - DB에서 시설 정보, 운영 시간, 예약 현황을 실시간으로 가져옴
 * - 날짜/시작시간/종료시간을 URL 파라미터로 자동 적용
 * - 시간 선택은 가로 타임라인 바 방식
 * - 신청 완료 시 DB에 저장 + 관리자 알림
 */

import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import type { FacilityBlockedDate } from "../../../drizzle/schema";
import { toast } from "sonner";
import { Loader2, ChevronRight, Clock, Users, MapPin, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReservationConflictDialog, {
  isReservationConflictMessage,
} from "@/components/facility/ReservationConflictDialog";
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import { hasContentPermission } from "@/lib/contentPermissions";
import {
  getExternalReservationDateRangeRestriction,
  getExternalReservationMaxDateKey,
  getExternalReservationWindow,
  getExternalReservationWindowMessage,
  getKstDateKey,
  getReservationDateRangeRestriction,
  getReservationLeadDateKey,
  getReservationMaxDateKey,
  getReservationTimeRestriction,
} from "@/lib/facilityReservationTime";
import { getDateKeyDayOfWeek } from "@/lib/koreanDate";
import {
  generateReservationTimePoints,
} from "@/lib/facilitySlotSelection";
import {
  hasFacilityReservationBlockedMemberMarker,
} from "@shared/facilityReservationEligibility";

type RepeatType = "none" | "daily" | "weekly" | "monthly-weekday";
type FacilityBuilding = "hayoungin" | "welfare";
type FacilityAudience = "member" | "external";
const FACILITY_CONTACT_DEFAULT_TEXT_KEY = "facility_contact_default_text";
const FACILITY_MEMBER_RULES_TITLE_KEY = "facility_member_rules_title";
const FACILITY_MEMBER_RULES_TEXT_KEY = "facility_member_rules_text";
const FACILITY_EXTERNAL_RULES_TITLE_KEY = "facility_external_rules_title";
const DEFAULT_FACILITY_CONTACT_TEXT = "기쁨의교회 사무국 054-270-1002";
const DEFAULT_MEMBER_FACILITY_RULES_TITLE = "교인 시설사용 주의사항";
const DEFAULT_EXTERNAL_FACILITY_RULES_TITLE = "외부 시설사용 주의사항";

function normalizeFacilityBuilding(building: string | null | undefined): FacilityBuilding {
  return building === "hayoungin" ? "hayoungin" : "welfare";
}

function getFacilityListHref(building: FacilityBuilding, audience: FacilityAudience) {
  return audience === "external" ? `/facility/external?building=${building}` : `/facility?building=${building}`;
}

function getFacilityDetailHref(facilityId: number, building: FacilityBuilding, audience: FacilityAudience) {
  return audience === "external"
    ? `/facility/external/${facilityId}?building=${building}`
    : `/facility/${facilityId}?building=${building}`;
}

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: "none", label: "반복 없음" },
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly-weekday", label: "매월 같은 주" },
];

// 요일 숫자 (0=일, 1=월 ... 6=토)
function getDayOfWeek(dateStr: string): number {
  return getDateKeyDayOfWeek(dateStr);
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
function SuccessScreen({ facilityName, status, count, recurrenceLabel, facilityListHref, showMyReservations = true, onReset }: {
  facilityName: string;
  status: string;
  count: number;
  recurrenceLabel?: string | null;
  facilityListHref: string;
  showMyReservations?: boolean;
  onReset: () => void;
}) {
  const isPending = status === "pending";
  const isRepeated = count > 1;
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
      {isRepeated && (
        <p className="text-sm text-[#1B5E20] font-medium mb-2">
          {recurrenceLabel ?? `반복 예약 총 ${count}건`}이 함께 접수되었습니다.
        </p>
      )}
      {isPending && (
        <p className="text-gray-500 text-sm mb-2">
          담당자 확인 후 입력하신 연락처로 안내드리겠습니다. <br className="hidden sm:block" />
          (평일 기준 1~2일 소요)
        </p>
      )}
      <p className="text-xs text-gray-400 mb-8">내 예약 현황에서 승인 상태를 확인하실 수 있습니다.</p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link href={facilityListHref}>
          <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            시설 목록으로
          </button>
        </Link>
        {showMyReservations && (
          <Link href="/facility/my-reservations">
            <button className="px-5 py-2.5 rounded-lg bg-[#1B5E20] text-white text-sm hover:bg-[#2E7D32] transition-colors">
              내 예약 현황 보기
            </button>
          </Link>
        )}
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
  disabledSlots = new Map<string, string>(),
  startTime,
  endTime,
  onSelect,
  slotMinutes = 60,
  maxSlots = 8,
  showSelectAll = false,
}: {
  allSlots: string[];
  bookedSlots: Set<string>;
  disabledSlots?: Map<string, string>;
  startTime: string;
  endTime: string;
  onSelect: (start: string, end: string) => void;
  slotMinutes?: number;
  maxSlots?: number;
  showSelectAll?: boolean;
}) {
  return (
    <ReservationTimelinePicker
      allSlots={allSlots}
      bookedSlots={bookedSlots}
      disabledSlots={disabledSlots}
      startTime={startTime}
      endTime={endTime}
      onSelect={onSelect}
      slotMinutes={slotMinutes}
      maxSlots={maxSlots}
      showSelectAll={showSelectAll}
    />
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
function FacilityApply({ audience = "member" }: { audience?: FacilityAudience }) {
  const params = useParams<{ id: string }>();
  const facilityId = Number(params.id);
  const isExternal = audience === "external";
  const [, navigate] = useLocation();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isExternal,
  });
  const { data: authMe } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isExternal,
  });
  const { data: reservationSettings } = trpc.home.settings.useQuery();
  const isApprovedMember = isExternal || Boolean(memberMe);
  const hasReservationOverride =
    !isExternal &&
    (hasContentPermission(authMe, "content:reservations") ||
      hasContentPermission(authMe, "content:facilities"));
  const canReserveFacility = isExternal || (isApprovedMember && !hasFacilityReservationBlockedMemberMarker(memberMe ?? {}));

  // URL 쿼리 파라미터에서 날짜/시간 읽기
  const searchString = useSearch();
  const { urlDate, urlStartTime, urlEndTime, urlBuilding } = useMemo(() => {
    const p = new URLSearchParams(searchString);
    return {
      urlDate: p.get("date") ?? "",
      urlStartTime: p.get("startTime") ?? "",
      urlEndTime: p.get("endTime") ?? "",
      urlBuilding: p.get("building") ?? "",
    };
  }, [searchString]);

  function goToMemberLogin() {
    const nextPath = isExternal
      ? `/facility/external/${facilityId}/apply${searchString ? `?${searchString}` : ""}`
      : `/facility/${facilityId}/apply${searchString ? `?${searchString}` : ""}`;
    const loginParams = new URLSearchParams({
      social: "facility_member_required",
      next: nextPath,
    });
    navigate(`/member/login?${loginParams.toString()}`);
  }

  // 폼 상태 — URL에서 날짜/시간 자동 적용
  const [form, setForm] = useState(() => ({
    reserverName: memberMe?.name ?? "",
    reserverPhone: "",
    department: "",
    depositorName: "",
    purpose: "",
    purposeDetail: "",
    date: urlDate,
    startTime: urlStartTime,
    endTime: urlEndTime,
    attendees: "",
    notes: "",
    repeatType: "none" as RepeatType,
    repeatUntilDate: "",
    agreeRules: false,
    agreePrivacy: false,
  }));
  const [submitted, setSubmitted] = useState(false);
  const [reservedStatus, setReservedStatus] = useState<string>("pending");
  const [reservedCount, setReservedCount] = useState(1);
  const [reservedRecurrenceLabel, setReservedRecurrenceLabel] = useState<string | null>(null);
  const [reservationConflictMessage, setReservationConflictMessage] = useState<string | null>(null);

  // URL 파라미터 변경 시 폼 동기화
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      date: urlDate || prev.date,
      startTime: urlStartTime || prev.startTime,
      endTime: urlEndTime || prev.endTime,
    }));
  }, [urlDate, urlStartTime, urlEndTime]);

  // 로그인한 성도 정보가 늦게 도착해도 신청자 이름/연락처를 자동으로 채웁니다.
  useEffect(() => {
    if (!memberMe) return;
    setForm(prev => ({
      ...prev,
      reserverName: prev.reserverName || memberMe.name || "",
      reserverPhone: prev.reserverPhone || memberMe.phone || "",
    }));
  }, [memberMe]);

  // ── API 쿼리 ─────────────────────────────────────────────
  const memberFacilityQuery = trpc.home.facility.useQuery(
    { id: facilityId },
    { enabled: !isExternal && !!facilityId && !isNaN(facilityId) }
  );
  const externalFacilityQuery = trpc.home.externalFacility.useQuery(
    { id: facilityId },
    { enabled: isExternal && !!facilityId && !isNaN(facilityId) }
  );
  const facility = isExternal ? externalFacilityQuery.data : memberFacilityQuery.data;
  const loadingFacility = isExternal ? externalFacilityQuery.isLoading : memberFacilityQuery.isLoading;
  const externalReservationWindow = isExternal
    ? getExternalReservationWindow(reservationSettings, facility)
    : null;
  const reservationMaxDateKey = isExternal
    ? getExternalReservationMaxDateKey(reservationSettings, facility)
    : getReservationMaxDateKey(reservationSettings);
  const externalReservationWindowMessage = externalReservationWindow
    ? getExternalReservationWindowMessage(externalReservationWindow)
    : null;
  const activeBuilding = useMemo(
    () => normalizeFacilityBuilding(urlBuilding || facility?.building),
    [facility?.building, urlBuilding],
  );
  const facilityListHref = getFacilityListHref(activeBuilding, audience);
  const facilityDetailHref = getFacilityDetailHref(facilityId, activeBuilding, audience);
  const { data: facilityImages } = trpc.home.facilityImages.useQuery(
    { facilityId },
    { enabled: !!facilityId }
  );
  const memberFacilityHoursQuery = trpc.home.facilityHours.useQuery(
    { facilityId },
    { enabled: !isExternal && !!facilityId }
  );
  const externalFacilityHoursQuery = trpc.home.externalFacilityHours.useQuery(
    { facilityId },
    { enabled: isExternal && !!facilityId }
  );
  const facilityHours = isExternal ? externalFacilityHoursQuery.data : memberFacilityHoursQuery.data;
  const { data: blockedDates } = trpc.home.facilityBlockedDates.useQuery(
    { facilityId },
    { enabled: !!facilityId }
  );
  const { data: reservationsByDate } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId, date: form.date },
    { enabled: !!facilityId && !!form.date }
  );
  const externalFacilityRulesQuery = trpc.home.getExternalFacilityRules.useQuery(undefined, {
    enabled: isExternal,
  });
  const externalFacilityRuleLines = useMemo(
    () => (externalFacilityRulesQuery.data ?? "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
    [externalFacilityRulesQuery.data],
  );
  const memberFacilityRuleLines = useMemo(
    () => (reservationSettings?.[FACILITY_MEMBER_RULES_TEXT_KEY] ?? "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
    [reservationSettings],
  );
  const facilityNoticeText = useMemo(() => {
    const memberNotice = facility?.notice?.trim() ?? "";
    const externalNotice = facility?.externalNotice?.trim() ?? "";
    return isExternal ? (externalNotice || memberNotice) : memberNotice;
  }, [facility?.externalNotice, facility?.notice, isExternal]);
  const facilityContactText =
    facility?.contactText?.trim() ||
    reservationSettings?.[FACILITY_CONTACT_DEFAULT_TEXT_KEY]?.trim() ||
    DEFAULT_FACILITY_CONTACT_TEXT;
  const facilityRulesTitle = isExternal
    ? (reservationSettings?.[FACILITY_EXTERNAL_RULES_TITLE_KEY]?.trim() || DEFAULT_EXTERNAL_FACILITY_RULES_TITLE)
    : (reservationSettings?.[FACILITY_MEMBER_RULES_TITLE_KEY]?.trim() || DEFAULT_MEMBER_FACILITY_RULES_TITLE);

  const onReservationCreated = (data: { status: string; count?: number | null; recurrenceLabel?: string | null }) => {
    setReservedStatus(data.status);
    setReservedCount(data.count ?? 1);
    setReservedRecurrenceLabel(data.recurrenceLabel ?? null);
    setSubmitted(true);
  };

  const createMemberReservation = trpc.home.createReservation.useMutation({
    onSuccess: onReservationCreated,
    onError: (err) => {
      showReservationError(err.message || "예약 신청 중 오류가 발생했습니다.");
    },
  });

  const createExternalReservation = trpc.home.createExternalReservation.useMutation({
    onSuccess: onReservationCreated,
    onError: (err) => {
      showReservationError(err.message || "예약 신청 중 오류가 발생했습니다.");
    },
  });

  const isSubmitting = isExternal ? createExternalReservation.isPending : createMemberReservation.isPending;

  // ── 시간 슬롯 계산 ────────────────────────────────────────
  const dayOfWeek = form.date ? getDayOfWeek(form.date) : -1;
  const todayHour = facilityHours?.find(h => h.dayOfWeek === dayOfWeek);
  const unitMinutes = facility?.slotMinutes ?? 60;

  const allTimeSlots = useMemo(() => {
    if (!hasReservationOverride && (!todayHour || !todayHour.isOpen)) return [];
    const openTime = hasReservationOverride
      ? (todayHour?.openTime ?? facility?.openTime)
      : todayHour?.openTime;
    const closeTime = hasReservationOverride
      ? (todayHour?.closeTime ?? facility?.closeTime)
      : todayHour?.closeTime;
    if (!openTime || !closeTime) return [];
    return generateReservationTimePoints(openTime, closeTime, unitMinutes);
  }, [todayHour, unitMinutes, hasReservationOverride, facility?.openTime, facility?.closeTime]);

  // 이미 예약된 시간 슬롯 (승인 대기 + 승인 완료)
  const bookedSlots = useMemo(() => {
    if (!reservationsByDate) return new Set<string>();
    const booked = new Set<string>();
    reservationsByDate.forEach(r => {
      if (r.status === 'cancelled' || r.status === 'rejected') return;
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

  const disabledTimeSlots = useMemo(() => {
    const disabled = new Map<string, string>();
    if (!form.date) return disabled;
    const dateRangeRestriction = isExternal
      ? getExternalReservationDateRangeRestriction(form.date, reservationSettings, facility)
      : getReservationDateRangeRestriction(form.date, reservationSettings, {
          enforceMaxDate: !hasReservationOverride,
        });
    if (dateRangeRestriction) {
      allTimeSlots.forEach((slot) => disabled.set(slot, dateRangeRestriction));
      return disabled;
    }
    allTimeSlots.forEach((slot) => {
      const restriction = getReservationTimeRestriction(form.date, slot, {
        enforceLeadTime: !hasReservationOverride,
      });
      if (restriction) disabled.set(slot, restriction);
    });
    return disabled;
  }, [allTimeSlots, facility, form.date, hasReservationOverride, isExternal, reservationSettings]);

  // 날짜 비활성화 여부
  const blockedDateSet = useMemo(() => {
    return new Set((blockedDates ?? []).map(b => b.blockedDate));
  }, [blockedDates]);

  const selectedDateRangeRestriction = useMemo(() => {
    if (!form.date) return null;
    return isExternal
      ? getExternalReservationDateRangeRestriction(form.date, reservationSettings, facility)
      : getReservationDateRangeRestriction(form.date, reservationSettings, {
          enforceMaxDate: !hasReservationOverride,
        });
  }, [facility, form.date, hasReservationOverride, isExternal, reservationSettings]);

  // ── 이벤트 핸들러 ─────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      ...(name === "purpose" && value !== "기타" ? { purposeDetail: "" } : {}),
      // 날짜 변경 시 시간 초기화
      ...(name === "date" ? { startTime: "", endTime: "" } : {}),
    }));
  }

  // 시간 슬롯 선택 핸들러
  function handleTimeSelect(start: string, end: string) {
    setForm(prev => ({ ...prev, startTime: start, endTime: end }));
  }

  function showReservationError(message: string) {
    if (isReservationConflictMessage(message)) {
      setReservationConflictMessage(message);
      return;
    }
    toast.error(message);
  }

  function validate(): string | null {
    const resolvedPurpose = form.purpose.trim();
    if (!form.reserverName.trim()) return "신청자 이름을 입력해 주세요.";
    if (!form.reserverPhone.trim()) return "연락처를 입력해 주세요.";
    if (!form.department.trim()) return isExternal ? "단체명을 입력해 주세요." : "소속 부서/단체를 입력해 주세요.";
    if (isExternal && !form.depositorName.trim()) return "입금자명을 입력해 주세요.";
    if (!form.purpose.trim()) return "사용 목적을 입력해 주세요.";
    if (!form.date) return "사용 날짜를 선택해 주세요.";
    if (!resolvedPurpose) return isExternal ? "사용 목적을 입력해 주세요." : (form.purpose === "기타" ? "기타 사용 목적을 입력해 주세요." : "사용 목적을 선택해 주세요.");
    if (selectedDateRangeRestriction) return selectedDateRangeRestriction;
    if (blockedDateSet.has(form.date) && !hasReservationOverride) return "해당 날짜는 예약이 불가능합니다.";
    if (!form.startTime) return "시작 시간을 선택해 주세요.";
    if (!form.endTime) return "종료 시간을 선택해 주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    const timeRestriction = getReservationTimeRestriction(form.date, form.startTime, {
      enforceLeadTime: !hasReservationOverride,
    });
    if (timeRestriction) return timeRestriction;
    if (!form.attendees || Number(form.attendees) < 1) return "예상 인원을 입력해 주세요.";
    if (facility && Number(form.attendees) > facility.capacity && !hasReservationOverride) return `최대 수용 인원(${facility.capacity}명)을 초과합니다.`;
    if (!isExternal && form.repeatType !== "none") {
      if (!form.repeatUntilDate) {
        return "반복 종료일을 선택해 주세요.";
      }
      if (form.repeatUntilDate < form.date) {
        return "반복 종료일은 사용 날짜보다 이전일 수 없습니다.";
      }
      const repeatDateRangeRestriction = getReservationDateRangeRestriction(form.repeatUntilDate, reservationSettings, {
        enforceMaxDate: !hasReservationOverride,
      });
      if (repeatDateRangeRestriction) return repeatDateRangeRestriction;
    }
    if (isExternal && !form.agreeRules) return "시설 사용 주의사항에 동의해 주세요.";
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
    if (!isExternal && !isApprovedMember) {
      toast.error("시설 사용 예약은 승인 완료된 성도만 신청할 수 있습니다.");
      goToMemberLogin();
      return;
    }
    if (!isExternal && !canReserveFacility) {
      toast.error("시설 사용 예약은 교회 등록 성도만 신청할 수 있습니다. 관리자에게 문의해 주세요.");
      return;
    }
    const error = validate();
    if (error) { showReservationError(error); return; }
    const resolvedPurpose = form.purpose.trim();
    const payload = {
      facilityId,
      reserverName: form.reserverName,
      reserverPhone: form.reserverPhone,
      reservationDate: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: resolvedPurpose,
      department: form.department || undefined,
      attendees: Number(form.attendees),
      notes: isExternal
        ? `[입금자명: ${form.depositorName.trim()}]${form.notes ? ` ${form.notes}` : ""}`
        : form.notes || undefined,
    };

    if (isExternal) {
      createExternalReservation.mutate(payload);
      return;
    }

    createMemberReservation.mutate({
      ...payload,
      repeat: form.repeatType === "none" ? undefined : {
        type: form.repeatType,
        untilDate: form.repeatUntilDate,
      },
    });
  }

  // ── 로딩/에러 상태 ────────────────────────────────────────
  const conflictDialog = (
    <ReservationConflictDialog
      message={reservationConflictMessage}
      onClose={() => setReservationConflictMessage(null)}
    />
  );

  if (loadingFacility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        {conflictDialog}
        <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        {conflictDialog}
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">시설 정보를 찾을 수 없습니다.</p>
          <Link href={facilityListHref} className="text-[#1B5E20] font-medium hover:underline">시설 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const thumbnailImage = facilityImages?.find(img => img.isThumbnail) ?? facilityImages?.[0];
  const inputClass = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-colors bg-white disabled:bg-gray-50 disabled:text-gray-400";

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {conflictDialog}
      {/* 상단 배너 */}
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="flex items-center gap-2 text-xs text-green-200 mb-3 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={facilityListHref} className="hover:text-white transition-colors">
              {isExternal ? "외부인 시설 예약" : "시설 사용 예약"}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={facilityDetailHref} className="hover:text-white transition-colors">{facility.name}</Link>
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
                count={reservedCount}
                recurrenceLabel={reservedRecurrenceLabel}
                facilityListHref={facilityListHref}
                showMyReservations={!isExternal}
                onReset={() => { setSubmitted(false); setForm(prev => ({ ...prev, date: "", startTime: "", endTime: "", repeatType: "none", repeatUntilDate: "" })); }}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* 선택된 시설 요약 */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6 flex items-center gap-4">
                {thumbnailImage ? (
                  <img src={thumbnailImage.imageUrl} alt={facility.name} className="w-16 h-16 rounded-lg object-cover shrink-0"  loading="lazy"/>
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
                <Link href={facilityDetailHref} className="ml-auto text-xs text-gray-400 hover:text-[#1B5E20] transition-colors shrink-0">
                  ← 변경
                </Link>
              </div>

              {facilityNoticeText && (
                <div className="mb-6 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 text-teal-600" />
                    시설 안내
                  </div>
                  <p className="whitespace-pre-line text-teal-800">{facilityNoticeText}</p>
                </div>
              )}

              {/* 로그인 안내 — 로딩 중에는 숨겨서 깜빡임 방지 */}
              {!isExternal && !memberLoading && !isApprovedMember && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">승인된 성도 로그인이 필요합니다</p>
                    <p className="text-xs text-amber-600 mt-0.5">시설 사용 예약은 승인 완료된 성도만 신청할 수 있습니다.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                    onClick={goToMemberLogin}>
                    성도 로그인
                  </Button>
                </div>
              )}
              {!isExternal && !memberLoading && isApprovedMember && !canReserveFacility && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">시설 예약 권한이 없습니다</p>
                    <p className="text-xs text-red-600 mt-0.5">시설 사용 예약은 교회 등록 성도만 신청할 수 있습니다. 권한이 필요한 경우 관리자에게 문의해 주세요.</p>
                  </div>
                </div>
              )}

              {/* 신청 정보 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-5">
                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  신청자 정보
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="신청자 이름" required>
                    <input type="text" name="reserverName" value={form.reserverName} onChange={handleChange} placeholder="성함을 입력해 주세요" className={inputClass} />
                  </Field>
                  <Field label="연락처" required>
                    <input type="tel" name="reserverPhone" value={form.reserverPhone} onChange={handleChange} placeholder="010-0000-0000" className={inputClass} />
                  </Field>
                </div>

                <Field label={isExternal ? "단체명" : "소속 부서/단체"} required>
                  <input
                    type="text"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder={isExternal ? "단체명을 입력해 주세요." : "예: 청년부, 찬양팀, 외부단체명"}
                    className={inputClass}
                  />
                </Field>

                {isExternal && (
                  <Field label="입금자명" required hint="사용료 입금 시 실제 입금자 이름을 입력해 주세요.">
                    <input
                      type="text"
                      name="depositorName"
                      value={form.depositorName}
                      onChange={handleChange}
                      placeholder="입금자 이름 (신청자와 다르면 따로 입력)"
                      className={inputClass}
                    />
                  </Field>
                )}

                <Field label="사용 목적" required>
                  <input
                    type="text"
                    name="purpose"
                    value={form.purpose}
                    onChange={handleChange}
                    placeholder="사용 목적을 직접 입력해 주세요. (예: 행사, 회의, 모임)"
                    className={inputClass}
                  />
                </Field>

                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100 pt-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  사용 일정
                </h2>

                {/* 사용 날짜 */}
                <Field label="사용 날짜" required hint={blockedDates && blockedDates.length > 0 ? ("예약 불가 날짜: " + blockedDates.map((b: FacilityBlockedDate) => b.blockedDate).join(", ")) : undefined}>
                  {urlDate ? (
                    <div className="flex items-center gap-2">
                      <div className={`${inputClass} flex items-center gap-2 bg-gray-50 cursor-default`}>
                        <Calendar className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span className="font-medium text-gray-800">{form.date}</span>
                      </div>
                      <Link
                        href={facilityDetailHref}
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
                      min={hasReservationOverride ? getKstDateKey() : getReservationLeadDateKey()}
                      max={hasReservationOverride ? undefined : reservationMaxDateKey}
                      className={inputClass}
                    />
                  )}
                  {form.date && todayHour && !todayHour.isOpen && !hasReservationOverride && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 해당 요일은 휴무일입니다.
                    </p>
                  )}
                  {form.date && blockedDateSet.has(form.date) && !hasReservationOverride && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 해당 날짜는 예약이 불가능합니다.
                    </p>
                  )}
                  {selectedDateRangeRestriction && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {selectedDateRangeRestriction}
                    </p>
                  )}
                  {isExternal && externalReservationWindowMessage && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {externalReservationWindowMessage}
                    </p>
                  )}
                  {form.date && hasReservationOverride && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 예약 예외 권한으로 운영 제한을 넘어 신청할 수 있습니다.
                    </p>
                  )}
                </Field>

                {/* 시간 선택 — 슬롯 버튼 방식 */}
                {form.date && !selectedDateRangeRestriction && (hasReservationOverride || !todayHour || todayHour.isOpen) && (hasReservationOverride || !blockedDateSet.has(form.date)) && (
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
                          disabledSlots={disabledTimeSlots}
                          startTime={form.startTime}
                          endTime={form.endTime}
                          onSelect={handleTimeSelect}
                          slotMinutes={unitMinutes}
                          maxSlots={Math.max(1, allTimeSlots.length - 1)}
                          showSelectAll={hasReservationOverride}
                        />
                      </div>
                    )}
                  </Field>
                )}

                {!isExternal && (
                  <Field label="반복 예약" hint="선택한 날짜와 시간 기준으로 여러 날짜의 예약을 한 번에 신청합니다.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        name="repeatType"
                        value={form.repeatType}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        {REPEAT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {form.repeatType !== "none" && (
                        <input
                          type="date"
                          name="repeatUntilDate"
                          value={form.repeatUntilDate}
                          onChange={handleChange}
                          min={form.date || getReservationLeadDateKey()}
                          max={hasReservationOverride ? undefined : reservationMaxDateKey}
                          aria-label="반복 종료일"
                          className={inputClass}
                        />
                      )}
                    </div>
                    {form.repeatType !== "none" && (
                      <p className="text-xs text-gray-400 mt-1">
                        종료일을 넘지 않는 날짜까지만 자동 생성됩니다. 예: 화요일에 시작한 매주 반복은 종료일을 넘지 않는 마지막 화요일까지만 신청됩니다.
                      </p>
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

                {!isExternal && memberFacilityRuleLines.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="mb-3 text-sm font-bold text-amber-900">
                      {facilityRulesTitle}
                    </h3>
                    <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-5 text-amber-900">
                      {memberFacilityRuleLines.map((line, index) => (
                        <li key={`${index}-${line}`}>{line}</li>
                      ))}
                    </ol>
                    <p className="mt-3 whitespace-pre-line text-xs leading-5 text-amber-700">
                      문의: {facilityContactText}
                    </p>
                  </div>
                )}

                {isExternal && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h3 className="mb-3 text-sm font-bold text-amber-900">
                      {facilityRulesTitle}
                    </h3>
                    {externalFacilityRulesQuery.isLoading ? (
                      <p className="text-xs leading-5 text-amber-900">주의사항을 불러오는 중입니다.</p>
                    ) : externalFacilityRuleLines.length > 0 ? (
                      <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-5 text-amber-900">
                        {externalFacilityRuleLines.map((line, index) => (
                          <li key={`${index}-${line}`}>{line}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs leading-5 text-amber-900">등록된 주의사항이 없습니다.</p>
                    )}
                    <p className="mt-3 whitespace-pre-line text-xs leading-5 text-amber-700">
                      문의: {facilityContactText}
                    </p>
                    <label className="mt-3 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="agreeRules"
                        checked={form.agreeRules}
                        onChange={handleChange}
                        className="w-4 h-4 accent-[#1B5E20]"
                      />
                      <span className="text-sm font-medium text-amber-900">
                        위 주의사항을 모두 확인했으며 동의합니다. <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>
                )}

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
                  disabled={isSubmitting || (!isExternal && memberLoading)}
                  className="w-full bg-[#1B5E20] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#2E7D32] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> 신청 중...</>
                  ) : (
                    <><Calendar className="w-5 h-5" /> 예약 신청하기</>
                  )}
                </button>
                {isExternal && (
                  <p className="mt-3 text-center text-xs text-gray-500">
                    자세한 사항은 아래 시설문의로 문의 바랍니다.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export function ExternalFacilityApply() {
  return <FacilityApply audience="external" />;
}

function MemberFacilityApply() {
  return <FacilityApply audience="member" />;
}

export default MemberFacilityApply;
