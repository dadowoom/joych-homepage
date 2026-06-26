/**
 * ChurchIntro.tsx
 * 교회소개 신규 페이지: 섬기는분, 교회백서, 사역원리, CI, 셔틀버스
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import type { RouteComponentProps } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, ChevronRight, Bus, BookOpen, Heart, Mail, Palette, Phone, UserRound, Edit3, Eye, EyeOff, ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";

function PageWrapper({ title, breadcrumb, children }: { title: string; breadcrumb: string[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-3">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {item}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold font-['Noto_Serif_KR']">{title}</h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-[#2d6a4f] hover:underline mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> 뒤로 가기
        </button>
        {children}
      </div>
    </div>
  );
}

function alertPendingResource(label: string) {
  window.alert(`${label} 자료는 현재 준비 중입니다. 자료가 필요하시면 교회 사무실(054-270-1000)로 문의해 주세요.`);
}

// ── 섬기는 분 ──
const STAFF_CATEGORIES = [
  { value: "senior", label: "담임목사" },
  { value: "associate", label: "부교역자" },
  { value: "education", label: "교회학교" },
  { value: "office", label: "사무행정" },
  { value: "elder", label: "장로" },
  { value: "other", label: "기타" },
] as const;

type StaffCategoryFilter = typeof STAFF_CATEGORIES[number]["value"];
type StaffCategory = StaffCategoryFilter;
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
type StaffMenuTreeItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  isVisible?: boolean;
  subItems?: StaffMenuTreeItem[];
};
type StaffMenuTree = Array<{
  label: string;
  items?: StaffMenuTreeItem[];
}>;
type StaffPageProps = {
  initialCategory?: StaffCategoryFilter;
} & Partial<RouteComponentProps<Record<string, string | undefined>>>;

const STAFF_SIDE_MENU_ITEMS = [
  { id: 1, label: "담임목사 인사말", href: "/page/교회소개-담임목사-소개" },
  { id: 2, label: "섬기는 분", href: "/page/교회소개-섬기는-분" },
  { id: 3, label: "부교역자", href: "/page/교회소개-부교역자" },
  { id: 4, label: "교회 역사", href: "/about/history" },
  { id: 5, label: "교회 비전", href: "/page/교회소개-3대-비전" },
  { id: 6, label: "오시는 길", href: "/about/directions" },
];

const staffFieldClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";
const staffLabelClass = "block text-xs font-medium text-gray-500 mb-1";

function getEmptyStaffForm(category: StaffCategory, sortOrder = 0): StaffForm {
  return {
    category,
    name: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    imageUrl: "",
    sortOrder,
    isVisible: true,
  };
}

function getInitialStaffCategory(location: string, fallback: StaffCategoryFilter = "senior"): StaffCategoryFilter {
  if (location.includes("/associate") || location.includes("부교역자")) return "associate";
  return fallback;
}

function getStaffCategoryLabel(category: string) {
  return STAFF_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

function staffToForm(member: StaffMember): StaffForm {
  return {
    category: member.category,
    name: member.name,
    title: member.title,
    department: member.department ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    imageUrl: member.imageUrl ?? "",
    sortOrder: member.sortOrder,
    isVisible: member.isVisible,
  };
}

function readStaffImageAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function normalizeStaffPayload(form: StaffForm) {
  return {
    category: form.category,
    name: form.name.trim(),
    title: form.title.trim(),
    department: form.department.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
    isVisible: form.isVisible,
  };
}

function hasOwnStaffMenuContent(item: StaffMenuTreeItem) {
  const pageType = item.pageType ?? "image";
  if (pageType === "image") {
    return Boolean(item.pageImageUrl?.trim());
  }
  return true;
}

function getStaffSideMenuItems(menuTree: StaffMenuTree | undefined, pageTitle: string) {
  const liveItems = menuTree
    ?.find((menu) => menu.label === "교회소개")
    ?.items
    ?.filter((item) => item.isVisible !== false)
    .map((item) => {
      const subItems = item.subItems?.filter((subItem) => subItem.isVisible !== false) ?? [];
      const hasSubItems = subItems.length > 0;
      return {
        id: item.id,
        label: item.label,
        href: hasSubItems && !hasOwnStaffMenuContent(item) ? null : item.href ?? null,
        isActive: item.label === pageTitle,
        subItems: subItems.map((subItem) => ({
          id: subItem.id,
          label: subItem.label,
          href: subItem.href ?? null,
          isActive: subItem.label === pageTitle,
        })),
      };
    });

  if (liveItems?.length) return liveItems;
  return STAFF_SIDE_MENU_ITEMS.map((item) => ({
    ...item,
    isActive: item.label === pageTitle,
  }));
}

function StaffEditDialog({
  defaultCategory,
  defaultSortOrder,
  initialMember,
  onClose,
}: {
  defaultCategory: StaffCategory;
  defaultSortOrder: number;
  initialMember?: StaffMember;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<StaffForm>(() =>
    initialMember ? staffToForm(initialMember) : getEmptyStaffForm(defaultCategory, defaultSortOrder)
  );
  const isEditing = Boolean(initialMember);

  const invalidateStaff = async () => {
    await Promise.all([
      utils.cms.staff.list.invalidate(),
      utils.home.staff.invalidate(),
    ]);
  };

  const uploadImage = trpc.cms.upload.pageImage.useMutation({
    onSuccess: (result) => {
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
      toast.success("사진이 업로드됐습니다.");
    },
    onError: (error) => toast.error(error.message),
  });

  const createStaff = trpc.cms.staff.create.useMutation({
    onSuccess: async () => {
      toast.success("섬기는 분이 등록됐습니다.");
      await invalidateStaff();
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStaff = trpc.cms.staff.update.useMutation({
    onSuccess: async () => {
      toast.success("섬기는 분 정보가 저장됐습니다.");
      await invalidateStaff();
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    try {
      const base64 = await readStaffImageAsBase64(file);
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

  const submit = () => {
    const payload = normalizeStaffPayload(form);
    if (!payload.name || !payload.title) {
      toast.error("이름과 직책은 필수입니다.");
      return;
    }
    if (initialMember) {
      updateStaff.mutate({ id: initialMember.id, ...payload });
      return;
    }
    createStaff.mutate(payload);
  };

  const isSaving = createStaff.isPending || updateStaff.isPending;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/45 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-2xl">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1B5E20]">ADMIN MODE</p>
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? "섬기는 분 수정" : "섬기는 분 추가"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
          <div>
            <label className={staffLabelClass}>프로필 사진</label>
            <div className="flex h-44 w-40 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <ImageIcon className="h-10 w-10 text-gray-300" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImage.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E20] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
              >
                {uploadImage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                사진 업로드
              </button>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                >
                  사진 제거
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label>
              <span className={staffLabelClass}>분류</span>
              <select
                className={staffFieldClass}
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as StaffCategory }))}
              >
                {STAFF_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={staffLabelClass}>정렬 순서</span>
              <input
                className={staffFieldClass}
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span className={staffLabelClass}>이름</span>
              <input
                className={staffFieldClass}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="예: 홍길동"
              />
            </label>
            <label>
              <span className={staffLabelClass}>직책</span>
              <input
                className={staffFieldClass}
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="예: 부목사, 전도사"
              />
            </label>
            <label className="md:col-span-2">
              <span className={staffLabelClass}>담당 사역/부서</span>
              <input
                className={staffFieldClass}
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                placeholder="예: 교구, 청년부, 행정"
              />
            </label>
            <label>
              <span className={staffLabelClass}>이메일</span>
              <input
                className={staffFieldClass}
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="name@example.com"
              />
            </label>
            <label>
              <span className={staffLabelClass}>전화번호</span>
              <input
                className={staffFieldClass}
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="054-000-0000"
              />
            </label>
            <label className="md:col-span-2">
              <span className={staffLabelClass}>사진 URL</span>
              <input
                className={staffFieldClass}
                value={form.imageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="직접 URL을 붙여넣거나 사진 업로드 사용"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(event) => setForm((prev) => ({ ...prev, isVisible: event.target.checked }))}
              />
              홈페이지에 노출
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditing ? "저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffPage({
  initialCategory = "senior",
}: StaffPageProps = {}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const [activeCategory, setActiveCategory] = useState<StaffCategoryFilter>(() => getInitialStaffCategory(location, initialCategory));
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  useEffect(() => {
    setActiveCategory(getInitialStaffCategory(location, initialCategory));
  }, [initialCategory, location]);

  const queryInput = useMemo(
    () => ({ category: activeCategory as StaffCategory }),
    [activeCategory],
  );
  const { data: staffList = [], isLoading } = trpc.home.staff.useQuery(queryInput);
  const { data: adminStaffMembers, isLoading: isAdminStaffLoading } = trpc.cms.staff.list.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: menuTree } = trpc.home.menus.useQuery();
  const pageTitle = activeCategory === "associate" ? "부교역자" : "섬기는 분";
  const profileIntro = activeCategory === "associate"
    ? "기쁨의교회를 함께 섬기는 부교역자를 소개합니다."
    : "기쁨의교회를 섬기는 목회자와 사역자들을 소개합니다.";
  const sideMenuItems = useMemo(
    () => getStaffSideMenuItems(menuTree, pageTitle),
    [menuTree, pageTitle],
  );
  const adminStaffList = useMemo(
    () => (adminStaffMembers ?? []).filter((member) => member.category === activeCategory),
    [activeCategory, adminStaffMembers],
  );
  const displayStaffList = isAdmin && adminStaffMembers ? adminStaffList : staffList;
  const isStaffListLoading = isLoading || (isAdmin && isAdminStaffLoading && !adminStaffMembers);
  const defaultSortOrder = useMemo(
    () => adminStaffList.reduce((max, member) => Math.max(max, member.sortOrder), 0) + 1,
    [adminStaffList],
  );

  const invalidateStaff = async () => {
    await Promise.all([
      utils.cms.staff.list.invalidate(),
      utils.home.staff.invalidate(),
    ]);
  };

  const updateStaff = trpc.cms.staff.update.useMutation({
    onSuccess: async () => {
      toast.success("노출 상태가 변경됐습니다.");
      await invalidateStaff();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteStaff = trpc.cms.staff.delete.useMutation({
    onSuccess: async () => {
      toast.success("삭제됐습니다.");
      await invalidateStaff();
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreateStaff = () => {
    setEditingStaff(null);
    setIsCreatingStaff(true);
  };

  const closeStaffDialog = () => {
    setEditingStaff(null);
    setIsCreatingStaff(false);
  };

  const toggleStaffVisible = (staff: StaffMember) => {
    updateStaff.mutate({ id: staff.id, isVisible: !staff.isVisible });
  };

  const removeStaff = (staff: StaffMember) => {
    if (!window.confirm(`${staff.name} 정보를 삭제할까요?`)) return;
    deleteStaff.mutate({ id: staff.id });
  };

  return (
    <SubPageLayout
      pageTitle={pageTitle}
      parentLabel="교회소개"
      sideMenuItems={sideMenuItems}
    >
      <p className="sr-only">{profileIntro}</p>

      {isAdmin && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="mb-3 flex items-center gap-2 text-amber-700 sm:mb-0">
            <Edit3 className="h-4 w-4" />
            <span className="text-sm font-medium">
              관리자 편집 모드 — 이 화면에서 바로 추가, 수정, 삭제할 수 있습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={openCreateStaff}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            현재 분류에 추가
          </button>
        </div>
      )}

      <div className="mb-12 border-y border-gray-200">
        <div className="flex flex-wrap gap-x-8 gap-y-0">
        {STAFF_CATEGORIES.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setActiveCategory(category.value)}
            className={`border-b-2 px-0 py-4 text-sm transition-colors ${
              activeCategory === category.value
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {category.label}
          </button>
        ))}
        </div>
      </div>

      {isStaffListLoading ? (
        <p className="text-gray-500 py-12 text-center">불러오는 중...</p>
      ) : displayStaffList.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-16 text-center">
          <UserRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {isAdmin ? "현재 분류에 등록된 섬기는 분 정보가 없습니다. 위 버튼으로 추가해 주세요." : "등록된 섬기는 분 정보가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-16 pt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayStaffList.map((staff) => {
            const roleParts = [staff.title, staff.department || getStaffCategoryLabel(staff.category)]
              .map((value) => value?.trim())
              .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
            const email = staff.email?.trim();
            const phone = staff.phone?.trim();
            return (
              <article
                key={staff.id}
                className={`group relative flex min-h-72 flex-col items-center border border-gray-200 bg-white px-4 pb-7 pt-32 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md ${isAdmin && !staff.isVisible ? "opacity-60 ring-2 ring-amber-200" : ""}`}
              >
                {isAdmin && (
                  <div className="absolute right-2 top-2 z-20 flex gap-1 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-gray-200">
                    <button
                      type="button"
                      onClick={() => setEditingStaff(staff)}
                      className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                      title="수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStaffVisible(staff)}
                      disabled={updateStaff.isPending}
                      className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-amber-600 disabled:opacity-50"
                      title={staff.isVisible ? "숨기기" : "보이기"}
                    >
                      {staff.isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStaff(staff)}
                      disabled={deleteStaff.isPending}
                      className="rounded-full p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="absolute -top-10 left-1/2 flex h-48 w-40 -translate-x-1/2 items-center justify-center overflow-hidden bg-gray-50 ring-1 ring-gray-100 transition-transform group-hover:-translate-y-1">
                  {staff.imageUrl ? (
                    <img
                      src={staff.imageUrl}
                      alt={staff.name}
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <UserRound className="h-14 w-14 text-gray-300" />
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900">{staff.name}</h3>
                {isAdmin && !staff.isVisible && (
                  <span className="mt-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    숨김
                  </span>
                )}
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {roleParts.join(" / ")}
                </p>
                {(email || phone) && (
                  <div className="mt-5 w-full border-t border-gray-100 pt-4 text-left text-xs leading-6 text-gray-500">
                    {email && (
                      <a href={`mailto:${email}`} className="flex items-center gap-2 break-all hover:text-[#1B5E20]">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {email}
                      </a>
                    )}
                    {phone && (
                      <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-[#1B5E20]">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {phone}
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {isAdmin && (isCreatingStaff || editingStaff) && (
        <StaffEditDialog
          defaultCategory={activeCategory}
          defaultSortOrder={defaultSortOrder}
          initialMember={editingStaff ?? undefined}
          onClose={closeStaffDialog}
        />
      )}
    </SubPageLayout>
  );
}

// ── 교회백서 ──
const whiteBookSections = [
  { year: "2024", title: "2024 기쁨의교회 백서", desc: "2024년 한 해 동안의 교회 사역 현황, 재정 보고, 성도 현황 등을 담은 연간 보고서입니다.", pages: 48 },
  { year: "2023", title: "2023 기쁨의교회 백서", desc: "2023년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 52 },
  { year: "2022", title: "2022 기쁨의교회 백서", desc: "2022년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 44 },
];

export function WhiteBookPage() {
  return (
    <PageWrapper title="교회백서" breadcrumb={["교회소개", "교회백서"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <BookOpen className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">교회백서란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            교회백서는 기쁨의교회가 매년 발행하는 연간 보고서입니다. 한 해 동안의 사역 현황, 재정 투명성, 성도 현황 등을 성도들과 투명하게 공유합니다.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {whiteBookSections.map((book, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#1b4332] text-white rounded-xl flex items-center justify-center font-bold text-lg">{book.year}</div>
              <div>
                <h3 className="font-bold text-gray-900">{book.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{book.desc}</p>
                <p className="text-gray-400 text-xs mt-1">총 {book.pages}페이지</p>
              </div>
            </div>
            <button type="button" onClick={() => alertPendingResource(book.title)} className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors whitespace-nowrap">
              PDF 보기
            </button>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 사역원리 ──
const principles = [
  { title: "말씀 중심", icon: "📖", desc: "모든 사역의 근거는 하나님의 말씀입니다. 성경의 가르침을 삶 속에서 실천하는 교회를 지향합니다.", verse: "\"모든 성경은 하나님의 감동으로 된 것으로 교훈과 책망과 바르게 함과 의로 교육하기에 유익하니\" (딤후 3:16)" },
  { title: "기도의 교회", icon: "🙏", desc: "기도는 교회 사역의 동력입니다. 개인 기도, 소그룹 기도, 교회 공동 기도를 통해 하나님과 깊이 교제합니다.", verse: "\"쉬지 말고 기도하라\" (살전 5:17)" },
  { title: "제자 삼는 교회", icon: "✝️", desc: "예수님의 지상 명령에 순종하여 모든 성도가 예수님의 제자가 되고, 또 다른 제자를 세우는 사역을 감당합니다.", verse: "\"그러므로 너희는 가서 모든 민족을 제자로 삼아\" (마 28:19)" },
  { title: "선교하는 교회", icon: "🌍", desc: "땅 끝까지 복음을 전하는 선교적 교회입니다. 국내외 선교사를 파송하고 지원하며 세계 선교에 헌신합니다.", verse: "\"오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라\" (행 1:8)" },
  { title: "섬기는 교회", icon: "🤝", desc: "예수님의 섬김을 본받아 교회 안팎에서 낮은 자세로 섬기는 공동체를 이룹니다.", verse: "\"인자가 온 것은 섬김을 받으려 함이 아니라 도리어 섬기려 하고\" (마 20:28)" },
  { title: "기쁨의 공동체", icon: "😊", desc: "성령 안에서 기쁨이 넘치는 공동체입니다. 어떤 상황에서도 주 안에서 기뻐하는 교회를 지향합니다.", verse: "\"주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라\" (빌 4:4)" },
];

export function MinistryPrinciplePage() {
  return (
    <PageWrapper title="사역원리" breadcrumb={["교회소개", "사역원리"]}>
      <p className="text-gray-600 mb-10 text-lg leading-relaxed">기쁨의교회가 사역을 감당하는 핵심 원리들을 소개합니다. 이 원리들은 교회의 모든 사역과 프로그램의 기초가 됩니다.</p>
      <div className="grid md:grid-cols-2 gap-8">
        {principles.map((p, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{p.icon}</span>
              <h3 className="text-xl font-bold text-[#1b4332] font-['Noto_Serif_KR']">{p.title}</h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">{p.desc}</p>
            <blockquote className="bg-[#F1F8E9] rounded-lg px-4 py-3 text-[#2d6a4f] text-sm italic">{p.verse}</blockquote>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── CI (교회 아이덴티티) ──
export function CIPage() {
  return (
    <PageWrapper title="CI" breadcrumb={["교회소개", "CI"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Palette className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">CI(Church Identity)란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            기쁨의교회의 시각적 정체성을 나타내는 로고, 색상, 서체 등의 디자인 가이드라인입니다. 교회의 모든 공식 자료에 통일된 CI를 사용합니다.
          </p>
        </div>
      </div>

      {/* 로고 섹션 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 로고</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { bg: "bg-white border-2 border-gray-200", label: "기본형 (흰 배경)", textColor: "text-[#1b4332]" },
            { bg: "bg-[#1b4332]", label: "반전형 (어두운 배경)", textColor: "text-white" },
            { bg: "bg-gray-100", label: "단색형 (회색 배경)", textColor: "text-gray-700" },
          ].map((item, i) => (
            <div key={i} className={`${item.bg} rounded-xl p-8 flex flex-col items-center justify-center min-h-[160px]`}>
              <div className={`text-3xl font-bold font-['Noto_Serif_KR'] ${item.textColor} mb-2`}>기쁨의교회</div>
              <div className={`text-sm ${item.textColor} opacity-70`}>Joy Church</div>
              <p className="text-xs text-gray-400 mt-4">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 색상 팔레트 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 색상</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { color: "#1b4332", name: "딥 그린", hex: "#1b4332", use: "주요 배경, 헤더" },
            { color: "#2d6a4f", name: "메인 그린", hex: "#2d6a4f", use: "포인트 컬러, 버튼" },
            { color: "#52b788", name: "라이트 그린", hex: "#52b788", use: "강조, 아이콘" },
            { color: "#d8f3dc", name: "페일 그린", hex: "#d8f3dc", use: "배경, 카드" },
          ].map((c, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-200">
              <div className="h-20" style={{ backgroundColor: c.color }} />
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs">{c.hex}</p>
                <p className="text-gray-400 text-xs mt-1">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 다운로드 */}
      <section>
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">CI 파일 다운로드</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {["로고 AI 파일", "로고 PNG 파일", "CI 가이드라인 PDF"].map((file, i) => (
            <button key={i} type="button" onClick={() => alertPendingResource(file)} className="border-2 border-[#2d6a4f] text-[#2d6a4f] rounded-xl p-4 hover:bg-[#2d6a4f] hover:text-white transition-colors text-sm font-semibold">
              ⬇️ {file}
            </button>
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}

// ── 셔틀버스 ──
const busRoutes = [
  { route: "1호차", area: "주일 셔틀", stops: ["세부 승차 위치는 주보 및 교회 공지를 확인해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "2호차", area: "주일 셔틀", stops: ["세부 승차 위치는 안내 데스크로 문의해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "3호차", area: "특별 행사", stops: ["행사 일정에 따라 별도 안내됩니다.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
];

export function ShuttleBusPage() {
  return (
    <PageWrapper title="셔틀버스" breadcrumb={["교회소개", "셔틀버스"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Bus className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">셔틀버스 운행 안내</h2>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>• 운행 시간: 매주 주일 오전 (1부 예배 기준)</li>
            <li>• 탑승 신청: 교회 행정실 또는 각 차량 담당자에게 연락</li>
            <li>• 문의: 054-270-1000</li>
          </ul>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {busRoutes.map((bus, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1b4332] text-white rounded-full flex items-center justify-center font-bold text-sm">{bus.route}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{bus.area}</h3>
              <p className="text-xs text-gray-500">문의: {bus.driver}</p>
                </div>
              </div>
              <a href={`tel:${bus.contact}`} className="text-[#2d6a4f] text-sm font-semibold hover:underline">{bus.contact}</a>
            </div>
            <div className="space-y-2">
              {bus.stops.map((stop, j) => (
                <div key={j} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${j === bus.stops.length - 1 ? "bg-[#2d6a4f]" : "bg-gray-300"}`} />
                  <span className={j === bus.stops.length - 1 ? "text-[#2d6a4f] font-semibold" : "text-gray-600"}>{stop}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
