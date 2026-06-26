/**
 * AdminCoursesTab.tsx
 * 관리자 강좌/신청자 관리 탭
 * - 강좌 등록/수정/삭제
 * - 강좌별 신청자 확인
 * - 신청 승인/거절/취소 상태 처리
 */

import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Ban,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";

type Course = inferRouterOutputs<AppRouter>["cms"]["courses"]["list"][number];
type CourseApplication = inferRouterOutputs<AppRouter>["cms"]["courses"]["applications"][number];
type CourseStatus = Course["status"];
type ApplicationStatus = CourseApplication["status"];

const STATUS_LABELS: Record<CourseStatus, { label: string; color: string }> = {
  draft: { label: "준비중", color: "bg-gray-100 text-gray-600" },
  open: { label: "신청중", color: "bg-green-100 text-green-700" },
  closed: { label: "마감", color: "bg-amber-100 text-amber-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
  archived: { label: "보관", color: "bg-slate-100 text-slate-500" },
};

const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "승인 대기", color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "승인 완료", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "거절", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500", icon: <Ban className="w-3 h-3" /> },
};

const EMPTY_FORM = {
  title: "",
  summary: "",
  imageUrl: "",
  description: "",
  instructor: "",
  location: "",
  target: "",
  fee: "",
  capacity: 0,
  facilityId: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  applyStartDate: "",
  applyEndDate: "",
  status: "draft" as CourseStatus,
  isVisible: true,
  applicationNotice: "",
  sortOrder: 0,
};

const COURSE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const MAX_COURSE_IMAGE_BYTES = 10 * 1024 * 1024;

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function formatDateRange(course: Pick<Course, "startDate" | "endDate" | "startTime" | "endTime">) {
  const date = course.startDate && course.endDate && course.startDate !== course.endDate
    ? `${course.startDate} ~ ${course.endDate}`
    : course.startDate || "일정 미정";
  const time = course.startTime && course.endTime
    ? ` ${course.startTime}~${course.endTime}`
    : course.startTime
    ? ` ${course.startTime}`
    : "";
  return `${date}${time}`;
}

function formatCreatedAt(value: Date | string | number) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCoursesTab() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CourseStatus>("all");
  const [applicationFilter, setApplicationFilter] = useState<"all" | ApplicationStatus>("all");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingCourseImage, setUploadingCourseImage] = useState(false);

  const { data: courses = [], isLoading } = trpc.cms.courses.list.useQuery();
  const { data: facilities = [] } = trpc.home.facilities.useQuery();
  const { data: applications = [], isLoading: loadingApplications } = trpc.cms.courses.applications.useQuery(
    { courseId: expandedCourseId ?? undefined },
    { enabled: expandedCourseId !== null, refetchInterval: 30000 },
  );
  const uploadCourseImage = trpc.cms.upload.courseImage.useMutation();

  const createCourse = trpc.cms.courses.create.useMutation({
    onSuccess: () => {
      utils.cms.courses.list.invalidate();
      utils.home.courses.invalidate();
      resetForm();
      toast.success("강좌가 등록됐습니다.");
    },
    onError: err => toast.error(err.message || "강좌 등록에 실패했습니다."),
  });

  const updateCourse = trpc.cms.courses.update.useMutation({
    onSuccess: () => {
      utils.cms.courses.list.invalidate();
      utils.home.courses.invalidate();
      resetForm();
      toast.success("강좌가 수정됐습니다.");
    },
    onError: err => toast.error(err.message || "강좌 수정에 실패했습니다."),
  });

  const deleteCourse = trpc.cms.courses.delete.useMutation({
    onSuccess: () => {
      utils.cms.courses.list.invalidate();
      utils.cms.courses.applications.invalidate();
      utils.home.courses.invalidate();
      toast.success("강좌가 삭제됐습니다.");
    },
    onError: err => toast.error(err.message || "강좌 삭제에 실패했습니다."),
  });

  const updateApplication = trpc.cms.courses.updateApplicationStatus.useMutation({
    onSuccess: () => {
      utils.cms.courses.list.invalidate();
      utils.cms.courses.applications.invalidate();
      utils.home.courses.invalidate();
      setReviewingId(null);
      setReviewComment("");
      toast.success("신청 상태가 변경됐습니다.");
    },
    onError: err => toast.error(err.message || "상태 변경에 실패했습니다."),
  });

  const filteredCourses = useMemo(() => {
    return courses.filter(course => statusFilter === "all" || course.status === statusFilter);
  }, [courses, statusFilter]);

  const filteredApplications = useMemo(() => {
    return applications.filter(application =>
      applicationFilter === "all" || application.status === applicationFilter
    );
  }, [applications, applicationFilter]);

  const stats = useMemo(() => ({
    total: courses.length,
    open: courses.filter(course => course.status === "open").length,
    pending: courses.reduce((sum, course) => sum + course.pendingCount, 0),
    approved: courses.reduce((sum, course) => sum + course.approvedCount, 0),
  }), [courses]);

  const facilityById = useMemo(() => {
    return new Map(facilities.map(facility => [facility.id, facility]));
  }, [facilities]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(course: Course) {
    setEditingId(course.id);
    setShowForm(true);
    setForm({
      title: course.title,
      summary: course.summary ?? "",
      imageUrl: course.imageUrl ?? "",
      description: course.description ?? "",
      instructor: course.instructor ?? "",
      location: course.location ?? "",
      target: course.target ?? "",
      fee: course.fee ?? "",
      capacity: course.capacity,
      facilityId: course.facilityId ? String(course.facilityId) : "",
      startDate: course.startDate ?? "",
      endDate: course.endDate ?? "",
      startTime: course.startTime ?? "",
      endTime: course.endTime ?? "",
      applyStartDate: course.applyStartDate ?? "",
      applyEndDate: course.applyEndDate ?? "",
      status: course.status,
      isVisible: course.isVisible,
      applicationNotice: course.applicationNotice ?? "",
      sortOrder: course.sortOrder,
    });
  }

  function buildPayload() {
    return {
      title: form.title,
      summary: form.summary,
      imageUrl: emptyToNull(form.imageUrl),
      description: form.description,
      instructor: form.instructor,
      location: form.location,
      target: form.target,
      fee: form.fee,
      capacity: Number(form.capacity) || 0,
      facilityId: form.facilityId ? Number(form.facilityId) : null,
      startDate: emptyToNull(form.startDate),
      endDate: emptyToNull(form.endDate),
      startTime: emptyToNull(form.startTime),
      endTime: emptyToNull(form.endTime),
      applyStartDate: emptyToNull(form.applyStartDate),
      applyEndDate: emptyToNull(form.applyEndDate),
      status: form.status,
      isVisible: form.isVisible,
      applicationNotice: form.applicationNotice,
      sortOrder: Number(form.sortOrder) || 0,
    };
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast.error("강좌명을 입력해주세요.");
      return;
    }
    const payload = buildPayload();
    if (editingId) {
      updateCourse.mutate({ id: editingId, ...payload });
    } else {
      createCourse.mutate(payload);
    }
  }

  async function handleCourseImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!COURSE_IMAGE_MIME_TYPES.has(file.type)) {
      toast.error("jpg, png, webp, gif 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_COURSE_IMAGE_BYTES) {
      toast.error("대표 사진은 10MB 이하로 업로드해주세요.");
      return;
    }

    try {
      setUploadingCourseImage(true);
      const base64 = await readFileAsBase64(file);
      const result = await uploadCourseImage.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type,
      });
      setForm(prev => ({ ...prev, imageUrl: result.url }));
      toast.success("강좌 대표 사진이 업로드되었습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "대표 사진 업로드에 실패했습니다.";
      toast.error(message);
    } finally {
      setUploadingCourseImage(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#1B5E20]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">강좌 관리</h3>
          <p className="text-sm text-gray-500">교육/강좌를 등록하고 성도 신청 내역을 관리합니다.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors"
          >
            <Plus className="w-4 h-4" /> 강좌 등록
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 강좌", value: stats.total, color: "bg-gray-50 border-gray-200 text-gray-700" },
          { label: "신청중", value: stats.open, color: "bg-green-50 border-green-200 text-green-700" },
          { label: "승인 대기", value: stats.pending, color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "승인 완료", value: stats.approved, color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border p-3 text-center ${item.color}`}>
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-xs mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800">{editingId ? "강좌 수정" : "새 강좌 등록"}</h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">강좌명 *</label>
              <input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="예: 조이아카데미 문화강좌"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">상태</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as CourseStatus }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              >
                <option value="draft">준비중</option>
                <option value="open">신청중</option>
                <option value="closed">마감</option>
                <option value="cancelled">취소</option>
                <option value="archived">보관</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">한 줄 소개</label>
              <input
                value={form.summary}
                onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="목록에 보일 짧은 안내를 입력하세요."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-48 h-32 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="강좌 대표 사진" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-300">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                      <p className="text-xs">대표 사진</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-gray-600">대표 사진</label>
                    {form.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, imageUrl: "" }))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        사진 제거
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] cursor-pointer transition-colors">
                      {uploadingCourseImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      사진 업로드
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleCourseImageUpload}
                        disabled={uploadingCourseImage}
                        className="hidden"
                      />
                    </label>
                    <input
                      value={form.imageUrl}
                      onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="이미지 URL 직접 입력"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">강좌 목록과 상세 카드에 표시됩니다. jpg, png, webp, gif / 최대 10MB</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">강사/담당자</label>
              <input
                value={form.instructor}
                onChange={e => setForm(prev => ({ ...prev, instructor: e.target.value }))}
                placeholder="예: 김OO 목사"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">장소</label>
              <input
                value={form.location}
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="예: 브니엘홀, 세미나실"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">대상</label>
              <input
                value={form.target}
                onChange={e => setForm(prev => ({ ...prev, target: e.target.value }))}
                placeholder="예: 등록 성도, 새가족, 누구나"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">수강료/회비</label>
              <input
                value={form.fee}
                onChange={e => setForm(prev => ({ ...prev, fee: e.target.value }))}
                placeholder="예: 무료, 교재비 별도"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">정원</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={e => setForm(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
                />
                <span className="text-xs text-gray-400 shrink-0">명</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">0명은 제한 없음입니다.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">정렬 순서</label>
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={e => setForm(prev => ({ ...prev, sortOrder: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              />
            </div>
          </div>

          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 일정/신청 기간
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">강좌 시작일</label>
                <input type="date" value={form.startDate} onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">강좌 종료일</label>
                <input type="date" value={form.endDate} onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간</label>
                <input type="time" value={form.startTime} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간</label>
                <input type="time" value={form.endTime} onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div className="md:col-span-4 rounded-xl border border-green-100 bg-green-50/40 p-4">
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#1B5E20]" />
                  진행 시설 / 시설예약 연결
                </label>
                <select
                  value={form.facilityId}
                  onChange={e => setForm(prev => ({ ...prev, facilityId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] bg-white"
                >
                  <option value="">시설예약 연결 안 함</option>
                  {facilities.map(facility => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}{facility.location ? ` · ${facility.location}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-2">
                  시설을 선택하고 강좌 시작일/시간을 입력한 뒤 저장하면 시설예약이 자동 생성됩니다. 강좌 취소 또는 삭제 시 연결 예약도 자동 취소됩니다.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">신청 시작일</label>
                <input type="date" value={form.applyStartDate} onChange={e => setForm(prev => ({ ...prev, applyStartDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">신청 마감일</label>
                <input type="date" value={form.applyEndDate} onChange={e => setForm(prev => ({ ...prev, applyEndDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={e => setForm(prev => ({ ...prev, isVisible: e.target.checked }))}
                  className="rounded border-gray-300 text-[#1B5E20] focus:ring-[#1B5E20]"
                />
                홈페이지에 노출
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">상세 안내</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="강좌 소개, 커리큘럼, 준비물 등을 입력하세요."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">신청 안내</label>
              <textarea
                value={form.applicationNotice}
                onChange={e => setForm(prev => ({ ...prev, applicationNotice: e.target.value }))}
                rows={4}
                placeholder="신청 전 성도에게 안내할 내용을 입력하세요."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={createCourse.isPending || updateCourse.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors disabled:opacity-50"
            >
              {createCourse.isPending || updateCourse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? "수정 완료" : "등록 완료"}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "open", "closed", "cancelled", "archived"] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === status ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "전체" : STATUS_LABELS[status].label}
          </button>
        ))}
      </div>

      {filteredCourses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>등록된 강좌가 없습니다.</p>
          <p className="text-sm mt-1">"강좌 등록" 버튼을 눌러 첫 강좌를 등록해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map(course => {
            const status = STATUS_LABELS[course.status];
            const expanded = expandedCourseId === course.id;
            const linkedFacility = course.facilityId ? facilityById.get(course.facilityId) : null;
            return (
              <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {course.imageUrl ? (
                    <img src={course.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#E8F5E9] text-[#1B5E20] flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{course.title}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                      {!course.isVisible && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">비노출</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateRange(course)}</span>
                      {course.location && <span>{course.location}</span>}
                      {course.instructor && <span>{course.instructor}</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.capacity > 0 ? `${course.activeCount}/${course.capacity}명` : `${course.activeCount}명`}</span>
                      {linkedFacility && <span className="text-[#1B5E20]">시설예약: {linkedFacility.name}</span>}
                      {course.facilityReservationId && <span className="text-blue-600">예약 연결됨</span>}
                      {course.pendingCount > 0 && <span className="text-amber-600">대기 {course.pendingCount}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedCourseId(expanded ? null : course.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="신청자 보기"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    <button onClick={() => startEdit(course)} className="p-2 text-gray-400 hover:text-[#1B5E20] transition-colors" title="수정">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${course.title}" 강좌를 삭제하시겠습니까?\n신청 내역은 삭제되고, 연결된 시설예약은 자동 취소됩니다.`)) {
                          deleteCourse.mutate({ id: course.id });
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h5 className="text-sm font-bold text-gray-700">신청자 명단</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {(["all", "pending", "approved", "rejected", "cancelled"] as const).map(statusKey => (
                          <button
                            key={statusKey}
                            onClick={() => setApplicationFilter(statusKey)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                              applicationFilter === statusKey ? "bg-[#1B5E20] text-white" : "bg-white text-gray-500 border border-gray-200"
                            }`}
                          >
                            {statusKey === "all" ? "전체" : APPLICATION_STATUS[statusKey].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {loadingApplications ? (
                      <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#1B5E20]" /></div>
                    ) : filteredApplications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">해당 조건의 신청자가 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredApplications.map(application => {
                          const appStatus = APPLICATION_STATUS[application.status];
                          const isReviewing = reviewingId === application.id;
                          return (
                            <div key={application.id} className="bg-white border border-gray-100 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${appStatus.color}`}>
                                  {appStatus.icon}
                                  {appStatus.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-800">
                                    {application.applicantName}
                                    {application.memberDepartment && <span className="ml-2 text-xs font-normal text-gray-400">{application.memberDepartment}</span>}
                                  </p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                    {application.applicantPhone && <span>{application.applicantPhone}</span>}
                                    {application.applicantEmail && <span>{application.applicantEmail}</span>}
                                    <span>신청 {formatCreatedAt(application.createdAt)}</span>
                                  </div>
                                  {application.memo && <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">{application.memo}</p>}
                                  {application.adminComment && <p className="mt-2 text-xs text-red-500 bg-red-50 rounded px-2 py-1.5">{application.adminComment}</p>}
                                </div>
                                {application.status === "pending" && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => updateApplication.mutate({ id: application.id, status: "approved" })}
                                      disabled={updateApplication.isPending}
                                      className="px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      승인
                                    </button>
                                    <button
                                      onClick={() => { setReviewingId(application.id); setReviewComment(""); }}
                                      className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50"
                                    >
                                      거절
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isReviewing && (
                                <div className="mt-3 pl-0 md:pl-20">
                                  <textarea
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    placeholder="거절 사유를 입력해 주세요."
                                    rows={2}
                                    className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => updateApplication.mutate({ id: application.id, status: "rejected", comment: reviewComment })}
                                      disabled={!reviewComment.trim() || updateApplication.isPending}
                                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                                    >
                                      거절 확정
                                    </button>
                                    <button
                                      onClick={() => { setReviewingId(null); setReviewComment(""); }}
                                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50"
                                    >
                                      취소
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
