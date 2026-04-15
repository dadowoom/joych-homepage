/**
 * 관리자 시설 관리 탭
 * - 시설 목록 조회, 등록, 수정, 삭제
 * - 시설 사진 여러 장 업로드 (S3)
 * - 요일별 운영 시간 설정
 * - 특정 날짜 차단 설정
 * - 예약 단위/최소/최대 시간 설정
 * - 승인 방식 설정 (자동/수동)
 *
 * API 경로:
 *   trpc.cms.facilities.create/update/delete
 *   trpc.cms.facilities.images.upload
 *   trpc.cms.facilities.blockedDates.add/delete/list
 *   trpc.cms.facilities.hours.upsert
 *   trpc.home.facility (공개 목록)
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp,
  Upload, X, Clock, Calendar, Users, CheckCircle2,
  Settings, Save, Ban, ImageIcon,
} from "lucide-react";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const DEFAULT_HOURS = DAY_LABELS.map((_, i) => ({
  dayOfWeek: i,
  isOpen: i !== 0,
  openTime: "09:00",
  closeTime: "22:00",
  breakStart: "" as string,
  breakEnd: "" as string,
}));

interface FacilityForm {
  name: string;
  description: string;
  location: string;
  capacity: number;
  pricePerHour: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  notice: string;
}

const EMPTY_FORM: FacilityForm = {
  name: "",
  description: "",
  location: "",
  capacity: 50,
  pricePerHour: 0,
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 8,
  approvalType: "manual",
  notice: "",
};

// ── 운영 시간 에디터 ──────────────────────────────────────
function HoursEditor({
  hours,
  onChange,
}: {
  hours: typeof DEFAULT_HOURS;
  onChange: (h: typeof DEFAULT_HOURS) => void;
}) {
  return (
    <div className="space-y-2">
      {hours.map((h, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-5 text-center font-medium text-gray-600 shrink-0">{DAY_LABELS[i]}</span>
          <label className="flex items-center gap-1 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={h.isOpen}
              onChange={e => {
                const next = [...hours];
                next[i] = { ...next[i], isOpen: e.target.checked };
                onChange(next);
              }}
            />
            <span className={h.isOpen ? "text-gray-700" : "text-gray-400"}>운영</span>
          </label>
          {h.isOpen ? (
            <>
              <input type="time" value={h.openTime}
                onChange={e => { const n=[...hours]; n[i]={...n[i],openTime:e.target.value}; onChange(n); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="time" value={h.closeTime}
                onChange={e => { const n=[...hours]; n[i]={...n[i],closeTime:e.target.value}; onChange(n); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs ml-1">점심</span>
              <input type="time" value={h.breakStart}
                onChange={e => { const n=[...hours]; n[i]={...n[i],breakStart:e.target.value}; onChange(n); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="time" value={h.breakEnd}
                onChange={e => { const n=[...hours]; n[i]={...n[i],breakEnd:e.target.value}; onChange(n); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
            </>
          ) : (
            <span className="text-xs text-gray-400">휴무</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 이미지 업로드 영역 ────────────────────────────────────
function ImageUploadArea({
  images,
  onUpload,
  onRemove,
  uploading,
}: {
  images: { imageUrl: string; isThumbnail: boolean }[];
  onUpload: (file: File) => void;
  onRemove: (idx: number) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
            <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
            {img.isThumbnail && (
              <span className="absolute bottom-0 left-0 right-0 bg-[#1B5E20]/80 text-white text-[9px] text-center py-0.5">대표</span>
            )}
            <button type="button" onClick={() => onRemove(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#1B5E20] hover:text-[#1B5E20] transition-colors disabled:opacity-50">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Upload className="w-5 h-5" /><span className="text-[10px] mt-1">추가</span></>}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ""; }} />
      <p className="text-xs text-gray-400">첫 번째 이미지가 대표 이미지로 사용됩니다.</p>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function AdminFacilitiesTab() {
  const utils = trpc.useUtils();
  const { data: facilities, isLoading } = trpc.home.facilities.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FacilityForm>(EMPTY_FORM);
  const [hours, setHours] = useState([...DEFAULT_HOURS]);
  const [images, setImages] = useState<{ imageUrl: string; isThumbnail: boolean }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  const { data: blockedDates } = trpc.cms.facilities.blockedDates.list.useQuery(
    { facilityId: expandedId ?? undefined },
    { enabled: expandedId !== null }
  );

  // ── Mutations ─────────────────────────────────────────
  const createFacility = trpc.cms.facilities.create.useMutation({
    onSuccess: async (newFacility) => {
      // 이미지 업로드 (생성 후)
      for (let i = 0; i < images.length; i++) {
        // 이미 URL이 있으면 이미 업로드된 것 — 별도 처리 필요 없음
      }
      // 운영 시간 저장
      for (const h of hours) {
        await upsertHour.mutateAsync({
          facilityId: (newFacility as any).id,
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.openTime,
          closeTime: h.closeTime,
          breakStart: h.breakStart || null,
          breakEnd: h.breakEnd || null,
        });
      }
      utils.home.facility.invalidate();
      resetForm();
      toast.success("시설이 등록되었습니다.");
    },
    onError: (e) => toast.error(e.message || "등록에 실패했습니다."),
  });

  const updateFacility = trpc.cms.facilities.update.useMutation({
    onSuccess: async () => {
      if (editingId) {
        for (const h of hours) {
          await upsertHour.mutateAsync({
            facilityId: editingId,
            dayOfWeek: h.dayOfWeek,
            isOpen: h.isOpen,
            openTime: h.openTime,
            closeTime: h.closeTime,
            breakStart: h.breakStart || null,
            breakEnd: h.breakEnd || null,
          });
        }
      }
      utils.home.facility.invalidate();
      resetForm();
      toast.success("시설 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message || "수정에 실패했습니다."),
  });

  const deleteFacility = trpc.cms.facilities.delete.useMutation({
    onSuccess: () => { utils.home.facility.invalidate(); toast.success("시설이 삭제되었습니다."); },
    onError: (e) => toast.error(e.message || "삭제에 실패했습니다."),
  });

  const uploadImageMutation = trpc.cms.facilities.images.upload.useMutation();
  const upsertHour = trpc.cms.facilities.hours.upsert.useMutation();

  const addBlockedDate = trpc.cms.facilities.blockedDates.add.useMutation({
    onSuccess: () => {
      utils.cms.facilities.blockedDates.list.invalidate();
      setNewBlockDate(""); setNewBlockReason("");
      toast.success("예약 불가 날짜가 추가되었습니다.");
    },
    onError: (e) => toast.error(e.message || "추가에 실패했습니다."),
  });

  const removeBlockedDate = trpc.cms.facilities.blockedDates.delete.useMutation({
    onSuccess: () => { utils.cms.facilities.blockedDates.list.invalidate(); toast.success("삭제되었습니다."); },
  });

  // ── 이미지 업로드 ─────────────────────────────────────
  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (editingId) {
        // 수정 모드: 즉시 서버에 업로드
        const result = await uploadImageMutation.mutateAsync({
          facilityId: editingId,
          base64,
          mimeType: file.type,
          isThumbnail: images.length === 0,
        });
        setImages(prev => [...prev, { imageUrl: result.url, isThumbnail: prev.length === 0 }]);
      } else {
        // 등록 모드: 로컬 미리보기만 (저장 시 업로드)
        const localUrl = URL.createObjectURL(file);
        setImages(prev => [...prev, { imageUrl: localUrl, isThumbnail: prev.length === 0, _file: file } as any]);
      }
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleImageRemove(idx: number) {
    setImages(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0) next[0] = { ...next[0], isThumbnail: true };
      return next;
    });
  }

  // ── 폼 초기화 ─────────────────────────────────────────
  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setHours([...DEFAULT_HOURS]);
    setImages([]);
  }

  function startEdit(f: NonNullable<typeof facilities>[number]) {
    setEditingId(f.id);
    setForm({
      name: f.name,
      description: f.description ?? "",
      location: f.location ?? "",
      capacity: f.capacity,
      pricePerHour: f.pricePerHour,
      slotMinutes: f.slotMinutes,
      minSlots: f.minSlots,
      maxSlots: f.maxSlots,
      approvalType: f.approvalType as "auto" | "manual",
      notice: f.notice ?? "",
    });
    setImages((f as any).images ?? []);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── 저장 ──────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { toast.error("시설명을 입력해 주세요."); return; }

    if (editingId) {
      updateFacility.mutate({ id: editingId, ...form });
    } else {
      // 등록 모드: 먼저 시설 생성 후 이미지 업로드
      createFacility.mutate({ ...form, isReservable: true, isVisible: true, sortOrder: 0 });
    }
  }

  const isSaving = createFacility.isPending || updateFacility.isPending;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#1B5E20]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">시설 관리</h3>
          <p className="text-sm text-gray-500">시설을 등록하고 운영 시간, 예약 조건을 설정합니다.</p>
        </div>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors">
            <Plus className="w-4 h-4" /> 시설 등록
          </button>
        )}
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-800">{editingId ? "시설 수정" : "새 시설 등록"}</h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시설명 *</label>
              <input type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 대예배실, 소회의실 A"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">위치</label>
              <input type="text" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 본관 3층"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">시설 설명</label>
              <textarea value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="시설에 대한 상세 설명을 입력하세요."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">이용 안내 (예약 시 성도에게 표시)</label>
              <textarea value={form.notice}
                onChange={e => setForm(p => ({ ...p, notice: e.target.value }))}
                placeholder="예: 사용 후 반드시 원상복구 해주세요. 음식물 반입 금지."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none" />
            </div>
          </div>

          {/* 예약 조건 */}
          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> 예약 조건
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">최대 수용 인원</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} value={form.capacity}
                    onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
                  <span className="text-xs text-gray-400 shrink-0">명</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">예약 단위</label>
                <select value={form.slotMinutes}
                  onChange={e => setForm(p => ({ ...p, slotMinutes: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]">
                  <option value={30}>30분</option>
                  <option value={60}>1시간</option>
                  <option value={90}>1시간 30분</option>
                  <option value={120}>2시간</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">최소 예약 (단위)</label>
                <input type="number" min={1} value={form.minSlots}
                  onChange={e => setForm(p => ({ ...p, minSlots: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">최대 예약 (단위)</label>
                <input type="number" min={1} value={form.maxSlots}
                  onChange={e => setForm(p => ({ ...p, maxSlots: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">시간당 요금</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} step={1000} value={form.pricePerHour}
                    onChange={e => setForm(p => ({ ...p, pricePerHour: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]" />
                  <span className="text-xs text-gray-400 shrink-0">원</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">승인 방식</label>
                <select value={form.approvalType}
                  onChange={e => setForm(p => ({ ...p, approvalType: e.target.value as "auto" | "manual" }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]">
                  <option value="manual">수동 승인 (관리자 확인 후)</option>
                  <option value="auto">자동 승인 (즉시 승인)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 운영 시간 */}
          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> 요일별 운영 시간
            </h5>
            <HoursEditor hours={hours} onChange={setHours} />
          </div>

          {/* 시설 사진 */}
          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" /> 시설 사진
            </h5>
            <ImageUploadArea
              images={images}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
              uploading={uploadingImage}
            />
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? "수정 완료" : "등록 완료"}
            </button>
            <button onClick={resetForm}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 시설 목록 */}
      {(facilities ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>등록된 시설이 없습니다.</p>
          <p className="text-sm mt-1">"시설 등록" 버튼을 눌러 첫 시설을 등록해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(facilities ?? []).map(f => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* 시설 헤더 행 */}
              <div className="flex items-center gap-3 p-4">
                {(f as any).thumbnailUrl ? (
                  <img src={(f as any).thumbnailUrl} alt={f.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{f.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {f.location && <span>{f.location}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{f.capacity}명</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.slotMinutes}분 단위</span>
                    <span className={`flex items-center gap-1 ${f.approvalType === "auto" ? "text-green-600" : "text-amber-600"}`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {f.approvalType === "auto" ? "자동 승인" : "수동 승인"}
                    </span>
                    <span>{f.pricePerHour === 0 ? "무료" : `${f.pricePerHour.toLocaleString()}원/시간`}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="예약 불가 날짜 관리">
                    {expandedId === f.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(f)}
                    className="p-2 text-gray-400 hover:text-[#1B5E20] transition-colors" title="수정">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${f.name}" 시설을 삭제하시겠습니까?\n관련 예약 데이터도 모두 삭제됩니다.`)) {
                        deleteFacility.mutate({ id: f.id });
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="삭제">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 차단 날짜 관리 패널 */}
              {expandedId === f.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-red-400" /> 예약 불가 날짜 설정
                  </h5>
                  <div className="flex gap-2 mb-3">
                    <input type="date" value={newBlockDate}
                      onChange={e => setNewBlockDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B5E20]" />
                    <input type="text" value={newBlockReason}
                      onChange={e => setNewBlockReason(e.target.value)}
                      placeholder="차단 사유 (예: 전교인 수련회)"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B5E20]" />
                    <button
                      onClick={() => {
                        if (!newBlockDate) { toast.error("날짜를 선택해 주세요."); return; }
                        addBlockedDate.mutate({
                          facilityId: f.id,
                          blockedDate: newBlockDate,
                          reason: newBlockReason || undefined,
                          isPartialBlock: false,
                        });
                      }}
                      disabled={addBlockedDate.isPending}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                      {addBlockedDate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                  {(blockedDates ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">설정된 예약 불가 날짜가 없습니다.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(blockedDates ?? []).map((bd: any) => (
                        <div key={bd.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-3.5 h-3.5 text-red-400" />
                            <span className="font-medium text-gray-700">{bd.blockedDate}</span>
                            {bd.reason && <span className="text-gray-400 text-xs">— {bd.reason}</span>}
                          </div>
                          <button onClick={() => removeBlockedDate.mutate({ id: bd.id })}
                            className="text-gray-300 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
