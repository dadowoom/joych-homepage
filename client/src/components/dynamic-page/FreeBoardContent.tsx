import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, FileText, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { RichTextEditor, RichTextViewer, sanitizeRichTextHtml } from "@/components/ui/rich-text-editor";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";

function normalizeViewMode(value?: string | null, fallback: ViewMode = "list"): ViewMode {
  return value === "grid" ? "grid" : fallback;
}

function formatDate(value: string | Date) {
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

function toPlainText(value?: string | null) {
  return sanitizeRichTextHtml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function FreeBoardContent({ defaultViewMode }: { defaultViewMode?: ViewMode | null } = {}) {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: posts = [], isLoading } = trpc.freeBoard.posts.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(normalizeViewMode(defaultViewMode));
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const viewedPostIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setViewMode(normalizeViewMode(defaultViewMode));
  }, [defaultViewMode]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
  };

  const createPost = trpc.freeBoard.createPost.useMutation({
    onSuccess: () => {
      toast.success("게시글이 등록되었습니다.");
      resetForm();
      setPage(1);
      utils.freeBoard.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePost = trpc.freeBoard.updatePost.useMutation({
    onSuccess: () => {
      toast.success("게시글이 수정되었습니다.");
      resetForm();
      utils.freeBoard.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deletePost = trpc.freeBoard.deletePost.useMutation({
    onSuccess: () => {
      toast.success("게시글이 삭제되었습니다.");
      utils.freeBoard.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const trackPostView = trpc.freeBoard.trackPostView.useMutation({
    onSuccess: () => {
      void utils.freeBoard.posts.invalidate();
    },
  });

  const handleTogglePost = (postId: number) => {
    const willOpen = expandedId !== postId;
    setExpandedId(willOpen ? postId : null);

    // 같은 목록 화면에서 같은 글을 여러 번 열고 닫아도 조회수가 반복 증가하지 않게 한다.
    if (!willOpen || viewedPostIdsRef.current.has(postId)) return;

    viewedPostIdsRef.current.add(postId);
    trackPostView.mutate({ id: postId });
  };

  const submit = () => {
    const payload = { title, content };
    if (editingId) {
      updatePost.mutate({ id: editingId, ...payload });
      return;
    }
    createPost.mutate(payload);
  };

  const startEdit = (post: (typeof posts)[number]) => {
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setShowForm(true);
  };

  const loginHref = `/member/login?next=${encodeURIComponent(location)}`;
  const isSaving = createPost.isPending || updatePost.isPending;
  const pageSize = 15;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredPosts = normalizedKeyword
    ? posts.filter((post) => {
        const titleText = post.title.toLowerCase();
        const authorText = (post.authorName ?? "성도").toLowerCase();
        const contentText = toPlainText(post.content).toLowerCase();
        if (searchField === "author") return authorText.includes(normalizedKeyword);
        if (searchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : posts;
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visiblePosts = filteredPosts.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newPostCount = filteredPosts.filter((post) => isToday(post.createdAt)).length;

  const writeAction = me ? (
    <button
      type="button"
      onClick={() => {
        if (showForm && !editingId) {
          resetForm();
          return;
        }
        setShowForm(true);
      }}
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
    >
      글쓰기
    </button>
  ) : (
    <Link
      href={loginHref}
      className="inline-flex h-10 items-center justify-center rounded-md border border-[#1B5E20]/20 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
    >
      로그인 후 글쓰기
    </Link>
  );

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-gray-100 pb-4">
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-[#1B5E20]">{posts.length}</span>개의 글
          {searchKeyword && (
            <span className="ml-2 text-gray-400">
              검색 결과 {filteredPosts.length}개
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-400">로그인한 성도만 자유게시판에 글을 작성할 수 있습니다.</p>
      </div>

      {showForm && me && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">
              {editingId ? "게시글 수정" : "새 글 작성"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="작성 취소"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="제목을 입력해주세요"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/10"
            />
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="내용을 입력해주세요"
              minHeightClassName="min-h-56 max-h-[55vh]"
              className="rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSaving}
                className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-20">
          <FileText className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-400">등록된 게시글이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <span>새 글 {newPostCount} / {filteredPosts.length}</span>
            </div>
            <form
              className="flex min-w-0 gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchKeyword(searchInput);
                setPage(1);
              }}
            >
              <select
                value={searchField}
                onChange={(event) => setSearchField(event.target.value)}
                className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
                aria-label="검색 조건"
              >
                <option value="title">제목</option>
                <option value="content">내용</option>
                <option value="author">작성자</option>
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

          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
              <FileText className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">해당 조건의 게시글이 없습니다.</p>
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
                {visiblePosts.map((post, index) => {
                  const isOwner = me?.id === post.authorMemberId;
                  const postNumber = filteredPosts.length - (pageStart + index);
                  const isExpanded = expandedId === post.id;
                  return (
                    <Fragment key={post.id}>
                      <tr className="transition-colors hover:bg-gray-50">
                        <td className="px-3 py-3 text-center text-gray-500">{postNumber}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleTogglePost(post.id)}
                            className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                            aria-expanded={isExpanded}
                          >
                            {post.title}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">{post.authorName ?? "성도"}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{formatDate(post.createdAt)}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{post.viewCount ?? 0}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="px-8 py-5">
                            <div className="border-l-2 border-[#1B5E20]/30 pl-4">
                              <RichTextViewer
                                html={post.content}
                                className="text-sm leading-7 text-gray-700"
                              />
                            </div>
                            {isOwner && (
                              <div className="mt-4 flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(post)}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 px-3 text-xs text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> 수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("이 게시글을 삭제하시겠습니까?")) {
                                      deletePost.mutate({ id: post.id });
                                    }
                                  }}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-red-100 px-3 text-xs text-red-400 hover:bg-red-50 hover:text-red-500"
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
            {visiblePosts.map((post, index) => {
              const isOwner = me?.id === post.authorMemberId;
              const postNumber = filteredPosts.length - (pageStart + index);
              const isExpanded = expandedId === post.id;
              return (
                <article key={post.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>번호 {postNumber}</span>
                    <span>{formatDate(post.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePost(post.id)}
                    className="block w-full text-left text-base font-bold text-gray-900"
                    aria-expanded={isExpanded}
                  >
                    {post.title}
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#1B5E20]">{post.authorName ?? "성도"}</span>
                    <span className="text-xs text-gray-500">조회수 {post.viewCount ?? 0}</span>
                    {isOwner && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(post)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500"
                          aria-label="게시글 수정"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("이 게시글을 삭제하시겠습니까?")) {
                              deletePost.mutate({ id: post.id });
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 text-red-400"
                          aria-label="게시글 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3">
                      <RichTextViewer
                        html={post.content}
                        className="text-sm leading-6 text-gray-700"
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
            </>
          )}
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex justify-center gap-1 sm:flex-1">
          {filteredPosts.length > 0 && (
            <>
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
            </>
          )}
        </div>
        <div className="flex justify-end">{writeAction}</div>
      </div>
    </div>
  );
}
