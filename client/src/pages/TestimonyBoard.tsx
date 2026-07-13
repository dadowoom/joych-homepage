/**
 * 생선 간증 페이지
 * 승인된 성도가 간증 글과 댓글을 자유롭게 나누는 커뮤니티형 화면입니다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Lock } from "lucide-react";
import SubPageLayout from "@/components/SubPageLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { toast } from "sonner";

type ImageRow = { imageUrl: string; caption?: string };

const fieldClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]";

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type PublicMenuSubItem = {
  id: number;
  label: string;
  href?: string | null;
};

type PublicMenuItem = PublicMenuSubItem & {
  subItems?: PublicMenuSubItem[];
};

type PublicMenu = {
  id: number;
  label: string;
  href?: string | null;
  items?: PublicMenuItem[];
};

function normalizeMenuText(value: string) {
  return value.replace(/\s+/g, "");
}

function getCommunitySideMenuItems(menus: PublicMenu[] | undefined, activeHref: string) {
  const communityMenu = menus?.find((menu) => normalizeMenuText(menu.label) === "커뮤니티");
  const sourceItems = communityMenu?.items ?? [
    { id: -1, label: "행사 사진", href: "/community/photo" },
    { id: -2, label: "은혜의 간증", href: "/community/testimony" },
    { id: -3, label: "선교 소식", href: "/mission" },
    { id: -4, label: "자유게시판", href: "/community/joytalk" },
  ];

  return {
    parentLabel: communityMenu?.label ?? "커뮤니티",
    sideMenuItems: sourceItems.map((item) => {
      const subItems = item.subItems ?? [];
      return {
        id: item.id,
        label: item.label,
        href: item.href ?? null,
        isActive:
          item.href === activeHref ||
          subItems.some((subItem) => subItem.href === activeHref),
        subItems: subItems.map((subItem) => ({
          id: subItem.id,
          label: subItem.label,
          href: subItem.href ?? null,
          isActive: subItem.href === activeHref,
        })),
      };
    }),
  };
}

export default function TestimonyList() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: allMenus } = trpc.home.menus.useQuery();
  const { parentLabel, sideMenuItems } = useMemo(
    () => getCommunitySideMenuItems(allMenus, "/community/testimony"),
    [allMenus],
  );
  const pageTitle = sideMenuItems.find((item) => item.isActive)?.label ?? "은혜의 간증";
  const canManage = canManageBoardContent(user, "content:testimonies");
  const {
    data: posts,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.testimony.posts.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });
  const canWrite = Boolean(me) || canManage;
  const deletePost = trpc.testimony.deletePost.useMutation({
    onSuccess: async () => {
      toast.success("\uAC04\uC99D \uAE00\uC774 \uC0AD\uC81C\uB410\uC2B5\uB2C8\uB2E4.");
      await utils.testimony.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateManagedPostStatus = trpc.cms.testimonies.updatePostStatus.useMutation({
    onSuccess: async () => {
      toast.success("\uAC04\uC99D \uAE00 \uC0C1\uD0DC\uAC00 \uBCC0\uACBD\uB410\uC2B5\uB2C8\uB2E4.");
      await utils.testimony.posts.invalidate();
      await utils.cms.testimonies.posts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const visiblePosts = posts ?? [];
  const loadingState = isLoading;
  const errorState = error;
  const isErrorState = isError;

  return (
    <SubPageLayout
      pageTitle={pageTitle}
      parentLabel={parentLabel}
      sideMenuItems={sideMenuItems}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#1B5E20]">생선수료자 간증 나눔</p>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                생선제자훈련 수료자들이 받은 은혜와 공동체 안에서의 변화를 함께 나누는 공간입니다.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
                <span>
                  {loadingState ? (
                    "간증을 불러오는 중입니다."
                  ) : (
                    <>
                      총 <span className="font-semibold text-[#1B5E20]">{visiblePosts.length}</span>개의 간증
                    </>
                  )}
                </span>
                <span className="text-xs text-gray-400">승인된 성도와 간증 관리 권한자는 글쓰기와 댓글 작성이 가능합니다.</span>
                {canManage && (
                  <span className="text-xs font-medium text-[#1B5E20]">게시판에서는 등록/수정/삭제만 가능하며 숨김/노출은 관리자 대시보드에서 처리합니다.</span>
                )}
              </div>
            </div>
            {canWrite ? (
              <Link href="/community/testimony/write" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]">
                <i className="fas fa-pen text-[10px]"></i>
                간증 작성
              </Link>
            ) : (
              <Link href="/member/login?next=/community/testimony/write" className="inline-flex h-10 items-center justify-center rounded-full border border-[#1B5E20]/15 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]">
                로그인 후 작성
              </Link>
            )}
          </div>
        </section>

        <section>
          {loadingState ? (
            <div className="py-24 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin text-4xl mb-4 block"></i>
              <p>간증을 불러오는 중입니다.</p>
            </div>
          ) : isErrorState ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
              <i className="fas fa-circle-exclamation text-4xl mb-4 block text-red-300"></i>
              <p className="font-medium text-gray-700">간증을 불러오지 못했습니다.</p>
              <p className="mt-2 text-sm text-gray-400">{errorState?.message ?? "잠시 후 다시 시도해 주세요."}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-5 px-5 py-2.5 rounded-full bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] transition-colors"
              >
                다시 불러오기
              </button>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <i className="fas fa-seedling text-4xl mb-4 block text-[#1B5E20]/40"></i>
              <p>아직 등록된 간증이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visiblePosts.map((post) => {
                const isAuthor = me?.id === post.authorMemberId;
                const canEdit = isAuthor || canManage;
                const article = (
                  <article className="bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 group h-full flex flex-col cursor-pointer hover:shadow-lg">
                    <div className="relative h-52 overflow-hidden bg-[#E8F5E9]">
                      {post.thumbnailUrl || post.images[0] ? (
                        <img
                          src={post.thumbnailUrl ?? post.images[0]}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                         loading="lazy"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="fas fa-quote-left text-[#1B5E20]/30 text-5xl"></i>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-[#1B5E20]/90 text-white text-xs px-2.5 py-1 rounded-full">
                        간증
                      </span>
                      {post.isSecret && (
                        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                          <Lock className="h-3 w-3" />
                          비밀글
                        </span>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                        <span className="font-medium text-gray-600">{post.authorName ?? "성도"}</span>
                        {post.authorPosition && <span>{post.authorPosition}</span>}
                        <span className="ml-auto">{formatDate(post.createdAt)}</span>
                      </div>
                      <h2
                        className="text-base font-bold text-gray-800 mb-2 leading-snug group-hover:text-[#1B5E20] transition-colors line-clamp-2"
                        style={{ fontFamily: "'Noto Serif KR', serif" }}
                      >
                        {post.title}
                      </h2>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">
                        {post.canViewSecret ? post.content : "비밀글입니다. 관리자, 간증 관리 권한자, 작성자만 볼 수 있습니다."}
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <i className="fas fa-comment"></i>
                          댓글 {post.commentCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="fas fa-eye"></i>
                          조회 {post.viewCount}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  navigate(`/community/testimony/edit/${post.id}`);
                                }}
                                className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#1B5E20]/25 hover:text-[#1B5E20]"
                              >
                                {"\uC218\uC815"}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const confirmed = confirm("\uC774 \uAC04\uC99D \uAE00\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?");
                                  if (!confirmed) return;
                                  if (canManage && !isAuthor) {
                                    updateManagedPostStatus.mutate({ id: post.id, status: "deleted" });
                                    return;
                                  }
                                  deletePost.mutate({ id: post.id });
                                }}
                                className="inline-flex items-center rounded-full border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                              >
                                {"\uC0AD\uC81C"}
                              </button>
                            </>
                          )}
                          <span className="ml-1 text-[#1B5E20] font-medium">{"\uC77D\uAE30 \u2192"}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );

                return (
                  <Link key={post.id} href={`/community/testimony/${post.id}`}>
                    {article}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SubPageLayout>
  );
}

export function TestimonyDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canManage = canManageBoardContent(user, "content:testimonies");
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState("");

  const { data: post, isLoading } = trpc.testimony.post.useQuery({ id }, { enabled: Number.isFinite(id) });
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });
  const canWriteComment = Boolean(me) || canManage;

  const createComment = trpc.testimony.createComment.useMutation({
    onSuccess: async () => {
      setComment("");
      toast.success("댓글이 등록됐습니다.");
      await utils.testimony.post.invalidate({ id });
      await utils.testimony.posts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateComment = trpc.testimony.updateComment.useMutation({
    onSuccess: async () => {
      setEditingCommentId(null);
      setEditingComment("");
      toast.success("댓글이 수정됐습니다.");
      await utils.testimony.post.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteComment = trpc.testimony.deleteComment.useMutation({
    onSuccess: async () => {
      toast.success("댓글이 삭제됐습니다.");
      await utils.testimony.post.invalidate({ id });
      await utils.testimony.posts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePost = trpc.testimony.deletePost.useMutation({
    onSuccess: async () => {
      toast.success("간증 글이 삭제됐습니다.");
      await utils.testimony.posts.invalidate();
      navigate("/community/testimony");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateManagedPostStatus = trpc.cms.testimonies.updatePostStatus.useMutation({
    onSuccess: async () => {
      toast.success("간증 글 상태가 변경됐습니다.");
      await utils.testimony.posts.invalidate();
      navigate("/community/testimony");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-5">간증 글을 찾을 수 없습니다.</p>
          <Link href="/community/testimony" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = me?.id === post.authorMemberId;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/community/testimony" className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">생선 간증 목록</span>
          </Link>
          {(isAuthor || canManage) && (
            <div className="flex items-center gap-2">
              {(isAuthor || canManage) && (
                <Link href={`/community/testimony/edit/${post.id}`} className="text-xs border border-gray-200 px-3 py-1.5 rounded-full text-gray-600 hover:text-[#1B5E20]">
                  수정
                </Link>
              )}
              <button
                onClick={() => {
                  const confirmed = confirm("이 간증 글을 삭제할까요?");
                  if (!confirmed) return;
                  if (canManage && !isAuthor) {
                    updateManagedPostStatus.mutate({ id: post.id, status: "deleted" });
                    return;
                  }
                  deletePost.mutate({ id: post.id });
                }}
                className="text-xs border border-red-100 px-3 py-1.5 rounded-full text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-9">
          <div className="mb-7 pb-7 border-b border-gray-100">
            <p className="text-sm text-[#1B5E20] font-medium mb-3">생선 간증</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {post.title}
            </h1>
            {post.isSecret && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                <Lock className="h-3.5 w-3.5" />
                비밀글
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-4">
              <span className="font-medium text-gray-700">{post.authorName ?? "성도"}</span>
              {post.authorPosition && <span>{post.authorPosition}</span>}
              <span>{formatDate(post.createdAt)}</span>
              <span>조회 {post.viewCount}</span>
            </div>
          </div>

          {post.canViewSecret && post.images.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {post.images.map((imageUrl, index) => (
                <img
                  key={`${imageUrl}-${index}`}
                  src={imageUrl}
                  alt={`${post.title} 이미지 ${index + 1}`}
                  className="w-full rounded-xl object-cover max-h-[420px] bg-gray-100"
                 loading="lazy"/>
              ))}
            </div>
          )}

          {post.canViewSecret ? (
            <div className="text-gray-700 leading-8 whitespace-pre-wrap text-[15px]">
              {post.content}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-6 text-sm leading-7 text-gray-600">
              비밀글입니다. 관리자, 간증 관리 권한자, 작성자만 내용을 볼 수 있습니다.
            </div>
          )}
        </article>

        {post.canViewSecret && (
        <section className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <i className="fas fa-comments text-[#1B5E20]"></i>
            댓글 {post.comments.length}
          </h2>

          {canWriteComment ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) {
                  toast.error("댓글 내용을 입력해주세요.");
                  return;
                }
                createComment.mutate({ postId: post.id, content: comment });
              }}
              className="mb-6"
            >
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="은혜 받은 내용을 함께 나눠주세요."
                className={`${fieldClass} resize-none`}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createComment.isPending}
                  className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  댓글 등록
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-6 rounded-xl bg-[#F7F7F5] px-4 py-4 text-sm text-gray-500 flex flex-wrap items-center justify-between gap-3">
              <span>댓글은 로그인한 성도와 간증 관리 권한자만 작성할 수 있습니다.</span>
              <Link href={`/member/login?next=/community/testimony/${post.id}`} className="text-[#1B5E20] font-medium hover:underline">
                로그인하기
              </Link>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {post.comments.map((item) => {
              const isCommentAuthor = me?.id === item.authorMemberId;
              const canManageComment = isCommentAuthor || canManage;
              return (
                <div key={item.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {item.authorName ?? "성도"}
                        {item.authorPosition && <span className="ml-2 text-xs text-gray-400 font-normal">{item.authorPosition}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.createdAt)}</p>
                    </div>
                    {canManageComment && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={() => {
                            setEditingCommentId(item.id);
                            setEditingComment(item.content);
                          }}
                          className="text-gray-400 hover:text-[#1B5E20]"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteComment.mutate({ id: item.id })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                  {editingCommentId === item.id ? (
                    <div className="mt-3">
                      <textarea
                        value={editingComment}
                        onChange={(e) => setEditingComment(e.target.value)}
                        rows={3}
                        className={`${fieldClass} resize-none`}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setEditingCommentId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500">
                          취소
                        </button>
                        <button
                          onClick={() => updateComment.mutate({ id: item.id, content: editingComment })}
                          className="px-3 py-1.5 text-xs rounded-lg bg-[#1B5E20] text-white"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-600 leading-7 whitespace-pre-wrap">{item.content}</p>
                  )}
                </div>
              );
            })}
            {post.comments.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">아직 댓글이 없습니다.</p>
            )}
          </div>
        </section>
        )}
      </main>
    </div>
  );
}

export function TestimonyEditor() {
  const params = useParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const canManage = canManageBoardContent(user, "content:testimonies");

  const { data: me, isLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const canWritePost = Boolean(me) || canManage;
  const { data: myPosts = [] } = trpc.testimony.myPosts.useQuery(undefined, {
    enabled: Boolean(me) && Boolean(editId),
    retry: false,
  });
  const editingPost = useMemo(
    () => myPosts.find(post => post.id === editId),
    [editId, myPosts],
  );
  const managedEditingPostQuery = trpc.cms.testimonies.post.useQuery(
    { id: editId! },
    {
      enabled: Boolean(editId) && canManage && !editingPost,
      retry: false,
    },
  );
  const editablePost = editingPost ?? managedEditingPostQuery.data ?? null;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [isSecret, setIsSecret] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editablePost) return;
    setTitle(editablePost.title);
    setContent(editablePost.content);
    setImages(editablePost.images.map(imageUrl => ({ imageUrl })));
    setIsSecret(Boolean(editablePost.isSecret));
  }, [editablePost]);

  const createPost = trpc.testimony.createPost.useMutation({
    onSuccess: async ({ id }) => {
      toast.success("간증이 등록됐습니다.");
      await utils.testimony.posts.invalidate();
      navigate(`/community/testimony/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePost = trpc.testimony.updatePost.useMutation({
    onSuccess: async () => {
      toast.success("간증이 수정됐습니다.");
      await utils.testimony.posts.invalidate();
      if (editId) {
        await utils.testimony.post.invalidate({ id: editId });
        navigate(`/community/testimony/${editId}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateManagedPost = trpc.cms.testimonies.updatePost.useMutation({
    onSuccess: async () => {
      toast.success("간증이 수정됐습니다.");
      await utils.testimony.posts.invalidate();
      await utils.cms.testimonies.posts.invalidate();
      if (editId) {
        await utils.testimony.post.invalidate({ id: editId });
        await utils.cms.testimonies.post.invalidate({ id: editId });
        navigate(`/community/testimony/${editId}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadImage = trpc.testimony.uploadImage.useMutation({
    onError: (e) => toast.error("이미지 업로드 실패: " + e.message),
  });

  const isBusy = createPost.isPending || updatePost.isPending || updateManagedPost.isPending;

  const handleUpload = async (file: File) => {
    if (file.size > 1 * 1024 * 1024) {
      toast.error("이미지는 1MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { url } = await uploadImage.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      setImages(prev => [...prev, { imageUrl: url }].slice(0, 10));
      toast.success("이미지가 업로드됐습니다.");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      toast.error("간증 내용을 입력해주세요.");
      return;
    }
    const payload = {
      title,
      content,
      thumbnailUrl: images[0]?.imageUrl,
      images: images.filter(image => image.imageUrl.trim()),
      isSecret,
    };
    if (editId) {
      if (editingPost) {
        updatePost.mutate({ id: editId, ...payload });
      } else if (canManage) {
        updateManagedPost.mutate({ id: editId, ...payload });
      }
    } else {
      createPost.mutate(payload);
    }
  };

  if (isLoading || managedEditingPostQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!canWritePost) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-5">간증 작성은 로그인한 성도와 간증 관리 권한자만 이용할 수 있습니다.</p>
          <Link href="/member/login?next=/community/testimony/write" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32]">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  if (editId && !editablePost) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-5">수정할 간증 글을 찾을 수 없습니다.</p>
          <Link href="/community/testimony" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32]">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={editId ? `/community/testimony/${editId}` : "/community/testimony"} className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">생선 간증</span>
          </Link>
          <span className="text-gray-400 text-sm hidden md:block">{editId ? "간증 수정" : "간증 작성"}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl p-7 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {editId ? "간증 수정" : "간증 작성"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">은혜 받은 내용을 자유롭게 나눠주세요.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} placeholder="간증 제목을 입력해주세요" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className={`${fieldClass} min-h-[220px] resize-y leading-7 md:min-h-[360px]`}
              placeholder="간증 내용을 입력해주세요"
            />
          </div>

          <label className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(event) => setIsSecret(event.target.checked)}
              className="h-4 w-4 accent-[#1B5E20]"
            />
            비밀글
            <span className="text-xs font-normal text-gray-500">
              비밀글을 체크하고 작성하시면 작성자와 관리자, 간증 관리 권한이 부여된 교역자만 볼 수 있습니다.
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-gray-700">사진</label>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || images.length >= 10}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-[#1B5E20] hover:bg-[#E8F5E9] disabled:opacity-50"
              >
                {uploading ? "업로드 중..." : "사진 추가"}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void handleUpload(file);
                }}
              />
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <div key={`${image.imageUrl}-${index}`} className="relative group">
                    <img src={image.imageUrl} alt={`업로드 이미지 ${index + 1}`} className="w-full aspect-square object-cover rounded-xl bg-gray-100"  loading="lazy"/>
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      aria-label="사진 삭제"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                사진 없이도 간증을 등록할 수 있습니다.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Link href="/community/testimony" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
              취소
            </Link>
            <button
              onClick={save}
              disabled={isBusy || uploading}
              className="px-5 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] disabled:opacity-50"
            >
              {isBusy ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
