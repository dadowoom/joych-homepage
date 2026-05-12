/**
 * 선교보고 작성/수정 페이지
 * 권한 있는 성도만 접근 가능하며, 공개 목록/상세 UI는 건드리지 않는다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ImageRow = { imageUrl: string; caption?: string };

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

export default function MissionReportEditor() {
  const params = useParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { data: me, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: grants = [], isLoading: grantsLoading } = trpc.mission.myAuthorGrants.useQuery(undefined, {
    enabled: Boolean(me),
    retry: false,
  });
  const { data: myReports = [] } = trpc.mission.myReports.useQuery(undefined, {
    enabled: Boolean(me) && Boolean(editId),
    retry: false,
  });

  const [missionaryId, setMissionaryId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState(todayKey());
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [prayerTopics, setPrayerTopics] = useState<string[]>([""]);
  const [uploading, setUploading] = useState<"thumbnail" | "gallery" | null>(null);
  const fieldClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]";

  const editingReport = useMemo(
    () => myReports.find(report => report.id === editId),
    [editId, myReports]
  );

  useEffect(() => {
    if (!missionaryId && grants[0]?.missionaryId) {
      setMissionaryId(grants[0].missionaryId);
    }
  }, [grants, missionaryId]);

  useEffect(() => {
    if (!editingReport) return;
    setMissionaryId(editingReport.missionaryId);
    setTitle(editingReport.title);
    setReportDate(editingReport.reportDate);
    setSummary(editingReport.summary ?? "");
    setContent(editingReport.content ?? "");
    setThumbnailUrl(editingReport.thumbnailUrl ?? "");
    setImages(editingReport.images.map(imageUrl => ({ imageUrl })));
    setPrayerTopics(editingReport.prayerTopics.length > 0 ? editingReport.prayerTopics : [""]);
  }, [editingReport]);

  const createMutation = trpc.mission.createReport.useMutation({
    onSuccess: ({ id }) => {
      toast.success("선교보고가 검토 요청으로 저장됐습니다.");
      utils.mission.myReports.invalidate();
      navigate(`/mission/edit/${id}`);
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });

  const updateMutation = trpc.mission.updateReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고가 저장됐습니다.");
      utils.mission.myReports.invalidate();
    },
    onError: (e) => toast.error(e.message || "저장에 실패했습니다."),
  });

  const uploadMutation = trpc.mission.uploadImage.useMutation({
    onError: (e) => toast.error("이미지 업로드 실패: " + e.message),
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const uploadFile = async (file: File, target: "thumbnail" | "gallery") => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setUploading(target);
    try {
      const base64 = await fileToBase64(file);
      const { url } = await uploadMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      if (target === "thumbnail") {
        setThumbnailUrl(url);
      } else {
        setImages(prev => [...prev, { imageUrl: url }]);
      }
      toast.success("이미지가 업로드됐습니다.");
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
      prayerTopics: prayerTopics.map(t => t.trim()).filter(Boolean),
      submitForReview,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (memberLoading || grantsLoading) {
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
          <p className="text-gray-500 mb-5">선교보고 작성은 로그인 후 이용하실 수 있습니다.</p>
          <Link href="/member/login" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32] transition-colors">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  if (grants.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-5">선교보고 작성 권한이 없습니다. 관리자에게 문의해주세요.</p>
          <Link href="/mission" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32] transition-colors">
            선교보고 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/mission" className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">선교보고 목록</span>
          </Link>
          <span className="text-gray-400 text-sm hidden md:block">선교보고 작성</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl p-7 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {editId ? "선교보고 수정" : "선교보고 작성"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">작성한 보고서는 관리자 승인 후 공개됩니다.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="담당 선교사/사역지">
              <select value={missionaryId} onChange={(e) => setMissionaryId(Number(e.target.value))} className={fieldClass}>
                {grants.map(grant => (
                  <option key={grant.id} value={grant.missionaryId}>
                    {grant.missionaryName ?? "선교사"} · {grant.missionaryRegion ?? "사역지"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="보고 날짜">
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={fieldClass} />
            </Field>
          </div>

          <Field label="제목">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} placeholder="선교보고 제목" />
          </Field>

          <Field label="요약">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className={`${fieldClass} min-h-24 resize-y`} placeholder="목록 카드에 표시될 짧은 요약" />
          </Field>

          <Field label="본문">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className={`${fieldClass} min-h-72 resize-y leading-7`} placeholder="선교 현장 이야기와 나눌 내용을 작성해주세요." />
          </Field>

          <Field label="대표 사진">
            {thumbnailUrl && <img src={thumbnailUrl} alt="대표 사진" className="w-full h-48 object-cover rounded-xl mb-3" />}
            <div className="flex gap-2">
              <button type="button" onClick={() => thumbnailInputRef.current?.click()} className="px-4 py-2 border border-[#1B5E20] text-[#1B5E20] rounded-lg text-sm hover:bg-[#E8F5E9] transition-colors">
                {uploading === "thumbnail" ? "업로드 중..." : "대표 사진 업로드"}
              </button>
              <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "thumbnail")} />
            </div>
          </Field>

          <Field label="현장 사진">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {images.map((img, index) => (
                <div key={`${img.imageUrl}-${index}`} className="relative">
                  <img src={img.imageUrl} alt={`현장 사진 ${index + 1}`} className="w-full aspect-video object-cover rounded-xl" />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, i) => i !== index))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="px-4 py-2 border border-[#1B5E20] text-[#1B5E20] rounded-lg text-sm hover:bg-[#E8F5E9] transition-colors">
              {uploading === "gallery" ? "업로드 중..." : "현장 사진 추가"}
            </button>
            <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "gallery")} />
          </Field>

          <Field label="기도 제목">
            <div className="space-y-2">
              {prayerTopics.map((topic, index) => (
                <div key={index} className="flex gap-2">
                  <input value={topic} onChange={(e) => setPrayerTopics(prev => prev.map((item, i) => i === index ? e.target.value : item))} className={fieldClass} placeholder={`기도 제목 ${index + 1}`} />
                  <button type="button" onClick={() => setPrayerTopics(prev => prev.filter((_, i) => i !== index))} className="px-3 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500">
                    삭제
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPrayerTopics(prev => [...prev, ""])} className="text-sm text-[#1B5E20] hover:underline">
                + 기도 제목 추가
              </button>
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => save(false)} disabled={isBusy} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              임시저장
            </button>
            <button type="button" onClick={() => save(true)} disabled={isBusy} className="px-5 py-2.5 bg-[#1B5E20] text-white rounded-lg text-sm hover:bg-[#2E7D32] disabled:opacity-50">
              검토 요청
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {children}
    </div>
  );
}
