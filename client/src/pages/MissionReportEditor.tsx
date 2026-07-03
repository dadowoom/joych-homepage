import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageBoardContent, canManageFullAdmin } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ImageRow = { imageUrl: string; caption?: string };
type FileRow = {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
};

const MISSION_ATTACHMENT_MAX_BYTES = 80 * 1024 * 1024;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function MissionReportEditor() {
  const params = useParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const canManage = canManageBoardContent(user, "content:missionReports");
  const isFullAdmin = canManageFullAdmin(user);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: grants = [], isLoading: grantsLoading } = trpc.mission.myAuthorGrants.useQuery(undefined, {
    enabled: Boolean(me) && !canManage,
    retry: false,
  });
  const { data: myReports = [] } = trpc.mission.myReports.useQuery(undefined, {
    enabled: Boolean(me) && Boolean(editId) && !canManage,
    retry: false,
  });
  const { data: adminMissionaries = [], isLoading: loadingAdminMissionaries } =
    trpc.cms.missionReports.missionaries.useQuery(undefined, { enabled: canManage });
  const adminReportQuery = trpc.cms.missionReports.report.useQuery(
    { id: editId ?? 0 },
    { enabled: canManage && Boolean(editId) },
  );

  const [missionaryId, setMissionaryId] = useState<number | "">("");
  const [missionarySearch, setMissionarySearch] = useState("");
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState(todayKey());
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [prayerTopics, setPrayerTopics] = useState<string[]>([""]);
  const [uploading, setUploading] = useState<"thumbnail" | "gallery" | "file" | null>(null);

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/20";

  const editingReport = useMemo(
    () => (canManage ? adminReportQuery.data ?? null : myReports.find(report => report.id === editId) ?? null),
    [adminReportQuery.data, canManage, editId, myReports],
  );
  const missionaryOptions = useMemo(
    () =>
      canManage
        ? adminMissionaries.map((missionary) => ({
            id: missionary.id,
            label: `${missionary.name} · ${missionary.region}`,
          }))
        : grants.map((grant) => ({
            id: grant.missionaryId,
            label: `${grant.missionaryName ?? "선교사"} · ${grant.missionaryRegion ?? "사역지"}`,
          })),
    [adminMissionaries, canManage, grants],
  );
  const filteredMissionaryOptions = useMemo(() => {
    const query = missionarySearch.trim().toLowerCase();
    const options = query
      ? missionaryOptions.filter((option) => option.label.toLowerCase().includes(query))
      : missionaryOptions;
    return options.slice(0, 30);
  }, [missionaryOptions, missionarySearch]);
  const selectedMissionaryLabel = missionaryOptions.find((option) => option.id === missionaryId)?.label ?? missionarySearch;

  useEffect(() => {
    if (!missionaryId && !missionarySearch && missionaryOptions[0]?.id) {
      setMissionaryId(missionaryOptions[0].id);
      setMissionarySearch(missionaryOptions[0].label);
    }
  }, [missionaryOptions, missionaryId, missionarySearch]);

  useEffect(() => {
    if (!missionaryId) return;
    const selected = missionaryOptions.find((option) => option.id === missionaryId);
    if (selected && missionarySearch !== selected.label) {
      setMissionarySearch(selected.label);
    }
  }, [missionaryId, missionaryOptions, missionarySearch]);

  useEffect(() => {
    if (!editingReport) return;
    setMissionaryId(editingReport.missionaryId);
    setTitle(editingReport.title);
    setReportDate(editingReport.reportDate);
    setSummary(editingReport.summary ?? "");
    setContent(editingReport.content ?? "");
    setThumbnailUrl(editingReport.thumbnailUrl ?? "");
    setImages(editingReport.images.map(imageUrl => ({ imageUrl })));
    setFiles((editingReport.files ?? []).map(file => ({
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileSize: file.fileSize ?? undefined,
      mimeType: file.mimeType ?? undefined,
    })));
    setPrayerTopics(editingReport.prayerTopics.length > 0 ? editingReport.prayerTopics : [""]);
  }, [editingReport]);

  const changeMissionarySearch = (value: string) => {
    setMissionarySearch(value);
    const exact = missionaryOptions.find((option) => option.label === value);
    setMissionaryId(exact?.id ?? "");
  };

  const createMutation = trpc.mission.createReport.useMutation({
    onSuccess: ({ id }) => {
      toast.success("선교보고서가 검토 요청으로 저장되었습니다.");
      utils.mission.myReports.invalidate();
      navigate(`/mission/edit/${id}`);
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  const updateMutation = trpc.mission.updateReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고서가 저장되었습니다.");
      utils.mission.myReports.invalidate();
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  const uploadMutation = trpc.mission.uploadImage.useMutation({
    onError: (e) => toast.error("이미지 업로드 실패: " + e.message),
  });
  const uploadFileMutation = trpc.mission.uploadFile.useMutation({
    onError: (e) => toast.error("첨부파일 업로드 실패: " + e.message),
  });
  const adminCreateMutation = trpc.cms.missionReports.createReport.useMutation({
    onSuccess: (id) => {
      toast.success("선교보고서가 저장되었습니다.");
      utils.cms.missionReports.reports.invalidate();
      utils.mission.reports.invalidate();
      if (id) navigate(`/mission/edit/${id}`);
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  const adminUpdateMutation = trpc.cms.missionReports.updateReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고서가 저장되었습니다.");
      utils.cms.missionReports.reports.invalidate();
      utils.mission.reports.invalidate();
      void adminReportQuery.refetch();
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });
  const adminUploadMutation = trpc.cms.missionReports.uploadImage.useMutation({
    onError: (e) => toast.error("이미지 업로드 실패: " + e.message),
  });
  const adminUploadFileMutation = trpc.cms.missionReports.uploadFile.useMutation({
    onError: (e) => toast.error("첨부파일 업로드 실패: " + e.message),
  });

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    adminCreateMutation.isPending ||
    adminUpdateMutation.isPending;

  const uploadImageFile = async (file: File, target: "thumbnail" | "gallery") => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setUploading(target);
    try {
      const base64 = await fileToBase64(file);
      const payload = { base64, fileName: file.name, mimeType: file.type || "image/jpeg" };
      const result = canManage
        ? await adminUploadMutation.mutateAsync(payload)
        : await uploadMutation.mutateAsync(payload);
      if (target === "thumbnail") {
        setThumbnailUrl(result.url);
      } else {
        setImages(prev => [...prev, { imageUrl: result.url }]);
      }
    } finally {
      setUploading(null);
    }
  };

  const uploadGalleryFiles = async (selectedFiles: FileList | null) => {
    const list = Array.from(selectedFiles ?? []);
    for (const file of list) {
      await uploadImageFile(file, "gallery");
    }
    if (list.length > 0) toast.success(`현장 사진 ${list.length}장이 추가되었습니다.`);
  };

  const uploadAttachmentFiles = async (selectedFiles: FileList | null) => {
    const list = Array.from(selectedFiles ?? []);
    if (list.length === 0) return;
    setUploading("file");
    try {
      const uploaded: FileRow[] = [];
      for (const file of list) {
        if (file.size > MISSION_ATTACHMENT_MAX_BYTES) {
          toast.error(`${file.name}은 80MB를 초과해 업로드할 수 없습니다.`);
          continue;
        }
        const base64 = await fileToBase64(file);
        const payload = { base64, fileName: file.name, mimeType: file.type || "application/octet-stream" };
        const result = canManage
          ? await adminUploadFileMutation.mutateAsync(payload)
          : await uploadFileMutation.mutateAsync(payload);
        uploaded.push({
          fileName: result.fileName,
          fileUrl: result.url,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
        });
      }
      if (uploaded.length > 0) {
        setFiles(prev => [...prev, ...uploaded]);
        toast.success(`첨부파일 ${uploaded.length}개가 추가되었습니다.`);
      }
    } finally {
      setUploading(null);
    }
  };

  const save = (submitForReview: boolean) => {
    if (!missionaryId) {
      toast.error("담당 선교사/사역지를 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    const payload = {
      missionaryId,
      title,
      reportDate,
      summary: summary || undefined,
      content: content || undefined,
      thumbnailUrl: thumbnailUrl || undefined,
      images: images.filter(img => img.imageUrl.trim()),
      files: files.filter(file => file.fileUrl.trim()),
      prayerTopics: prayerTopics.map(t => t.trim()).filter(Boolean),
      submitForReview,
    };
    if (canManage) {
      const nextStatus = isFullAdmin
        ? (submitForReview ? "published" as const : "draft" as const)
        : (editingReport?.status ?? "pending" as const);
      const adminPayload = {
        ...payload,
        status: nextStatus,
        authorMemberId: editingReport?.authorMemberId ?? undefined,
      };
      if (editId) adminUpdateMutation.mutate({ id: editId, ...adminPayload });
      else adminCreateMutation.mutate(adminPayload);
      return;
    }
    if (editId) updateMutation.mutate({ id: editId, ...payload });
    else createMutation.mutate(payload);
  };

  if (memberLoading || (!canManage && grantsLoading) || (canManage && loadingAdminMissionaries) || (canManage && editId && adminReportQuery.isLoading)) {
    return <CenteredMessage message="선교보고서 작성 정보를 불러오는 중입니다." />;
  }

  if (!canManage && !me) {
    return (
      <CenteredMessage
        message="선교보고서 작성은 로그인 후 이용할 수 있습니다."
        action={<Link href="/member/login" className="rounded-full bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2E7D32]">로그인하기</Link>}
      />
    );
  }

  if (!canManage && grants.length === 0) {
    return (
      <CenteredMessage
        message="선교보고서 작성 권한이 없습니다. 관리자에게 문의해주세요."
        action={<Link href="/mission" className="rounded-full bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2E7D32]">목록으로</Link>}
      />
    );
  }

  if (editId && !editingReport) {
    return (
      <CenteredMessage
        message="수정할 선교보고서를 찾을 수 없습니다."
        action={<Link href="/mission" className="rounded-full bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2E7D32]">목록으로</Link>}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4EF]">
      <header className="sticky top-0 z-50 border-b border-[#E5DED0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/mission" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B5E20] hover:text-[#2E7D32]">
            <i className="fas fa-chevron-left text-xs"></i>
            선교보고 목록
          </Link>
          <div className="hidden items-center gap-2 text-xs text-gray-500 md:flex">
            <span className="rounded-full bg-[#E8F5E9] px-3 py-1 font-semibold text-[#1B5E20]">선교편지 작성</span>
            <span>{isFullAdmin ? "관리자는 저장 또는 바로 공개할 수 있습니다." : "작성 후 관리자 검토를 거쳐 공개됩니다."}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-[#E5DED0] bg-white shadow-sm">
            <div className="bg-[#123D23] px-6 py-7 text-white md:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B7D7B8]">Mission Letter</p>
              <h1 className="mt-2 text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {editId ? "선교보고서 수정" : "선교보고서 작성"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-green-100">
                현장 이야기, 사진, 기도 제목, 첨부자료를 한 번에 정리해 선교편지처럼 남길 수 있습니다.
              </p>
            </div>

            <div className="space-y-7 p-6 md:p-8">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="담당 선교사/사역지">
                  <div className="space-y-2">
                    <input
                      value={missionarySearch}
                      onChange={(e) => changeMissionarySearch(e.target.value)}
                      className={fieldClass}
                      placeholder="이름 또는 사역지 검색"
                      list="missionary-options"
                    />
                    <datalist id="missionary-options">
                      {missionaryOptions.map((option) => (
                        <option key={option.id} value={option.label} />
                      ))}
                    </datalist>
                    <select
                      value={missionaryId}
                      onChange={(e) => {
                        const nextId = Number(e.target.value);
                        const selected = missionaryOptions.find((option) => option.id === nextId);
                        setMissionaryId(nextId || "");
                        setMissionarySearch(selected?.label ?? "");
                      }}
                      className={fieldClass}
                    >
                      <option value="">검색 결과에서 선택</option>
                      {filteredMissionaryOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="보고 날짜">
                  <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={fieldClass} />
                </Field>
              </div>

              <Field label="제목">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} placeholder="예: 일본 사역 7월 선교편지" />
              </Field>

              <Field label="짧은 요약">
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className={`${fieldClass} min-h-28 resize-y leading-6`}
                  placeholder="목록 카드에 보일 짧은 소개를 적어주세요."
                />
              </Field>

              <Field label="선교편지 본문">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`${fieldClass} min-h-[360px] resize-y leading-8`}
                  placeholder={`사역 소식, 만난 사람들, 감사 제목, 앞으로의 기도 제목을 편지처럼 작성해주세요.\n\n예)\n사랑하는 기쁨의교회 성도님들께...\n이번 달에는...\n함께 기도해주세요.`}
                />
              </Field>
            </div>
          </div>

          <UploadSection title="대표 사진" description="목록과 상세 상단에 보이는 대표 이미지입니다.">
            {thumbnailUrl ? (
              <div className="mb-3 overflow-hidden rounded-xl border border-gray-200">
                <img src={thumbnailUrl} alt="대표 사진" className="h-60 w-full object-cover" loading="lazy" />
              </div>
            ) : null}
            <button type="button" onClick={() => thumbnailInputRef.current?.click()} className="rounded-lg border border-[#1B5E20] px-4 py-2 text-sm font-semibold text-[#1B5E20] hover:bg-[#E8F5E9]">
              {uploading === "thumbnail" ? "업로드 중..." : "대표 사진 선택"}
            </button>
            <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImageFile(e.target.files[0], "thumbnail")} />
          </UploadSection>

          <UploadSection title="현장 사진" description="10장 내외로 올려도 좋고, 필요한 만큼 여러 장을 추가할 수 있습니다.">
            {images.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {images.map((img, index) => (
                  <div key={`${img.imageUrl}-${index}`} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <img src={img.imageUrl} alt={`현장 사진 ${index + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                      className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/65 text-xs text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="사진 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="rounded-lg border border-[#1B5E20] px-4 py-2 text-sm font-semibold text-[#1B5E20] hover:bg-[#E8F5E9]">
              {uploading === "gallery" ? "업로드 중..." : "사진 여러 장 추가"}
            </button>
            <input ref={galleryInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => uploadGalleryFiles(e.target.files)} />
          </UploadSection>

          <UploadSection title="첨부파일" description="PPT, PDF, 한글, 워드, 엑셀, ZIP 등을 첨부할 수 있습니다. 파일 1개당 최대 80MB입니다.">
            {files.length > 0 && (
              <div className="mb-4 space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.fileUrl}-${index}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <i className="fas fa-paperclip text-[#1B5E20]"></i>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{file.fileName}</p>
                      <p className="text-xs text-gray-400">{formatBytes(file.fileSize)}</p>
                    </div>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))} className="rounded-full border border-red-100 px-3 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-[#1B5E20] px-4 py-2 text-sm font-semibold text-[#1B5E20] hover:bg-[#E8F5E9]">
              {uploading === "file" ? "업로드 중..." : "첨부파일 추가"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={(e) => uploadAttachmentFiles(e.target.files)}
            />
          </UploadSection>

          <UploadSection title="기도 제목" description="성도들이 함께 붙들고 기도할 제목을 항목별로 적어주세요.">
            <div className="space-y-2">
              {prayerTopics.map((topic, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={topic}
                    onChange={(e) => setPrayerTopics(prev => prev.map((item, i) => i === index ? e.target.value : item))}
                    className={fieldClass}
                    placeholder={`기도 제목 ${index + 1}`}
                  />
                  <button type="button" onClick={() => setPrayerTopics(prev => prev.filter((_, i) => i !== index))} className="rounded-lg border border-gray-200 px-3 text-sm text-gray-500 hover:text-red-500">
                    삭제
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPrayerTopics(prev => [...prev, ""])} className="text-sm font-semibold text-[#1B5E20] hover:underline">
                + 기도 제목 추가
              </button>
            </div>
          </UploadSection>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[#D7E9D8] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B5E20]">Preview</p>
            <h2 className="mt-2 line-clamp-2 text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {title || "선교보고서 제목"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">{selectedMissionaryLabel || "담당 선교사/사역지"} · {reportDate}</p>
            <div className="mt-4 overflow-hidden rounded-xl bg-[#EEF7EE]">
              {thumbnailUrl || images[0]?.imageUrl ? (
                <img src={thumbnailUrl || images[0]?.imageUrl} alt="미리보기" className="h-44 w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-[#1B5E20]">대표 사진 미리보기</div>
              )}
            </div>
            <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm leading-6 text-gray-600">
              {summary || content || "선교 현장 이야기와 요약이 이곳에 미리 표시됩니다."}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat label="사진" value={images.length} />
              <Stat label="파일" value={files.length} />
              <Stat label="기도" value={prayerTopics.filter(Boolean).length} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5DED0] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">저장 방식</h3>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              {isFullAdmin ? "숨김 저장은 비공개 상태로 보관하고, 바로 공개를 누르면 홈페이지 선교보고 흐름에 반영됩니다." : "저장한 선교보고서는 관리자가 공개/숨김을 처리합니다."}
            </p>
            <div className="mt-5 space-y-2">
              {isFullAdmin && (
                <button type="button" onClick={() => save(false)} disabled={isBusy} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  숨김 저장
                </button>
              )}
              <button type="button" onClick={() => save(isFullAdmin)} disabled={isBusy} className="w-full rounded-xl bg-[#1B5E20] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50">
                {isFullAdmin ? "바로 공개" : "저장"}
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-800">{label}</label>
      {children}
    </div>
  );
}

function UploadSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E5DED0] bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F4F8F1] px-3 py-2">
      <p className="text-lg font-bold text-[#1B5E20]">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function CenteredMessage({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
          <i className="fas fa-lock text-xl"></i>
        </div>
        <p className="mb-5 text-sm text-gray-500">{message}</p>
        {action}
      </div>
    </div>
  );
}
