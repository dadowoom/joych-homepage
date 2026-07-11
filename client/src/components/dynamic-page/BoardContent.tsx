import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  RichTextEditor,
  RichTextViewer,
  sanitizeRichTextHtml,
} from "@/components/ui/rich-text-editor";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";
import { FreeBoardContent } from "./FreeBoardContent";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import {
  ADMIN_RESOURCE_CATEGORY,
  DEFAULT_NOTICE_CATEGORY_LABEL,
  NOTICE_ALL_CATEGORY_LABEL,
  NOTICE_CATEGORY_SETTINGS_KEY,
  getNoticeWriteCategoryLabels,
  getVisibleNoticeFilterCategoryLabels,
  parseNoticeCategorySettings,
  sanitizeNoticePostCategory,
  type NoticeCategoryConfig,
} from "@shared/noticeCategories";

type BoardContentProps = {
  label?: string;
  href?: string | null;
  menuItemId?: number;
  menuSubItemId?: number;
  defaultViewMode?: ViewMode | null;
};

type NoticeFormState = {
  category: string;
  title: string;
  content: string;
  createdAt: string;
  thumbnailUrl: string;
  attachmentName: string;
  attachmentUrl: string;
  isPublished: boolean;
  isPinned: boolean;
  isSecret: boolean;
};

type BoardAttachment = {
  name: string;
  url: string;
};

type NoticeFormMode = "create" | "edit" | null;

function isFreeBoardPage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`.replace(/\s+/g, "");
  return normalized.includes("자유게시판") || normalized.includes("joytalk");
}

type NoticeBoardMode = "notice" | "adminResource";

type CustomBoard = {
  label: string;
  menuItemId?: number;
  menuSubItemId?: number;
};

function getCustomBoard({
  label,
  menuItemId,
  menuSubItemId,
}: BoardContentProps): CustomBoard {
  return {
    label: label?.trim() || "게시판",
    menuItemId,
    menuSubItemId,
  };
}

function normalizeNoticeCategory(category?: string | null) {
  return sanitizeNoticePostCategory(category);
}

function isNoticeBoardPage(label?: string) {
  const normalizedLabel = (label ?? "").replace(/\s+/g, "").toLowerCase();
  return (
    normalizedLabel === "공지사항" ||
    normalizedLabel === "교회소식" ||
    normalizedLabel === "hotnews"
  );
}

function isAdminResourcePage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`
    .replace(/\s+/g, "")
    .toLowerCase();
  return (
    normalized.includes("행정자료") ||
    normalized.includes("admin-data") ||
    normalized.includes("adminresource")
  );
}

function formatBoardDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function toDateTimeLocalValue(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000
  );
  return offsetDate.toISOString().slice(0, 16);
}

function isToday(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getNoticeViewCount(notice: unknown) {
  if (typeof notice !== "object" || notice === null) return 0;
  const value = (notice as { viewCount?: unknown }).viewCount;
  return typeof value === "number" ? value : 0;
}

function toPlainText(value?: string | null) {
  return sanitizeRichTextHtml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeViewMode(
  value?: string | null,
  fallback: ViewMode = "list"
): ViewMode {
  return value === "grid" ? "grid" : fallback;
}

function parseTargetPostId(searchString: string) {
  const rawValue = new URLSearchParams(searchString).get("post");
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const ATTACHMENT_MAX_BYTES = 1 * 1024 * 1024;
const ATTACHMENT_ACCEPT =
  ".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.webp,.gif";
const ATTACHMENT_LABEL = "\uCCA8\uBD80\uD30C\uC77C";
const ATTACHMENT_REMOVE_LABEL = "\uCCA8\uBD80 \uC81C\uAC70";
const ATTACHMENT_UPLOADING_LABEL = "\uCCA8\uBD80 \uC5C5\uB85C\uB4DC \uC911";
const ATTACHMENT_SELECT_LABEL = "\uCCA8\uBD80\uD30C\uC77C \uC120\uD0DD";
const ATTACHMENT_HELP_TEXT =
  "pdf, hwp, office \uBB38\uC11C, zip, \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC744 1MB\uAE4C\uC9C0 \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
const ATTACHMENT_TOO_LARGE_TEXT =
  "\uCCA8\uBD80\uD30C\uC77C\uC740 1MB \uC774\uD558 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
const ATTACHMENT_UPLOAD_SUCCESS_TEXT =
  "\uCCA8\uBD80\uD30C\uC77C \uC5C5\uB85C\uB4DC \uC644\uB8CC";
const ATTACHMENT_UPLOAD_FAILURE_LABEL =
  "\uCCA8\uBD80\uD30C\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328";
const IMAGE_MAX_BYTES = 1 * 1024 * 1024;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const IMAGE_HELP_TEXT =
  "\uC774\uBBF8\uC9C0 \uD30C\uC77C\uC744 1MB\uAE4C\uC9C0 \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
const IMAGE_ONLY_UPLOAD_TEXT =
  "\uC774\uBBF8\uC9C0 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
const IMAGE_TOO_LARGE_TEXT =
  "\uC774\uBBF8\uC9C0\uB294 1MB \uC774\uD558 \uD30C\uC77C\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";

function isImageUploadFile(file: File) {
  return (
    file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

function isImageFileName(fileName: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(fileName);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeAttachment(value: unknown): BoardAttachment | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as { name?: unknown; url?: unknown };
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!url) return null;
  return { name, url };
}

function parseAttachmentList(
  nameValue: unknown,
  urlValue: unknown
): BoardAttachment[] {
  if (typeof urlValue === "string" && urlValue.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(urlValue) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeAttachment)
          .filter((item): item is BoardAttachment => Boolean(item));
      }
    } catch {
      // Fall back to the legacy single attachment fields below.
    }
  }

  const name = typeof nameValue === "string" ? nameValue : "";
  const url = typeof urlValue === "string" ? urlValue : "";
  return url ? [{ name, url }] : [];
}

function serializeAttachmentList(attachments: BoardAttachment[]) {
  const normalized = attachments
    .map(item => ({
      name: item.name.trim(),
      url: item.url.trim(),
    }))
    .filter(item => item.url);

  if (normalized.length === 0) {
    return { attachmentName: "", attachmentUrl: "" };
  }

  if (normalized.length === 1) {
    return {
      attachmentName: normalized[0].name,
      attachmentUrl: normalized[0].url,
    };
  }

  return {
    attachmentName: `${normalized.length}개 첨부파일`,
    attachmentUrl: JSON.stringify(normalized),
  };
}

function NoticeBoardContent({
  mode = "notice",
  customBoard,
  defaultViewMode = "list",
}: {
  mode?: NoticeBoardMode;
  customBoard?: CustomBoard;
  defaultViewMode?: ViewMode | null;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdminResource = mode === "adminResource";
  const isCustomBoard = Boolean(customBoard);
  const canManageNotices = canManageBoardContent(user, "content:notices");
  const supportsAttachments = isAdminResource || isCustomBoard;
  const supportsMultipleAttachments = supportsAttachments;
  const customBoardSource = customBoard?.menuSubItemId
    ? { menuSubItemId: customBoard.menuSubItemId }
    : customBoard?.menuItemId
      ? { menuItemId: customBoard.menuItemId }
      : undefined;
  const [activeCategory, setActiveCategory] = useState("전체");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    normalizeViewMode(defaultViewMode)
  );
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [formMode, setFormMode] = useState<NoticeFormMode>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const searchString = useSearch();
  const targetPostId = useMemo(
    () => parseTargetPostId(searchString),
    [searchString]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewedNoticeIdsRef = useRef<Set<number>>(new Set());
  const desktopRowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const pendingScrollPostIdRef = useRef<number | null>(null);
  const handledTargetPostIdRef = useRef<number | null>(null);

  useEffect(() => {
    setViewMode(normalizeViewMode(defaultViewMode));
  }, [defaultViewMode]);

  const getBlankForm = (): NoticeFormState => ({
    category: isAdminResource
      ? ADMIN_RESOURCE_CATEGORY
      : DEFAULT_NOTICE_CATEGORY_LABEL,
    title: "",
    content: "",
    createdAt: toDateTimeLocalValue(),
    thumbnailUrl: "",
    attachmentName: "",
    attachmentUrl: "",
    isPublished: true,
    isPinned: false,
    isSecret: false,
  });

  const [formState, setFormState] = useState<NoticeFormState>(getBlankForm);
  const noticeQuery = trpc.home.noticeBoard.useQuery(undefined, {
    enabled: !isAdminResource && !isCustomBoard,
  });
  const adminNoticeQuery = trpc.cms.notices.list.useQuery(undefined, {
    enabled: canManageNotices && !isAdminResource && !isCustomBoard,
  });
  const adminResourceQuery = trpc.home.adminResourceBoard.useQuery(undefined, {
    enabled: isAdminResource,
  });
  const customBoardQuery = trpc.home.dynamicBoardPosts.useQuery(
    customBoardSource ?? { menuItemId: 0 },
    { enabled: isCustomBoard && Boolean(customBoardSource) }
  );
  const { data: settings } = trpc.home.settings.useQuery(undefined, {
    enabled: !isAdminResource && !isCustomBoard,
  });
  const noticeCategorySettings = useMemo(
    () => parseNoticeCategorySettings(settings?.[NOTICE_CATEGORY_SETTINGS_KEY]),
    [settings]
  );
  const visibleNoticeCategories = useMemo(
    () => getVisibleNoticeFilterCategoryLabels(noticeCategorySettings),
    [noticeCategorySettings]
  );
  const writeNoticeCategories = useMemo(
    () => getNoticeWriteCategoryLabels(noticeCategorySettings),
    [noticeCategorySettings]
  );
  const notices = isCustomBoard
    ? customBoardQuery.data
    : isAdminResource
      ? adminResourceQuery.data
      : canManageNotices
        ? (adminNoticeQuery.data ?? []).filter(
            notice =>
              notice.category !== ADMIN_RESOURCE_CATEGORY &&
              !String(notice.category ?? "").startsWith("menu-board:")
          )
        : noticeQuery.data;
  const isLoading = isCustomBoard
    ? customBoardQuery.isLoading
    : isAdminResource
      ? adminResourceQuery.isLoading
      : canManageNotices
        ? adminNoticeQuery.isLoading
        : noticeQuery.isLoading;
  const totalLabel = isAdminResource
    ? "자료"
    : isCustomBoard
      ? "게시글"
      : "소식";
  const boardDescription = isAdminResource
    ? "행정자료를 게시판 형태로 확인할 수 있습니다."
    : isCustomBoard
      ? "이 메뉴에 등록된 게시글만 표시됩니다."
      : "공지와 안내를 게시판 형태로 확인할 수 있습니다.";
  const createButtonLabel = isAdminResource
    ? "행정자료 작성"
    : isCustomBoard
      ? "게시글 작성"
      : "공지사항 작성";
  const emptyText = isAdminResource
    ? "등록된 행정자료가 없습니다."
    : "등록된 게시글이 없습니다.";
  const noResultText = isAdminResource
    ? "해당 조건의 행정자료가 없습니다."
    : "해당 조건의 게시글이 없습니다.";
  const effectiveSearchField =
    (isAdminResource || isCustomBoard) && searchField === "category"
      ? "title"
      : searchField;

  const invalidateNoticeData = () => {
    void utils.cms.notices.list.invalidate();
    void utils.home.notices.invalidate();
    void utils.home.noticeBoard.invalidate();
    void utils.home.adminResourceBoard.invalidate();
    if (customBoardSource) {
      void utils.home.dynamicBoardPosts.invalidate(customBoardSource);
    }
    void utils.home.settings.invalidate();
  };

  const uploadImageMutation = trpc.cms.upload.image.useMutation({
    onError: error => toast.error(`이미지 업로드 실패: ${error.message}`),
  });

  const uploadAttachmentMutation = trpc.cms.upload.attachment.useMutation({
    onError: error =>
      toast.error(`${ATTACHMENT_UPLOAD_FAILURE_LABEL}: ${error.message}`),
  });

  const createMutation = trpc.cms.notices.create.useMutation({
    onSuccess: () => {
      toast.success(
        isAdminResource
          ? "행정자료가 등록됐습니다."
          : isCustomBoard
            ? "게시글이 등록됐습니다."
            : "공지사항이 등록됐습니다."
      );
      setFormMode(null);
      setFormState(getBlankForm());
      invalidateNoticeData();
    },
    onError: error => toast.error(`등록 실패: ${error.message}`),
  });

  const updateMutation = trpc.cms.notices.update.useMutation({
    onSuccess: () => {
      toast.success(
        isAdminResource
          ? "행정자료가 수정됐습니다."
          : isCustomBoard
            ? "게시글이 수정됐습니다."
            : "공지사항이 수정됐습니다."
      );
      setFormMode(null);
      setEditingNoticeId(null);
      invalidateNoticeData();
    },
    onError: error => toast.error(`수정 실패: ${error.message}`),
  });

  const deleteMutation = trpc.cms.notices.delete.useMutation({
    onSuccess: () => {
      toast.success(
        isAdminResource
          ? "행정자료가 삭제됐습니다."
          : isCustomBoard
            ? "게시글이 삭제됐습니다."
            : "공지사항이 삭제됐습니다."
      );
      setFormMode(null);
      setEditingNoticeId(null);
      invalidateNoticeData();
    },
    onError: error => toast.error(`삭제 실패: ${error.message}`),
  });

  const createDynamicPostMutation =
    trpc.cms.dynamicBoards.createPost.useMutation({
      onSuccess: () => {
        toast.success("게시글이 등록됐습니다.");
        setFormMode(null);
        setFormState(getBlankForm());
        invalidateNoticeData();
      },
      onError: error => toast.error(`등록 실패: ${error.message}`),
    });

  const updateDynamicPostMutation =
    trpc.cms.dynamicBoards.updatePost.useMutation({
      onSuccess: () => {
        toast.success("게시글이 수정됐습니다.");
        setFormMode(null);
        setEditingNoticeId(null);
        invalidateNoticeData();
      },
      onError: error => toast.error(`수정 실패: ${error.message}`),
    });

  const deleteDynamicPostMutation =
    trpc.cms.dynamicBoards.deletePost.useMutation({
      onSuccess: () => {
        toast.success("게시글이 삭제됐습니다.");
        setFormMode(null);
        setEditingNoticeId(null);
        invalidateNoticeData();
      },
      onError: error => toast.error(`삭제 실패: ${error.message}`),
    });

  const updateCategoriesMutation =
    trpc.cms.notices.categories.update.useMutation({
      onSuccess: () => {
        toast.success("공지사항 분류가 저장됐습니다.");
        invalidateNoticeData();
      },
      onError: error => toast.error(`분류 저장 실패: ${error.message}`),
    });

  const trackNoticeViewMutation = trpc.home.trackNoticeView.useMutation({
    onSuccess: () => {
      void utils.home.notices.invalidate();
      void utils.home.noticeBoard.invalidate();
      void utils.home.adminResourceBoard.invalidate();
    },
  });

  const trackDynamicPostViewMutation =
    trpc.home.trackDynamicBoardPostView.useMutation({
      onSuccess: () => {
        if (customBoardSource) {
          void utils.home.dynamicBoardPosts.invalidate(customBoardSource);
        }
      },
    });

  const sortedNotices = useMemo(() => {
    return [...(notices ?? [])].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notices]);

  useEffect(() => {
    if (
      isAdminResource ||
      isCustomBoard ||
      visibleNoticeCategories.includes(activeCategory)
    )
      return;
    setActiveCategory(visibleNoticeCategories[0] ?? NOTICE_ALL_CATEGORY_LABEL);
    setPage(1);
  }, [activeCategory, isAdminResource, isCustomBoard, visibleNoticeCategories]);

  const trackOpenedNotice = (noticeId: number) => {
    if (viewedNoticeIdsRef.current.has(noticeId)) return;

    viewedNoticeIdsRef.current.add(noticeId);
    if (isCustomBoard) {
      trackDynamicPostViewMutation.mutate({ id: noticeId });
      return;
    }
    trackNoticeViewMutation.mutate({ id: noticeId });
  };

  const handleToggleNotice = (noticeId: number) => {
    const willOpen = expandedId !== noticeId;
    setExpandedId(willOpen ? noticeId : null);

    // 같은 목록 화면에서 같은 글을 접었다 펼쳐도 조회수가 계속 오르지 않게 막는다.
    if (!willOpen) return;

    trackOpenedNotice(noticeId);
  };

  const categoryFilteredNotices =
    isAdminResource ||
    isCustomBoard ||
    activeCategory === NOTICE_ALL_CATEGORY_LABEL
      ? sortedNotices
      : sortedNotices.filter(
          notice =>
            normalizeNoticeCategory(getPostCategory(notice)) === activeCategory
        );
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredNotices = normalizedKeyword
    ? categoryFilteredNotices.filter(notice => {
        const titleText = notice.title.toLowerCase();
        const categoryText = normalizeNoticeCategory(
          getPostCategory(notice)
        ).toLowerCase();
        const contentText = toPlainText(notice.content).toLowerCase();
        if (
          !isAdminResource &&
          !isCustomBoard &&
          effectiveSearchField === "category"
        )
          return categoryText.includes(normalizedKeyword);
        if (effectiveSearchField === "content")
          return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : categoryFilteredNotices;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleNotices = filteredNotices.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );
  const newNoticeCount = filteredNotices.filter(notice =>
    isToday(notice.createdAt)
  ).length;
  const formCategoryOptions = useMemo(() => {
    if (isAdminResource || isCustomBoard) return [];
    const options = [...writeNoticeCategories];
    const current = sanitizeNoticePostCategory(
      formState.category,
      options[0] ?? DEFAULT_NOTICE_CATEGORY_LABEL
    );
    if (current && !options.includes(current)) options.unshift(current);
    return options;
  }, [
    formState.category,
    isAdminResource,
    isCustomBoard,
    writeNoticeCategories,
  ]);

  useEffect(() => {
    if (!targetPostId) {
      pendingScrollPostIdRef.current = null;
      handledTargetPostIdRef.current = null;
      return;
    }

    if (handledTargetPostIdRef.current === targetPostId) return;

    const targetIndex = filteredNotices.findIndex(
      notice => notice.id === targetPostId
    );
    if (targetIndex === -1) return;

    const targetPage = Math.floor(targetIndex / pageSize) + 1;
    if (page !== targetPage) {
      setPage(targetPage);
    }

    if (expandedId !== targetPostId) {
      setExpandedId(targetPostId);
    }

    trackOpenedNotice(targetPostId);
    pendingScrollPostIdRef.current = targetPostId;
  }, [expandedId, filteredNotices, page, targetPostId]);

  useEffect(() => {
    if (!targetPostId || pendingScrollPostIdRef.current !== targetPostId)
      return;
    if (!visibleNotices.some(notice => notice.id === targetPostId)) return;

    const prefersDesktopTable =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches &&
      viewMode === "list";
    const element = prefersDesktopTable
      ? (desktopRowRefs.current.get(targetPostId) ??
        cardRefs.current.get(targetPostId))
      : (cardRefs.current.get(targetPostId) ??
        desktopRowRefs.current.get(targetPostId));

    if (!element) return;

    const timer = window.setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollPostIdRef.current = null;
      handledTargetPostIdRef.current = targetPostId;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [targetPostId, viewMode, visibleNotices]);

  const setDesktopRowRef =
    (noticeId: number) => (node: HTMLTableRowElement | null) => {
      if (node) {
        desktopRowRefs.current.set(noticeId, node);
        return;
      }

      desktopRowRefs.current.delete(noticeId);
    };

  const setCardRef = (noticeId: number) => (node: HTMLElement | null) => {
    if (node) {
      cardRefs.current.set(noticeId, node);
      return;
    }

    cardRefs.current.delete(noticeId);
  };

  const openCreateForm = () => {
    setFormMode("create");
    setEditingNoticeId(null);
    setExpandedId(null);
    setFormState(getBlankForm());
  };

  const openEditForm = (notice: NonNullable<typeof notices>[number]) => {
    const attachmentFields = getPostAttachmentFields(notice);
    setFormMode("edit");
    setEditingNoticeId(notice.id);
    setFormState({
      category: isAdminResource
        ? ADMIN_RESOURCE_CATEGORY
        : sanitizeNoticePostCategory(
            getPostCategory(notice),
            writeNoticeCategories[0] ?? DEFAULT_NOTICE_CATEGORY_LABEL
          ),
      title: notice.title,
      content: notice.content ?? "",
      createdAt: toDateTimeLocalValue(notice.createdAt),
      thumbnailUrl: notice.thumbnailUrl ?? "",
      attachmentName: attachmentFields.name,
      attachmentUrl: attachmentFields.url,
      isPublished: notice.isPublished,
      isPinned: notice.isPinned,
      isSecret: Boolean(notice.isSecret),
    });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingNoticeId(null);
    setFormState(getBlankForm());
  };

  const handleUploadFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const invalidFile = selectedFiles.find(file => {
      const isImage = isImageUploadFile(file);
      if (!supportsAttachments && !isImage) return true;
      if (!supportsAttachments && file.size > IMAGE_MAX_BYTES) return true;
      return supportsAttachments && file.size > ATTACHMENT_MAX_BYTES;
    });

    if (invalidFile) {
      if (!supportsAttachments && !isImageUploadFile(invalidFile)) {
        toast.error(IMAGE_ONLY_UPLOAD_TEXT);
      } else if (!supportsAttachments) {
        toast.error(IMAGE_TOO_LARGE_TEXT);
      } else {
        toast.error(ATTACHMENT_TOO_LARGE_TEXT);
      }
      event.target.value = "";
      return;
    }

    setUploadingFile(true);
    try {
      if (!supportsAttachments) {
        const file = selectedFiles[0];
        const base64 = await readFileAsBase64(file);
        const { url } = await uploadImageMutation.mutateAsync({
          base64,
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
        });
        setFormState(previous => ({ ...previous, thumbnailUrl: url }));
        toast.success(ATTACHMENT_UPLOAD_SUCCESS_TEXT);
        return;
      }

      const uploadedAttachments: BoardAttachment[] = [];
      for (const file of selectedFiles) {
        const base64 = await readFileAsBase64(file);
        const result = await uploadAttachmentMutation.mutateAsync({
          base64,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        });
        uploadedAttachments.push({ name: result.fileName, url: result.url });
      }

      setFormState(previous => ({
        ...previous,
        thumbnailUrl:
          previous.thumbnailUrl ||
          uploadedAttachments.find(attachment =>
            isImageFileName(attachment.name)
          )?.url ||
          "",
        ...serializeAttachmentList(
          supportsMultipleAttachments
            ? [
                ...parseAttachmentList(
                  previous.attachmentName,
                  previous.attachmentUrl
                ),
                ...uploadedAttachments,
              ]
            : uploadedAttachments.slice(-1)
        ),
      }));
      toast.success(ATTACHMENT_UPLOAD_SUCCESS_TEXT);
    } finally {
      setUploadingFile(false);
      event.target.value = "";
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = formState.title.trim();
    if (!title) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    const payload = {
      category: isAdminResource
        ? ADMIN_RESOURCE_CATEGORY
        : sanitizeNoticePostCategory(
            formState.category,
            writeNoticeCategories[0] ?? DEFAULT_NOTICE_CATEGORY_LABEL
          ),
      title,
      content: formState.content.trim() || undefined,
      createdAt: formState.createdAt
        ? new Date(formState.createdAt)
        : undefined,
      thumbnailUrl: formState.thumbnailUrl.trim(),
      attachmentName: supportsAttachments
        ? formState.attachmentName.trim()
        : undefined,
      attachmentUrl: supportsAttachments
        ? formState.attachmentUrl.trim()
        : undefined,
      isPublished: formState.isPublished,
      isPinned: formState.isPinned,
      isSecret: formState.isSecret,
    };

    if (isCustomBoard) {
      if (!customBoardSource) {
        toast.error(
          "게시판 연결 정보를 찾을 수 없습니다. 메뉴를 다시 저장한 뒤 시도해주세요."
        );
        return;
      }
      const dynamicPayload = {
        ...customBoardSource,
        title,
        content: formState.content.trim() || undefined,
        createdAt: formState.createdAt
          ? new Date(formState.createdAt)
          : undefined,
        thumbnailUrl: formState.thumbnailUrl.trim(),
        attachmentName: supportsAttachments
          ? formState.attachmentName.trim()
          : undefined,
        attachmentUrl: supportsAttachments
          ? formState.attachmentUrl.trim()
          : undefined,
        isPublished: formState.isPublished,
        isPinned: formState.isPinned,
        isSecret: formState.isSecret,
      };
      if (formMode === "edit" && editingNoticeId) {
        updateDynamicPostMutation.mutate({
          id: editingNoticeId,
          title,
          content: dynamicPayload.content,
          createdAt: dynamicPayload.createdAt,
          thumbnailUrl: dynamicPayload.thumbnailUrl,
          attachmentName: dynamicPayload.attachmentName,
          attachmentUrl: dynamicPayload.attachmentUrl,
          isPublished: dynamicPayload.isPublished,
          isPinned: dynamicPayload.isPinned,
          isSecret: dynamicPayload.isSecret,
        });
        return;
      }
      createDynamicPostMutation.mutate(dynamicPayload);
      return;
    }

    if (formMode === "edit" && editingNoticeId) {
      updateMutation.mutate({ id: editingNoticeId, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleDelete = (id: number) => {
    const message = isAdminResource
      ? "이 행정자료를 삭제할까요?"
      : isCustomBoard
        ? "이 게시글을 삭제할까요?"
        : "이 공지사항을 삭제할까요?";
    if (!window.confirm(message)) return;
    if (isCustomBoard) {
      deleteDynamicPostMutation.mutate({ id });
      return;
    }
    deleteMutation.mutate({ id });
  };

  const saveNoticeCategories = (categories: NoticeCategoryConfig[]) => {
    updateCategoriesMutation.mutate({ categories });
  };

  const addNoticeCategory = () => {
    const label = newCategoryLabel.trim().replace(/\s+/g, " ");
    if (!label) {
      toast.error("추가할 분류 이름을 입력해주세요.");
      return;
    }
    if (label === ADMIN_RESOURCE_CATEGORY) {
      toast.error("행정자료는 공지사항 분류로 사용할 수 없습니다.");
      return;
    }
    if (noticeCategorySettings.some(category => category.label === label)) {
      toast.error("이미 등록된 분류입니다.");
      return;
    }
    saveNoticeCategories([
      ...noticeCategorySettings,
      { label, isVisible: true },
    ]);
    setNewCategoryLabel("");
  };

  const toggleNoticeCategory = (label: string) => {
    saveNoticeCategories(
      noticeCategorySettings.map(category =>
        category.label === label
          ? { ...category, isVisible: !category.isVisible }
          : category
      )
    );
  };

  const deleteNoticeCategory = (label: string) => {
    if (
      !window.confirm(
        `"${label}" 분류 메뉴를 삭제할까요? 기존 글은 삭제되지 않습니다.`
      )
    )
      return;
    saveNoticeCategories(
      noticeCategorySettings.filter(category => category.label !== label)
    );
  };

  const renderCategoryManager = () => {
    if (!canManageNotices || isAdminResource || isCustomBoard) return null;

    return (
      <div className="border border-emerald-100 bg-emerald-50/60 p-4">
        <button
          type="button"
          onClick={() => setCategoryManagerOpen(open => !open)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              분류 관리
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              공지사항 상단 분류 메뉴를 추가, 삭제, 숨김 처리합니다.
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-[#1B5E20]">
            {categoryManagerOpen ? "닫기" : "열기"}
          </span>
        </button>
        {categoryManagerOpen && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {noticeCategorySettings.map(category => (
                <div
                  key={category.label}
                  className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleNoticeCategory(category.label)}
                    disabled={updateCategoriesMutation.isPending}
                    className={`h-5 w-9 rounded-full p-0.5 transition-colors ${category.isVisible ? "bg-[#1B5E20]" : "bg-gray-300"}`}
                    aria-label={`${category.label} ${category.isVisible ? "숨기기" : "보이기"}`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${category.isVisible ? "translate-x-4" : ""}`}
                    />
                  </button>
                  <span
                    className={
                      category.isVisible ? "text-gray-800" : "text-gray-400"
                    }
                  >
                    {category.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteNoticeCategory(category.label)}
                    disabled={updateCategoriesMutation.isPending}
                    className="text-gray-300 hover:text-red-500"
                    aria-label={`${category.label} 삭제`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={newCategoryLabel}
                onChange={event => setNewCategoryLabel(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addNoticeCategory();
                  }
                }}
                placeholder="새 분류 이름"
                className="h-9 min-w-48 flex-1 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
              />
              <button
                type="button"
                onClick={addNoticeCategory}
                disabled={updateCategoriesMutation.isPending}
                className="inline-flex h-9 items-center gap-1 bg-[#1B5E20] px-3 text-sm font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                추가
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNoticeForm = () => {
    if (!canManageNotices || !formMode) return null;
    const isSaving =
      createMutation.isPending ||
      updateMutation.isPending ||
      createDynamicPostMutation.isPending ||
      updateDynamicPostMutation.isPending;
    const formAttachments = parseAttachmentList(
      formState.attachmentName,
      formState.attachmentUrl
    );
    const removeFormAttachment = (attachmentUrl: string) => {
      const nextAttachments = formAttachments.filter(
        attachment => attachment.url !== attachmentUrl
      );
      setFormState(previous => ({
        ...previous,
        thumbnailUrl: nextAttachments.some(
          attachment => attachment.url === previous.thumbnailUrl
        )
          ? previous.thumbnailUrl
          : "",
        ...serializeAttachmentList(nextAttachments),
      }));
    };
    const formTitle =
      formMode === "edit"
        ? `${createButtonLabel.replace("작성", "수정")}`
        : createButtonLabel;

    return (
      <form onSubmit={handleSubmit} className="border border-gray-200 bg-white">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-900">
              {formTitle}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              작성자는 로그인 계정 기준으로 처리되므로 이메일 입력은 받지
              않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={closeForm}
            className="inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-700"
            aria-label="작성 폼 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          {!isAdminResource && !isCustomBoard && (
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-gray-700">
                분류
              </span>
              <select
                value={formState.category}
                onChange={event =>
                  setFormState(previous => ({
                    ...previous,
                    category: event.target.value,
                  }))
                }
                className="h-10 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
              >
                {formCategoryOptions.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-gray-700">
              작성자
            </span>
            <input
              value="관리자"
              readOnly
              className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </label>
          <label
            className={`space-y-2 ${isAdminResource ? "md:col-span-2" : "md:col-span-2"}`}
          >
            <span className="block text-sm font-semibold text-gray-700">
              제목
            </span>
            <input
              value={formState.title}
              onChange={event =>
                setFormState(previous => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
              placeholder={
                isAdminResource
                  ? "예: 2026년 행정자료 안내"
                  : "예: 2026년 공동의회 안내"
              }
              className="h-10 w-full border border-gray-300 px-3 text-sm outline-none focus:border-[#1B5E20]"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-gray-700">
              등록일시
            </span>
            <input
              type="datetime-local"
              value={formState.createdAt}
              onChange={event =>
                setFormState(previous => ({
                  ...previous,
                  createdAt: event.target.value,
                }))
              }
              className="h-10 w-full border border-gray-300 px-3 text-sm outline-none focus:border-[#1B5E20] md:max-w-xs"
            />
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-gray-700">
              내용
            </span>
            <RichTextEditor
              value={formState.content}
              onChange={value =>
                setFormState(previous => ({ ...previous, content: value }))
              }
              placeholder="본문 내용을 입력해주세요."
              minHeightClassName="min-h-56 max-h-[55vh]"
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="block text-sm font-semibold text-gray-700">
                {ATTACHMENT_LABEL}
              </span>
              {(formState.thumbnailUrl || formAttachments.length > 0) && (
                <button
                  type="button"
                  onClick={() =>
                    setFormState(previous => ({
                      ...previous,
                      thumbnailUrl: "",
                      attachmentName: "",
                      attachmentUrl: "",
                    }))
                  }
                  className="inline-flex h-8 items-center gap-1 border border-red-200 px-3 text-xs text-red-500 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                  {ATTACHMENT_REMOVE_LABEL}
                </button>
              )}
            </div>
            {formState.thumbnailUrl && (
              <div className="max-w-sm border border-gray-200 bg-gray-50 p-2">
                <img
                  src={formState.thumbnailUrl}
                  alt=""
                  className="max-h-40 w-full object-contain"
                  onError={event => {
                    (event.target as HTMLImageElement).style.display = "none";
                  }}
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="inline-flex h-9 items-center gap-2 border border-[#1B5E20] px-3 text-sm font-medium text-[#1B5E20] hover:bg-[#F1F8E9] disabled:opacity-50"
              >
                {uploadingFile ? (
                  <Upload className="h-4 w-4 animate-bounce" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {uploadingFile
                  ? ATTACHMENT_UPLOADING_LABEL
                  : ATTACHMENT_SELECT_LABEL}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple={supportsMultipleAttachments}
                accept={supportsAttachments ? ATTACHMENT_ACCEPT : IMAGE_ACCEPT}
                className="hidden"
                onChange={handleUploadFileChange}
              />
              <div className="min-w-0 flex-1 border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {formAttachments.length > 0 ? (
                  <div className="space-y-1">
                    {formAttachments.map(attachment => (
                      <div
                        key={attachment.url}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <a
                          href={attachment.url}
                          className="inline-flex min-w-0 flex-1 items-center gap-2 text-[#1B5E20] hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {attachment.name || ATTACHMENT_LABEL}
                          </span>
                        </a>
                        {supportsMultipleAttachments && (
                          <button
                            type="button"
                            onClick={() => removeFormAttachment(attachment.url)}
                            className="shrink-0 text-[11px] text-red-500 hover:underline"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>
                    {supportsAttachments
                      ? ATTACHMENT_HELP_TEXT
                      : IMAGE_HELP_TEXT}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formState.isPublished}
                onChange={event =>
                  setFormState(previous => ({
                    ...previous,
                    isPublished: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#1B5E20]"
              />
              게시
            </label>
            {!isAdminResource && !isCustomBoard && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.isPinned}
                  onChange={event =>
                    setFormState(previous => ({
                      ...previous,
                      isPinned: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#1B5E20]"
                />
                공지글 지정
              </label>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formState.isSecret}
                onChange={event =>
                  setFormState(previous => ({
                    ...previous,
                    isSecret: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[#1B5E20]"
              />
              비밀글
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-100 px-5 py-4">
          <div>
            {formMode === "edit" && editingNoticeId && (
              <button
                type="button"
                onClick={() => handleDelete(editingNoticeId)}
                disabled={
                  deleteMutation.isPending ||
                  deleteDynamicPostMutation.isPending
                }
                className="inline-flex h-9 items-center gap-2 border border-red-200 px-3 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="h-9 border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || uploadingFile}
              className="inline-flex h-9 items-center gap-2 bg-[#1B5E20] px-4 text-sm font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSaving ? "저장 중" : formMode === "edit" ? "수정" : "등록"}
            </button>
          </div>
        </div>
      </form>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-400">불러오는 중...</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            총{" "}
            <span className="font-semibold text-[#1B5E20]">
              {notices?.length ?? 0}
            </span>
            개의 {totalLabel}
            {((!isAdminResource &&
              !isCustomBoard &&
              activeCategory !== NOTICE_ALL_CATEGORY_LABEL) ||
              searchKeyword) && (
              <span className="ml-2 text-gray-400">
                표시 {filteredNotices.length}개
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">{boardDescription}</p>
        </div>
        {canManageNotices && (
          <button
            type="button"
            onClick={formMode ? closeForm : openCreateForm}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
          >
            {formMode ? "작성 닫기" : createButtonLabel}
          </button>
        )}
      </div>

      {renderCategoryManager()}

      {renderNoticeForm()}

      <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <span>
            새 글 {newNoticeCount} / {filteredNotices.length}
          </span>
        </div>
        <form
          className="flex min-w-0 flex-wrap justify-end gap-1"
          onSubmit={event => {
            event.preventDefault();
            setSearchKeyword(searchInput);
            setPage(1);
          }}
        >
          {!isAdminResource && !isCustomBoard && (
            <select
              value={activeCategory}
              onChange={event => {
                setActiveCategory(event.target.value);
                setPage(1);
              }}
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="분류"
            >
              {visibleNoticeCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
          <select
            value={effectiveSearchField}
            onChange={event => setSearchField(event.target.value)}
            className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
            aria-label="검색 조건"
          >
            <option value="title">제목</option>
            <option value="content">내용</option>
            {!isAdminResource && !isCustomBoard && (
              <option value="category">분류</option>
            )}
          </select>
          <input
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-48"
            aria-label="검색어"
          />
          <button
            type="submit"
            className="h-8 border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
            aria-label="검색"
          >
            검색
          </button>
        </form>
      </div>

      {!isAdminResource && !isCustomBoard && (
        <div className="flex flex-wrap gap-2">
          {visibleNoticeCategories.map(category => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setActiveCategory(category);
                  setPage(1);
                }}
                className={`h-8 border px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      )}

      {filteredNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">
            {notices?.length ? noResultText : emptyText}
          </p>
        </div>
      ) : (
        <>
          <div
            className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}
          >
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-16" />
                <col />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-20" />
              </colgroup>
              <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                  >
                    번호
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                  >
                    제목
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                  >
                    작성자
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                  >
                    등록일
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold"
                  >
                    조회수
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleNotices.map((notice, index) => {
                  const postNumber = notice.isPinned
                    ? "공지"
                    : String(filteredNotices.length - (pageStart + index));
                  const isExpanded = expandedId === notice.id;
                  const displayCategory = normalizeNoticeCategory(
                    getPostCategory(notice)
                  );
                  const attachments = getPostAttachments(notice);
                  const canViewSecret = canViewSecretBoardPost(notice);
                  return (
                    <Fragment key={notice.id}>
                      <tr
                        ref={setDesktopRowRef(notice.id)}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="px-3 py-3 text-center text-gray-500">
                          {notice.isPinned ? (
                            <span className="inline-flex min-w-10 justify-center bg-[#1B5E20] px-2 py-0.5 text-xs font-semibold text-white">
                              공지
                            </span>
                          ) : (
                            postNumber
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleNotice(notice.id)}
                            className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                            aria-expanded={isExpanded}
                          >
                            {!isAdminResource && !isCustomBoard && (
                              <span className="mr-2 text-xs text-[#1B5E20]">
                                [{displayCategory}]
                              </span>
                            )}
                            {notice.isSecret && (
                              <Lock className="mr-1 inline h-3.5 w-3.5 text-gray-400" />
                            )}
                            {notice.title}
                            {attachments.length > 0 && (
                              <Paperclip className="ml-2 inline h-3.5 w-3.5 text-[#1B5E20]" />
                            )}
                            {notice.thumbnailUrl && (
                              <span className="ml-2 text-[#0F8FB3]">▣</span>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">
                          관리자
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">
                          {formatBoardDate(notice.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">
                          {getNoticeViewCount(notice)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="px-8 py-5">
                            {canViewSecret && notice.thumbnailUrl && (
                              <img
                                src={notice.thumbnailUrl}
                                alt=""
                                className="mb-4 max-h-64 max-w-full border border-gray-100 object-contain"
                                onError={event => {
                                  (
                                    event.target as HTMLImageElement
                                  ).style.display = "none";
                                }}
                                loading="lazy"
                              />
                            )}
                            <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                              {notice.content ? (
                                <RichTextViewer html={notice.content} />
                              ) : (
                                "등록된 본문 내용이 없습니다."
                              )}
                            </div>
                            {attachments.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {attachments.map(item => (
                                  <a
                                    key={item.url}
                                    href={item.url}
                                    className="inline-flex max-w-full items-center gap-2 border border-[#1B5E20]/20 bg-white px-3 py-2 text-sm text-[#1B5E20] hover:bg-[#F1F8E9]"
                                  >
                                    <Paperclip className="h-4 w-4 shrink-0" />
                                    <span className="truncate">
                                      {item.name || ATTACHMENT_LABEL}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                            {canManageNotices && (
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(notice)}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 px-3 text-xs text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> 수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(notice.id)}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-3 text-xs text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> 삭제
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className={
              viewMode === "grid"
                ? "grid gap-4 md:grid-cols-2"
                : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"
            }
          >
            {visibleNotices.map((notice, index) => {
              const postNumber = notice.isPinned
                ? "공지"
                : String(filteredNotices.length - (pageStart + index));
              const isExpanded = expandedId === notice.id;
              const displayCategory = normalizeNoticeCategory(
                getPostCategory(notice)
              );
              const attachments = getPostAttachments(notice);
              const canViewSecret = canViewSecretBoardPost(notice);
              return (
                <article
                  key={notice.id}
                  ref={setCardRef(notice.id)}
                  className={
                    viewMode === "grid"
                      ? "border border-gray-200 bg-white p-4"
                      : "p-4"
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{postNumber}</span>
                    <span>{formatBoardDate(notice.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotice(notice.id)}
                    className="block w-full text-left text-base font-bold text-gray-900"
                    aria-expanded={isExpanded}
                  >
                    {!isAdminResource && !isCustomBoard && (
                      <span className="mr-2 text-xs text-[#1B5E20]">
                        [{displayCategory}]
                      </span>
                    )}
                    {notice.isSecret && (
                      <Lock className="mr-1 inline h-4 w-4 text-gray-400" />
                    )}
                    {notice.title}
                    {attachments.length > 0 && (
                      <Paperclip className="ml-2 inline h-3.5 w-3.5 text-[#1B5E20]" />
                    )}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="font-medium text-[#1B5E20]">관리자</span>
                    <span>조회수 {getNoticeViewCount(notice)}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                      {canViewSecret && notice.thumbnailUrl && (
                        <img
                          src={notice.thumbnailUrl}
                          alt=""
                          className="mb-4 max-h-56 max-w-full border border-gray-100 object-contain"
                          onError={event => {
                            (event.target as HTMLImageElement).style.display =
                              "none";
                          }}
                          loading="lazy"
                        />
                      )}
                      {notice.content ? (
                        <RichTextViewer html={notice.content} />
                      ) : (
                        <p>등록된 본문 내용이 없습니다.</p>
                      )}
                      {attachments.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {attachments.map(item => (
                            <a
                              key={item.url}
                              href={item.url}
                              className="inline-flex max-w-full items-center gap-2 border border-[#1B5E20]/20 bg-white px-3 py-2 text-sm text-[#1B5E20] hover:bg-[#F1F8E9]"
                            >
                              <Paperclip className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {item.name || ATTACHMENT_LABEL}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {canManageNotices && (
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(notice)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 px-3 text-xs text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
                          >
                            <Pencil className="h-3.5 w-3.5" /> 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(notice.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-3 text-xs text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="flex justify-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, activePage - 1))}
              disabled={activePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20] disabled:opacity-40"
              aria-label="이전 페이지"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map(pageNumber => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm ${
                  activePage === pageNumber
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                    : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20]"
                }`}
                aria-current={activePage === pageNumber ? "page" : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, activePage + 1))}
              disabled={activePage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20] disabled:opacity-40"
              aria-label="다음 페이지"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function BoardContent({
  label,
  href,
  menuItemId,
  menuSubItemId,
  defaultViewMode,
}: BoardContentProps = {}) {
  if (isFreeBoardPage(label, href)) {
    return <FreeBoardContent defaultViewMode={defaultViewMode} />;
  }
  if (isAdminResourcePage(label, href)) {
    return (
      <NoticeBoardContent
        mode="adminResource"
        defaultViewMode={defaultViewMode}
      />
    );
  }
  if (isNoticeBoardPage(label)) {
    return <NoticeBoardContent defaultViewMode={defaultViewMode} />;
  }
  return (
    <NoticeBoardContent
      customBoard={getCustomBoard({ label, href, menuItemId, menuSubItemId })}
      defaultViewMode={defaultViewMode}
    />
  );
}

function getPostCategory(post: unknown) {
  if (typeof post !== "object" || post === null) return undefined;
  const value = (post as { category?: unknown }).category;
  return typeof value === "string" ? value : undefined;
}

function getPostAttachmentFields(post: unknown) {
  if (typeof post !== "object" || post === null) return { name: "", url: "" };
  const value = post as { attachmentName?: unknown; attachmentUrl?: unknown };
  return {
    name: typeof value.attachmentName === "string" ? value.attachmentName : "",
    url: typeof value.attachmentUrl === "string" ? value.attachmentUrl : "",
  };
}

function getPostAttachment(post: unknown) {
  return getPostAttachments(post)[0] ?? { name: "", url: "" };
}

function getPostAttachments(post: unknown) {
  const fields = getPostAttachmentFields(post);
  return parseAttachmentList(fields.name, fields.url);
}

function canViewSecretBoardPost(post: unknown) {
  if (typeof post !== "object" || post === null) return true;
  const value = post as { canViewSecret?: unknown };
  return value.canViewSecret !== false;
}
