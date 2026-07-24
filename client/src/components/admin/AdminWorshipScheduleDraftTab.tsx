import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_WORSHIP_SCHEDULE_DRAFT,
  WORSHIP_SCHEDULE_ICONS,
  WORSHIP_SCHEDULE_LIMITS,
  WORSHIP_SCHEDULE_THEMES,
  cloneWorshipScheduleContent,
  type WorshipScheduleContent,
  type WorshipScheduleEntry,
  type WorshipScheduleIcon,
  type WorshipScheduleSection,
  type WorshipScheduleTheme,
} from "@shared/worshipSchedule";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { WorshipScheduleCards } from "@/components/worship/WorshipScheduleCards";

const THEME_OPTIONS: Array<{
  value: WorshipScheduleTheme;
  label: string;
  swatch: string;
}> = [
  { value: "green", label: "초록", swatch: "bg-[#C8E6C9]" },
  { value: "blue", label: "파랑", swatch: "bg-blue-200" },
  { value: "amber", label: "노랑", swatch: "bg-amber-200" },
  { value: "rose", label: "분홍", swatch: "bg-rose-200" },
  { value: "purple", label: "보라", swatch: "bg-purple-200" },
  { value: "slate", label: "회색", swatch: "bg-slate-300" },
];

const ICON_OPTIONS: Array<{
  value: WorshipScheduleIcon;
  label: string;
  icon: string;
}> = [
  { value: "sun", label: "해", icon: "fa-sun" },
  { value: "church", label: "교회", icon: "fa-church" },
  { value: "moon", label: "달", icon: "fa-moon" },
  { value: "fire", label: "불꽃", icon: "fa-fire" },
  { value: "cross", label: "십자가", icon: "fa-cross" },
  { value: "heart", label: "하트", icon: "fa-heart" },
  { value: "users", label: "사람", icon: "fa-users" },
  { value: "bell", label: "종", icon: "fa-bell" },
];

const LOCAL_WORKING_DRAFT_KEY_PREFIX =
  "joych:worship-schedule:working-draft:v1";

type LocalWorkingDraft = {
  content: WorshipScheduleContent;
  revision: string | null;
  savedAt: string;
};

type ValidationIssue = {
  message: string;
  fieldId: string;
};

function newId(prefix: "section" | "entry") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`.slice(0, 64);
}

function formatSavedAt(value: string | null | undefined) {
  if (!value) return "아직 저장하지 않음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalWorkingDraft(value: unknown): value is LocalWorkingDraft {
  if (!isRecord(value) || !isRecord(value.content)) return false;
  if (
    typeof value.savedAt !== "string" ||
    (value.revision !== null && typeof value.revision !== "string") ||
    typeof value.content.notice !== "string" ||
    !Array.isArray(value.content.sections)
  ) {
    return false;
  }

  return value.content.sections.every(section => {
    if (
      !isRecord(section) ||
      typeof section.id !== "string" ||
      typeof section.title !== "string" ||
      typeof section.theme !== "string" ||
      !WORSHIP_SCHEDULE_THEMES.includes(
        section.theme as WorshipScheduleTheme,
      ) ||
      typeof section.icon !== "string" ||
      !WORSHIP_SCHEDULE_ICONS.includes(section.icon as WorshipScheduleIcon) ||
      !Array.isArray(section.entries)
    ) {
      return false;
    }

    return section.entries.every(
      entry =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.time === "string" &&
        typeof entry.note === "string",
    );
  });
}

function readLocalWorkingDraft(key: string) {
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isLocalWorkingDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalWorkingDraft(key: string, draft: LocalWorkingDraft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // 저장 공간 또는 브라우저 정책으로 실패해도 서버 저장 기능은 계속 사용합니다.
  }
}

function clearLocalWorkingDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 저장 공간 접근이 차단된 브라우저에서는 별도 처리가 필요하지 않습니다.
  }
}

function sectionTitleFieldId(sectionId: string) {
  return `worship-section-title-${sectionId}`;
}

function entryLabelFieldId(sectionId: string, entryId: string) {
  return `worship-entry-label-${sectionId}-${entryId}`;
}

function entryTimeFieldId(sectionId: string, entryId: string) {
  return `worship-entry-time-${sectionId}-${entryId}`;
}

function validateDraft(content: WorshipScheduleContent): ValidationIssue | null {
  if (!content.sections.length) {
    return {
      message: "예배 블록을 한 개 이상 추가해주세요.",
      fieldId: "worship-add-section",
    };
  }
  if (content.sections.length > WORSHIP_SCHEDULE_LIMITS.sections) {
    return {
      message: `예배 블록은 최대 ${WORSHIP_SCHEDULE_LIMITS.sections}개까지 추가할 수 있습니다.`,
      fieldId: "worship-add-section",
    };
  }
  for (let sectionIndex = 0; sectionIndex < content.sections.length; sectionIndex += 1) {
    const section = content.sections[sectionIndex];
    if (!section.title.trim()) {
      return {
        message: `${sectionIndex + 1}번째 예배 블록의 제목을 입력해주세요.`,
        fieldId: sectionTitleFieldId(section.id),
      };
    }
    if (!section.entries.length) {
      return {
        message: `"${section.title}" 블록에 예배시간을 한 개 이상 추가해주세요.`,
        fieldId: `worship-add-entry-${section.id}`,
      };
    }
    for (let entryIndex = 0; entryIndex < section.entries.length; entryIndex += 1) {
      const entry = section.entries[entryIndex];
      if (!entry.label.trim()) {
        return {
          message: `"${section.title}"의 ${entryIndex + 1}번째 예배 이름을 입력해주세요.`,
          fieldId: entryLabelFieldId(section.id, entry.id),
        };
      }
      if (!entry.time.trim()) {
        return {
          message: `"${section.title}"의 ${entry.label || entryIndex + 1} 시간을 입력해주세요.`,
          fieldId: entryTimeFieldId(section.id, entry.id),
        };
      }
    }
  }
  return null;
}

type PreviewWidth = "desktop" | "mobile";

type AdminWorshipScheduleDraftTabProps = {
  pageMode?: boolean;
};

export default function AdminWorshipScheduleDraftTab({
  pageMode = false,
}: AdminWorshipScheduleDraftTabProps) {
  const { user } = useAuth();
  const localWorkingDraftKey = `${LOCAL_WORKING_DRAFT_KEY_PREFIX}:${user?.id ?? "admin"}`;
  const [content, setContent] = useState<WorshipScheduleContent>(() =>
    cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT),
  );
  const [baseline, setBaseline] = useState("");
  const [revision, setRevision] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const [isEditing, setIsEditing] = useState(!pageMode);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    () => new Set(),
  );

  const query = trpc.cms.worshipSchedule.getDraft.useQuery(undefined, {
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const isDirty = hasHydrated && JSON.stringify(content) !== baseline;

  const hydrate = (
    draft: {
      content: WorshipScheduleContent;
      revision: string | null;
      updatedAt: string | null;
      updatedBy: string | null;
    },
    restoreLocalDraft = false,
  ) => {
    const serverContent = cloneWorshipScheduleContent(draft.content);
    const localDraft = restoreLocalDraft
      ? readLocalWorkingDraft(localWorkingDraftKey)
      : null;
    const hasDifferentLocalContent = Boolean(
      localDraft &&
        JSON.stringify(localDraft.content) !== JSON.stringify(serverContent),
    );
    const nextContent = hasDifferentLocalContent && localDraft
      ? cloneWorshipScheduleContent(localDraft.content)
      : serverContent;
    setContent(nextContent);
    setBaseline(JSON.stringify(serverContent));
    setRevision(
      hasDifferentLocalContent && localDraft
        ? localDraft.revision
        : draft.revision,
    );
    setLastSavedAt(draft.updatedAt);
    setLastSavedBy(draft.updatedBy);
    setHasHydrated(true);
    if (hasDifferentLocalContent) {
      toast.info(
        "이 브라우저에 남아 있던 저장 전 편집내용을 자동으로 복구했습니다.",
      );
    } else if (localDraft) {
      clearLocalWorkingDraft(localWorkingDraftKey);
    }
  };

  useEffect(() => {
    if (!query.data || hasHydrated) return;
    hydrate(query.data, true);
  }, [query.data, hasHydrated]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isDirty) {
      clearLocalWorkingDraft(localWorkingDraftKey);
      return;
    }
    writeLocalWorkingDraft(localWorkingDraftKey, {
      content,
      revision,
      savedAt: new Date().toISOString(),
    });
  }, [content, hasHydrated, isDirty, revision]);

  const saveMutation = trpc.cms.worshipSchedule.saveDraft.useMutation({
    onSuccess: result => {
      clearLocalWorkingDraft(localWorkingDraftKey);
      hydrate(result, false);
      toast.success(
        "예배시간(beta)을 저장했습니다. 관리자 전용 beta 화면에 바로 반영됩니다.",
      );
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const validationIssue = useMemo(() => validateDraft(content), [content]);

  const updateSection = (
    sectionId: string,
    updater: (section: WorshipScheduleSection) => WorshipScheduleSection,
  ) => {
    setContent(current => ({
      ...current,
      sections: current.sections.map(section =>
        section.id === sectionId ? updater(section) : section,
      ),
    }));
  };

  const addSection = () => {
    if (content.sections.length >= WORSHIP_SCHEDULE_LIMITS.sections) {
      toast.error(
        `예배 블록은 최대 ${WORSHIP_SCHEDULE_LIMITS.sections}개까지 추가할 수 있습니다.`,
      );
      return;
    }
    const theme =
      WORSHIP_SCHEDULE_THEMES[
        content.sections.length % WORSHIP_SCHEDULE_THEMES.length
      ];
    const icon =
      WORSHIP_SCHEDULE_ICONS[
        content.sections.length % WORSHIP_SCHEDULE_ICONS.length
      ];
    const section: WorshipScheduleSection = {
      id: newId("section"),
      title: "",
      theme,
      icon,
      entries: [
        {
          id: newId("entry"),
          label: "",
          time: "",
          note: "",
        },
      ],
    };
    setContent(current => ({
      ...current,
      sections: [...current.sections, section],
    }));
    setExpandedSectionIds(current => new Set(current).add(section.id));
  };

  const removeSection = (section: WorshipScheduleSection) => {
    if (content.sections.length === 1) {
      toast.error("예배 블록은 한 개 이상 있어야 합니다.");
      return;
    }
    if (!window.confirm(`"${section.title}" 블록을 삭제하시겠습니까?`)) return;
    setContent(current => ({
      ...current,
      sections: current.sections.filter(item => item.id !== section.id),
    }));
    setExpandedSectionIds(current => {
      const next = new Set(current);
      next.delete(section.id);
      return next;
    });
  };

  const moveSection = (sectionIndex: number, direction: -1 | 1) => {
    const targetIndex = sectionIndex + direction;
    if (targetIndex < 0 || targetIndex >= content.sections.length) return;
    setContent(current => {
      const sections = [...current.sections];
      [sections[sectionIndex], sections[targetIndex]] = [
        sections[targetIndex],
        sections[sectionIndex],
      ];
      return { ...current, sections };
    });
  };

  const addEntry = (sectionId: string) => {
    updateSection(sectionId, section => {
      if (
        section.entries.length >= WORSHIP_SCHEDULE_LIMITS.entriesPerSection
      ) {
        toast.error(
          `한 블록에는 예배시간을 최대 ${WORSHIP_SCHEDULE_LIMITS.entriesPerSection}개까지 추가할 수 있습니다.`,
        );
        return section;
      }
      const entry: WorshipScheduleEntry = {
        id: newId("entry"),
        label: "",
        time: "",
        note: "",
      };
      return { ...section, entries: [...section.entries, entry] };
    });
  };

  const updateEntry = (
    sectionId: string,
    entryId: string,
    patch: Partial<WorshipScheduleEntry>,
  ) => {
    updateSection(sectionId, section => ({
      ...section,
      entries: section.entries.map(entry =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    }));
  };

  const removeEntry = (sectionId: string, entry: WorshipScheduleEntry) => {
    const section = content.sections.find(item => item.id === sectionId);
    if (!section) return;
    if (section.entries.length === 1) {
      toast.error("각 예배 블록에는 예배시간이 한 개 이상 있어야 합니다.");
      return;
    }
    if (!window.confirm(`"${entry.label}" 시간을 삭제하시겠습니까?`)) return;
    updateSection(sectionId, current => ({
      ...current,
      entries: current.entries.filter(item => item.id !== entry.id),
    }));
  };

  const moveEntry = (
    sectionId: string,
    entryIndex: number,
    direction: -1 | 1,
  ) => {
    updateSection(sectionId, section => {
      const targetIndex = entryIndex + direction;
      if (targetIndex < 0 || targetIndex >= section.entries.length) {
        return section;
      }
      const entries = [...section.entries];
      [entries[entryIndex], entries[targetIndex]] = [
        entries[targetIndex],
        entries[entryIndex],
      ];
      return { ...section, entries };
    });
  };

  const saveDraft = () => {
    if (validationIssue) {
      toast.error(validationIssue.message);
      setExpandedSectionIds(
        new Set(content.sections.map(section => section.id)),
      );
      window.requestAnimationFrame(() => {
        const field = document.getElementById(validationIssue.fieldId);
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLButtonElement
        ) {
          field.focus({ preventScroll: true });
        }
      });
      return;
    }
    saveMutation.mutate({ content, expectedRevision: revision });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(current => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const closeInlineEditing = () => {
    if (isDirty) {
      toast.error(
        "변경사항을 먼저 저장하거나 서버 초안을 다시 불러온 뒤 편집을 닫아주세요.",
      );
      return;
    }
    setIsEditing(false);
    setExpandedSectionIds(new Set());
  };

  const reloadServerDraft = async () => {
    if (
      isDirty &&
      !window.confirm("저장하지 않은 변경사항을 버리고 서버 초안을 다시 불러올까요?")
    ) {
      return;
    }
    const result = await query.refetch();
    if (result.data) {
      clearLocalWorkingDraft(localWorkingDraftKey);
      hydrate(result.data, false);
      toast.success("서버에 저장된 체험 초안을 다시 불러왔습니다.");
    }
  };

  const loadExample = () => {
    if (
      !window.confirm(
        "현재 편집 내용을 현행 예배시간이 아닌 샘플 데이터로 바꿀까요?\n\n이 자료는 사용법 체험용이며, 실제 최신 예배시간과 다를 수 있습니다. 체험 초안 저장 버튼을 누르기 전까지 서버에는 반영되지 않습니다.",
      )
    ) {
      return;
    }
    setContent(cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT));
  };

  if (query.isLoading && !hasHydrated) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#1B5E20] border-t-transparent" />
          <p className="text-sm text-gray-500">예배시간(beta)을 불러오고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (query.error && !hasHydrated) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-bold">예배시간(beta)을 불러오지 못했습니다.</p>
        <p className="mt-1">{query.error.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20 sm:pb-0">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
            <i className="fas fa-flask" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-gray-900">관리자 전용 예배시간(beta)</h3>
              <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">
                관리자만 노출
              </span>
            </div>
            <p className="mt-1 break-keep text-sm leading-6 text-amber-900">
              관리자페이지에 저장한 내용이 이 beta 메뉴에 그대로 표시됩니다.
              여기서 수정해 저장하면 beta 화면에는 바로 반영되며, 현재 성도에게
              공개 중인 예배시간 안내 페이지에는 영향을 주지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {pageMode && !isEditing ? (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              <p>
                <span className="font-semibold text-gray-800">마지막 저장</span>{" "}
                {formatSavedAt(lastSavedAt)}
                {lastSavedBy ? ` · ${lastSavedBy}` : ""}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                현재 beta 메뉴에 표시되는 실제 모습입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="min-h-11 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E7D32]"
            >
              <i className="fas fa-pen mr-1.5" aria-hidden="true" />
              이 화면에서 수정
            </button>
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <WorshipScheduleCards content={content} />
          </section>
        </>
      ) : null}

      <div className={pageMode && !isEditing ? "hidden" : "contents"}>
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          <p>
            <span className="font-semibold text-gray-800">마지막 저장</span>{" "}
            {formatSavedAt(lastSavedAt)}
            {lastSavedBy ? ` · ${lastSavedBy}` : ""}
          </p>
          <p className={`mt-1 text-xs font-semibold ${isDirty ? "text-amber-600" : "text-[#1B5E20]"}`}>
            {isDirty
              ? "저장하지 않은 변경사항이 있습니다. 이 브라우저에 자동 임시보관 중입니다."
              : "서버 초안과 동일합니다."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void reloadServerDraft()}
            disabled={query.isFetching}
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <i className="fas fa-rotate mr-1.5" aria-hidden="true" />
            서버 초안 다시 불러오기
          </button>
          {!pageMode ? (
            <button
              type="button"
              onClick={loadExample}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-arrow-rotate-left mr-1.5" aria-hidden="true" />
              샘플 데이터로 바꾸기 (현행 아님)
            </button>
          ) : null}
          {pageMode ? (
            <button
              type="button"
              onClick={closeInlineEditing}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-xmark mr-1.5" aria-hidden="true" />
              편집 닫기
            </button>
          ) : null}
          <button
            type="button"
            onClick={saveDraft}
            disabled={saveMutation.isPending || !isDirty}
            className="min-h-10 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i
              className={`fas ${saveMutation.isPending ? "fa-spinner animate-spin" : "fa-floppy-disk"} mr-1.5`}
              aria-hidden="true"
            />
            저장
          </button>
        </div>
      </section>

      {validationIssue ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <i className="fas fa-circle-exclamation mr-2" aria-hidden="true" />
          {validationIssue.message}
        </div>
      ) : null}

      <div className="space-y-5">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">예배 블록 편집</h3>
              <p className="mt-1 text-xs text-gray-500">
                블록 {content.sections.length}개 · 각 블록 안에 예배시간을 추가할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedSectionIds(
                    expandedSectionIds.size === content.sections.length
                      ? new Set()
                      : new Set(content.sections.map(section => section.id)),
                  )
                }
                className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                <i
                  className={`fas ${
                    expandedSectionIds.size === content.sections.length
                      ? "fa-angles-up"
                      : "fa-angles-down"
                  } mr-1.5`}
                  aria-hidden="true"
                />
                {expandedSectionIds.size === content.sections.length
                  ? "모두 접기"
                  : "전체 펼치기"}
              </button>
              <button
                id="worship-add-section"
                type="button"
                onClick={addSection}
                disabled={
                  content.sections.length >= WORSHIP_SCHEDULE_LIMITS.sections
                }
                className="min-h-10 rounded-lg border border-[#1B5E20] bg-white px-4 py-2 text-sm font-bold text-[#1B5E20] hover:bg-[#F1F8F2] disabled:opacity-50"
              >
                <i className="fas fa-plus mr-1.5" aria-hidden="true" />
                예배 블록 추가
              </button>
            </div>
          </div>

          {content.sections.map((section, sectionIndex) => {
            const isSectionExpanded = expandedSectionIds.has(section.id);
            return (
              <article
                key={section.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
              <header
                className={`flex flex-col gap-3 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                  isSectionExpanded ? "border-b border-gray-100" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
                    {sectionIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate font-bold text-gray-900">
                      {section.title || "제목 없는 예배 블록"}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      예배시간 {section.entries.length}개
                      {section.entries[0]?.label
                        ? ` · ${section.entries[0].label}${
                            section.entries.length > 1 ? " 외" : ""
                          }`
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isSectionExpanded}
                    className="h-10 rounded-md border border-[#A5D6A7] bg-white px-3 text-xs font-bold text-[#1B5E20] hover:bg-[#F1F8F2]"
                  >
                    <i
                      className={`fas ${
                        isSectionExpanded ? "fa-chevron-up" : "fa-pen"
                      } mr-1.5`}
                      aria-hidden="true"
                    />
                    {isSectionExpanded ? "접기" : "수정"}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(sectionIndex, -1)}
                    disabled={sectionIndex === 0}
                    aria-label={`${section.title} 블록 위로 이동`}
                    className="h-10 min-w-10 rounded-md border border-gray-300 bg-white px-2.5 text-gray-600 hover:text-[#1B5E20] disabled:opacity-30"
                  >
                    <i className="fas fa-arrow-up" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(sectionIndex, 1)}
                    disabled={sectionIndex === content.sections.length - 1}
                    aria-label={`${section.title} 블록 아래로 이동`}
                    className="h-10 min-w-10 rounded-md border border-gray-300 bg-white px-2.5 text-gray-600 hover:text-[#1B5E20] disabled:opacity-30"
                  >
                    <i className="fas fa-arrow-down" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section)}
                    disabled={content.sections.length === 1}
                    className="ml-2 h-10 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    <i className="fas fa-trash-can mr-1" aria-hidden="true" />
                    블록 삭제
                  </button>
                </div>
              </header>

              {isSectionExpanded ? (
                <div className="space-y-5 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-gray-700">
                      블록 제목
                    </span>
                    <input
                      id={sectionTitleFieldId(section.id)}
                      value={section.title}
                      onChange={event =>
                        updateSection(section.id, current => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      maxLength={WORSHIP_SCHEDULE_LIMITS.title}
                      placeholder="예: 주일예배"
                      aria-invalid={!section.title.trim()}
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/15"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-gray-700">
                      아이콘
                    </span>
                    <select
                      value={section.icon}
                      onChange={event =>
                        updateSection(section.id, current => ({
                          ...current,
                          icon: event.target.value as WorshipScheduleIcon,
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                    >
                      {ICON_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-gray-700">
                    배경색
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {THEME_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateSection(section.id, current => ({
                            ...current,
                            theme: option.value,
                          }))
                        }
                        aria-pressed={section.theme === option.value}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                          section.theme === option.value
                            ? "border-[#1B5E20] bg-[#F1F8F2] text-[#1B5E20] ring-2 ring-[#1B5E20]/10"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full border border-black/5 ${option.swatch}`}
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        예배시간
                      </h4>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {section.entries.length}개 등록됨
                      </p>
                    </div>
                    <button
                      id={`worship-add-entry-${section.id}`}
                      type="button"
                      onClick={() => addEntry(section.id)}
                      disabled={
                        section.entries.length >=
                        WORSHIP_SCHEDULE_LIMITS.entriesPerSection
                      }
                      className="min-h-10 rounded-md border border-[#A5D6A7] bg-white px-3 py-2 text-xs font-bold text-[#1B5E20] hover:bg-[#F1F8F2] disabled:opacity-50"
                    >
                      <i className="fas fa-plus mr-1" aria-hidden="true" />
                      예배시간 추가
                    </button>
                  </div>

                  {section.entries.map((entry, entryIndex) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500">
                          시간 {entryIndex + 1}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              moveEntry(section.id, entryIndex, -1)
                            }
                            disabled={entryIndex === 0}
                            aria-label={`${entry.label} 위로 이동`}
                            className="h-10 min-w-10 rounded border border-gray-300 bg-white px-2 text-xs text-gray-600 disabled:opacity-30"
                          >
                            <i className="fas fa-arrow-up" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              moveEntry(section.id, entryIndex, 1)
                            }
                            disabled={
                              entryIndex === section.entries.length - 1
                            }
                            aria-label={`${entry.label} 아래로 이동`}
                            className="h-10 min-w-10 rounded border border-gray-300 bg-white px-2 text-xs text-gray-600 disabled:opacity-30"
                          >
                            <i className="fas fa-arrow-down" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(section.id, entry)}
                            disabled={section.entries.length === 1}
                            aria-label={`${entry.label} 삭제`}
                            className="ml-2 h-10 min-w-10 rounded border border-red-200 bg-white px-2 text-xs text-red-600 disabled:opacity-30"
                          >
                            <i className="fas fa-trash-can" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)]">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-gray-600">
                            예배 이름
                          </span>
                          <input
                            id={entryLabelFieldId(section.id, entry.id)}
                            value={entry.label}
                            onChange={event =>
                              updateEntry(section.id, entry.id, {
                                label: event.target.value,
                              })
                            }
                            maxLength={WORSHIP_SCHEDULE_LIMITS.label}
                            placeholder="예: 1부 예배"
                            aria-invalid={!entry.label.trim()}
                            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-gray-600">
                            시간
                          </span>
                          <input
                            id={entryTimeFieldId(section.id, entry.id)}
                            value={entry.time}
                            onChange={event =>
                              updateEntry(section.id, entry.id, {
                                time: event.target.value,
                              })
                            }
                            maxLength={WORSHIP_SCHEDULE_LIMITS.time}
                            placeholder="예: 오전 11:30"
                            aria-invalid={!entry.time.trim()}
                            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold text-gray-600">
                            장소·요일·비고
                          </span>
                          <input
                            value={entry.note}
                            onChange={event =>
                              updateEntry(section.id, entry.id, {
                                note: event.target.value,
                              })
                            }
                            maxLength={WORSHIP_SCHEDULE_LIMITS.note}
                            placeholder="예: 월~토 / 본당"
                            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </section>
                </div>
              ) : null}
            </article>
            );
          })}

          <label className="block rounded-xl border border-gray-200 bg-white p-4">
            <span className="mb-1.5 block text-sm font-bold text-gray-900">
              페이지 하단 안내문
            </span>
            <textarea
              value={content.notice}
              onChange={event =>
                setContent(current => ({
                  ...current,
                  notice: event.target.value,
                }))
              }
              maxLength={WORSHIP_SCHEDULE_LIMITS.notice}
              rows={7}
              className="min-h-44 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/15"
            />
            <span className="mt-1 block text-right text-xs text-gray-400">
              {content.notice.length}/{WORSHIP_SCHEDULE_LIMITS.notice}자
            </span>
          </label>
        </section>

        <aside className="min-w-0">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <header className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-gray-900">실시간 미리보기</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  입력하는 즉시 최종 카드 모양을 확인할 수 있습니다.
                </p>
              </div>
              <div className="inline-flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewWidth("desktop")}
                  aria-pressed={previewWidth === "desktop"}
                  className={`min-h-10 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    previewWidth === "desktop"
                      ? "bg-white text-[#1B5E20] shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <i className="fas fa-desktop mr-1" aria-hidden="true" />
                  PC
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewWidth("mobile")}
                  aria-pressed={previewWidth === "mobile"}
                  className={`min-h-10 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    previewWidth === "mobile"
                      ? "bg-white text-[#1B5E20] shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <i className="fas fa-mobile-screen mr-1" aria-hidden="true" />
                  모바일
                </button>
              </div>
            </header>
            <div className="overflow-x-auto bg-[#F7F7F5] p-3 sm:p-5">
              <div
                className={`mx-auto rounded-xl bg-[#F7F7F5] transition-[width] ${
                  previewWidth === "mobile"
                    ? "w-[390px] max-w-full"
                    : "w-[1000px] max-w-none"
                }`}
              >
                <div className="border-b border-gray-200 bg-white px-4 py-5 text-center">
                  <p
                    className="text-xl font-bold text-gray-900"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    예배시간 안내
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    기쁨의교회 예배 일정을 확인하세요
                  </p>
                </div>
                <div className="p-4">
                  <WorshipScheduleCards
                    content={content}
                    forceMobile={previewWidth === "mobile"}
                    forceDesktop={previewWidth === "desktop"}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-4 z-50 flex justify-end sm:hidden">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saveMutation.isPending || !isDirty}
          className="min-h-12 rounded-full bg-[#1B5E20] px-5 py-3 text-sm font-bold text-white shadow-lg ring-1 ring-white/80 disabled:opacity-50"
        >
          <i
            className={`fas ${saveMutation.isPending ? "fa-spinner animate-spin" : "fa-floppy-disk"} mr-1.5`}
            aria-hidden="true"
          />
          저장
        </button>
      </div>
      </div>
    </div>
  );
}
