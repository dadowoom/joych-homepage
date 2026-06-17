import { Fragment, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, FileText, ImageIcon, Pencil, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";
import { FreeBoardContent } from "./FreeBoardContent";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";

type BoardContentProps = {
  label?: string;
  href?: string | null;
};

type NoticeFormState = {
  category: string;
  title: string;
  content: string;
  thumbnailUrl: string;
  isPublished: boolean;
  isPinned: boolean;
};

type NoticeFormMode = "create" | "edit" | null;

function isFreeBoardPage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`.replace(/\s+/g, "");
  return normalized.includes("자유게시판") || normalized.includes("joytalk");
}

const NOTICE_CATEGORIES = ["공지", "부고", "결혼"] as const;
const ALL_NOTICE_CATEGORIES = ["전체", ...NOTICE_CATEGORIES] as const;
const ADMIN_RESOURCE_CATEGORY = "행정자료";

type NoticeBoardMode = "notice" | "adminResource";

function normalizeNoticeCategory(category?: string | null) {
  const value = category?.trim();
  if (value === "부고" || value === "결혼") return value;
  return "공지";
}

function isAdminResourcePage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`.replace(/\s+/g, "").toLowerCase();
  return normalized.includes("행정자료") || normalized.includes("admin-data") || normalized.includes("adminresource");
}

function formatBoardDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function isToday(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function getNoticeViewCount(notice: unknown) {
  if (typeof notice !== "object" || notice === null) return 0;
  const value = (notice as { viewCount?: unknown }).viewCount;
  return typeof value === "number" ? value : 0;
}

function NoticeBoardContent({ mode = "notice" }: { mode?: NoticeBoardMode }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdminResource = mode === "adminResource";
  const [activeCategory, setActiveCategory] = useState("전체");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [formMode, setFormMode] = useState<NoticeFormMode>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getBlankForm = (): NoticeFormState => ({
    category: isAdminResource ? ADMIN_RESOURCE_CATEGORY : "공지",
    title: "",
    content: "",
    thumbnailUrl: "",
    isPublished: true,
    isPinned: false,
  });

  const [formState, setFormState] = useState<NoticeFormState>(getBlankForm);
  const noticeQuery = trpc.home.noticeBoard.useQuery(undefined, { enabled: !isAdminResource });
  const adminResourceQuery = trpc.home.adminResourceBoard.useQuery(undefined, { enabled: isAdminResource });
  const notices = isAdminResource ? adminResourceQuery.data : noticeQuery.data;
  const isLoading = isAdminResource ? adminResourceQuery.isLoading : noticeQuery.isLoading;
  const canManageNotices = canManageBoardContent(user, "content:notices");
  const totalLabel = isAdminResource ? "자료" : "소식";
  const boardDescription = isAdminResource
    ? "행정자료를 게시판 형태로 확인할 수 있습니다."
    : "공지와 안내를 게시판 형태로 확인할 수 있습니다.";
  const createButtonLabel = isAdminResource ? "행정자료 작성" : "공지사항 작성";
  const emptyText = isAdminResource ? "등록된 행정자료가 없습니다." : "등록된 게시글이 없습니다.";
  const noResultText = isAdminResource ? "해당 조건의 행정자료가 없습니다." : "해당 조건의 게시글이 없습니다.";
  const effectiveSearchField = isAdminResource && searchField === "category" ? "title" : searchField;

  const invalidateNoticeData = () => {
    void utils.cms.notices.list.invalidate();
    void utils.home.notices.invalidate();
    void utils.home.noticeBoard.invalidate();
    void utils.home.adminResourceBoard.invalidate();
  };

  const uploadImageMutation = trpc.cms.upload.image.useMutation({
    onError: (error) => toast.error(`이미지 업로드 실패: ${error.message}`),
  });

  const createMutation = trpc.cms.notices.create.useMutation({
    onSuccess: () => {
      toast.success(isAdminResource ? "행정자료가 등록됐습니다." : "공지사항이 등록됐습니다.");
      setFormMode(null);
      setFormState(getBlankForm());
      invalidateNoticeData();
    },
    onError: (error) => toast.error(`등록 실패: ${error.message}`),
  });

  const updateMutation = trpc.cms.notices.update.useMutation({
    onSuccess: () => {
      toast.success(isAdminResource ? "행정자료가 수정됐습니다." : "공지사항이 수정됐습니다.");
      setFormMode(null);
      setEditingNoticeId(null);
      invalidateNoticeData();
    },
    onError: (error) => toast.error(`수정 실패: ${error.message}`),
  });

  const deleteMutation = trpc.cms.notices.delete.useMutation({
    onSuccess: () => {
      toast.success(isAdminResource ? "행정자료가 삭제됐습니다." : "공지사항이 삭제됐습니다.");
      setFormMode(null);
      setEditingNoticeId(null);
      invalidateNoticeData();
    },
    onError: (error) => toast.error(`삭제 실패: ${error.message}`),
  });

  const sortedNotices = useMemo(() => {
    return [...(notices ?? [])].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notices]);

  const categoryFilteredNotices = isAdminResource || activeCategory === "전체"
    ? sortedNotices
    : sortedNotices.filter((notice) => normalizeNoticeCategory(notice.category) === activeCategory);
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredNotices = normalizedKeyword
    ? categoryFilteredNotices.filter((notice) => {
        const titleText = notice.title.toLowerCase();
        const categoryText = normalizeNoticeCategory(notice.category).toLowerCase();
        const contentText = (notice.content ?? "").toLowerCase();
        if (!isAdminResource && effectiveSearchField === "category") return categoryText.includes(normalizedKeyword);
        if (effectiveSearchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : categoryFilteredNotices;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleNotices = filteredNotices.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newNoticeCount = filteredNotices.filter((notice) => isToday(notice.createdAt)).length;

  const openCreateForm = () => {
    setFormMode("create");
    setEditingNoticeId(null);
    setExpandedId(null);
    setFormState(getBlankForm());
  };

  const openEditForm = (notice: NonNullable<typeof notices>[number]) => {
    setFormMode("edit");
    setEditingNoticeId(notice.id);
    setFormState({
      category: isAdminResource ? ADMIN_RESOURCE_CATEGORY : normalizeNoticeCategory(notice.category),
      title: notice.title,
      content: notice.content ?? "",
      thumbnailUrl: notice.thumbnailUrl ?? "",
      isPublished: notice.isPublished,
      isPinned: notice.isPinned,
    });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingNoticeId(null);
    setFormState(getBlankForm());
  };

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("이미지는 10MB 이하 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await uploadImageMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      setFormState((previous) => ({ ...previous, thumbnailUrl: url }));
      toast.success("이미지 업로드 완료");
    } finally {
      setUploadingImage(false);
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
      category: isAdminResource ? ADMIN_RESOURCE_CATEGORY : normalizeNoticeCategory(formState.category),
      title,
      content: formState.content.trim() || undefined,
      thumbnailUrl: formState.thumbnailUrl.trim() || undefined,
      isPublished: formState.isPublished,
      isPinned: formState.isPinned,
    };

    if (formMode === "edit" && editingNoticeId) {
      updateMutation.mutate({ id: editingNoticeId, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleDelete = (id: number) => {
    const message = isAdminResource ? "이 행정자료를 삭제할까요?" : "이 공지사항을 삭제할까요?";
    if (!window.confirm(message)) return;
    deleteMutation.mutate({ id });
  };

  const renderNoticeForm = () => {
    if (!canManageNotices || !formMode) return null;
    const isSaving = createMutation.isPending || updateMutation.isPending;
    const formTitle = formMode === "edit" ? `${createButtonLabel.replace("작성", "수정")}` : createButtonLabel;

    return (
      <form onSubmit={handleSubmit} className="border border-gray-200 bg-white">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-900">{formTitle}</h3>
            <p className="mt-1 text-xs text-gray-400">
              작성자는 로그인 계정 기준으로 처리되므로 이메일 입력은 받지 않습니다.
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
          {!isAdminResource && (
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-gray-700">분류</span>
              <select
                value={formState.category}
                onChange={(event) => setFormState((previous) => ({ ...previous, category: event.target.value }))}
                className="h-10 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
              >
                {NOTICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-gray-700">작성자</span>
            <input
              value="관리자"
              readOnly
              className="h-10 w-full border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </label>
          <label className={`space-y-2 ${isAdminResource ? "md:col-span-2" : "md:col-span-2"}`}>
            <span className="block text-sm font-semibold text-gray-700">제목</span>
            <input
              value={formState.title}
              onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
              placeholder={isAdminResource ? "예: 2026년 행정자료 안내" : "예: 2026년 공동의회 안내"}
              className="h-10 w-full border border-gray-300 px-3 text-sm outline-none focus:border-[#1B5E20]"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-gray-700">내용</span>
            <textarea
              value={formState.content}
              onChange={(event) => setFormState((previous) => ({ ...previous, content: event.target.value }))}
              placeholder="본문 내용을 입력해주세요."
              rows={10}
              className="w-full resize-y border border-gray-300 px-3 py-3 text-sm leading-6 outline-none focus:border-[#1B5E20]"
            />
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="block text-sm font-semibold text-gray-700">첨부 이미지</span>
            {formState.thumbnailUrl && (
              <div className="relative max-w-sm border border-gray-200 bg-gray-50 p-2">
                <img
                  src={formState.thumbnailUrl}
                  alt=""
                  className="max-h-40 w-full object-contain"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormState((previous) => ({ ...previous, thumbnailUrl: "" }))}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center bg-white text-red-500 shadow-sm"
                  aria-label="첨부 이미지 제거"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="inline-flex h-9 items-center gap-2 border border-[#1B5E20] px-3 text-sm font-medium text-[#1B5E20] hover:bg-[#F1F8E9] disabled:opacity-50"
              >
                {uploadingImage ? <Upload className="h-4 w-4 animate-bounce" /> : <ImageIcon className="h-4 w-4" />}
                {uploadingImage ? "업로드 중" : "이미지 파일 선택"}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <input
                value={formState.thumbnailUrl}
                onChange={(event) => setFormState((previous) => ({ ...previous, thumbnailUrl: event.target.value }))}
                placeholder="이미지 URL 직접 입력"
                className="h-9 min-w-64 flex-1 border border-gray-300 px-3 text-xs outline-none focus:border-[#1B5E20]"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-5 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formState.isPublished}
                onChange={(event) => setFormState((previous) => ({ ...previous, isPublished: event.target.checked }))}
                className="h-4 w-4 accent-[#1B5E20]"
              />
              게시
            </label>
            {!isAdminResource && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.isPinned}
                  onChange={(event) => setFormState((previous) => ({ ...previous, isPinned: event.target.checked }))}
                  className="h-4 w-4 accent-[#1B5E20]"
                />
                공지글 지정
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-100 px-5 py-4">
          <div>
            {formMode === "edit" && editingNoticeId && (
              <button
                type="button"
                onClick={() => handleDelete(editingNoticeId)}
                disabled={deleteMutation.isPending}
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
              disabled={isSaving || uploadingImage}
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
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{notices?.length ?? 0}</span>개의 {totalLabel}
            {((!isAdminResource && activeCategory !== "전체") || searchKeyword) && (
              <span className="ml-2 text-gray-400">표시 {filteredNotices.length}개</span>
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

      {renderNoticeForm()}

      <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <span>새 글 {newNoticeCount} / {filteredNotices.length}</span>
        </div>
        <form
          className="flex min-w-0 flex-wrap justify-end gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchKeyword(searchInput);
            setPage(1);
          }}
        >
          {!isAdminResource && (
            <select
              value={activeCategory}
              onChange={(event) => {
                setActiveCategory(event.target.value);
                setPage(1);
              }}
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="분류"
            >
              {ALL_NOTICE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
          <select
            value={effectiveSearchField}
            onChange={(event) => setSearchField(event.target.value)}
            className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
            aria-label="검색 조건"
          >
            <option value="title">제목</option>
            <option value="content">내용</option>
            {!isAdminResource && <option value="category">분류</option>}
          </select>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
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

      {!isAdminResource && (
        <div className="flex flex-wrap gap-2">
          {ALL_NOTICE_CATEGORIES.map((category) => {
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
          <p className="text-gray-400 text-sm">{notices?.length ? noResultText : emptyText}</p>
        </div>
      ) : (
        <>
          <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
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
                  <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">조회수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleNotices.map((notice, index) => {
                  const postNumber = notice.isPinned ? "공지" : String(filteredNotices.length - (pageStart + index));
                  const isExpanded = expandedId === notice.id;
                  const displayCategory = normalizeNoticeCategory(notice.category);
                  return (
                    <Fragment key={notice.id}>
                      <tr className="transition-colors hover:bg-gray-50">
                        <td className="px-3 py-3 text-center text-gray-500">
                          {notice.isPinned ? (
                            <span className="inline-flex min-w-10 justify-center bg-[#1B5E20] px-2 py-0.5 text-xs font-semibold text-white">공지</span>
                          ) : postNumber}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                            className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                            aria-expanded={isExpanded}
                          >
                            {!isAdminResource && (
                              <span className="mr-2 text-xs text-[#1B5E20]">[{displayCategory}]</span>
                            )}
                            {notice.title}
                            {notice.thumbnailUrl && <span className="ml-2 text-[#0F8FB3]">▣</span>}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">관리자</td>
                        <td className="px-3 py-3 text-center text-gray-500">{formatBoardDate(notice.createdAt)}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{getNoticeViewCount(notice)}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="px-8 py-5">
                            {notice.thumbnailUrl && (
                              <img
                                src={notice.thumbnailUrl}
                                alt=""
                                className="mb-4 max-h-64 max-w-full border border-gray-100 object-contain"
                                onError={(event) => {
                                  (event.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                              {notice.content || "등록된 본문 내용이 없습니다."}
                            </div>
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

          <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
            {visibleNotices.map((notice, index) => {
              const postNumber = notice.isPinned ? "공지" : String(filteredNotices.length - (pageStart + index));
              const isExpanded = expandedId === notice.id;
              const displayCategory = normalizeNoticeCategory(notice.category);
              return (
                <article key={notice.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{postNumber}</span>
                    <span>{formatBoardDate(notice.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                    className="block w-full text-left text-base font-bold text-gray-900"
                    aria-expanded={isExpanded}
                  >
                    {!isAdminResource && (
                      <span className="mr-2 text-xs text-[#1B5E20]">[{displayCategory}]</span>
                    )}
                    {notice.title}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="font-medium text-[#1B5E20]">관리자</span>
                    <span>조회수 {getNoticeViewCount(notice)}</span>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                      {notice.thumbnailUrl && (
                        <img
                          src={notice.thumbnailUrl}
                          alt=""
                          className="mb-4 max-h-56 max-w-full border border-gray-100 object-contain"
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <p className="whitespace-pre-line">{notice.content || "등록된 본문 내용이 없습니다."}</p>
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
            {pageNumbers.map((pageNumber) => (
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

export function BoardContent({ label, href }: BoardContentProps = {}) {
  if (isFreeBoardPage(label, href)) {
    return <FreeBoardContent />;
  }
  if (isAdminResourcePage(label, href)) {
    return <NoticeBoardContent mode="adminResource" />;
  }
  return <NoticeBoardContent />;
}
