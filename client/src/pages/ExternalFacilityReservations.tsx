import { useState, type FormEvent, type ReactNode } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  Pencil,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getKstDateKey } from "@/lib/facilityReservationTime";
import { formatKoreanDateKey } from "@/lib/koreanDate";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import {
  PUBLIC_MENU_PATHS,
} from "@shared/publicMenuRoutes";
import { isUpcomingReservationOccurrence } from "@shared/reservationSchedule";

type ExternalReservationRow =
  inferRouterOutputs<AppRouter>["home"]["externalReservationsLookup"][number];
type ExternalReservationStatus = ExternalReservationRow["status"];

type LookupCredentials = {
  reserverName: string;
  reserverPhone: string;
  managePassword: string;
  manageCode: string;
};

type EditDraft = {
  id: number;
  reservationDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  department: string;
  attendees: string;
};

const STATUS_CONFIG: Record<ExternalReservationStatus, {
  label: string;
  className: string;
}> = {
  pending: {
    label: "승인 대기",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  checking: {
    label: "확인 중",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  approved: {
    label: "승인 완료",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  rejected: {
    label: "승인 거절",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  cancelled: {
    label: "취소됨",
    className: "border-gray-200 bg-gray-50 text-gray-500",
  },
};

const ACTIVE_STATUSES = new Set<ExternalReservationStatus>([
  "pending",
  "checking",
  "approved",
]);

const inputClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#1B5E20] focus:ring-2 focus:ring-green-100";

function isFutureOccurrence(row: ExternalReservationRow) {
  return isUpcomingReservationOccurrence(row);
}

function canManageReservation(row: ExternalReservationRow) {
  return ACTIVE_STATUSES.has(row.status) && isFutureOccurrence(row);
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-5 text-gray-500">{hint}</p>}
    </div>
  );
}

function ReservationInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="font-medium text-gray-400">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-gray-700">{value}</dd>
    </div>
  );
}

export default function ExternalFacilityReservations() {
  const [credentials, setCredentials] = useState<LookupCredentials>({
    reserverName: "",
    reserverPhone: "",
    managePassword: "",
    manageCode: "",
  });
  const [reservations, setReservations] = useState<ExternalReservationRow[]>([]);
  const [hasVerified, setHasVerified] = useState(false);
  const [editing, setEditing] = useState<EditDraft | null>(null);

  const lookup = trpc.home.externalReservationsLookup.useMutation({
    gcTime: 0,
    onSuccess: (result) => {
      setReservations(result);
      setHasVerified(true);
      setEditing(null);
      queueMicrotask(() => lookup.reset());
    },
    onError: (error) => {
      setHasVerified(false);
      setReservations([]);
      toast.error(error.message || "예약 정보를 확인하지 못했습니다.");
      queueMicrotask(() => lookup.reset());
    },
  });

  const refreshReservations = () => {
    lookup.mutate({
      reserverName: credentials.reserverName.trim(),
      reserverPhone: credentials.reserverPhone.trim(),
      managePassword: credentials.managePassword,
      manageCode: credentials.manageCode,
    });
  };

  const updateReservation = trpc.home.updateExternalReservation.useMutation({
    gcTime: 0,
    onSuccess: () => {
      toast.success("예약 정보가 수정되었습니다. 변경된 예약은 관리자 확인을 거칩니다.");
      setEditing(null);
      refreshReservations();
      queueMicrotask(() => updateReservation.reset());
    },
    onError: (error) => {
      toast.error(error.message || "예약 수정에 실패했습니다.");
      queueMicrotask(() => updateReservation.reset());
    },
  });

  const cancelReservation = trpc.home.cancelExternalReservation.useMutation({
    gcTime: 0,
    onSuccess: () => {
      toast.success("예약을 취소했습니다.");
      setEditing(null);
      refreshReservations();
      queueMicrotask(() => cancelReservation.reset());
    },
    onError: (error) => {
      toast.error(error.message || "예약 취소에 실패했습니다.");
      queueMicrotask(() => cancelReservation.reset());
    },
  });

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reserverName = credentials.reserverName.trim();
    const reserverPhone = credentials.reserverPhone.trim();
    if (!reserverName || !reserverPhone) {
      toast.error("예약자 이름과 연락처를 입력해 주세요.");
      return;
    }
    if (!/^\d{6}$/.test(credentials.managePassword)) {
      toast.error("예약 확인 비밀번호를 숫자 6자리로 입력해 주세요.");
      return;
    }
    if (!/^[A-Za-z0-9_-]{22}$/.test(credentials.manageCode)) {
      toast.error("예약 확인번호 22자를 정확히 입력해 주세요.");
      return;
    }
    lookup.mutate({
      reserverName,
      reserverPhone,
      managePassword: credentials.managePassword,
      manageCode: credentials.manageCode,
    });
  };

  const startEditing = (row: ExternalReservationRow) => {
    setEditing({
      id: row.id,
      reservationDate: row.reservationDate,
      startTime: row.startTime,
      endTime: row.endTime,
      purpose: row.purpose,
      department: row.department ?? "",
      attendees: String(row.attendees),
    });
    requestAnimationFrame(() => {
      const dateInput = document.getElementById("edit-reservation-date");
      dateInput?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      dateInput?.focus({ preventScroll: true });
    });
  };

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const attendees = Number(editing.attendees);
    if (!editing.reservationDate || !editing.startTime || !editing.endTime) {
      toast.error("예약 날짜와 시간을 모두 입력해 주세요.");
      return;
    }
    if (editing.startTime >= editing.endTime) {
      toast.error("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    if (!editing.purpose.trim()) {
      toast.error("사용 목적을 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(attendees) || attendees < 1) {
      toast.error("사용 인원은 1명 이상으로 입력해 주세요.");
      return;
    }

    updateReservation.mutate({
      id: editing.id,
      reserverName: credentials.reserverName.trim(),
      reserverPhone: credentials.reserverPhone.trim(),
      managePassword: credentials.managePassword,
      manageCode: credentials.manageCode,
      reservationDate: editing.reservationDate,
      startTime: editing.startTime,
      endTime: editing.endTime,
      purpose: editing.purpose.trim(),
      department: editing.department.trim() || undefined,
      attendees,
    });
  };

  const handleCancel = (row: ExternalReservationRow) => {
    if (!window.confirm(`${formatKoreanDateKey(row.reservationDate)} 예약을 취소하시겠습니까?`)) return;
    cancelReservation.mutate({
      id: row.id,
      reserverName: credentials.reserverName.trim(),
      reserverPhone: credentials.reserverPhone.trim(),
      managePassword: credentials.managePassword,
      manageCode: credentials.manageCode,
    });
  };

  const resetLookup = () => {
    lookup.reset();
    setCredentials({ reserverName: "", reserverPhone: "", managePassword: "", manageCode: "" });
    setReservations([]);
    setHasVerified(false);
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <section className="border-b border-green-900/20 bg-gradient-to-br from-[#174f1c] to-[#26732d] px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-4xl">
          <Link href={PUBLIC_MENU_PATHS.externalFacility}>
            <span className="inline-flex items-center gap-1.5 text-sm text-green-100 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" /> 외부인 시설 목록
            </span>
          </Link>
          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-200">External Reservation</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                내 예약 확인·변경
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-green-100">
                신청할 때 입력한 이름, 연락처, 숫자 6자리 비밀번호와 발급받은 예약 확인번호로 예약 상태를 확인할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {!hasVerified ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="lookup-title">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-[#1B5E20]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 id="lookup-title" className="font-bold text-gray-900">예약자 확인</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  입력 정보는 예약 확인에만 사용되며 주소나 브라우저 저장소에 보관하지 않습니다.
                </p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-5" noValidate>
              <Field label="예약자 이름" htmlFor="external-reserver-name">
                <input
                  id="external-reserver-name"
                  type="text"
                  value={credentials.reserverName}
                  onChange={(event) => setCredentials(prev => ({ ...prev, reserverName: event.target.value }))}
                  autoComplete="name"
                  className={inputClass}
                  placeholder="신청할 때 입력한 이름"
                  required
                />
              </Field>
              <Field label="연락처" htmlFor="external-reserver-phone">
                <input
                  id="external-reserver-phone"
                  type="tel"
                  value={credentials.reserverPhone}
                  onChange={(event) => setCredentials(prev => ({ ...prev, reserverPhone: event.target.value }))}
                  autoComplete="tel"
                  inputMode="tel"
                  className={inputClass}
                  placeholder="010-0000-0000"
                  required
                />
              </Field>
              <Field
                label="예약 확인 비밀번호"
                htmlFor="external-manage-password"
                hint="시설 예약을 신청할 때 직접 정한 숫자 6자리입니다."
              >
                <input
                  id="external-manage-password"
                  type="password"
                  value={credentials.managePassword}
                  onChange={(event) => setCredentials(prev => ({
                    ...prev,
                    managePassword: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="off"
                  className={inputClass}
                  placeholder="숫자 6자리"
                  aria-describedby="external-manage-password-help"
                  required
                />
                <span id="external-manage-password-help" className="sr-only">
                  시설 예약 신청 때 직접 정한 숫자 6자리 비밀번호를 입력해 주세요.
                </span>
              </Field>
              <Field
                label="예약 확인번호"
                htmlFor="external-manage-code"
                hint="예약 신청 완료 화면에서 한 번만 발급된 영문·숫자 22자입니다. 대문자와 소문자를 구분합니다."
              >
                <input
                  id="external-manage-code"
                  type="text"
                  value={credentials.manageCode}
                  onChange={(event) => setCredentials(prev => ({
                    ...prev,
                    manageCode: event.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 22),
                  }))}
                  minLength={22}
                  maxLength={22}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`${inputClass} font-mono tracking-wide`}
                  placeholder="예약 확인번호 22자"
                  aria-describedby="external-manage-code-help"
                  required
                />
                <p id="external-manage-code-help" className="mt-1.5 text-xs font-medium leading-5 text-amber-700">
                  확인번호를 분실한 경우 교회 사무국(054-270-1000)으로 문의해 주세요.
                </p>
              </Field>
              <Button
                type="submit"
                disabled={lookup.isPending}
                className="h-12 w-full bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
              >
                {lookup.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 확인 중...</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" /> 내 예약 확인</>
                )}
              </Button>
            </form>
            <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
              확인번호가 발급되기 전에 접수한 예약, 또는 비밀번호·확인번호를 잊은 예약은 교회 사무국(054-270-1000)으로 문의해 주세요.
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="flex flex-col gap-3 rounded-xl border border-green-100 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1B5E20]" />
                <div>
                  <p className="font-bold text-green-900">예약자 확인이 완료되었습니다.</p>
                  <p className="mt-0.5 text-sm text-green-700">{credentials.reserverName}님의 외부인 시설 예약 {reservations.length}건</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={resetLookup} className="border-green-200 bg-white text-green-800 hover:bg-green-50">
                <RotateCcw className="mr-2 h-4 w-4" /> 다른 예약 확인
              </Button>
            </section>

            {reservations.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-16 text-center">
                <CalendarDays className="mx-auto h-12 w-12 text-gray-200" />
                <p className="mt-4 font-medium text-gray-600">일치하는 외부인 시설 예약이 없습니다.</p>
                <p className="mt-1 text-sm text-gray-400">입력 정보를 다시 확인하거나 교회 사무국으로 문의해 주세요.</p>
              </section>
            ) : (
              <section className="space-y-4" aria-label="외부인 시설 예약 목록">
                {reservations.map((row) => {
                  const status = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending;
                  const canManage = canManageReservation(row);
                  return (
                    <article key={row.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                            {status.label}
                          </span>
                          <h2 className="mt-3 break-words text-lg font-bold text-gray-900">
                            {row.facilityName || `시설 #${row.facilityId}`}
                          </h2>
                        </div>
                        {canManage && (
                          <div className="flex w-full gap-2 sm:w-auto">
                            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => startEditing(row)}>
                              <Pencil className="mr-1.5 h-4 w-4" /> 수정
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 sm:flex-none"
                              disabled={cancelReservation.isPending}
                              onClick={() => handleCancel(row)}
                            >
                              <Ban className="mr-1.5 h-4 w-4" /> 취소
                            </Button>
                          </div>
                        )}
                      </div>

                      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-100 pt-5 sm:grid-cols-2">
                        <ReservationInfo label="날짜" value={formatKoreanDateKey(row.reservationDate)} />
                        <ReservationInfo label="시간" value={`${row.startTime} ~ ${row.endTime}`} />
                        <ReservationInfo label="목적" value={row.purpose} />
                        <ReservationInfo label="단체/인원" value={`${row.department?.trim() || "미입력"} · ${row.attendees}명`} />
                      </dl>

                      {row.adminResponse && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                          <span className="font-bold">관리자 답변</span>
                          <p className="mt-1 whitespace-pre-wrap break-words">{row.adminResponse}</p>
                        </div>
                      )}

                      {!canManage && ACTIVE_STATUSES.has(row.status) && (
                        <p className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500">
                          <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          이미 시작했거나 지난 예약은 홈페이지에서 수정·취소할 수 없습니다.
                        </p>
                      )}
                    </article>
                  );
                })}
              </section>
            )}

            {editing && (
              <section id="external-reservation-edit" className="scroll-mt-24 rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="edit-title">
                <div className="mb-6 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-[#1B5E20]">
                    <Pencil className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="edit-title" className="font-bold text-gray-900">예약 정보 수정</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      일정이나 시간을 변경하면 기존 승인은 해제되고 다시 관리자 확인을 받습니다.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleUpdate} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="사용 날짜" htmlFor="edit-reservation-date">
                      <input
                        id="edit-reservation-date"
                        type="date"
                        min={getKstDateKey()}
                        value={editing.reservationDate}
                        onChange={(event) => setEditing(prev => prev ? ({ ...prev, reservationDate: event.target.value }) : prev)}
                        className={inputClass}
                        required
                      />
                    </Field>
                    <Field label="시작 시간" htmlFor="edit-start-time">
                      <input
                        id="edit-start-time"
                        type="time"
                        value={editing.startTime}
                        onChange={(event) => setEditing(prev => prev ? ({ ...prev, startTime: event.target.value }) : prev)}
                        className={inputClass}
                        required
                      />
                    </Field>
                    <Field label="종료 시간" htmlFor="edit-end-time">
                      <input
                        id="edit-end-time"
                        type="time"
                        value={editing.endTime}
                        onChange={(event) => setEditing(prev => prev ? ({ ...prev, endTime: event.target.value }) : prev)}
                        className={inputClass}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="사용 목적" htmlFor="edit-purpose">
                    <input
                      id="edit-purpose"
                      type="text"
                      value={editing.purpose}
                      onChange={(event) => setEditing(prev => prev ? ({ ...prev, purpose: event.target.value }) : prev)}
                      className={inputClass}
                      maxLength={256}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="단체명" htmlFor="edit-department">
                      <input
                        id="edit-department"
                        type="text"
                        value={editing.department}
                        onChange={(event) => setEditing(prev => prev ? ({ ...prev, department: event.target.value }) : prev)}
                        className={inputClass}
                        maxLength={128}
                      />
                    </Field>
                    <Field label="사용 인원" htmlFor="edit-attendees">
                      <input
                        id="edit-attendees"
                        type="number"
                        min={1}
                        value={editing.attendees}
                        onChange={(event) => setEditing(prev => prev ? ({ ...prev, attendees: event.target.value }) : prev)}
                        className={inputClass}
                        required
                      />
                    </Field>
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                      닫기
                    </Button>
                    <Button type="submit" disabled={updateReservation.isPending} className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
                      {updateReservation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 저장 중...</>
                      ) : (
                        "수정 내용 저장"
                      )}
                    </Button>
                  </div>
                </form>
              </section>
            )}

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                비밀번호나 확인번호를 잊었거나 지난 예약의 변경이 필요하면 기쁨의교회 사무국(054-270-1000)으로 문의해 주세요.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href={PUBLIC_MENU_PATHS.externalFacility}>
            <span className="text-sm font-medium text-[#1B5E20] hover:underline">외부인 시설 예약으로 돌아가기</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
