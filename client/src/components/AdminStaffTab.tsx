/**
 * 관리자 섬기는 분 관리 탭
 * - 섬기는 분 정보 등록
 * - 사진 업로드, 노출 여부, 정렬 순서 관리
 */

import { useMemo, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "senior", label: "담임목사" },
  { value: "associate", label: "부교역자" },
  { value: "education", label: "교회학교 교역자" },
  { value: "cooperation", label: "협력사역자" },
  { value: "elder", label: "장로" },
  { value: "office", label: "교회직원" },
  { value: "other", label: "사회복지법인 기쁨의복지재단" },
] as const;

const ELDER_GROUP_OPTIONS = ["시무장로", "휴무장로", "원로장로", "은퇴장로"] as const;

type StaffCategory = typeof CATEGORY_OPTIONS[number]["value"];
type StaffMember = inferRouterOutputs<AppRouter>["cms"]["staff"]["list"][number];

type StaffForm = {
  category: StaffCategory;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  imageUrl: string;
  sortOrder: number;
  isVisible: boolean;
};

const EMPTY_FORM: StaffForm = {
  category: "associate",
  name: "",
  title: "",
  department: "",
  email: "",
  phone: "",
  imageUrl: "",
  sortOrder: 0,
  isVisible: true,
};

const fieldClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

function getCategoryLabel(category: string) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function isElderGroupOption(value: string) {
  const normalized = value.replace(/\s+/g, "");
  return ELDER_GROUP_OPTIONS.some((option) => option.replace(/\s+/g, "") === normalized);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function normalizePayload(form: StaffForm) {
  const categoryLabel = getCategoryLabel(form.category);

  return {
    category: form.category,
    name: form.name.trim(),
    title: form.title.trim() || categoryLabel,
    department: form.department.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
    isVisible: form.isVisible,
  };
}

export default function AdminStaffTab() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<StaffCategory | "all">("all");

  const { data: staffMembers = [], isLoading } = trpc.cms.staff.list.useQuery();

  const uploadImage = trpc.cms.upload.pageImage.useMutation({
    onSuccess: (result) => {
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
      toast.success("사진이 업로드됐습니다.");
    },
    onError: (error) => toast.error(error.message),
  });

  const createStaff = trpc.cms.staff.create.useMutation({
    onSuccess: () => {
      toast.success("섬기는 분이 등록됐습니다.");
      resetForm();
      utils.cms.staff.list.invalidate();
      utils.home.staff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStaff = trpc.cms.staff.update.useMutation({
    onSuccess: () => {
      toast.success("섬기는 분 정보가 저장됐습니다.");
      resetForm();
      utils.cms.staff.list.invalidate();
      utils.home.staff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteStaff = trpc.cms.staff.delete.useMutation({
    onSuccess: () => {
      toast.success("삭제됐습니다.");
      utils.cms.staff.list.invalidate();
      utils.home.staff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredMembers = useMemo(() => {
    if (categoryFilter === "all") return staffMembers;
    return staffMembers.filter((member) => member.category === categoryFilter);
  }, [categoryFilter, staffMembers]);

  const groupedMembers = useMemo(() => {
    return CATEGORY_OPTIONS.map((category) => ({
      ...category,
      members: filteredMembers.filter((member) => member.category === category.value),
    })).filter((group) => group.members.length > 0);
  }, [filteredMembers]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setForm({
      category: member.category,
      name: member.name,
      title: member.title,
      department: member.department ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      imageUrl: member.imageUrl ?? "",
      sortOrder: member.sortOrder,
      isVisible: member.isVisible,
    });
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submit = () => {
    const payload = normalizePayload(form);
    if (!payload.name) {
      toast.error("이름은 필수입니다.");
      return;
    }
    if (editingId) {
      updateStaff.mutate({ id: editingId, ...payload });
    } else {
      createStaff.mutate(payload);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      uploadImage.mutate({
        base64,
        fileName: file.name,
        mimeType: file.type,
        context: "church-staff",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사진 업로드를 준비하지 못했습니다.");
    }
  };

  const toggleVisible = (member: StaffMember) => {
    updateStaff.mutate({ id: member.id, isVisible: !member.isVisible });
  };

  const remove = (member: StaffMember) => {
    if (!window.confirm(`${member.name} 정보를 삭제할까요?`)) return;
    deleteStaff.mutate({ id: member.id });
  };

  const handleCategoryChange = (category: StaffCategory) => {
    setForm((prev) => ({
      ...prev,
      category,
      department: category === "elder"
        ? isElderGroupOption(prev.department) ? prev.department : ""
        : prev.department,
    }));
  };

  if (isLoading) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">섬기는 분 관리</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            담임목사, 부교역자, 교회학교 교역자, 협력사역자, 장로, 교회직원, 사회복지법인 기쁨의복지재단 정보를 등록하고 홈페이지 노출 여부를 관리합니다.
          </p>
        </div>
        <span className="text-xs bg-green-50 text-[#1B5E20] px-3 py-1 rounded-full border border-green-100">
          전체 {staffMembers.length}명
        </span>
      </div>

      <section ref={formSectionRef} className="border border-gray-200 rounded-xl p-4 scroll-mt-24">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h4 className="font-bold text-gray-800">
            {editingId ? "정보 수정" : "새로 등록"}
          </h4>
          {editingId && (
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
              <X className="w-3.5 h-3.5" />
              수정 취소
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
          <div>
            <label className={labelClass}>프로필 사진</label>
            <div className="w-36 h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-10 h-10 text-gray-300" />
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImage.isPending}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadImage.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                사진
              </button>
              {form.imageUrl && (
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50">
                  제거
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>분류</span>
              <select className={fieldClass} value={form.category} onChange={(event) => handleCategoryChange(event.target.value as StaffCategory)}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>정렬 순서</span>
              <input className={fieldClass} type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))} />
            </label>
            <label>
              <span className={labelClass}>이름</span>
              <input className={fieldClass} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="예: 김수홍 목사" />
            </label>
            {form.category === "elder" ? (
              <label className="md:col-span-2">
                <span className={labelClass}>장로 구분</span>
                <select className={fieldClass} value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}>
                  <option value="">구분 선택</option>
                  {form.department && !isElderGroupOption(form.department) && (
                    <option value={form.department}>{form.department}</option>
                  )}
                  {ELDER_GROUP_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="md:col-span-2">
                <span className={labelClass}>담당 사역/부서</span>
                <input className={fieldClass} value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="예: 교구, 청년부, 행정" />
              </label>
            )}
            <label>
              <span className={labelClass}>이메일</span>
              <input className={fieldClass} type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="name@example.com" />
            </label>
            <label>
              <span className={labelClass}>전화번호</span>
              <input className={fieldClass} value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="054-000-0000" />
            </label>
            <label className="md:col-span-2">
              <span className={labelClass}>사진 URL</span>
              <input className={fieldClass} value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="직접 URL을 붙여넣거나 사진 버튼으로 업로드" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.isVisible} onChange={(event) => setForm((prev) => ({ ...prev, isVisible: event.target.checked }))} />
              홈페이지에 노출
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                초기화
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={createStaff.isPending || updateStaff.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#1B5E20] text-white hover:bg-[#2E7D32] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {editingId ? "저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap gap-1 mb-4">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${categoryFilter === "all" ? "bg-[#1B5E20] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
          >
            전체
          </button>
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategoryFilter(option.value)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${categoryFilter === option.value ? "bg-[#1B5E20] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {groupedMembers.map((group) => (
            <div key={group.value} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-bold text-gray-800">{group.label}</h4>
                <span className="text-xs text-gray-400">{group.members.length}명</span>
              </div>
              <div className="divide-y divide-gray-100">
                {group.members.map((member) => (
                  <div key={member.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                        {member.imageUrl ? (
                          <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{member.name}</p>
                          {!member.isVisible && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">숨김</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {getCategoryLabel(member.category)} · {member.department || "담당 미입력"} · 정렬 {member.sortOrder}
                        </p>
                        {(member.email || member.phone) && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                            {[member.email, member.phone].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <button type="button" onClick={() => toggleVisible(member)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50">
                        {member.isVisible ? "숨김" : "노출"}
                      </button>
                      <button type="button" onClick={() => startEdit(member)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50">
                        <Pencil className="w-3.5 h-3.5" />
                        수정
                      </button>
                      <button type="button" onClick={() => remove(member)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredMembers.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-xl">
              등록된 섬기는 분 정보가 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
