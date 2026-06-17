/**
 * 관리자 섬기는 분 관리 탭
 * - 섬기는 분 정보 등록
 * - 사진 업로드, 노출 여부, 정렬 순서 관리
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type StaffCategory = string;
type StaffCategoryOption = { value: string; label: string; isBuiltIn?: boolean };

const DEFAULT_CATEGORY_OPTIONS = [
  { value: "senior", label: "담임목사" },
  { value: "associate", label: "부교역자" },
  { value: "education", label: "교회학교 교역자" },
  { value: "cooperation", label: "협력사역자" },
  { value: "elder", label: "장로" },
  { value: "office", label: "교회직원" },
  { value: "other", label: "사회복지법인 기쁨의복지재단" },
] satisfies StaffCategoryOption[];

const ELDER_TITLE_OPTIONS = ["원로장로", "은퇴장로", "시무장로", "휴무장로"] as const;
const COOPERATION_TITLE_OPTIONS = ["협력사역자", "파송선교사", "협력선교사"] as const;
const FOUNDATION_TITLE_OPTIONS = [
  "이사장",
  "감사",
  "이사",
  "법인사무처",
  "창포종합사회복지관",
  "경북동부 노인보호전문기관",
  "경상북도학대피해 노인전용쉼터",
  "경북남부 노인보호전문기관",
  "은빛빌리지",
  "시립창포어린이집",
  "기쁨의지역아동센터",
  "창포지역아동센터",
  "포항시가족센터",
] as const;
const CUSTOM_TITLE_VALUE = "__custom__";

type StaffMember = inferRouterOutputs<AppRouter>["cms"]["staff"]["list"][number];
type StaffTitleOption = inferRouterOutputs<AppRouter>["cms"]["staff"]["titleOptions"][number];

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

function mergeCategoryOptions(categories: Array<{ categoryKey: string; label: string; isBuiltIn?: boolean }>): StaffCategoryOption[] {
  if (categories.length === 0) return DEFAULT_CATEGORY_OPTIONS;
  return categories.map((category) => ({
    value: category.categoryKey,
    label: category.label,
    isBuiltIn: category.isBuiltIn,
  }));
}

function getCategoryLabel(category: string, options: StaffCategoryOption[] = DEFAULT_CATEGORY_OPTIONS) {
  return options.find((option) => option.value === category)?.label ?? category;
}

function isElderTitleOption(value: string) {
  const normalized = value.replace(/\s+/g, "");
  return ELDER_TITLE_OPTIONS.some((option) => option.replace(/\s+/g, "") === normalized);
}

function hasTitleOption(options: readonly string[], value: string) {
  return options.some((option) => option === value);
}

const GROUPED_STAFF_SORT_CATEGORIES = new Set<StaffCategory>(["elder", "cooperation", "other"]);

function isGroupedStaffSortCategory(category: StaffCategory) {
  return GROUPED_STAFF_SORT_CATEGORIES.has(category);
}

function normalizeStaffSortTitle(title?: string | null) {
  return title?.trim() ?? "";
}

function groupTitleOptionsByCategory(options: StaffTitleOption[]) {
  const optionMap = new Map<string, string[]>();
  options.forEach((option) => {
    const current = optionMap.get(option.categoryKey) ?? [];
    current.push(option.label);
    optionMap.set(option.categoryKey, current);
  });
  return optionMap;
}

function getDepartmentFieldCopy(category: StaffCategory) {
  if (category === "elder") {
    return {
      label: "맡은 부서",
      placeholder: "예: 예배위원회, 재정위원회, 선교위원회",
      help: "추후 장로님별 담당 부서가 정해지면 여기에 입력하면 홈페이지 카드에 표시됩니다.",
    };
  }

  if (category === "cooperation") {
    return {
      label: "담당 사역/소속",
      placeholder: "예: 복지선교사, 청년공동체, 선교지",
      help: "담당 사역이나 소속을 입력하면 홈페이지 카드 이름 아래에 표시됩니다.",
    };
  }

  if (category === "other") {
    return {
      label: "담당/직책·소속",
      placeholder: "예: 처장: 김병우 / 팀장: 김진희",
      help: "기관별 담당자, 직책, 소속 내용을 입력하면 홈페이지 카드에 표시됩니다.",
    };
  }

  return {
    label: "담당 사역/부서",
    placeholder: "예: 교구, 청년부, 행정",
    help: "",
  };
}

function getTitleFieldCopy(category: StaffCategory) {
  if (category === "elder") {
    return {
      label: "장로 구분",
      placeholder: "구분 선택",
      options: ELDER_TITLE_OPTIONS,
    };
  }

  if (category === "cooperation") {
    return {
      label: "사역 구분",
      placeholder: "구분 선택",
      options: COOPERATION_TITLE_OPTIONS,
    };
  }

  if (category === "other") {
    return {
      label: "사역 구분",
      placeholder: "구분 선택",
      options: FOUNDATION_TITLE_OPTIONS,
    };
  }

  return null;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function normalizePayload(form: StaffForm, categoryOptions: StaffCategoryOption[]) {
  const categoryLabel = getCategoryLabel(form.category, categoryOptions);
  const sortOrder = Number.isFinite(form.sortOrder) && form.sortOrder > 0
    ? Math.floor(form.sortOrder)
    : undefined;

  return {
    category: form.category,
    name: form.name.trim(),
    title: form.title.trim() || categoryLabel,
    department: form.department.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    sortOrder,
    isVisible: form.isVisible,
  };
}

function getNextSortOrder(members: StaffMember[], category: StaffCategory, title = "") {
  const normalizedTitle = normalizeStaffSortTitle(title);
  const maxSortOrder = members
    .filter((member) => {
      if (member.category !== category) return false;
      if (!isGroupedStaffSortCategory(category)) return true;
      return normalizeStaffSortTitle(member.title) === normalizedTitle;
    })
    .reduce((max, member) => Math.max(max, Number(member.sortOrder) || 0), 0);
  return maxSortOrder + 1;
}

function getMemberMeta(member: StaffMember, categoryOptions: StaffCategoryOption[]) {
  const categoryLabel = getCategoryLabel(member.category, categoryOptions);
  const title = normalizeStaffSortTitle(member.title);
  const department = member.department?.trim();
  const parts = [categoryLabel];

  if (isGroupedStaffSortCategory(member.category) && title && title !== categoryLabel) {
    parts.push(title);
  }

  if (department) {
    parts.push(department);
  } else if (!isGroupedStaffSortCategory(member.category) || !title) {
    parts.push("담당 미입력");
  }

  parts.push(`정렬 ${member.sortOrder}`);
  return parts.join(" · ");
}

function SortableCategoryChip({
  category,
  memberCount,
  isDeleting,
  onDelete,
}: {
  category: StaffCategoryOption;
  memberCount: number;
  isDeleting: boolean;
  onDelete: (category: StaffCategoryOption) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.value });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-5 w-5 cursor-grab items-center justify-center rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-700 active:cursor-grabbing"
        aria-label={`${category.label} 순서 이동`}
        title="드래그해서 순서 변경"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="font-medium">{category.label}</span>
      {category.isBuiltIn && (
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">기본</span>
      )}
      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] text-[#1B5E20]">{memberCount}명</span>
      <button
        type="button"
        onClick={() => onDelete(category)}
        disabled={memberCount > 0 || isDeleting}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
        title={memberCount > 0 ? "등록된 사람이 있으면 삭제할 수 없습니다." : "분류 삭제"}
      >
        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        <span className="sr-only">삭제</span>
      </button>
    </div>
  );
}

function SortableTitleOptionChip({
  option,
  isDeleting,
  onDelete,
}: {
  option: string;
  isDeleting: boolean;
  onDelete: (label: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-4 w-4 cursor-grab items-center justify-center rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-700 active:cursor-grabbing"
        aria-label={`${option} 순서 이동`}
        title="드래그해서 순서 변경"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      {option}
      <button
        type="button"
        onClick={() => onDelete(option)}
        disabled={isDeleting}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        title="사역 구분 삭제"
      >
        {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
        <span className="sr-only">삭제</span>
      </button>
    </span>
  );
}

export default function AdminStaffTab() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<StaffCategory | "all">("all");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newTitleOptionLabel, setNewTitleOptionLabel] = useState("");
  const [orderedCategoryKeys, setOrderedCategoryKeys] = useState<string[]>([]);
  const [orderedTitleOptionLabels, setOrderedTitleOptionLabels] = useState<Record<string, string[]>>({});
  const [isCustomTitleMode, setIsCustomTitleMode] = useState(false);

  const { data: staffMembers = [], isLoading } = trpc.cms.staff.list.useQuery();
  const { data: staffCategories } = trpc.cms.staff.categories.useQuery();
  const { data: staffTitleOptions = [] } = trpc.cms.staff.titleOptions.useQuery();
  const rawCategoryOptions = useMemo(() => mergeCategoryOptions(staffCategories ?? []), [staffCategories]);
  const categoryOptions = useMemo(() => {
    if (orderedCategoryKeys.length === 0) return rawCategoryOptions;
    const categoryMap = new Map(rawCategoryOptions.map((category) => [category.value, category]));
    const orderedOptions = orderedCategoryKeys
      .map((categoryKey) => categoryMap.get(categoryKey))
      .filter((category): category is StaffCategoryOption => Boolean(category));
    const remainingOptions = rawCategoryOptions.filter((category) => !orderedCategoryKeys.includes(category.value));
    return [...orderedOptions, ...remainingOptions];
  }, [orderedCategoryKeys, rawCategoryOptions]);
  const categorySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const categoryMemberCountMap = useMemo(() => {
    const countMap = new Map<string, number>();
    staffMembers.forEach((member) => {
      countMap.set(member.category, (countMap.get(member.category) ?? 0) + 1);
    });
    return countMap;
  }, [staffMembers]);
  const departmentFieldCopy = getDepartmentFieldCopy(form.category);
  const titleFieldCopy = getTitleFieldCopy(form.category);
  const titleOptionsByCategory = useMemo(() => groupTitleOptionsByCategory(staffTitleOptions), [staffTitleOptions]);
  const getTitleOptionsForCategory = (category: StaffCategory) => {
    const orderedOptions = orderedTitleOptionLabels[category];
    if (orderedOptions?.length) return orderedOptions;
    const savedOptions = titleOptionsByCategory.get(category);
    if (savedOptions?.length) return savedOptions;
    return [...(getTitleFieldCopy(category)?.options ?? [])];
  };
  const titleOptionsForCurrentCategory = titleFieldCopy ? getTitleOptionsForCategory(form.category) : [];
  const getEmptyForm = (category: StaffCategory = categoryFilter === "all" ? EMPTY_FORM.category : categoryFilter): StaffForm => ({
    ...EMPTY_FORM,
    category,
    sortOrder: getNextSortOrder(staffMembers, category, ""),
  });

  useEffect(() => {
    setOrderedCategoryKeys(rawCategoryOptions.map((category) => category.value));
  }, [rawCategoryOptions]);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    titleOptionsByCategory.forEach((labels, categoryKey) => {
      next[categoryKey] = labels;
    });
    setOrderedTitleOptionLabels(next);
  }, [titleOptionsByCategory]);

  useEffect(() => {
    if (editingId) return;
    setForm((prev) => {
      const nextSortOrder = getNextSortOrder(staffMembers, prev.category, prev.title);
      return prev.sortOrder === nextSortOrder ? prev : { ...prev, sortOrder: nextSortOrder };
    });
  }, [editingId, staffMembers]);

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

  const createCategory = trpc.cms.staff.createCategory.useMutation({
    onSuccess: (category) => {
      toast.success("분류가 추가됐습니다.");
      setNewCategoryLabel("");
      utils.cms.staff.categories.invalidate();
      utils.home.staffCategories.invalidate();
      if (category?.categoryKey) {
        handleCategoryChange(category.categoryKey);
        setCategoryFilter(category.categoryKey);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderCategories = trpc.cms.staff.reorderCategories.useMutation({
    onSuccess: () => {
      toast.success("분류 순서가 저장됐습니다.");
      utils.cms.staff.categories.invalidate();
      utils.home.staffCategories.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      setOrderedCategoryKeys(rawCategoryOptions.map((category) => category.value));
    },
  });

  const moveCategory = trpc.cms.staff.moveCategory.useMutation({
    onSuccess: () => {
      utils.cms.staff.categories.invalidate();
      utils.home.staffCategories.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCategory = trpc.cms.staff.deleteCategory.useMutation({
    onSuccess: (_, variables) => {
      toast.success("분류가 삭제됐습니다.");
      if (categoryFilter === variables.categoryKey) {
        setCategoryFilter("all");
      }
      if (form.category === variables.categoryKey) {
        setForm(getEmptyForm("associate"));
        setIsCustomTitleMode(false);
      }
      utils.cms.staff.categories.invalidate();
      utils.home.staffCategories.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createTitleOption = trpc.cms.staff.createTitleOption.useMutation({
    onSuccess: (option) => {
      toast.success("사역 구분이 추가됐습니다.");
      setNewTitleOptionLabel("");
      if (option?.label) {
        setIsCustomTitleMode(false);
        setForm((prev) => ({
          ...prev,
          title: option.label,
          sortOrder: editingId ? prev.sortOrder : getNextSortOrder(staffMembers, prev.category, option.label),
        }));
      }
      utils.cms.staff.titleOptions.invalidate();
      utils.home.staffTitleOptions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTitleOption = trpc.cms.staff.deleteTitleOption.useMutation({
    onSuccess: (_, variables) => {
      toast.success("사역 구분이 삭제됐습니다.");
      setForm((prev) => (
        prev.category === variables.categoryKey && prev.title === variables.label
          ? { ...prev, title: "" }
          : prev
      ));
      utils.cms.staff.titleOptions.invalidate();
      utils.home.staffTitleOptions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderTitleOptions = trpc.cms.staff.reorderTitleOptions.useMutation({
    onSuccess: () => {
      toast.success("사역 구분 순서가 저장됐습니다.");
      utils.cms.staff.titleOptions.invalidate();
      utils.home.staffTitleOptions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      const resetOptions = titleOptionsByCategory.get(form.category);
      if (resetOptions?.length) {
        setOrderedTitleOptionLabels((prev) => ({ ...prev, [form.category]: resetOptions }));
      }
    },
  });

  const filteredMembers = useMemo(() => {
    if (categoryFilter === "all") return staffMembers;
    return staffMembers.filter((member) => member.category === categoryFilter);
  }, [categoryFilter, staffMembers]);

  const groupedMembers = useMemo(() => {
    return categoryOptions.flatMap((category) => {
      const categoryMembers = filteredMembers.filter((member) => member.category === category.value);
      if (categoryMembers.length === 0) return [];

      if (!isGroupedStaffSortCategory(category.value)) {
        return [{ ...category, members: categoryMembers }];
      }

      const titleOptions = getTitleOptionsForCategory(category.value);
      const titleOptionSet = new Set(titleOptions.map((option) => normalizeStaffSortTitle(option)));
      const titleGroups = titleOptions
        .map((label) => ({
          value: `${category.value}:${label}`,
          label,
          isBuiltIn: category.isBuiltIn,
          members: categoryMembers.filter((member) => normalizeStaffSortTitle(member.title) === normalizeStaffSortTitle(label)),
        }))
        .filter((group) => group.members.length > 0);

      const ungroupedMembers = categoryMembers.filter((member) => !titleOptionSet.has(normalizeStaffSortTitle(member.title)));
      if (ungroupedMembers.length > 0) {
        titleGroups.push({
          value: `${category.value}:__ungrouped`,
          label: category.label,
          isBuiltIn: category.isBuiltIn,
          members: ungroupedMembers,
        });
      }

      return titleGroups;
    });
  }, [categoryOptions, filteredMembers, orderedTitleOptionLabels, titleOptionsByCategory]);

  const resetForm = () => {
    setForm(getEmptyForm());
    setEditingId(null);
    setIsCustomTitleMode(false);
  };

  const startEdit = (member: StaffMember) => {
    const department = member.department ?? "";
    const legacyElderTitle = member.category === "elder" && isElderTitleOption(department) ? department : "";
    const nextTitle = member.title && member.title !== getCategoryLabel(member.category, categoryOptions) ? member.title : legacyElderTitle;
    const editTitleCopy = getTitleFieldCopy(member.category);
    const editTitleOptions = getTitleOptionsForCategory(member.category);
    setEditingId(member.id);
    setForm({
      category: member.category,
      name: member.name,
      title: nextTitle,
      department: legacyElderTitle ? "" : department,
      email: member.email ?? "",
      phone: member.phone ?? "",
      imageUrl: member.imageUrl ?? "",
      sortOrder: member.sortOrder,
      isVisible: member.isVisible,
    });
    setIsCustomTitleMode(Boolean(editTitleCopy && nextTitle && !hasTitleOption(editTitleOptions, nextTitle)));
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submit = () => {
    const payload = normalizePayload(form, categoryOptions);
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
    setIsCustomTitleMode(false);
    setNewTitleOptionLabel("");
    setForm((prev) => ({
      ...prev,
      category,
      title: category === prev.category ? prev.title : "",
      sortOrder: category === prev.category ? prev.sortOrder : getNextSortOrder(staffMembers, category, ""),
    }));
  };

  const submitCategory = () => {
    const label = newCategoryLabel.trim();
    if (!label) {
      toast.error("추가할 분류명을 입력해주세요.");
      return;
    }
    createCategory.mutate({ label });
  };

  const submitTitleOption = () => {
    const label = newTitleOptionLabel.trim();
    if (!titleFieldCopy) return;
    if (!label) {
      toast.error("추가할 사역 구분명을 입력해주세요.");
      return;
    }
    createTitleOption.mutate({ categoryKey: form.category, label });
  };

  const handleDeleteTitleOption = (label: string) => {
    if (!window.confirm(`"${label}" 사역 구분을 선택 목록에서 삭제할까요?`)) return;
    deleteTitleOption.mutate({ categoryKey: form.category, label });
  };

  const handleMoveCategory = (categoryKey: string, direction: "up" | "down") => {
    moveCategory.mutate({ categoryKey, direction });
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = categoryOptions.findIndex((category) => category.value === activeId);
    const newIndex = categoryOptions.findIndex((category) => category.value === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOptions = arrayMove(categoryOptions, oldIndex, newIndex);
    const nextCategoryKeys = nextOptions.map((category) => category.value);
    setOrderedCategoryKeys(nextCategoryKeys);
    reorderCategories.mutate({ categoryKeys: nextCategoryKeys });
  };

  const handleTitleOptionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !titleFieldCopy) return;

    const activeLabel = String(active.id);
    const overLabel = String(over.id);
    const oldIndex = titleOptionsForCurrentCategory.findIndex((option) => option === activeLabel);
    const newIndex = titleOptionsForCurrentCategory.findIndex((option) => option === overLabel);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOptions = arrayMove(titleOptionsForCurrentCategory, oldIndex, newIndex);
    setOrderedTitleOptionLabels((prev) => ({ ...prev, [form.category]: nextOptions }));
    reorderTitleOptions.mutate({ categoryKey: form.category, labels: nextOptions });
  };

  const handleDeleteCategory = (category: StaffCategoryOption) => {
    const memberCount = categoryMemberCountMap.get(category.value) ?? 0;
    if (memberCount > 0) {
      toast.error("이 분류에 등록된 사람이 있어 삭제할 수 없습니다. 먼저 다른 분류로 옮겨주세요.");
      return;
    }
    if (!window.confirm(`"${category.label}" 분류를 삭제할까요?`)) return;
    deleteCategory.mutate({ categoryKey: category.value });
  };

  const titleSelectValue = titleFieldCopy
    ? isCustomTitleMode
      ? CUSTOM_TITLE_VALUE
      : form.title
    : "";

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

        <div className="mb-5 rounded-xl border border-green-100 bg-green-50/40 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <label className="flex-1">
              <span className={labelClass}>분류 추가</span>
              <input
                className={`${fieldClass} w-full bg-white`}
                value={newCategoryLabel}
                onChange={(event) => setNewCategoryLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitCategory();
                  }
                }}
                placeholder="예: 전도사, 권사, 찬양팀"
              />
            </label>
            <button
              type="button"
              onClick={submitCategory}
              disabled={createCategory.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1B5E20] px-4 py-2 text-sm font-medium text-[#1B5E20] hover:bg-white disabled:opacity-50"
            >
              {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              분류 추가
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            추가한 분류는 등록 폼, 아래 필터, 홈페이지 섬기는 분 탭에 같이 표시됩니다.
          </p>
          <div className="mt-3 rounded-lg border border-green-100 bg-white p-2.5">
            <p className="mb-2 text-[11px] text-gray-500">
              분류 칩을 마우스로 드래그하면 홈페이지 탭 표시 순서가 바뀝니다.
            </p>
            <DndContext sensors={categorySensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categoryOptions.map((category) => category.value)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((category) => {
                    const memberCount = categoryMemberCountMap.get(category.value) ?? 0;
                    const isDeleting = deleteCategory.isPending && deleteCategory.variables?.categoryKey === category.value;

                    return (
                      <SortableCategoryChip
                        key={category.value}
                        category={category}
                        memberCount={memberCount}
                        isDeleting={isDeleting}
                        onDelete={handleDeleteCategory}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {reorderCategories.isPending && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                순서 저장 중...
              </p>
            )}
          </div>
          <div className="hidden mt-3 rounded-lg border border-green-100 bg-white">
            <div className="divide-y divide-gray-100">
              {categoryOptions.map((category, index) => {
                const memberCount = categoryMemberCountMap.get(category.value) ?? 0;
                const isFirst = index === 0;
                const isLast = index === categoryOptions.length - 1;
                const isDeleting = deleteCategory.isPending && deleteCategory.variables?.categoryKey === category.value;
                const isMoving = moveCategory.isPending && moveCategory.variables?.categoryKey === category.value;

                return (
                  <div key={category.value} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{category.label}</span>
                        {category.isBuiltIn && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">기본</span>
                        )}
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-[#1B5E20]">{memberCount}명</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        홈페이지 탭 표시 순서 {index + 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(category.value, "up")}
                        disabled={isFirst || moveCategory.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="위로 이동"
                      >
                        {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(category.value, "down")}
                        disabled={isLast || moveCategory.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="아래로 이동"
                      >
                        {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category)}
                        disabled={memberCount > 0 || deleteCategory.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-100 px-2 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
                {categoryOptions.map((option) => (
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
            {titleFieldCopy && (
              <div>
                <span className={labelClass}>{titleFieldCopy.label}</span>
                <select
                  className={fieldClass}
                  value={titleSelectValue}
                  onChange={(event) => {
                    if (event.target.value === CUSTOM_TITLE_VALUE) {
                      setIsCustomTitleMode(true);
                      setForm((prev) => ({
                        ...prev,
                        title: "",
                        sortOrder: editingId ? prev.sortOrder : getNextSortOrder(staffMembers, prev.category, ""),
                      }));
                      return;
                    }
                    const nextTitle = event.target.value;
                    setIsCustomTitleMode(false);
                    setForm((prev) => ({
                      ...prev,
                      title: nextTitle,
                      sortOrder: editingId ? prev.sortOrder : getNextSortOrder(staffMembers, prev.category, nextTitle),
                    }));
                  }}
                >
                  <option value="">{titleFieldCopy.placeholder}</option>
                  {titleOptionsForCurrentCategory.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={CUSTOM_TITLE_VALUE}>직접 입력</option>
                </select>
                {isCustomTitleMode && (
                  <input
                    className={`${fieldClass} mt-2 w-full`}
                    value={form.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        title: nextTitle,
                        sortOrder: editingId ? prev.sortOrder : getNextSortOrder(staffMembers, prev.category, nextTitle),
                      }));
                    }}
                    placeholder="새 사역 구분을 직접 입력"
                  />
                )}
                <div className="mt-2 rounded-lg border border-green-100 bg-green-50/40 p-2">
                  <div className="flex gap-2">
                    <input
                      className={`${fieldClass} min-w-0 flex-1 bg-white`}
                      value={newTitleOptionLabel}
                      onChange={(event) => setNewTitleOptionLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitTitleOption();
                        }
                      }}
                      placeholder="사역 구분 추가"
                    />
                    <button
                      type="button"
                      onClick={submitTitleOption}
                      disabled={createTitleOption.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#1B5E20] px-3 py-2 text-xs font-medium text-[#1B5E20] hover:bg-white disabled:opacity-50"
                    >
                      {createTitleOption.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      추가
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    사역 구분 칩을 드래그하면 홈페이지 그룹 표시 순서가 바뀝니다.
                  </p>
                  <DndContext sensors={categorySensors} collisionDetection={closestCenter} onDragEnd={handleTitleOptionDragEnd}>
                    <SortableContext items={titleOptionsForCurrentCategory} strategy={rectSortingStrategy}>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {titleOptionsForCurrentCategory.map((option) => (
                          <SortableTitleOptionChip
                            key={option}
                            option={option}
                            isDeleting={deleteTitleOption.isPending}
                            onDelete={handleDeleteTitleOption}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  {reorderTitleOptions.isPending && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      사역 구분 순서 저장 중...
                    </p>
                  )}
                </div>
              </div>
            )}
            <label className="md:col-span-2">
              <span className={labelClass}>{departmentFieldCopy.label}</span>
              <input
                className={fieldClass}
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                placeholder={departmentFieldCopy.placeholder}
              />
              {departmentFieldCopy.help && (
                <p className="mt-1 text-[11px] text-gray-400">{departmentFieldCopy.help}</p>
              )}
            </label>
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
          {categoryOptions.map((option) => (
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
                          {getMemberMeta(member, categoryOptions)}
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
