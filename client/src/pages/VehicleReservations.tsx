/**
 * 차량예약 사용자 화면
 * 지정된 성도 그룹만 목록/신청 화면에 접근할 수 있습니다.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import { generateReservationTimePoints } from "@/lib/facilitySlotSelection";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Users,
  Car,
} from "lucide-react";

type VehicleRow = {
  id: number;
  name: string;
  description?: string | null;
  plateNumber?: string | null;
  location?: string | null;
  driverInfo?: string | null;
  capacity: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  isReservable: boolean;
  isVisible: boolean;
  notice?: string | null;
  caution?: string | null;
  openTime: string;
  closeTime: string;
  thumbnailUrl?: string | null;
};

type ReservationByDateRow = {
  startTime: string;
  endTime: string;
  status: string;
};

type MyVehicleReservationRow = {
  id: number;
  vehicleId: number;
  vehicleName?: string | null;
  plateNumber?: string | null;
  reserverName: string;
  reserverPhone?: string | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  department?: string | null;
  passengers: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminComment?: string | null;
  createdAt: Date | string;
};

const PURPOSE_OPTIONS = [
  "교회 행사",
  "부서 행사",
  "심방/탐방",
  "선교/봉사",
  "물품 운반",
  "기타",
];

const STATUS_LABELS = {
  pending: { label: "승인 대기", color: "bg-amber-100 text-amber-700", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "승인 완료", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "거절", color: "bg-red-100 text-red-700", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500", icon: <AlertCircle className="h-3.5 w-3.5" /> },
} as const;

function Field({ label, required, children, hint }: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function getKstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatDate(dateKey: string) {
  const date = new Date(dateKey);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function getLoginHref(next: string) {
  const params = new URLSearchParams({
    social: "vehicle_member_required",
    next,
  });
  return `/member/login?${params.toString()}`;
}

function AccessBlocked({ message, next }: { message: string; next: string }) {
  const isLoginMessage = message.includes("로그인") || message.includes("UNAUTHORIZED") || message.includes("unauthorized");
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-14">
        <div className="container max-w-xl">
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
              <Car className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              차량예약 이용 확인이 필요합니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {isLoginMessage
                ? "차량예약은 로그인한 성도 중 지정된 그룹만 이용할 수 있습니다."
                : message}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              {isLoginMessage && (
                <Link href={getLoginHref(next)}>
                  <Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">성도 로그인</Button>
                </Link>
              )}
              <Link href="/">
                <Button variant="outline">홈으로</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VehicleHero() {
  return (
    <section className="bg-[#1B5E20] py-12 text-white">
      <div className="container">
        <p className="mb-2 text-sm uppercase tracking-widest text-green-200">Vehicle Reservation</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>차량예약</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-green-100">
          교회 차량 사용 신청을 접수하고 담당자 승인 후 이용할 수 있습니다.
        </p>
        <nav className="mt-5 flex items-center gap-2 text-xs text-green-200">
          <Link href="/" className="hover:text-white">홈</Link>
          <span>/</span>
          <span className="text-white">차량예약</span>
        </nav>
      </div>
    </section>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehicleRow }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {vehicle.thumbnailUrl ? (
        <img
          src={vehicle.thumbnailUrl}
          alt={vehicle.name}
          className="h-44 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-[#E8F5E9] text-[#1B5E20]">
          <Car className="h-12 w-12" />
        </div>
      )}
      <div className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{vehicle.name}</h3>
          {vehicle.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{vehicle.plateNumber}</span>}
        </div>
        {vehicle.description && <p className="mb-4 line-clamp-2 text-sm leading-6 text-gray-500">{vehicle.description}</p>}
        <div className="mb-5 space-y-2 text-sm text-gray-600">
          {vehicle.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1B5E20]" /> {vehicle.location}</p>}
          <p className="flex items-center gap-2"><Users className="h-4 w-4 text-[#1B5E20]" /> 최대 {vehicle.capacity}명</p>
          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#1B5E20]" /> {vehicle.openTime}~{vehicle.closeTime} · {vehicle.slotMinutes}분 단위</p>
        </div>
        <Link href={`/support/vehicle/${vehicle.id}/apply`}>
          <Button className="w-full bg-[#1B5E20] text-white hover:bg-[#2E7D32]" disabled={!vehicle.isReservable}>
            {vehicle.isReservable ? "예약 신청" : "예약 중단"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function VehicleReservationList() {
  const { data: vehicles, isLoading, error } = trpc.home.vehicles.useQuery(undefined, {
    retry: false,
  });

  if (error) {
    return <AccessBlocked message={error.message} next="/support/vehicle" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-12">
        <div className="container">
          <div className="mb-6 flex justify-end">
            <Link href="/support/vehicle/my-reservations">
              <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                <CalendarCheck className="mr-2 h-4 w-4" /> 내 차량예약 현황
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>
          ) : !vehicles?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              현재 예약 가능한 차량이 없습니다.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(vehicles as VehicleRow[]).map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function VehicleReservationApply() {
  const params = useParams<{ id: string }>();
  const vehicleId = Number(params.id);
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    reserverName: "",
    reserverPhone: "",
    department: "",
    purpose: "",
    date: "",
    startTime: "",
    endTime: "",
    passengers: "",
    notes: "",
    agreePrivacy: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [reservedStatus, setReservedStatus] = useState<"pending" | "approved">("pending");

  const { data: memberMe } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: vehicle, isLoading, error } = trpc.home.vehicle.useQuery(
    { id: vehicleId },
    { enabled: !!vehicleId && !Number.isNaN(vehicleId), retry: false }
  );
  const { data: reservationsByDate } = trpc.home.vehicleReservationsByDate.useQuery(
    { vehicleId, date: form.date },
    { enabled: !!vehicleId && !!form.date, retry: false }
  );
  const createReservation = trpc.home.createVehicleReservation.useMutation({
    onSuccess: (data) => {
      setReservedStatus(data.status);
      setSubmitted(true);
    },
    onError: (err) => toast.error(err.message || "차량 예약 신청 중 오류가 발생했습니다."),
  });

  const vehicleRow = vehicle as VehicleRow | null | undefined;
  const unitMinutes = vehicleRow?.slotMinutes ?? 60;
  const allTimeSlots = useMemo(() => {
    if (!vehicleRow) return [];
    return generateReservationTimePoints(vehicleRow.openTime, vehicleRow.closeTime, unitMinutes);
  }, [unitMinutes, vehicleRow]);

  const bookedSlots = useMemo(() => {
    const booked = new Set<string>();
    ((reservationsByDate ?? []) as ReservationByDateRow[]).forEach(row => {
      if (row.status === "cancelled" || row.status === "rejected") return;
      let cur = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      while (cur < end) {
        booked.add(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
        cur += unitMinutes;
      }
    });
    return booked;
  }, [reservationsByDate, unitMinutes]);

  const disabledSlots = useMemo(() => {
    const disabled = new Map<string, string>();
    if (!form.date) return disabled;
    const today = getKstDateKey();
    if (form.date < today) {
      allTimeSlots.forEach(slot => disabled.set(slot, "지난 날짜는 예약할 수 없습니다."));
      return disabled;
    }
    if (form.date === today) {
      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      allTimeSlots.forEach(slot => {
        if (toMinutes(slot) <= currentMinutes) disabled.set(slot, "이미 지난 시간입니다.");
      });
    }
    return disabled;
  }, [allTimeSlots, form.date]);

  function updateForm(key: keyof typeof form, value: string | boolean) {
    setForm(prev => ({
      ...prev,
      [key]: value,
      ...(key === "date" ? { startTime: "", endTime: "" } : {}),
    }));
  }

  function validate() {
    if (!vehicleRow) return "차량 정보를 찾을 수 없습니다.";
    if (!memberMe) return "성도 로그인 후 신청할 수 있습니다.";
    if (!form.reserverName.trim()) return "신청자 이름을 입력해주세요.";
    if (!form.reserverPhone.trim()) return "연락처를 입력해주세요.";
    if (!form.department.trim()) return "소속 부서/단체를 입력해주세요.";
    if (!form.purpose) return "사용 목적을 선택해주세요.";
    if (!form.date) return "사용 날짜를 선택해주세요.";
    if (form.date < getKstDateKey()) return "지난 날짜는 예약할 수 없습니다.";
    if (!form.startTime || !form.endTime) return "사용 시간을 선택해주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (!form.passengers || Number(form.passengers) < 1) return "탑승 인원을 입력해주세요.";
    if (Number(form.passengers) > vehicleRow.capacity) return `최대 탑승 인원(${vehicleRow.capacity}명)을 초과할 수 없습니다.`;
    if (!form.agreePrivacy) return "개인정보 수집·이용에 동의해주세요.";
    let cur = toMinutes(form.startTime);
    const end = toMinutes(form.endTime);
    while (cur < end) {
      const slot = `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
      if (bookedSlots.has(slot)) return "선택하신 시간대에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.";
      if (disabledSlots.has(slot)) return disabledSlots.get(slot) ?? "선택할 수 없는 시간입니다.";
      cur += unitMinutes;
    }
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errorMessage = validate();
    if (errorMessage) {
      toast.error(errorMessage);
      if (errorMessage.includes("로그인")) navigate(getLoginHref(`/support/vehicle/${vehicleId}/apply`));
      return;
    }
    createReservation.mutate({
      vehicleId,
      reserverName: form.reserverName,
      reserverPhone: form.reserverPhone,
      reservationDate: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose,
      department: form.department || undefined,
      passengers: Number(form.passengers),
      notes: form.notes || undefined,
    });
  }

  if (error) {
    return <AccessBlocked message={error.message} next={`/support/vehicle/${vehicleId}/apply`} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!vehicleRow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">차량 정보를 찾을 수 없습니다.</p>
          <Link href="/support/vehicle" className="font-medium text-[#1B5E20] hover:underline">차량 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-10">
        <div className="container max-w-3xl">
          {submitted ? (
            <div className="rounded-xl border border-gray-100 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
                {reservedStatus === "approved" ? <CheckCircle2 className="h-9 w-9" /> : <Clock className="h-9 w-9" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {reservedStatus === "approved" ? "차량 예약이 승인되었습니다" : "차량 예약 신청이 접수되었습니다"}
              </h2>
              <p className="mt-3 text-sm text-gray-500">담당자 확인 후 필요한 경우 연락드리겠습니다.</p>
              <div className="mt-7 flex justify-center gap-2">
                <Link href="/support/vehicle"><Button variant="outline">차량 목록</Button></Link>
                <Link href="/support/vehicle/my-reservations"><Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">내 예약 현황</Button></Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#1B5E20]">
                    <Car className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{vehicleRow.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {vehicleRow.plateNumber ? `${vehicleRow.plateNumber} · ` : ""}{vehicleRow.openTime}~{vehicleRow.closeTime} · 최대 {vehicleRow.capacity}명
                    </p>
                    {vehicleRow.notice && <p className="mt-2 text-sm leading-6 text-[#1B5E20]">{vehicleRow.notice}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-gray-900">신청 정보</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">신청자 이름 *</span>
                    <input value={form.reserverName} onChange={(e) => updateForm("reserverName", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">연락처 *</span>
                    <input value={form.reserverPhone} onChange={(e) => updateForm("reserverPhone", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">소속 부서/단체 *</span>
                    <input value={form.department} onChange={(e) => updateForm("department", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">사용 목적 *</span>
                    <select value={form.purpose} onChange={(e) => updateForm("purpose", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none">
                      <option value="">선택해주세요</option>
                      {PURPOSE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">사용 날짜 *</span>
                    <input type="date" min={getKstDateKey()} value={form.date} onChange={(e) => updateForm("date", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">탑승 인원 *</span>
                    <input type="number" min={1} max={vehicleRow.capacity} value={form.passengers} onChange={(e) => updateForm("passengers", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                  </label>
                </div>

                <div className="mt-5">
                  <Field
                    label="사용 시간"
                    required
                    hint={`${unitMinutes}분 단위 · 시작 시간 클릭 후 종료 시간 클릭`}
                  >
                    {!form.date ? (
                      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-5 text-center text-sm text-gray-400">
                        날짜를 먼저 선택해주세요.
                      </div>
                    ) : allTimeSlots.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                        해당 날짜의 운영 시간 정보가 없습니다.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        {form.startTime && (
                          <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#E8F5E9] px-3 py-2 text-sm font-medium text-[#1B5E20]">
                            <Clock className="h-4 w-4 shrink-0" />
                            {form.endTime
                              ? `선택된 시간: ${form.startTime} ~ ${form.endTime}`
                              : `시작: ${form.startTime} — 종료 시간을 선택하세요`}
                          </div>
                        )}
                        <ReservationTimelinePicker
                          allSlots={allTimeSlots}
                          bookedSlots={bookedSlots}
                          disabledSlots={disabledSlots}
                          startTime={form.startTime}
                          endTime={form.endTime}
                          onSelect={(start, end) => setForm(prev => ({ ...prev, startTime: start, endTime: end }))}
                          slotMinutes={unitMinutes}
                          maxSlots={vehicleRow.maxSlots}
                        />
                      </div>
                    )}
                  </Field>
                </div>

                <label className="mt-5 block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">추가 요청사항</span>
                  <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#1B5E20] focus:outline-none" />
                </label>

                <label className="mt-5 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
                  <input type="checkbox" checked={form.agreePrivacy} onChange={(e) => updateForm("agreePrivacy", e.target.checked)} className="mt-1" />
                  <span>차량예약 처리를 위해 이름, 연락처, 소속, 신청 내용을 수집·이용하는 데 동의합니다.</span>
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Link href="/support/vehicle"><Button type="button" variant="outline">목록으로</Button></Link>
                <Button type="submit" disabled={createReservation.isPending} className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
                  {createReservation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
                  차량예약 신청
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export function MyVehicleReservations() {
  const utils = trpc.useUtils();
  const { data: rows, isLoading, error } = trpc.home.myVehicleReservations.useQuery(undefined, {
    retry: false,
  });
  const cancelReservation = trpc.home.cancelVehicleReservation.useMutation({
    onSuccess: () => {
      utils.home.myVehicleReservations.invalidate();
      toast.success("차량 예약이 취소되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (error) {
    return <AccessBlocked message={error.message} next="/support/vehicle/my-reservations" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-12">
        <div className="container max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>내 차량예약 현황</h2>
              <p className="mt-1 text-sm text-gray-500">신청한 차량예약의 승인 상태를 확인합니다.</p>
            </div>
            <Link href="/support/vehicle"><Button variant="outline">차량 목록</Button></Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>
          ) : !(rows as MyVehicleReservationRow[] | undefined)?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              신청한 차량예약이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {(rows as MyVehicleReservationRow[]).map(row => {
                const status = STATUS_LABELS[row.status];
                const canCancel = row.status === "pending" || row.status === "approved";
                return (
                  <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                        <h3 className="mt-2 font-bold text-gray-900">
                          {row.vehicleName ?? "차량"} · {formatDate(row.reservationDate)}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {row.startTime}~{row.endTime} · {row.purpose} · {row.passengers}명
                        </p>
                        {row.adminComment && <p className="mt-1 text-xs text-red-600">관리자 메모: {row.adminComment}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {canCancel && (
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            disabled={cancelReservation.isPending}
                            onClick={() => {
                              if (!confirm("차량 예약을 취소하시겠습니까?")) return;
                              cancelReservation.mutate({ id: row.id });
                            }}
                          >
                            예약 취소
                          </Button>
                        )}
                        {row.status === "approved" && (
                          <a href="tel:054-270-1000">
                            <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                              <Phone className="mr-1.5 h-4 w-4" /> 문의
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
