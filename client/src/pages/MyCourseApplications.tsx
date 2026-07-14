import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import {
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  User,
  XCircle,
} from "lucide-react";

type CourseApplication = inferRouterOutputs<AppRouter>["home"]["myCourseApplications"][number];
type CoursePeriod = "all" | "upcoming" | "ongoing" | "past";

const copy = {
  home: "\uD648",
  all: "\uC804\uCCB4",
  upcoming: "\uC9C4\uD589 \uC608\uC815",
  ongoing: "\uC9C4\uD589 \uC911",
  past: "\uC9C0\uB09C \uAC15\uC88C",
  pending: "\uC2B9\uC778 \uB300\uAE30",
  approved: "\uC2B9\uC778 \uC644\uB8CC",
  rejected: "\uAC70\uC808",
  cancelled: "\uCDE8\uC18C\uB428",
  pageTitle: "\uB0B4 \uAC15\uC88C \uD604\uD669",
  courseApplication: "\uAC15\uC88C \uC2E0\uCCAD",
  scheduleLater: "\uC77C\uC815 \uCD94\uD6C4 \uC548\uB0B4",
  cancel: "\uC2E0\uCCAD \uCDE8\uC18C",
  noApplications: "\uD574\uB2F9 \uAE30\uAC04\uC5D0 \uAC15\uC88C \uC2E0\uCCAD \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  cancelConfirm: "\uAC15\uC88C \uC2E0\uCCAD\uC744 \uCDE8\uC18C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?",
  cancelSuccess: "\uAC15\uC88C \uC2E0\uCCAD\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
  cancelError: "\uC2E0\uCCAD \uCDE8\uC18C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  memberOnly: "\uB0B4 \uAC15\uC88C \uD604\uD669\uC740 \uC131\uB3C4 \uB85C\uADF8\uC778 \uD6C4 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  adminNotice: "\uAD00\uB9AC\uC790 \uC548\uB0B4",
  untitled: "\uC81C\uBAA9 \uC5C6\uB294 \uAC15\uC88C",
};

const periods: { value: CoursePeriod; label: string }[] = [
  { value: "all", label: copy.all },
  { value: "upcoming", label: copy.upcoming },
  { value: "ongoing", label: copy.ongoing },
  { value: "past", label: copy.past },
];

const statusConfig = {
  pending: { label: copy.pending, color: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  approved: { label: copy.approved, color: "border-green-200 bg-green-50 text-green-700", icon: CheckCircle2 },
  rejected: { label: copy.rejected, color: "border-red-200 bg-red-50 text-red-600", icon: XCircle },
  cancelled: { label: copy.cancelled, color: "border-gray-200 bg-gray-50 text-gray-500", icon: Ban },
};

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDate(date?: string | null) {
  return date ? date.replaceAll("-", ".") : copy.scheduleLater;
}

function getCoursePeriod(application: CourseApplication): Exclude<CoursePeriod, "all"> {
  const today = todayKstDateKey();
  const startDate = application.courseStartDate;
  const endDate = application.courseEndDate || startDate;

  if (!startDate) return "ongoing";
  if (startDate > today) return "upcoming";
  if (endDate && endDate < today) return "past";
  return "ongoing";
}

function scheduleFor(application: CourseApplication) {
  const dates = application.courseStartDate && application.courseEndDate && application.courseStartDate !== application.courseEndDate
    ? `${formatDate(application.courseStartDate)} ~ ${formatDate(application.courseEndDate)}`
    : formatDate(application.courseStartDate);
  const times = application.courseStartTime
    ? ` ${application.courseStartTime}${application.courseEndTime ? `~${application.courseEndTime}` : ""}`
    : "";
  return `${dates}${times}`;
}

function StatusBadge({ application }: { application: CourseApplication }) {
  const config = statusConfig[application.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

export default function MyCourseApplications() {
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<CoursePeriod>("all");
  const { data: member, isLoading: loadingMember } = trpc.members.me.useQuery(undefined, { retry: false });
  const isAuthenticated = Boolean(member);
  const { data: applications = [], isLoading } = trpc.home.myCourseApplications.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const cancelApplication = trpc.home.cancelCourseApplication.useMutation({
    onSuccess: () => {
      toast.success(copy.cancelSuccess);
      utils.home.myCourseApplications.invalidate();
      utils.home.courses.invalidate();
    },
    onError: (error) => toast.error(error.message || copy.cancelError),
  });

  const counts = useMemo(() => ({
    all: applications.length,
    upcoming: applications.filter((item) => getCoursePeriod(item) === "upcoming").length,
    ongoing: applications.filter((item) => getCoursePeriod(item) === "ongoing").length,
    past: applications.filter((item) => getCoursePeriod(item) === "past").length,
  }), [applications]);
  const visibleApplications = useMemo(
    () => applications.filter((item) => period === "all" || getCoursePeriod(item) === period),
    [applications, period],
  );

  if (loadingMember) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <MemberOnlyContentNotice resourceLabel={copy.pageTitle} description={copy.memberOnly} fallbackPath="/education/my-courses" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs text-green-200">
            <Link href="/" className="transition-colors hover:text-white">{copy.home}</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/education/courses" className="transition-colors hover:text-white">{copy.courseApplication}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{copy.pageTitle}</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl" style={{ fontFamily: "'Noto Serif KR', serif" }}>{copy.pageTitle}</h1>
              <p className="mt-1 text-sm text-green-200">{member?.name} {copy.courseApplication}</p>
            </div>
            <Link href="/education/courses" className="rounded-lg border border-green-200 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10">
              {copy.courseApplication}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-10">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            {periods.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${period === option.value ? "bg-[#1B5E20] text-white" : "bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-[#1B5E20]"}`}
              >
                {option.label} <span className="ml-1 text-xs opacity-80">{counts[option.value]}</span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-20 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#1B5E20]" /></div>
          ) : visibleApplications.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-20 text-center shadow-sm">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-200" />
              <p className="text-base font-medium text-gray-500">{copy.noApplications}</p>
              <Link href="/education/courses" className="mt-5 inline-flex rounded-lg bg-[#1B5E20] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E7D32]">{copy.courseApplication}</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleApplications.map((application) => {
                const coursePeriod = getCoursePeriod(application);
                return (
                  <article key={application.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-900">{application.courseTitle || copy.untitled}</h2>
                          <StatusBadge application={application} />
                          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-[#1B5E20]">{periods.find((option) => option.value === coursePeriod)?.label}</span>
                        </div>
                        <div className="grid gap-x-5 gap-y-2 text-sm text-gray-600 sm:grid-cols-2">
                          <p className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-gray-300" />{scheduleFor(application)}</p>
                          {application.courseLocation && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gray-300" />{application.courseLocation}</p>}
                          {application.courseInstructor && <p className="flex items-center gap-2"><User className="h-4 w-4 shrink-0 text-gray-300" />{application.courseInstructor}</p>}
                        </div>
                        {application.adminComment && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{copy.adminNotice}: {application.adminComment}</p>}
                      </div>
                      {application.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(copy.cancelConfirm)) cancelApplication.mutate({ id: application.id }); }}
                          disabled={cancelApplication.isPending}
                          className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {copy.cancel}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
