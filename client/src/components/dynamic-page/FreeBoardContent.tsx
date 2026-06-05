import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

export function FreeBoardContent() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: posts = [], isLoading } = trpc.freeBoard.posts.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{posts.length}</span>개의 글
          </p>
          <p className="mt-1 text-xs text-gray-400">로그인한 성도만 자유게시판에 글을 작성할 수 있습니다.</p>
        </div>
        {me ? (
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingId) {
                resetForm();
                return;
              }
              setShowForm(true);
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
          >
            글쓰기
          </button>
        ) : (
          <Link
            href={loginHref}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#1B5E20]/20 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
          >
            로그인 후 글쓰기
          </Link>
        )}
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
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="내용을 입력해주세요"
              rows={7}
              className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 outline-none focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/10"
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
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
          {posts.map((post) => {
            const isOwner = me?.id === post.authorMemberId;
            return (
              <article key={post.id} className="p-4 transition-colors hover:bg-gray-50/70 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className="font-medium text-[#1B5E20]">
                        {post.authorName ?? "성도"}
                      </span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{post.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                      {post.content}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(post)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="게시글 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
