/**
 * 시설 사용 예약 — 신청 폼 페이지 (/facility/:id/apply)
 * 규칙: 타입 안전, 나중에 API POST로 교체 가능한 구조, 불필요한 상태 없이 최소화
 */

import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { MOCK_FACILITIES } from "@/lib/facilityData";
import { toast } from "sonner";

// ── 폼 데이터 타입 ─────────────────────────────────────────
interface ApplyFormData {
  name: string;
  phone: string;
  department: string;
  purpose: string;
  date: string;
  startTime: string;
  endTime: string;
  headcount: string;
  requests: string;
  agreePrivacy: boolean;
}

const INITIAL_FORM: ApplyFormData = {
  name: "",
  phone: "",
  department: "",
  purpose: "",
  date: "",
  startTime: "",
  endTime: "",
  headcount: "",
  requests: "",
  agreePrivacy: false,
};

const TIME_OPTIONS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

const PURPOSE_OPTIONS = [
  "주일 예배", "수요 예배", "새벽 기도", "소그룹 모임", "부서 행사",
  "찬양 연습", "강의/세미나", "회의", "바자회/전시", "외부 단체 행사", "기타",
];

// ── 입력 필드 공통 컴포넌트 ────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── 완료 화면 ──────────────────────────────────────────────
function SuccessScreen({ facilityName, onReset }: { facilityName: string; onReset: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-5">
        <i className="fas fa-check text-[#1B5E20] text-3xl"></i>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
        신청이 접수되었습니다
      </h2>
      <p className="text-gray-500 text-sm leading-relaxed mb-2">
        <span className="font-medium text-gray-700">{facilityName}</span> 사용 신청이 정상적으로 접수되었습니다.
      </p>
      <p className="text-gray-500 text-sm mb-8">
        담당자 확인 후 입력하신 연락처로 안내드리겠습니다. (평일 기준 1~2일 소요)
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/facility">
          <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            시설 목록으로
          </button>
        </Link>
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-lg bg-[#1B5E20] text-white text-sm hover:bg-[#2E7D32] transition-colors"
        >
          추가 신청하기
        </button>
      </div>
    </div>
  );
}

// ── 메인 신청 폼 페이지 ────────────────────────────────────
export default function FacilityApply() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const facility = MOCK_FACILITIES.find((f) => f.id === params.id);

  const [form, setForm] = useState<ApplyFormData>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">시설 정보를 찾을 수 없습니다.</p>
          <Link href="/facility" className="text-[#1B5E20] font-medium hover:underline">
            시설 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "신청자 이름을 입력해 주세요.";
    if (!form.phone.trim()) return "연락처를 입력해 주세요.";
    if (!form.department.trim()) return "소속 부서/단체를 입력해 주세요.";
    if (!form.purpose) return "사용 목적을 선택해 주세요.";
    if (!form.date) return "사용 날짜를 선택해 주세요.";
    if (!form.startTime) return "시작 시간을 선택해 주세요.";
    if (!form.endTime) return "종료 시간을 선택해 주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (!form.headcount || Number(form.headcount) < 1) return "예상 인원을 입력해 주세요.";
    if (Number(form.headcount) > (facility?.capacity ?? 0)) return `최대 수용 인원(${facility?.capacity ?? 0}명)을 초과합니다.`;
    if (!form.agreePrivacy) return "개인정보 수집·이용에 동의해 주세요.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setLoading(true);
    // TODO: 백엔드 연결 시 여기에 API POST 요청 추가
    // await api.post('/reservations', { facilityId: facility.id, ...form });
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  }

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-colors bg-white";

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* 상단 배너 */}
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="flex items-center gap-2 text-xs text-green-200 mb-3">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <i className="fas fa-chevron-right text-[10px]"></i>
            <Link href="/facility" className="hover:text-white transition-colors">시설 사용 예약</Link>
            <i className="fas fa-chevron-right text-[10px]"></i>
            <Link href={`/facility/${facility.id}`} className="hover:text-white transition-colors">{facility.name}</Link>
            <i className="fas fa-chevron-right text-[10px]"></i>
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
              <SuccessScreen facilityName={facility.name} onReset={() => setSubmitted(false)} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* 선택된 시설 요약 */}
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6 flex items-center gap-4">
                <img
                  src={facility.imageUrl}
                  alt={facility.name}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{facility.floor}</p>
                  <p className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {facility.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    최대 {facility.capacity}명 · {facility.availableHours}
                  </p>
                </div>
                <Link href={`/facility/${facility.id}`} className="ml-auto text-xs text-gray-400 hover:text-[#1B5E20] transition-colors shrink-0">
                  <i className="fas fa-arrow-left mr-1"></i>변경
                </Link>
              </div>

              {/* 신청 정보 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-5">
                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  신청자 정보
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="신청자 이름" required>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="홍길동"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="연락처" required>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="010-0000-0000"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="소속 부서/단체" required>
                  <input
                    type="text"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="예: 청년부, 찬양팀, 외부단체명"
                    className={inputClass}
                  />
                </Field>

                <Field label="사용 목적" required>
                  <select name="purpose" value={form.purpose} onChange={handleChange} className={inputClass}>
                    <option value="">선택해 주세요</option>
                    {PURPOSE_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>

                <h2 className="font-bold text-gray-900 text-base pb-3 border-b border-gray-100 pt-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  사용 일정
                </h2>

                <Field label="사용 날짜" required>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    min={new Date().toISOString().split("T")[0]}
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="시작 시간" required>
                    <select name="startTime" value={form.startTime} onChange={handleChange} className={inputClass}>
                      <option value="">선택</option>
                      {TIME_OPTIONS.slice(0, -1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="종료 시간" required>
                    <select name="endTime" value={form.endTime} onChange={handleChange} className={inputClass}>
                      <option value="">선택</option>
                      {TIME_OPTIONS.slice(1).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="예상 인원" required>
                  <input
                    type="number"
                    name="headcount"
                    value={form.headcount}
                    onChange={handleChange}
                    placeholder={`1 ~ ${facility.capacity}`}
                    min={1}
                    max={facility.capacity}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">최대 수용 인원: {facility.capacity.toLocaleString()}명</p>
                </Field>

                <Field label="추가 요청사항">
                  <textarea
                    name="requests"
                    value={form.requests}
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
                  disabled={loading}
                  className="w-full bg-[#1B5E20] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#2E7D32] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> 신청 중...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-calendar-check"></i> 예약 신청하기
                    </>
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
