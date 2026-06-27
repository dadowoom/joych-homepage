import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { sanitizeRichTextHtml } from "@/components/ui/rich-text-editor";

const STATUS_LABELS: Record<string, string> = {
  published: "공개",
  hidden: "숨김",
  deleted: "삭제",
};

const STATUS_CLASS: Record<string, string> = {
  published: "bg-green-50 text-green-700",
  hidden: "bg-yellow-50 text-yellow-700",
  deleted: "bg-gray-100 text-gray-500",
};

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}

function toPlainText(value?: string | null) {
  return sanitizeRichTextHtml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminFreeBoardTab() {
  const utils = trpc.useUtils();
  const { data: posts = [], isLoading } = trpc.cms.freeBoard.posts.useQuery();

  const updatePostStatus = trpc.cms.freeBoard.updatePostStatus.useMutation({
    onSuccess: () => {
      toast.success("자유게시판 글 상태가 변경되었습니다.");
      utils.cms.freeBoard.posts.invalidate();
      utils.freeBoard.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">자유게시판 관리</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          성도가 작성한 자유게시판 글을 공개, 숨김, 삭제 상태로 관리합니다.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-bold text-gray-800">게시글</h4>
          <span className="text-sm text-gray-400">{posts.length}개</span>
        </div>
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-800">{post.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[post.status] ?? STATUS_CLASS.hidden}`}>
                    {STATUS_LABELS[post.status] ?? post.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {post.authorName ?? "성도"} · {formatDate(post.createdAt)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">{toPlainText(post.content)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => updatePostStatus.mutate({ id: post.id, status: "published" })}
                  className="rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs text-white hover:bg-[#2E7D32]"
                >
                  공개
                </button>
                <button
                  type="button"
                  onClick={() => updatePostStatus.mutate({ id: post.id, status: "hidden" })}
                  className="rounded-lg border border-yellow-200 px-3 py-1.5 text-xs text-yellow-700 hover:bg-yellow-50"
                >
                  숨김
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("이 자유게시판 글을 삭제 처리하시겠습니까?")) {
                      updatePostStatus.mutate({ id: post.id, status: "deleted" });
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">등록된 자유게시판 글이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
