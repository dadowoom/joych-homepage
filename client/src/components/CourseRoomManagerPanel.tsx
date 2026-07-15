import { useState } from "react";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getKstDateKey } from "@/lib/facilityReservationTime";

type Props = {
  pageHref: string;
  roomLabel: string;
};

const EMPTY_FORM = {
  title: "",
  summary: "",
  instructor: "",
  location: "",
  target: "",
  capacity: "0",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  applyStartDate: "",
  applyEndDate: "",
  status: "open" as const,
  audience: "member" as const,
};

type CourseRoomForm = Omit<typeof EMPTY_FORM, "status" | "audience"> & {
  status: "draft" | "open" | "closed" | "cancelled" | "archived";
  audience: "all" | "member";
};

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export default function CourseRoomManagerPanel({ pageHref, roomLabel }: Props) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingApplicationId, setEditingApplicationId] = useState<number | null>(null);
  const [applicationForm, setApplicationForm] = useState({ applicantName: "", applicantPhone: "", applicantEmail: "", memo: "" });
  const [form, setForm] = useState<CourseRoomForm>(EMPTY_FORM);
  const courseStartMin = getKstDateKey();
  const courseEndMin = form.startDate > courseStartMin ? form.startDate : courseStartMin;
  const { data: access, isLoading: checkingAccess } = trpc.courseManagement.access.useQuery({ pageHref });
  const enabled = Boolean(access?.canManage);
  const { data: courses = [], isLoading: loadingCourses } = trpc.courseManagement.courses.useQuery(
    { pageHref }, { enabled },
  );
  const { data: applications = [], isLoading: loadingApplications } = trpc.courseManagement.applications.useQuery(
    { pageHref }, { enabled: enabled && open },
  );

  const refresh = () => {
    utils.courseManagement.courses.invalidate({ pageHref });
    utils.courseManagement.applications.invalidate({ pageHref });
    utils.home.courses.invalidate({ pageHref });
  };
  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };
  const createCourse = trpc.courseManagement.create.useMutation({
    onSuccess: () => { refresh(); resetForm(); toast.success("강좌가 등록됐습니다."); },
    onError: error => toast.error(error.message || "강좌 등록에 실패했습니다."),
  });
  const updateCourse = trpc.courseManagement.update.useMutation({
    onSuccess: () => { refresh(); resetForm(); toast.success("강좌가 수정됐습니다."); },
    onError: error => toast.error(error.message || "강좌 수정에 실패했습니다."),
  });
  const deleteCourse = trpc.courseManagement.delete.useMutation({
    onSuccess: () => { refresh(); toast.success("강좌가 삭제됐습니다."); },
    onError: error => toast.error(error.message || "강좌 삭제에 실패했습니다."),
  });
  const updateApplication = trpc.courseManagement.updateApplicationStatus.useMutation({
    onSuccess: () => { refresh(); toast.success("신청 상태가 변경됐습니다."); },
    onError: error => toast.error(error.message || "신청 상태 변경에 실패했습니다."),
  });
  const updateApplicationDetails = trpc.courseManagement.updateApplicationDetails.useMutation({
    onSuccess: () => {
      refresh();
      setEditingApplicationId(null);
      toast.success("신청자 정보가 수정됐습니다.");
    },
    onError: error => toast.error(error.message || "신청자 정보 수정에 실패했습니다."),
  });

  if (checkingAccess || !enabled) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("강좌명을 입력해주세요.");
      return;
    }
    const hasPastDate = [form.startDate, form.endDate, form.applyStartDate, form.applyEndDate]
      .some((date) => Boolean(date) && date < courseStartMin);
    if (hasPastDate) {
      toast.error("강좌 및 신청 일정은 오늘 또는 이후 날짜로 선택해주세요.");
      return;
    }
    const course = {
      title: form.title.trim(),
      summary: nullable(form.summary),
      description: null,
      instructor: nullable(form.instructor),
      location: nullable(form.location),
      target: nullable(form.target),
      fee: null,
      capacity: Math.max(0, Number(form.capacity) || 0),
      startDate: nullable(form.startDate),
      endDate: nullable(form.endDate),
      startTime: nullable(form.startTime),
      endTime: nullable(form.endTime),
      applyStartDate: nullable(form.applyStartDate),
      applyEndDate: nullable(form.applyEndDate),
      status: form.status,
      isVisible: true,
      audience: form.audience,
      applicationNotice: null,
      sortOrder: 0,
    };
    if (editingId) updateCourse.mutate({ id: editingId, course });
    else createCourse.mutate({ pageHref, course });
  };

  const startEdit = (course: typeof courses[number]) => {
    setEditingId(course.id);
    setForm({
      title: course.title,
      summary: course.summary ?? "",
      instructor: course.instructor ?? "",
      location: course.location ?? "",
      target: course.target ?? "",
      capacity: String(course.capacity ?? 0),
      startDate: course.startDate ?? "",
      endDate: course.endDate ?? "",
      startTime: course.startTime ?? "",
      endTime: course.endTime ?? "",
      applyStartDate: course.applyStartDate ?? "",
      applyEndDate: course.applyEndDate ?? "",
      status: course.status,
      audience: course.audience,
    });
  };

  const startEditApplication = (application: typeof applications[number]) => {
    setEditingApplicationId(application.id);
    setApplicationForm({
      applicantName: application.applicantName,
      applicantPhone: application.applicantPhone ?? "",
      applicantEmail: application.applicantEmail ?? "",
      memo: application.memo ?? "",
    });
  };

  return (
    <section className="mb-6 rounded-xl border border-green-200 bg-green-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#1B5E20]">{access?.scope === "all" ? "관리자 강좌 관리" : "담당 강좌 관리"}</p>
          <p className="mt-1 text-xs text-gray-500">{roomLabel} 강좌와 신청자만 관리할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-3 py-2 text-xs font-bold text-white hover:bg-[#2E7D32]"
        >
          <Users className="h-4 w-4" /> 강좌 관리 <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-green-100 bg-white p-4 sm:p-5">
          <form onSubmit={submit} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-800">{editingId ? "강좌 수정" : "새 강좌 등록"}</p>
              {editingId && <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-800">수정 취소</button>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">강좌명<input required value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">한 줄 소개<input value={form.summary} onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">강사/담당<input value={form.instructor} onChange={e => setForm(prev => ({ ...prev, instructor: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">장소<input value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">시작일<input type="date" min={courseStartMin} value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value, endDate: prev.endDate && prev.endDate < e.target.value ? e.target.value : prev.endDate }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">종료일<input type="date" min={courseEndMin} value={form.endDate} onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">시작 시간<input type="time" value={form.startTime} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">종료 시간<input type="time" value={form.endTime} onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">정원<input type="number" min="0" value={form.capacity} onChange={e => setForm(prev => ({ ...prev, capacity: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-gray-600">공개 대상<select value={form.audience} onChange={e => setForm(prev => ({ ...prev, audience: e.target.value as "all" | "member" }))} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="member">성도</option><option value="all">전체 공개</option></select></label>
            </div>
            <div className="mt-3 flex justify-end gap-2"><button disabled={createCourse.isPending || updateCourse.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{editingId ? "수정 저장" : "강좌 등록"}</button></div>
          </form>

          <div className="mt-5">
            <p className="mb-2 text-sm font-bold text-gray-800">이 강좌방의 강좌</p>
            {loadingCourses ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#1B5E20]" /></div> : courses.length === 0 ? <p className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">등록된 강좌가 없습니다.</p> : <div className="space-y-2">{courses.map(course => <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-3"><div><p className="text-sm font-bold text-gray-800">{course.title}</p><p className="mt-0.5 text-xs text-gray-500">{course.startDate || "일정 미정"}{course.startTime ? ` · ${course.startTime}` : ""} · 신청 {course.pendingCount}건</p></div><div className="flex gap-1.5"><button type="button" onClick={() => startEdit(course)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-600"><Pencil className="h-3.5 w-3.5" />수정</button><button type="button" onClick={() => { if (window.confirm("강좌와 신청 내역을 삭제할까요?")) deleteCourse.mutate({ id: course.id }); }} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1.5 text-xs text-red-600"><Trash2 className="h-3.5 w-3.5" />삭제</button></div></div>)}</div>}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-bold text-gray-800">신청자 관리</p>
            {loadingApplications ? (
              <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#1B5E20]" /></div>
            ) : applications.filter(application => application.status === "pending" || application.status === "approved").length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">관리할 신청 내역이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {applications.filter(application => application.status === "pending" || application.status === "approved").map(application => {
                  const isEditing = editingApplicationId === application.id;
                  return (
                    <div key={application.id} className={`rounded-lg border px-3 py-3 ${application.status === "pending" ? "border-amber-100 bg-amber-50/50" : "border-green-100 bg-green-50/40"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{application.courseTitle} · {application.applicantName}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{application.applicantPhone || "연락처 미입력"}{application.applicantEmail ? ` · ${application.applicantEmail}` : ""}</p>
                          {application.memo && <p className="mt-1 text-xs text-gray-500">{application.memo}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {application.status === "pending" ? <>
                            <button type="button" onClick={() => updateApplication.mutate({ id: application.id, status: "approved" })} disabled={updateApplication.isPending} className="inline-flex items-center gap-1 rounded bg-green-700 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />승인</button>
                            <button type="button" onClick={() => updateApplication.mutate({ id: application.id, status: "rejected" })} disabled={updateApplication.isPending} className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"><X className="h-3.5 w-3.5" />거절</button>
                          </> : <>
                            <button type="button" onClick={() => startEditApplication(application)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"><Pencil className="h-3.5 w-3.5" />수정</button>
                            <button type="button" onClick={() => { if (window.confirm("승인된 강좌 신청을 취소할까요?")) updateApplication.mutate({ id: application.id, status: "cancelled" }); }} disabled={updateApplication.isPending} className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 disabled:opacity-50"><X className="h-3.5 w-3.5" />신청 취소</button>
                          </>}
                        </div>
                      </div>
                      {isEditing && (
                        <div className="mt-3 grid gap-2 border-t border-green-100 pt-3 sm:grid-cols-2">
                          <input value={applicationForm.applicantName} onChange={e => setApplicationForm(prev => ({ ...prev, applicantName: e.target.value }))} placeholder="이름" className="rounded border border-gray-200 px-2.5 py-2 text-sm" />
                          <input value={applicationForm.applicantPhone} onChange={e => setApplicationForm(prev => ({ ...prev, applicantPhone: e.target.value }))} placeholder="연락처" className="rounded border border-gray-200 px-2.5 py-2 text-sm" />
                          <input value={applicationForm.applicantEmail} onChange={e => setApplicationForm(prev => ({ ...prev, applicantEmail: e.target.value }))} placeholder="이메일" className="rounded border border-gray-200 px-2.5 py-2 text-sm" />
                          <input value={applicationForm.memo} onChange={e => setApplicationForm(prev => ({ ...prev, memo: e.target.value }))} placeholder="관리 메모" className="rounded border border-gray-200 px-2.5 py-2 text-sm" />
                          <div className="flex gap-2 sm:col-span-2">
                            <button type="button" onClick={() => updateApplicationDetails.mutate({ id: application.id, application: { applicantName: applicationForm.applicantName.trim(), applicantPhone: nullable(applicationForm.applicantPhone), applicantEmail: nullable(applicationForm.applicantEmail), memo: nullable(applicationForm.memo) } })} disabled={!applicationForm.applicantName.trim() || updateApplicationDetails.isPending} className="rounded bg-[#1B5E20] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">저장</button>
                            <button type="button" onClick={() => setEditingApplicationId(null)} className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-600">취소</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
