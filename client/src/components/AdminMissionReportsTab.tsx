/**
 * 관리자 선교보고 탭
 * - 선교사/사역지 등록
 * - 성도 작성 권한 부여/회수
 * - 제출된 선교보고 승인/반려
 */

import { useMemo, useState, type ReactNode } from "react";
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
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import {
  resolveMissionaryGrantIds,
  type MissionaryGrantSelection,
} from "@/lib/missionAuthorGrantSelection";
import { moveMissionaryOrder } from "@/lib/missionaryOrder";
import { toast } from "sonner";
import { GripVertical, ImagePlus, Loader2, X } from "lucide-react";

const MAX_MISSIONARY_PROFILE_IMAGE_BYTES = 1 * 1024 * 1024;
const MISSIONARY_PROFILE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("프로필 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

const CONTINENT_OPTIONS = [
  { value: "asia", label: "아시아" },
  { value: "africa", label: "아프리카" },
  { value: "americas", label: "아메리카" },
  { value: "europe", label: "유럽" },
  { value: "oceania", label: "오세아니아" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  pending: "검토 대기",
  published: "공개",
  rejected: "반려",
};

const adminFieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

type MissionaryFormState = {
  name: string;
  region: string;
  continent: (typeof CONTINENT_OPTIONS)[number]["value"];
  sentYear: number;
  organization: string;
  profileImage: string;
};

function getEmptyMissionaryForm(): MissionaryFormState {
  return {
    name: "",
    region: "",
    continent: "asia",
    sentYear: new Date().getFullYear(),
    organization: "",
    profileImage: "",
  };
}

function SortableMissionaryCard({
  id,
  label,
  disabled,
  children,
}: {
  id: number;
  label: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`rounded-xl border bg-white p-3 ${
        isDragging ? "border-green-300 shadow-lg" : "border-gray-100"
      }`}
    >
      <div className="flex items-stretch gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`${label} 순서 이동`}
          title="마우스로 끌어 순서 이동"
          disabled={disabled}
          className="flex w-7 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-gray-300 transition hover:bg-gray-50 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function ProfileImageUploadField({
  value,
  isUploading,
  disabled,
  onFileSelect,
  onClear,
}: {
  value: string;
  isUploading: boolean;
  disabled: boolean;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="선교사 프로필 미리보기"
            className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-gray-300">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 text-xs font-semibold text-[#1B5E20] transition hover:bg-green-50 ${
                disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`}
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {isUploading ? "업로드 중" : value ? "이미지 변경" : "이미지 선택"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  input.value = "";
                  if (file) onFileSelect(file);
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                제거
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            JPG, PNG, WEBP, GIF / 최대 1MB
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminMissionReportsTab() {
  const utils = trpc.useUtils();
  const [memberSearch, setMemberSearch] = useState("");
  const [missionaryForm, setMissionaryForm] = useState<MissionaryFormState>(getEmptyMissionaryForm);
  const [editingMissionaryId, setEditingMissionaryId] = useState<number | null>(null);
  const [editingMissionaryForm, setEditingMissionaryForm] = useState<MissionaryFormState>(getEmptyMissionaryForm);
  const [profileImageUploadTarget, setProfileImageUploadTarget] = useState<"create" | "edit" | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");
  const [selectedMissionarySelection, setSelectedMissionarySelection] =
    useState<MissionaryGrantSelection>("");

  const { data: missionaries = [], isLoading: loadingMissionaries } =
    trpc.cms.missionReports.missionaries.useQuery();
  const [missionaryOrder, setMissionaryOrder] = useState<(typeof missionaries) | null>(null);
  const { data: grants = [] } =
    trpc.cms.missionReports.authorGrants.useQuery();
  const { data: reports = [] } = trpc.cms.missionReports.reports.useQuery();
  const { data: members = [] } = trpc.cms.missionReports.members.useQuery();
  const displayMissionaries = missionaryOrder ?? missionaries;
  const missionarySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const approvedMembers = useMemo(
    () => members.filter((member) => member.status === "approved"),
    [members]
  );
  const selectedMember = useMemo(
    () => approvedMembers.find((member) => member.id === selectedMemberId) ?? null,
    [approvedMembers, selectedMemberId]
  );
  const filteredMembers = useMemo(() => {
    const trimmedSearch = memberSearch.trim();
    const normalizedSearch = trimmedSearch.toLowerCase();
    if (!trimmedSearch) return approvedMembers;
    return approvedMembers.filter(
      (member) => {
        const haystack = [
          member.name,
          member.phone,
          member.email,
          member.position,
          member.department,
          member.district,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch) || (member.phone ?? "").includes(trimmedSearch);
      }
    );
  }, [approvedMembers, memberSearch]);
  const visibleMemberMatches = useMemo(
    () => filteredMembers.slice(0, 8),
    [filteredMembers]
  );

  const uploadProfileImage = trpc.cms.missionReports.uploadImage.useMutation();

  const handleProfileImageFile = async (file: File, target: "create" | "edit") => {
    if (!MISSIONARY_PROFILE_IMAGE_MIMES.has(file.type)) {
      toast.error("프로필 이미지는 JPG, PNG, WEBP, GIF 파일만 가능합니다.");
      return;
    }
    if (file.size > MAX_MISSIONARY_PROFILE_IMAGE_BYTES) {
      toast.error("프로필 이미지는 1MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setProfileImageUploadTarget(target);
    try {
      const result = await uploadProfileImage.mutateAsync({
        base64: await fileToBase64(file),
        fileName: file.name,
        mimeType: file.type,
      });
      if (target === "create") {
        setMissionaryForm((previous) => ({ ...previous, profileImage: result.url }));
      } else {
        setEditingMissionaryForm((previous) => ({ ...previous, profileImage: result.url }));
      }
      toast.success("프로필 이미지가 업로드됐습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 이미지 업로드에 실패했습니다.");
    } finally {
      setProfileImageUploadTarget(null);
    }
  };

  const createMissionary = trpc.cms.missionReports.createMissionary.useMutation(
    {
      onSuccess: () => {
        toast.success("선교사/사역지가 추가됐습니다.");
        setMissionaryForm(getEmptyMissionaryForm());
        setMissionaryOrder(null);
        utils.cms.missionReports.missionaries.invalidate();
        utils.mission.missionaries.invalidate();
      },
      onError: (e) => toast.error(e.message),
    }
  );

  const updateMissionary = trpc.cms.missionReports.updateMissionary.useMutation({
    onSuccess: () => {
      toast.success("선교사/사역지가 수정됐습니다.");
      setEditingMissionaryId(null);
      setMissionaryOrder(null);
      utils.cms.missionReports.missionaries.invalidate();
      utils.mission.missionaries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMissionaries = trpc.cms.missionReports.reorderMissionaries.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cms.missionReports.missionaries.invalidate(),
        utils.mission.missionaries.invalidate(),
      ]);
      setMissionaryOrder(null);
      toast.success("선교사/사역지 순서가 저장됐습니다.");
    },
    onError: (error) => {
      setMissionaryOrder(null);
      toast.error(`순서 저장에 실패했습니다: ${error.message}`);
    },
  });

  const deleteMissionary = trpc.cms.missionReports.deleteMissionary.useMutation({
    onSuccess: () => {
      toast.success("선교사/사역지가 삭제됐습니다.");
      setEditingMissionaryId(null);
      setMissionaryOrder(null);
      utils.cms.missionReports.missionaries.invalidate();
      utils.cms.missionReports.authorGrants.invalidate();
      utils.mission.missionaries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createGrants = trpc.cms.missionReports.createAuthorGrants.useMutation({
    onSuccess: ({ grantedCount }) => {
      toast.success(`${grantedCount}곳의 작성 권한이 부여됐습니다.`);
      utils.cms.missionReports.authorGrants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateGrant = trpc.cms.missionReports.updateAuthorGrant.useMutation({
    onSuccess: () => {
      toast.success("작성 권한이 변경됐습니다.");
      utils.cms.missionReports.authorGrants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGrant = trpc.cms.missionReports.deleteAuthorGrant.useMutation({
    onSuccess: () => {
      toast.success("작성 권한이 삭제됐습니다.");
      utils.cms.missionReports.authorGrants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reviewReport = trpc.cms.missionReports.reviewReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고 상태가 변경됐습니다.");
      utils.cms.missionReports.reports.invalidate();
      utils.mission.reports.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteReport = trpc.cms.missionReports.deleteReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고가 삭제됐습니다.");
      utils.cms.missionReports.reports.invalidate();
      utils.mission.reports.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleMissionaryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || reorderMissionaries.isPending) return;

    const result = moveMissionaryOrder(
      displayMissionaries,
      Number(active.id),
      Number(over.id),
    );
    if (!result) return;

    setMissionaryOrder(result.orderedItems);
    reorderMissionaries.mutate({ items: result.updates });
  };

  const submitMissionary = () => {
    if (!missionaryForm.name.trim() || !missionaryForm.region.trim()) {
      toast.error("이름과 사역 지역을 입력해 주세요.");
      return;
    }
    createMissionary.mutate({
      ...missionaryForm,
      organization: missionaryForm.organization || undefined,
      profileImage: missionaryForm.profileImage || undefined,
      isActive: true,
      sortOrder: missionaries.reduce(
        (highest, missionary) => Math.max(highest, missionary.sortOrder),
        0,
      ) + 1,
    });
  };

  const submitGrant = () => {
    if (!selectedMemberId) {
      toast.error("성도를 선택해 주세요.");
      return;
    }
    const missionaryIds = resolveMissionaryGrantIds(
      selectedMissionarySelection,
      missionaries,
    );
    if (missionaryIds.length === 0) {
      toast.error(
        selectedMissionarySelection === "all"
          ? "등록된 선교사/사역지가 없습니다."
          : "선교사/사역지를 선택해 주세요.",
      );
      return;
    }
    createGrants.mutate({
      memberId: selectedMemberId,
      missionaryIds,
    });
  };

  const startMissionaryEdit = (missionary: typeof missionaries[number]) => {
    setEditingMissionaryId(missionary.id);
    setEditingMissionaryForm({
      name: missionary.name,
      region: missionary.region,
      continent: missionary.continent,
      sentYear: missionary.sentYear,
      organization: missionary.organization ?? "",
      profileImage: missionary.profileImage ?? "",
    });
  };

  const submitMissionaryEdit = () => {
    if (!editingMissionaryId) return;
    if (!editingMissionaryForm.name.trim() || !editingMissionaryForm.region.trim()) {
      toast.error("이름과 사역 지역을 입력해 주세요.");
      return;
    }
    updateMissionary.mutate({
      id: editingMissionaryId,
      ...editingMissionaryForm,
      organization: editingMissionaryForm.organization || undefined,
      profileImage: editingMissionaryForm.profileImage || null,
    });
  };

  if (loadingMissionaries) {
    return <p className="py-8 text-center text-gray-500">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">선교보고 관리</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          선교보고 작성 권한과 제출된 보고서를 관리합니다.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">선교사/사역지 추가</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className={adminFieldClass}
            placeholder="이름 또는 사역명"
            value={missionaryForm.name}
            onChange={(e) =>
              setMissionaryForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <input
            className={adminFieldClass}
            placeholder="사역 지역"
            value={missionaryForm.region}
            onChange={(e) =>
              setMissionaryForm((prev) => ({ ...prev, region: e.target.value }))
            }
          />
          <select
            className={adminFieldClass}
            value={missionaryForm.continent}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                continent: e.target.value as typeof missionaryForm.continent,
              }))
            }
          >
            {CONTINENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className={adminFieldClass}
            type="number"
            placeholder="시작 연도"
            value={missionaryForm.sentYear}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                sentYear: Number(e.target.value),
              }))
            }
          />
          <input
            className={adminFieldClass}
            placeholder="소속 기관"
            value={missionaryForm.organization}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                organization: e.target.value,
              }))
            }
          />
          <ProfileImageUploadField
            value={missionaryForm.profileImage}
            isUploading={profileImageUploadTarget === "create"}
            disabled={uploadProfileImage.isPending}
            onFileSelect={(file) => void handleProfileImageFile(file, "create")}
            onClear={() => setMissionaryForm((previous) => ({ ...previous, profileImage: "" }))}
          />
        </div>
        <button
          onClick={submitMissionary}
          disabled={createMissionary.isPending || uploadProfileImage.isPending}
          className="mt-3 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm text-white hover:bg-[#2E7D32] disabled:opacity-50"
        >
          추가
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-gray-800">등록된 선교사/사역지</h4>
            <p className="mt-0.5 text-xs text-gray-500">
              왼쪽 손잡이를 마우스로 끌어 표시 순서를 바꿀 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reorderMissionaries.isPending && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 순서 저장 중
              </span>
            )}
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-[#1B5E20]">
              {missionaries.length}개
            </span>
          </div>
        </div>
        <DndContext
          sensors={missionarySensors}
          collisionDetection={closestCenter}
          onDragEnd={handleMissionaryDragEnd}
        >
          <SortableContext
            items={displayMissionaries.map((missionary) => missionary.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
          {displayMissionaries.map((missionary) => {
            const isEditing = editingMissionaryId === missionary.id;
            return (
              <SortableMissionaryCard
                key={missionary.id}
                id={missionary.id}
                label={missionary.name}
                disabled={editingMissionaryId !== null || reorderMissionaries.isPending}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.name}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="이름 또는 사역명"
                      />
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.region}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, region: e.target.value }))}
                        placeholder="사역 지역"
                      />
                      <select
                        className={adminFieldClass}
                        value={editingMissionaryForm.continent}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({
                          ...prev,
                          continent: e.target.value as MissionaryFormState["continent"],
                        }))}
                      >
                        {CONTINENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        className={adminFieldClass}
                        type="number"
                        value={editingMissionaryForm.sentYear}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, sentYear: Number(e.target.value) }))}
                        placeholder="시작 연도"
                      />
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.organization}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, organization: e.target.value }))}
                        placeholder="소속 기관"
                      />
                      <ProfileImageUploadField
                        value={editingMissionaryForm.profileImage}
                        isUploading={profileImageUploadTarget === "edit"}
                        disabled={uploadProfileImage.isPending}
                        onFileSelect={(file) => void handleProfileImageFile(file, "edit")}
                        onClear={() => setEditingMissionaryForm((previous) => ({ ...previous, profileImage: "" }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMissionaryId(null)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={submitMissionaryEdit}
                        disabled={updateMissionary.isPending || uploadProfileImage.isPending}
                        className="rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs text-white hover:bg-[#2E7D32] disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {missionary.profileImage ? (
                        <img
                          src={missionary.profileImage}
                          alt={`${missionary.name} 프로필`}
                          className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-gray-50 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-300"
                          aria-label={`${missionary.name} 프로필 이미지 없음`}
                        >
                          <ImagePlus className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800">
                          {missionary.name} <span className="font-normal text-gray-400">· {missionary.region}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {CONTINENT_OPTIONS.find((option) => option.value === missionary.continent)?.label ?? missionary.continent}
                          {missionary.sentYear ? ` · ${missionary.sentYear}년` : ""}
                          {missionary.organization ? ` · ${missionary.organization}` : ""}
                          {!missionary.isActive ? " · 숨김" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startMissionaryEdit(missionary)}
                        className="rounded-lg border border-green-200 px-3 py-1.5 text-xs text-[#1B5E20] hover:bg-green-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`${missionary.name} 항목을 삭제할까요?`)) {
                            deleteMissionary.mutate({ id: missionary.id });
                          }
                        }}
                        disabled={deleteMissionary.isPending}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </SortableMissionaryCard>
            );
          })}
          {missionaries.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-5 text-center text-sm text-gray-400">
              등록된 선교사/사역지가 없습니다.
            </p>
          )}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">작성자 권한 부여</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-green-100 bg-green-50/60 p-3 md:col-span-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-sm font-bold text-[#1B5E20]">
                  성도 검색
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  이름을 입력한 뒤 아래 검색 결과를 클릭하면 작성자로 선택됩니다.
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#1B5E20] shadow-sm">
                {filteredMembers.length}명 검색됨
              </span>
            </div>
            <input
              type="text"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="예: 홍길동, 집사, 1구역, 010..."
              className={`${adminFieldClass} w-full border-green-200 bg-white`}
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-3">
            {selectedMember && (
              <div className="mb-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                선택됨: <span className="font-semibold">{selectedMember.name}</span>
                {selectedMember.position ? ` · ${selectedMember.position}` : ""}
                {selectedMember.department ? ` · ${selectedMember.department}` : ""}
                {selectedMember.district ? ` · ${selectedMember.district}` : ""}
              </div>
            )}
            <p className="mb-2 text-xs font-semibold text-gray-500">
              검색 결과에서 성도를 클릭하세요
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visibleMemberMatches.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setMemberSearch(member.name);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedMemberId === member.id
                      ? "border-[#1B5E20] bg-green-50 text-[#1B5E20]"
                      : "border-gray-200 bg-white text-gray-700 hover:border-green-200 hover:bg-green-50"
                  }`}
                >
                  <span className="block font-semibold">{member.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {[member.position, member.department, member.district, member.phone, member.email]
                      .filter(Boolean)
                      .join(" · ") || "추가 정보 없음"}
                  </span>
                </button>
              ))}
            </div>
            {memberSearch.trim() && filteredMembers.length === 0 && (
              <p className="mt-2 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-400">
                검색된 성도가 없습니다.
              </p>
            )}
            {filteredMembers.length > visibleMemberMatches.length && (
              <p className="mt-2 text-xs text-gray-400">
                검색 결과 {filteredMembers.length}명 중 상위 {visibleMemberMatches.length}명만 표시됩니다.
              </p>
            )}
          </div>
          <select
            className={adminFieldClass}
            value={selectedMemberId}
            onChange={(e) =>
              setSelectedMemberId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">성도 선택</option>
            {filteredMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.phone ? ` · ${member.phone}` : ""}
                {member.email ? ` (${member.email})` : ""}
              </option>
            ))}
          </select>
          <select
            className={adminFieldClass}
            value={selectedMissionarySelection}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedMissionarySelection(
                value === "all" ? "all" : value ? Number(value) : "",
              );
            }}
          >
            <option value="">선교사/사역지 선택</option>
            <option value="all" disabled={missionaries.length === 0}>
              전체 선교사/사역지 ({missionaries.length}곳)
            </option>
            {missionaries.map((missionary) => (
              <option key={missionary.id} value={missionary.id}>
                {missionary.name} · {missionary.region}
              </option>
            ))}
          </select>
          <button
            onClick={submitGrant}
            disabled={createGrants.isPending}
            className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm text-white hover:bg-[#2E7D32] disabled:opacity-50"
          >
            {createGrants.isPending
              ? "권한 부여 중..."
              : selectedMissionarySelection === "all"
                ? "전체 권한 부여"
                : "권한 부여"}
          </button>
        </div>
        {memberSearch.trim() && (
          <p className="mt-2 text-xs text-gray-500">
            검색 결과 {filteredMembers.length}명
          </p>
        )}

        <div className="mt-4 divide-y divide-gray-100">
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="text-sm">
                <p className="font-medium text-gray-800">
                  {grant.memberName ?? "성도"} · {grant.missionaryName ?? "선교사"}
                </p>
                <p className="text-xs text-gray-400">
                  {grant.memberEmail ?? "-"} · {grant.missionaryRegion ?? "-"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    grant.canWrite
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {grant.canWrite ? "활성" : "비활성"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateGrant.mutate({ id: grant.id, canWrite: !grant.canWrite })
                  }
                  disabled={updateGrant.isPending}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {grant.canWrite ? "비활성" : "활성"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`${grant.memberName ?? "성도"}님의 작성 권한을 삭제할까요?`)) {
                      deleteGrant.mutate({ id: grant.id });
                    }
                  }}
                  disabled={deleteGrant.isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {grants.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              아직 부여된 작성 권한이 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">선교보고 승인</h4>
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
            >
              <div>
                <p className="font-medium text-gray-800">{report.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {report.missionary.name} · {report.reportDate} ·{" "}
                  {STATUS_LABELS[report.status] ?? report.status}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() =>
                    reviewReport.mutate({ id: report.id, status: "published" })
                  }
                  className="rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs text-white hover:bg-[#2E7D32]"
                >
                  공개
                </button>
                <button
                  onClick={() =>
                    reviewReport.mutate({
                      id: report.id,
                      status: "rejected",
                      comment: "관리자 반려",
                    })
                  }
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                >
                  반려
                </button>
                <a
                  href={`/mission/edit/${report.id}`}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  수정
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`\"${report.title}\" 선교보고를 삭제할까요?`)) {
                      deleteReport.mutate({ id: report.id });
                    }
                  }}
                  disabled={deleteReport.isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              등록된 선교보고가 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
