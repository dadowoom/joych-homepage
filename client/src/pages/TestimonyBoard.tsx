/**
 * 생선 간증 페이지
 * 승인된 성도가 간증 글과 댓글을 자유롭게 나누는 커뮤니티형 화면입니다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
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

function PageHero({ count }: { count?: number }) {
  return (
    <section
      className="relative py-20 bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: "url('https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_d34c61eb.webp')" }}
    >
      <div className="absolute inset-0 bg-[#1B5E20]/80"></div>
      <div className="relative z-10 max-w-6xl mx-auto px-4 text-white">
        <p className="text-sm font-medium tracking-widest text-green-200 mb-3 uppercase">Saengseon Testimony</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          생선 간증
        </h1>
        <p className="text-green-100 text-lg max-w-xl leading-relaxed">
          생선제자훈련과 교회 공동체 안에서 경험한 은혜를<br className="hidden sm:block" />
          함께 나누는 간증 공간입니다.
        </p>
        {typeof count === "number" && (
          <div className="mt-8">
            <p className="text-3xl font-bold">{count}</p>
            <p className="text-green-200 text-sm mt-1">나눠진 간증</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TestimonyList() {
  const { data: posts = [], isLoading } = trpc.testimony.posts.useQuery();
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">기쁨의교회 홈</span>
          </Link>
          {me ? (
            <Link href="/community/testimony/write" className="inline-flex items-center gap-1.5 text-xs bg-[#1B5E20] text-white px-3 py-1.5 rounded-full hover:bg-[#2E7D32] transition-colors">
              <i className="fas fa-pen text-[10px]"></i>
              간증 작성
            </Link>
          ) : (
            <Link href="/member/login?next=/community/testimony/write" className="text-xs text-[#1B5E20] font-medium hover:underline">
              로그인 후 작성
            </Link>
          )}
        </div>
      </header>

      <PageHero count={posts.length} />

      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{posts.length}</span>개의 간증
          </p>
          <p className="text-xs text-gray-400">승인된 성도만 글쓰기와 댓글 작성이 가능합니다.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        {isLoading ? (
          <div className="text-center py-24 text-gray-400">
            <i className="fas fa-spinner fa-spin text-4xl mb-4 block"></i>
            <p>간증을 불러오는 중입니다.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
            <i className="fas fa-seedling text-4xl mb-4 block text-[#1B5E20]/40"></i>
            <p>아직 등록된 간증이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/community/testimony/${post.id}`}>
                <article className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group h-full flex flex-col">
                  <div className="relative h-52 overflow-hidden bg-[#E8F5E9]">
                    {post.thumbnailUrl || post.images[0] ? (
                      <img
                        src={post.thumbnailUrl ?? post.images[0]}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fas fa-quote-left text-[#1B5E20]/30 text-5xl"></i>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-[#1B5E20]/90 text-white text-xs px-2.5 py-1 rounded-full">
                      간증
                    </span>
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
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">{post.content}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <i className="fas fa-comment"></i>
                        댓글 {post.commentCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fas fa-eye"></i>
                        조회 {post.viewCount}
                      </span>
                      <span className="ml-auto text-[#1B5E20] font-medium">읽기 →</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function TestimonyDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState("");

  const { data: post, isLoading } = trpc.testimony.post.useQuery({ id }, { enabled: Number.isFinite(id) });
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });

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
          {isAuthor && (
            <div className="flex items-center gap-2">
              <Link href={`/community/testimony/edit/${post.id}`} className="text-xs border border-gray-200 px-3 py-1.5 rounded-full text-gray-600 hover:text-[#1B5E20]">
                수정
              </Link>
              <button
                onClick={() => {
                  if (confirm("이 간증 글을 삭제할까요?")) deletePost.mutate({ id: post.id });
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-4">
              <span className="font-medium text-gray-700">{post.authorName ?? "성도"}</span>
              {post.authorPosition && <span>{post.authorPosition}</span>}
              <span>{formatDate(post.createdAt)}</span>
              <span>조회 {post.viewCount}</span>
            </div>
          </div>

          {post.images.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {post.images.map((imageUrl, index) => (
                <img
                  key={`${imageUrl}-${index}`}
                  src={imageUrl}
                  alt={`${post.title} 이미지 ${index + 1}`}
                  className="w-full rounded-xl object-cover max-h-[420px] bg-gray-100"
                />
              ))}
            </div>
          )}

          <div className="text-gray-700 leading-8 whitespace-pre-wrap text-[15px]">
            {post.content}
          </div>
        </article>

        <section className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <i className="fas fa-comments text-[#1B5E20]"></i>
            댓글 {post.comments.length}
          </h2>

          {me ? (
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
              <span>댓글은 로그인한 성도만 작성할 수 있습니다.</span>
              <Link href={`/member/login?next=/community/testimony/${post.id}`} className="text-[#1B5E20] font-medium hover:underline">
                로그인하기
              </Link>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {post.comments.map((item) => {
              const isCommentAuthor = me?.id === item.authorMemberId;
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
                    {isCommentAuthor && (
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

  const { data: me, isLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: myPosts = [] } = trpc.testimony.myPosts.useQuery(undefined, {
    enabled: Boolean(me) && Boolean(editId),
    retry: false,
  });
  const editingPost = useMemo(
    () => myPosts.find(post => post.id === editId),
    [editId, myPosts],
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editingPost) return;
    setTitle(editingPost.title);
    setContent(editingPost.content);
    setImages(editingPost.images.map(imageUrl => ({ imageUrl })));
  }, [editingPost]);

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

  const uploadImage = trpc.testimony.uploadImage.useMutation({
    onError: (e) => toast.error("이미지 업로드 실패: " + e.message),
  });

  const isBusy = createPost.isPending || updatePost.isPending;

  const handleUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 10MB 이하만 업로드할 수 있습니다.");
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
    };
    if (editId) {
      updatePost.mutate({ id: editId, ...payload });
    } else {
      createPost.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-5">간증 작성은 로그인한 성도만 이용할 수 있습니다.</p>
          <Link href="/member/login?next=/community/testimony/write" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32]">
            로그인하기
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
              rows={14}
              className={`${fieldClass} resize-y leading-7`}
              placeholder="간증 내용을 입력해주세요"
            />
          </div>

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
                    <img src={image.imageUrl} alt={`업로드 이미지 ${index + 1}`} className="w-full aspect-square object-cover rounded-xl bg-gray-100" />
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
