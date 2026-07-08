/**
 * 교육/강좌 신청 페이지 (/education/courses)
 * - 공개 강좌 목록 표시
 * - 성도 로그인 후 강좌 신청
 * - 본인 신청 상태 확인 및 대기 신청 취소
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasContentPermission } from "@/lib/contentPermissions";
import SubPageLayout from "@/components/SubPageLayout";
import { getSideLayoutByHref } from "@/lib/menuSideLayout";
import {
  AlertCircle,
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  User,
  Users,
  XCircle,
} from "lucide-react";

type Course = inferRouterOutputs<AppRouter>["home"]["courses"][number];
type MyApplication = inferRouterOutputs<AppRouter>["home"]["myCourseApplications"][number];
type ApplicationField = {
  id: string;
  label: string;
  type?: "text" | "phone" | "email" | "number" | "select";
  required?: boolean;
  options?: string[];
};

type CourseListProps = {
  pageHref?: string;
  title?: string;
  embedded?: boolean;
  showHero?: boolean;
};

const APPLICATION_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "승인 대기", color: "bg-amber-50 text-amber-600 border-amber-200", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "승인 완료", color: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: "거절됨", color: "bg-red-50 text-red-600 border-red-200", icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "취소됨", color: "bg-gray-50 text-gray-500 border-gray-200", icon: <Ban className="w-3.5 h-3.5" /> },
};

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDisplayDate(dateKey: string) {
  return dateKey.replaceAll("-", ".");
}

function getApplyDeadlineInfo(course: Pick<Course, "applyEndDate" | "status">) {
  if (!course.applyEndDate) return null;

  const daysLeft = Math.round(
    (dateKeyToUtcTime(course.applyEndDate) - dateKeyToUtcTime(todayKstDateKey())) / 86_400_000,
  );

  if (course.status !== "open" || daysLeft < 0) {
    return {
      dateLabel: `신청 마감 ${formatDisplayDate(course.applyEndDate)}`,
      ddayLabel: "마감됨",
      color: "bg-gray-100 text-gray-500",
    };
  }

  return {
    dateLabel: `신청 마감 ${formatDisplayDate(course.applyEndDate)}`,
    ddayLabel: daysLeft === 0 ? "오늘 마감" : `D-${daysLeft}`,
    color: daysLeft <= 3 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700",
  };
}

function formatCourseDate(course: Pick<Course, "startDate" | "endDate" | "startTime" | "endTime">) {
  const date = course.startDate && course.endDate && course.startDate !== course.endDate
    ? `${course.startDate} ~ ${course.endDate}`
    : course.startDate || "일정 추후 안내";
  const time = course.startTime && course.endTime
    ? ` ${course.startTime}~${course.endTime}`
    : course.startTime
    ? ` ${course.startTime}`
    : "";
  return `${date}${time}`;
}

function getApplyState(course: Course) {
  const today = todayKstDateKey();
  if (course.status !== "open") return { open: false, label: "신청 마감" };
  if (course.applyStartDate && today < course.applyStartDate) return { open: false, label: "신청 예정" };
  if (course.applyEndDate && today > course.applyEndDate) return { open: false, label: "신청 마감" };
  if (course.capacity > 0 && course.activeCount >= course.capacity) return { open: false, label: "정원 마감" };
  return { open: true, label: "신청 가능" };
}

function parseApplicationFields(value: string | null | undefined): ApplicationField[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((field) => ({
        id: typeof field?.id === "string" ? field.id.trim() : "",
        label: typeof field?.label === "string" ? field.label.trim() : "",
        type: ["text", "phone", "email", "number", "select"].includes(field?.type) ? field.type : "text",
        required: Boolean(field?.required),
        options: Array.isArray(field?.options) ? field.options.map(String).filter(Boolean) : [],
      }))
      .filter((field) => field.id && field.label);
  } catch {
    return [];
  }
}

function CourseHero() {
  return (
    <section className="relative bg-[#1B5E20] py-12 overflow-hidden">
      <div className="container relative z-10 text-white">
        <nav className="flex items-center gap-2 text-xs text-green-200 mb-3 flex-wrap">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">교육/강좌 신청</span>
        </nav>
        <p className="text-sm tracking-widest text-green-200 mb-2 uppercase">Education Registration</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          교육/강좌 신청
        </h1>
        <p className="text-green-100 text-sm md:text-base max-w-2xl">
          교회에서 진행하는 교육과 강좌를 확인하고 성도 계정으로 신청할 수 있습니다.
        </p>
      </div>
    </section>
  );
}

function ApplicationBadge({ application }: { application: MyApplication }) {
  const status = APPLICATION_STATUS[application.status] ?? APPLICATION_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${status.color}`}>
      {status.icon}
      {status.label}
    </span>
  );
}

export default function CourseList({ pageHref, title, embedded = false, showHero = true }: CourseListProps = {}) {
  const utils = trpc.useUtils();
  const { user: adminUser } = useAuth();
  const { data: allMenus } = trpc.home.menus.useQuery();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [form, setForm] = useState({
    applicantName: "",
    applicantPhone: "",
    applicantEmail: "",
    memo: "",
    customAnswers: {} as Record<string, string>,
  });

  const { data: memberMe, isLoading: loadingMember } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isAuthenticated = Boolean(memberMe);
  const canManageCourses = adminUser?.role === "admin" || hasContentPermission(adminUser, "content:courses");
  const currentPageHref = pageHref || "/education/courses";
  const sideLayout = useMemo(
    () => getSideLayoutByHref(allMenus, currentPageHref, title ?? "교육/강좌 신청"),
    [allMenus, currentPageHref, title],
  );
  const adminCourseCreateHref = `/admin_joych_2026?tab=courses&mode=new&pageHref=${encodeURIComponent(currentPageHref)}`;
  const { data: courses = [], isLoading } = trpc.home.courses.useQuery({ pageHref: currentPageHref });
  const { data: myApplications = [], isLoading: loadingApplications } = trpc.home.myCourseApplications.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const applicationByCourseId = useMemo(() => {
    const map = new Map<number, MyApplication>();
    for (const application of myApplications) {
      if (!map.has(application.courseId)) map.set(application.courseId, application);
    }
    return map;
  }, [myApplications]);

  const applyCourse = trpc.home.applyCourse.useMutation({
    onSuccess: () => {
      toast.success("강좌 신청이 접수되었습니다.");
      setSelectedCourseId(null);
      setForm(prev => ({ ...prev, memo: "", customAnswers: {} }));
      utils.home.courses.invalidate();
      utils.home.myCourseApplications.invalidate();
    },
    onError: err => toast.error(err.message || "신청 처리 중 오류가 발생했습니다."),
  });

  const cancelApplication = trpc.home.cancelCourseApplication.useMutation({
    onSuccess: () => {
      toast.success("신청이 취소되었습니다.");
      utils.home.courses.invalidate();
      utils.home.myCourseApplications.invalidate();
    },
    onError: err => toast.error(err.message || "신청 취소에 실패했습니다."),
  });

  function openApplicationForm(courseId: number) {
    if (!isAuthenticated) {
      window.location.href = "/member/login";
      return;
    }
    setSelectedCourseId(courseId);
    setForm({
      applicantName: memberMe?.name ?? "",
      applicantPhone: memberMe?.phone ?? "",
      applicantEmail: memberMe?.email ?? "",
      memo: "",
      customAnswers: {},
    });
  }

  function submitApplication(courseId: number) {
    const course = courses.find(candidate => candidate.id === courseId);
    const fields = parseApplicationFields(course?.applicationFields);
    if (!form.applicantName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    const missingRequiredField = fields.find(field => field.required && !form.customAnswers[field.id]?.trim());
    if (missingRequiredField) {
      toast.error(`${missingRequiredField.label} 항목을 입력해주세요.`);
      return;
    }
    applyCourse.mutate({
      courseId,
      applicantName: form.applicantName,
      applicantPhone: form.applicantPhone || undefined,
      applicantEmail: form.applicantEmail || undefined,
      memo: form.memo || undefined,
      customAnswers: form.customAnswers,
    });
  }

  if (isLoading || loadingMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  const content = (
    <div className="min-h-screen bg-[#F7F7F5]">
      {!embedded && showHero && <CourseHero />}

      <section className={embedded ? "py-2" : "py-10"}>
        <div className="container max-w-5xl mx-auto">
          {canManageCourses && (
            <div className="mb-6 rounded-xl border border-green-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#1B5E20]">관리자 강좌 관리</p>
                  <p className="mt-1 text-sm text-gray-500">현재 강좌 신청 화면에 표시할 강좌를 바로 추가할 수 있습니다.</p>
                </div>
                <Link
                  href={adminCourseCreateHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32]"
                >
                  <Plus className="h-4 w-4" />
                  강좌 추가
                </Link>
              </div>
            </div>
          )}

          {embedded && title && (
            <div className="mb-5 rounded-xl border border-green-100 bg-white p-5">
              <p className="text-sm font-bold text-[#1B5E20]">{title}</p>
              <p className="mt-1 text-sm text-gray-500">강좌를 확인하고 성도 계정으로 신청할 수 있습니다.</p>
            </div>
          )}
          {!isAuthenticated && (
            <div className="mb-6 bg-white border border-gray-100 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#1B5E20] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-800">성도 로그인 후 신청할 수 있습니다</p>
                  <p className="text-sm text-gray-500 mt-0.5">강좌 신청 내역은 본인 계정에서 확인됩니다.</p>
                </div>
              </div>
              <Link
                href="/member/login"
                className="inline-flex items-center justify-center px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors"
              >
                로그인하기
              </Link>
            </div>
          )}

          {isAuthenticated && !loadingApplications && myApplications.length > 0 && (
            <div className="mb-6 bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-gray-800">내 강좌 신청 현황</p>
                  <p className="text-sm text-gray-500">{memberMe?.name}님의 신청 내역입니다.</p>
                </div>
              </div>
              <div className="space-y-2">
                {myApplications.slice(0, 4).map(application => (
                  <div key={application.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{application.courseTitle}</p>
                      <p className="text-xs text-gray-400">{application.courseStartDate ?? "일정 추후 안내"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ApplicationBadge application={application} />
                      {application.status === "pending" && (
                        <button
                          onClick={() => {
                            if (confirm("강좌 신청을 취소하시겠습니까?")) {
                              cancelApplication.mutate({ id: application.id });
                            }
                          }}
                          disabled={cancelApplication.isPending}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {courses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
              <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-500">현재 신청 가능한 강좌가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">새로운 강좌가 열리면 이곳에 안내됩니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map(course => {
                const applyState = getApplyState(course);
                const deadlineInfo = getApplyDeadlineInfo(course);
                const application = applicationByCourseId.get(course.id);
                const selected = selectedCourseId === course.id;
                const canReapply = !application || application.status === "rejected" || application.status === "cancelled";
                const applicationFields = parseApplicationFields(course.applicationFields);
                return (
                  <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className={course.imageUrl ? "md:grid md:grid-cols-[220px_1fr]" : ""}>
                      {course.imageUrl && (
                        <div className="flex justify-center border-b border-gray-100 bg-gray-50 p-4 md:border-b-0 md:border-r">
                          <div className="aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-100">
                            <img
                              src={course.imageUrl}
                              alt={`${course.title} 포스터`}
                              className="h-full w-full object-contain bg-gray-50"
                             loading="lazy"/>
                          </div>
                        </div>
                      )}
                      <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                              {course.title}
                            </h2>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${applyState.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {applyState.label}
                            </span>
                            {application && <ApplicationBadge application={application} />}
                          </div>
                          {course.summary && <p className="text-sm text-gray-500 leading-relaxed mb-4">{course.summary}</p>}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-300 shrink-0" />
                              <span>{formatCourseDate(course)}</span>
                            </div>
                            {course.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-300 shrink-0" />
                                <span>{course.location}</span>
                              </div>
                            )}
                            {course.instructor && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-300 shrink-0" />
                                <span>{course.instructor}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-300 shrink-0" />
                              <span>{course.capacity > 0 ? `${course.activeCount}/${course.capacity}명` : `${course.activeCount}명 신청`}</span>
                            </div>
                          </div>
                          {(course.target || course.fee) && (
                            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                              {course.target && <span className="bg-gray-50 text-gray-500 px-2 py-1 rounded-full">대상: {course.target}</span>}
                              {course.fee && <span className="bg-gray-50 text-gray-500 px-2 py-1 rounded-full">{course.fee}</span>}
                            </div>
                          )}
                        </div>
                        <div className="md:w-36 shrink-0">
                          {deadlineInfo && (
                            <div className="mb-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-center">
                              <p className="text-[11px] font-medium text-gray-500">{deadlineInfo.dateLabel}</p>
                              <p className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${deadlineInfo.color}`}>
                                {deadlineInfo.ddayLabel}
                              </p>
                            </div>
                          )}
                          {application && application.status === "pending" ? (
                            <button
                              onClick={() => {
                                if (confirm("강좌 신청을 취소하시겠습니까?")) {
                                  cancelApplication.mutate({ id: application.id });
                                }
                              }}
                              disabled={cancelApplication.isPending}
                              className="w-full px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              신청 취소
                            </button>
                          ) : (
                            <button
                              onClick={() => openApplicationForm(course.id)}
                              disabled={!applyState.open || !canReapply}
                              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                applyState.open && canReapply
                                  ? "bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {application?.status === "approved" ? "신청 완료" : "신청하기"}
                            </button>
                          )}
                        </div>
                      </div>

                      {(course.description || course.applicationNotice) && (
                        <div className="mt-5 border-t border-gray-50 pt-4 space-y-3">
                          {course.description && <p className="text-sm text-gray-600 leading-7 whitespace-pre-line">{course.description}</p>}
                          {course.applicationNotice && (
                            <div className="rounded-lg bg-[#F1F8E9] px-3 py-2 text-sm text-[#1B5E20] whitespace-pre-line">
                              {course.applicationNotice}
                            </div>
                          )}
                        </div>
                      )}

                      {selected && (
                        <div className="mt-5 border-t border-gray-100 pt-5">
                          <h3 className="text-sm font-bold text-gray-800 mb-3">신청 정보 확인</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">이름 *</label>
                              <input
                                value={form.applicantName}
                                onChange={e => setForm(prev => ({ ...prev, applicantName: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">연락처</label>
                              <input
                                value={form.applicantPhone}
                                onChange={e => setForm(prev => ({ ...prev, applicantPhone: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
                              <input
                                value={form.applicantEmail}
                                onChange={e => setForm(prev => ({ ...prev, applicantEmail: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                              />
                            </div>
                            <div className="md:col-span-3">
                              {applicationFields.length > 0 && (
                                <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {applicationFields.map(field => (
                                    <div key={field.id} className={field.type === "select" ? "" : ""}>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        {field.label}{field.required ? " *" : ""}
                                      </label>
                                      {field.type === "select" ? (
                                        <select
                                          value={form.customAnswers[field.id] ?? ""}
                                          onChange={e => setForm(prev => ({
                                            ...prev,
                                            customAnswers: { ...prev.customAnswers, [field.id]: e.target.value },
                                          }))}
                                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                                        >
                                          <option value="">선택</option>
                                          {(field.options ?? []).map(option => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                                          value={form.customAnswers[field.id] ?? ""}
                                          onChange={e => setForm(prev => ({
                                            ...prev,
                                            customAnswers: { ...prev.customAnswers, [field.id]: e.target.value },
                                          }))}
                                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <label className="block text-xs font-medium text-gray-500 mb-1">남길 말</label>
                              <textarea
                                value={form.memo}
                                onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
                                rows={3}
                                placeholder="필요한 요청사항이 있다면 적어주세요."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <button
                              onClick={() => setSelectedCourseId(null)}
                              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => submitApplication(course.id)}
                              disabled={applyCourse.isPending}
                              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] transition-colors disabled:opacity-50"
                            >
                              {applyCourse.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                              신청 접수
                            </button>
                          </div>
                        </div>
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

  if (!embedded && sideLayout) {
    return (
      <SubPageLayout
        pageTitle={sideLayout.pageTitle}
        parentLabel={sideLayout.parentLabel}
        sideMenuItems={sideLayout.sideMenuItems}
      >
        {content}
      </SubPageLayout>
    );
  }

  return content;
}
