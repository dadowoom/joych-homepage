/**
 * 관리자 생선 간증 탭
 * 성도들이 작성한 간증 글과 댓글을 숨김/공개/삭제 처리합니다.
 */

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

export default function AdminTestimoniesTab() {
  const utils = trpc.useUtils();
  const { data: posts = [], isLoading: loadingPosts } = trpc.cms.testimonies.posts.useQuery();
  const { data: comments = [], isLoading: loadingComments } = trpc.cms.testimonies.comments.useQuery();

  const updatePostStatus = trpc.cms.testimonies.updatePostStatus.useMutation({
    onSuccess: () => {
      toast.success("간증 글 상태가 변경됐습니다.");
      utils.cms.testimonies.posts.invalidate();
      utils.testimony.posts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCommentStatus = trpc.cms.testimonies.updateCommentStatus.useMutation({
    onSuccess: () => {
      toast.success("댓글 상태가 변경됐습니다.");
      utils.cms.testimonies.comments.invalidate();
      utils.cms.testimonies.posts.invalidate();
      utils.testimony.posts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loadingPosts || loadingComments) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">생선 간증 관리</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          성도가 작성한 간증 글과 댓글을 공개/숨김/삭제 처리합니다.
        </p>
      </div>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-3">간증 글</h4>
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-800 truncate">{post.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[post.status] ?? STATUS_CLASS.hidden}`}>
                    {STATUS_LABELS[post.status] ?? post.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {post.authorName ?? "성도"} · {formatDate(post.createdAt)} · 댓글 {post.commentCount} · 조회 {post.viewCount}
                </p>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{post.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => updatePostStatus.mutate({ id: post.id, status: "published" })}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
                >
                  공개
                </button>
                <button
                  onClick={() => updatePostStatus.mutate({ id: post.id, status: "hidden" })}
                  className="px-3 py-1.5 text-xs rounded-lg border border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                >
                  숨김
                </button>
                <button
                  onClick={() => {
                    if (confirm("이 간증 글을 삭제 처리할까요?")) {
                      updatePostStatus.mutate({ id: post.id, status: "deleted" });
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {posts.length === 0 && <p className="text-sm text-gray-400 py-4">등록된 간증 글이 없습니다.</p>}
        </div>
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-3">댓글</h4>
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{comment.authorName ?? "성도"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[comment.status] ?? STATUS_CLASS.hidden}`}>
                    {STATUS_LABELS[comment.status] ?? comment.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {comment.postTitle ?? "간증 글"} · {formatDate(comment.createdAt)}
                </p>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{comment.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => updateCommentStatus.mutate({ id: comment.id, status: "published" })}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
                >
                  공개
                </button>
                <button
                  onClick={() => updateCommentStatus.mutate({ id: comment.id, status: "hidden" })}
                  className="px-3 py-1.5 text-xs rounded-lg border border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                >
                  숨김
                </button>
                <button
                  onClick={() => {
                    if (confirm("이 댓글을 삭제 처리할까요?")) {
                      updateCommentStatus.mutate({ id: comment.id, status: "deleted" });
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-gray-400 py-4">등록된 댓글이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
