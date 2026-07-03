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

import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Facility, FacilityBlockedDate, FacilityImage } from "../../../drizzle/schema";
import {
  DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS,
  EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY,
  DEFAULT_FACILITY_RESERVATION_MAX_MONTHS,
  FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY,
  MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS,
  MAX_FACILITY_RESERVATION_MAX_MONTHS,
  MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS,
  MIN_FACILITY_RESERVATION_MAX_MONTHS,
  normalizeExternalReservationAdvanceDays,
  normalizeFacilityReservationMaxMonths,
} from "@shared/facilityReservationPolicy";
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp,
  Upload, X, Clock, Calendar, Users, CheckCircle2,
  Settings, Save, Ban, ImageIcon, Building2, GripVertical,
} from "lucide-react";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const FACILITY_BUILDINGS = [
  { value: "hayoungin", label: "하영인관" },
  { value: "welfare", label: "복지관" },
] as const;
const FACILITY_CONTACT_DEFAULT_TEXT_KEY = "facility_contact_default_text";
const FACILITY_MEMBER_RULES_TITLE_KEY = "facility_member_rules_title";
const FACILITY_MEMBER_RULES_TEXT_KEY = "facility_member_rules_text";
const FACILITY_EXTERNAL_RULES_TITLE_KEY = "facility_external_rules_title";
const FACILITY_PAGE_SETTING_FIELDS = [
  { key: "facility_hero_eyebrow", label: "상단 영문 라벨", helper: "예: FACILITY RESERVATION" },
  { key: "facility_hero_title", label: "상단 큰 제목", helper: "예: 시설 사용 예약" },
  { key: "facility_hero_description", label: "상단 설명 문구", helper: "히어로 영역의 안내 문장을 입력합니다." },
  { key: "facility_hero_background_url", label: "상단 배경 이미지 URL", helper: "비워두면 기본 배경 이미지를 사용합니다." },
  { key: "facility_guide_step1_title", label: "1단계 제목", helper: "예: 시설 선택" },
  { key: "facility_guide_step1_desc", label: "1단계 설명", helper: "예: 원하는 공간을 선택하세요" },
  { key: "facility_guide_step2_title", label: "2단계 제목", helper: "예: 날짜 확인" },
  { key: "facility_guide_step2_desc", label: "2단계 설명", helper: "예: 예약 가능 일정을 확인하세요" },
  { key: "facility_guide_step3_title", label: "3단계 제목", helper: "예: 신청서 작성" },
  { key: "facility_guide_step3_desc", label: "3단계 설명", helper: "예: 신청 정보를 입력하세요" },
  { key: "facility_guide_step4_title", label: "4단계 제목", helper: "예: 담당자 확인" },
  { key: "facility_guide_step4_desc", label: "4단계 설명", helper: "예: 승인 후 연락을 드립니다" },
  { key: FACILITY_CONTACT_DEFAULT_TEXT_KEY, label: "시설문의 기본 문구", helper: "시설별 문의문구가 비어 있을 때 공통으로 표시됩니다." },
  { key: FACILITY_MEMBER_RULES_TITLE_KEY, label: "교인 주의사항 제목", helper: "예: 교인 시설사용 주의사항" },
  { key: FACILITY_MEMBER_RULES_TEXT_KEY, label: "교인 주의사항 내용", helper: "교인 시설사용 공지와 주의사항을 한 줄에 하나씩 입력합니다." },
  { key: FACILITY_EXTERNAL_RULES_TITLE_KEY, label: "외부인 주의사항 제목", helper: "예: 외부 시설사용 주의사항" },
] as const;

type FacilityBuilding = typeof FACILITY_BUILDINGS[number]["value"];
type FacilityPageSettingKey =
  | typeof FACILITY_PAGE_SETTING_FIELDS[number]["key"]
  | typeof FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY
  | typeof EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY;
type FacilitySubTab = "list" | "pageSettings" | "externalSchedule";
const MONDAY_FIRST_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DEFAULT_HOURS = DAY_LABELS.map((_, i) => ({
  dayOfWeek: i,
  isOpen: i !== 1,
  openTime: "09:00",
  closeTime: "22:00",
  breakStart: "" as string,
  breakEnd: "" as string,
}));
type FacilityHoursForm = typeof DEFAULT_HOURS;

function createFacilityPageSettingDrafts(): Record<FacilityPageSettingKey, string> {
  return FACILITY_PAGE_SETTING_FIELDS.reduce((drafts, field) => {
    drafts[field.key] = "";
    return drafts;
  }, {
    [FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY]: String(DEFAULT_FACILITY_RESERVATION_MAX_MONTHS),
    [EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY]: String(DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS),
  } as Record<FacilityPageSettingKey, string>);
}

function createDefaultHours(): FacilityHoursForm {
  return DEFAULT_HOURS.map(hour => ({ ...hour }));
}

function mergeFacilityHours(
  savedHours: Array<{
    facilityId?: number;
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    breakStart?: string | null;
    breakEnd?: string | null;
  }> | undefined
): FacilityHoursForm {
  const savedByDay = new Map((savedHours ?? []).map(hour => [hour.dayOfWeek, hour]));
  return DEFAULT_HOURS.map(defaultHour => {
    const saved = savedByDay.get(defaultHour.dayOfWeek);
    if (!saved) return { ...defaultHour };
    return {
      ...defaultHour,
      isOpen: saved.isOpen,
      openTime: saved.openTime,
      closeTime: saved.closeTime,
      breakStart: saved.breakStart ?? "",
      breakEnd: saved.breakEnd ?? "",
    };
  });
}

interface FacilityForm {
  name: string;
  description: string;
  location: string;
  building: FacilityBuilding;
  capacity: number;
  pricePerHour: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  isExternalReservable: boolean;
  useExternalAdvanceDaysDefault: boolean;
  externalAdvanceDaysOverride: string;
  contactText: string;
  notice: string;
  externalNotice: string;
}

type FacilityImageDraft = {
  id?: number;
  imageUrl: string;
  isThumbnail: boolean;
  base64?: string;
  mimeType?: string;
  localPreview?: boolean;
};

const EMPTY_FORM: FacilityForm = {
  name: "",
  description: "",
  location: "",
  building: "welfare",
  capacity: 50,
  pricePerHour: 0,
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 8,
  approvalType: "manual",
  isExternalReservable: false,
  useExternalAdvanceDaysDefault: true,
  externalAdvanceDaysOverride: "",
  contactText: "",
  notice: "",
  externalNotice: "",
};

function getFacilityBuildingLabel(building: string | null | undefined) {
  return FACILITY_BUILDINGS.find((option) => option.value === building)?.label ?? "복지관";
}

function normalizeFacilityBuilding(building: string | null | undefined): FacilityBuilding {
  return building === "hayoungin" ? "hayoungin" : "welfare";
}

function getNextFacilitySortOrder(rows: Facility[], building: FacilityBuilding) {
  return rows
    .filter((facility) => normalizeFacilityBuilding(facility.building) === building)
    .reduce((max, facility) => Math.max(max, Number(facility.sortOrder) || 0), 0) + 1;
}

function SortableFacilityRow({
  facility,
  isExpanded,
  blockedDates,
  newBlockDate,
  newBlockReason,
  isAddingBlockedDate,
  isDeleting,
  onToggleExpanded,
  onEdit,
  onDelete,
  onNewBlockDateChange,
  onNewBlockReasonChange,
  onAddBlockedDate,
  onRemoveBlockedDate,
}: {
  facility: Facility & { thumbnailUrl?: string | null };
  isExpanded: boolean;
  blockedDates: FacilityBlockedDate[];
  newBlockDate: string;
  newBlockReason: string;
  isAddingBlockedDate: boolean;
  isDeleting: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewBlockDateChange: (value: string) => void;
  onNewBlockReasonChange: (value: string) => void;
  onAddBlockedDate: () => void;
  onRemoveBlockedDate: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: facility.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600 active:cursor-grabbing touch-none"
          title="드래그해서 순서 변경"
          aria-label={`${facility.name} 순서 변경`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {facility.thumbnailUrl ? (
          <img src={facility.thumbnailUrl} alt={facility.name} className="w-14 h-14 rounded-lg object-cover shrink-0"  loading="lazy"/>
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-gray-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{facility.name}</p>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[#1B5E20]">{getFacilityBuildingLabel(facility.building)}</span>
            {facility.location && <span>{facility.location}</span>}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{facility.capacity}명</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{facility.slotMinutes}분 단위</span>
            <span className={`flex items-center gap-1 ${facility.approvalType === "auto" ? "text-green-600" : "text-amber-600"}`}>
              <CheckCircle2 className="w-3 h-3" />
              {facility.approvalType === "auto" ? "자동 승인" : "수동 승인"}
            </span>
            {facility.isExternalReservable && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">외부인 공개</span>
            )}
            <span>{facility.pricePerHour === 0 ? "무료" : `${facility.pricePerHour.toLocaleString()}원/시간`}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleExpanded}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="예약 불가 날짜 관리"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onEdit}
            className="p-2 text-gray-400 hover:text-[#1B5E20] transition-colors" title="수정">
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title="삭제"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <Ban className="w-4 h-4 text-red-400" /> 예약 불가 날짜 설정
          </h5>
          <div className="flex gap-2 mb-3">
            <input type="date" value={newBlockDate}
              onChange={e => onNewBlockDateChange(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B5E20]" />
            <input type="text" value={newBlockReason}
              onChange={e => onNewBlockReasonChange(e.target.value)}
              placeholder="차단 사유 (예: 전교인 수련회)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1B5E20]" />
            <button
              onClick={onAddBlockedDate}
              disabled={isAddingBlockedDate}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
              {isAddingBlockedDate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {blockedDates.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">설정된 예약 불가 날짜가 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {blockedDates.map((bd) => (
                <div key={bd.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-red-400" />
                    <span className="font-medium text-gray-700">{bd.blockedDate}</span>
                    {bd.reason && <span className="text-gray-400 text-xs">— {bd.reason}</span>}
                  </div>
                  <button onClick={() => onRemoveBlockedDate(bd.id)}
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
  );
}

// ── 운영 시간 에디터 ──────────────────────────────────────
function HoursEditor({
  hours,
  onChange,
  dayOrder,
}: {
  hours: FacilityHoursForm;
  onChange: (h: FacilityHoursForm) => void;
  dayOrder?: readonly number[];
}) {
  const orderedHours = (dayOrder ?? hours.map(hour => hour.dayOfWeek))
    .map(day => hours.find(hour => hour.dayOfWeek === day))
    .filter((hour): hour is FacilityHoursForm[number] => Boolean(hour));

  function updateHour(dayOfWeek: number, patch: Partial<FacilityHoursForm[number]>) {
    const next = hours.map(hour => (
      hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour
    ));
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {orderedHours.map((h) => (
        <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-5 text-center font-medium text-gray-600 shrink-0">{DAY_LABELS[h.dayOfWeek]}</span>
          <label className="flex items-center gap-1 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={h.isOpen}
              onChange={e => updateHour(h.dayOfWeek, { isOpen: e.target.checked })}
            />
            <span className={h.isOpen ? "text-gray-700" : "text-gray-400"}>운영</span>
          </label>
          {h.isOpen ? (
            <>
              <input type="time" value={h.openTime}
                onChange={e => updateHour(h.dayOfWeek, { openTime: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="time" value={h.closeTime}
                onChange={e => updateHour(h.dayOfWeek, { closeTime: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs ml-1">불가</span>
              <input type="time" value={h.breakStart}
                onChange={e => updateHour(h.dayOfWeek, { breakStart: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="time" value={h.breakEnd}
                onChange={e => updateHour(h.dayOfWeek, { breakEnd: e.target.value })}
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
  onSetThumbnail,
  uploading,
  busyImageId,
}: {
  images: FacilityImageDraft[];
  onUpload: (file: File) => void;
  onRemove: (idx: number) => void;
  onSetThumbnail: (idx: number) => void;
  uploading: boolean;
  busyImageId?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
            <img src={img.imageUrl} alt="" className="w-full h-full object-cover"  loading="lazy"/>
            {img.isThumbnail && (
              <span className="absolute bottom-0 left-0 right-0 bg-[#1B5E20]/80 text-white text-[9px] text-center py-0.5">대표</span>
            )}
            {!img.isThumbnail && img.id && (
              <button
                type="button"
                onClick={() => onSetThumbnail(idx)}
                disabled={busyImageId === img.id}
                className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-medium text-[#1B5E20] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 disabled:opacity-50"
              >
                대표
              </button>
            )}
            <button type="button" onClick={() => onRemove(idx)}
              disabled={busyImageId === img.id}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
              {busyImageId === img.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <X className="w-2.5 h-2.5" />}
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

type AdminFacilitiesTabMode = "facilities" | "buildingSchedule" | "external";

type AdminFacilitiesTabProps = {
  mode?: AdminFacilitiesTabMode;
};

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function AdminFacilitiesTab({ mode = "facilities" }: AdminFacilitiesTabProps) {
  const utils = trpc.useUtils();
  const { data: facilities, isLoading } = trpc.home.facilities.useQuery();
  const { data: pageSettings } = trpc.home.settings.useQuery();
  const facilityRows = facilities ?? [];
  const isExternalMode = mode === "external";
  const externalFacilityRulesQuery = trpc.home.getExternalFacilityRules.useQuery(undefined, {
    enabled: isExternalMode,
  });
  const isFacilityResourceMode = mode === "facilities" || isExternalMode;
  const facilityRowsForMode = useMemo(
    () => isExternalMode
      ? facilityRows.filter((facility) => Boolean(facility.isExternalReservable))
      : facilityRows,
    [facilityRows, isExternalMode],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FacilityForm>(EMPTY_FORM);
  const [hours, setHours] = useState(createDefaultHours());
  const [images, setImages] = useState<FacilityImageDraft[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [activeBuilding, setActiveBuilding] = useState<FacilityBuilding>("welfare");
  const [buildingScheduleDrafts, setBuildingScheduleDrafts] = useState<Record<FacilityBuilding, FacilityHoursForm>>({
    hayoungin: createDefaultHours(),
    welfare: createDefaultHours(),
  });
  const [applyingBuilding, setApplyingBuilding] = useState<FacilityBuilding | null>(null);
  const [activeFacilitySubTab, setActiveFacilitySubTab] = useState<FacilitySubTab>("list");
  const [pageSettingDrafts, setPageSettingDrafts] = useState<Record<FacilityPageSettingKey, string>>(createFacilityPageSettingDrafts);
  const [externalRulesText, setExternalRulesText] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const buildingCounts = useMemo(() => {
    const counts = new Map<FacilityBuilding, number>(FACILITY_BUILDINGS.map((building) => [building.value, 0]));
    facilityRowsForMode.forEach((facility) => {
      const building = normalizeFacilityBuilding(facility.building);
      counts.set(building, (counts.get(building) ?? 0) + 1);
    });
    return counts;
  }, [facilityRowsForMode]);
  const activeBuildingOption = FACILITY_BUILDINGS.find((building) => building.value === activeBuilding) ?? FACILITY_BUILDINGS[1];
  const activeFacilities = useMemo(
    () => facilityRowsForMode
      .filter((facility) => normalizeFacilityBuilding(facility.building) === activeBuilding)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id),
    [activeBuilding, facilityRowsForMode],
  );

  const { data: blockedDates } = trpc.cms.facilities.blockedDates.list.useQuery(
    { facilityId: expandedId ?? undefined },
    { enabled: expandedId !== null }
  );
  const memberEditingFacilityHoursQuery = trpc.cms.facilities.hours.list.useQuery(
    { facilityId: editingId ?? 0 },
    { enabled: editingId !== null && !isExternalMode }
  );
  const externalEditingFacilityHoursQuery = trpc.cms.facilities.externalHours.list.useQuery(
    { facilityId: editingId ?? 0 },
    { enabled: editingId !== null && isExternalMode }
  );
  const editingFacilityHours = isExternalMode
    ? externalEditingFacilityHoursQuery.data
    : memberEditingFacilityHoursQuery.data;
  const isFetchingFacilityHours = isExternalMode
    ? externalEditingFacilityHoursQuery.isFetching
    : memberEditingFacilityHoursQuery.isFetching;
  const { data: editingFacilityImages } = trpc.cms.facilities.images.list.useQuery(
    { facilityId: editingId ?? 0 },
    { enabled: editingId !== null }
  );

  useEffect(() => {
    if (editingId === null || editingFacilityHours === undefined) return;
    if (editingFacilityHours.some(hour => hour.facilityId !== editingId)) return;
    setHours(mergeFacilityHours(editingFacilityHours));
  }, [editingFacilityHours, editingId]);

  useEffect(() => {
    if (editingId === null || editingFacilityImages === undefined) return;
    setImages(editingFacilityImages.map((image: FacilityImage) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      isThumbnail: image.isThumbnail,
    })));
  }, [editingFacilityImages, editingId]);

  useEffect(() => {
    if (!pageSettings) return;
    setPageSettingDrafts(() => {
      const next = createFacilityPageSettingDrafts();
      FACILITY_PAGE_SETTING_FIELDS.forEach((field) => {
        next[field.key] = pageSettings[field.key] ?? "";
      });
      next[FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY] = String(
        normalizeFacilityReservationMaxMonths(pageSettings[FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY]),
      );
      next[EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY] = String(
        normalizeExternalReservationAdvanceDays(
          pageSettings[EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY],
        ),
      );
      return next;
    });
  }, [pageSettings]);

  useEffect(() => {
    if (externalFacilityRulesQuery.data === undefined) return;
    setExternalRulesText(externalFacilityRulesQuery.data);
  }, [externalFacilityRulesQuery.data]);

  // ── Mutations ─────────────────────────────────────────
  const createFacility = trpc.cms.facilities.create.useMutation({
    onSuccess: async (newFacility) => {
      const facilityId = newFacility as number;
      let imageUploadFailed = false;

      for (const img of images) {
        if (!img.base64 || !img.mimeType) continue;
        try {
          await uploadImageMutation.mutateAsync({
            facilityId,
            base64: img.base64,
            mimeType: img.mimeType,
            isThumbnail: img.isThumbnail,
          });
        } catch {
          imageUploadFailed = true;
        }
      }

      // 운영 시간 저장
      for (const h of hours) {
        await upsertHour.mutateAsync({
          facilityId,
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.openTime,
          closeTime: h.closeTime,
          breakStart: h.breakStart || null,
          breakEnd: h.breakEnd || null,
        });
      }
      utils.home.facilities.invalidate();
      utils.home.facility.invalidate();
      utils.home.externalFacilities.invalidate();
      utils.home.externalFacility.invalidate();
      resetForm();
      if (imageUploadFailed) {
        toast.error("시설은 등록됐지만 일부 사진 업로드에 실패했습니다. 수정 화면에서 다시 추가해 주세요.");
      } else {
        toast.success("시설이 등록되었습니다.");
      }
    },
    onError: (e) => toast.error(e.message || "등록에 실패했습니다."),
  });

  const updateFacility = trpc.cms.facilities.update.useMutation({
    onSuccess: async () => {
      if (editingId) {
        for (const h of hours) {
          await upsertHourForMode({
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
      utils.home.facilities.invalidate();
      utils.home.facility.invalidate();
      utils.home.externalFacilities.invalidate();
      utils.home.externalFacility.invalidate();
      if (editingId) {
        utils.home.externalFacilityHours.invalidate({ facilityId: editingId });
        utils.cms.facilities.externalHours.list.invalidate({ facilityId: editingId });
      }
      resetForm();
      toast.success("시설 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message || "수정에 실패했습니다."),
  });

  const deleteFacility = trpc.cms.facilities.delete.useMutation({
    onSuccess: () => {
      utils.home.facilities.invalidate();
      utils.home.facility.invalidate();
      utils.home.externalFacilities.invalidate();
      utils.home.externalFacility.invalidate();
      toast.success("시설이 삭제되었습니다.");
    },
    onError: (e) => toast.error(e.message || "삭제에 실패했습니다."),
  });

  const reorderFacility = trpc.cms.facilities.reorder.useMutation({
    onSuccess: () => {
      utils.home.facilities.invalidate();
      utils.home.externalFacilities.invalidate();
      toast.success("시설 순서가 저장되었습니다.");
    },
    onError: (e) => toast.error(e.message || "순서 저장에 실패했습니다."),
  });

  const uploadImageMutation = trpc.cms.facilities.images.upload.useMutation();
  const deleteImageMutation = trpc.cms.facilities.images.delete.useMutation();
  const setThumbnailMutation = trpc.cms.facilities.images.setThumbnail.useMutation();
  const upsertHour = trpc.cms.facilities.hours.upsert.useMutation();
  const upsertExternalHour = trpc.cms.facilities.externalHours.upsert.useMutation();
  const updateFacilityPageSetting = trpc.cms.facilities.pageSettings.update.useMutation({
    onSuccess: () => utils.home.settings.invalidate(),
  });
  const updateExternalFacilityRules = trpc.home.setExternalFacilityRules.useMutation({
    onSuccess: async () => {
      await utils.home.getExternalFacilityRules.invalidate();
      toast.success("외부 시설 주의사항이 저장되었습니다.");
    },
    onError: (e) => toast.error(e.message || "외부 시설 주의사항 저장에 실패했습니다."),
  });

  async function upsertHourForMode(input: {
    facilityId: number;
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    breakStart: string | null;
    breakEnd: string | null;
  }) {
    return isExternalMode ? upsertExternalHour.mutateAsync(input) : upsertHour.mutateAsync(input);
  }

  function updatePageSettingDraft(key: FacilityPageSettingKey, value: string) {
    setPageSettingDrafts(prev => ({ ...prev, [key]: value }));
  }

  function getValidReservationMaxMonthsDraft() {
    const reservationMaxMonths = Number(
      pageSettingDrafts[FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY] || DEFAULT_FACILITY_RESERVATION_MAX_MONTHS,
    );

    if (
      !Number.isInteger(reservationMaxMonths) ||
      reservationMaxMonths < MIN_FACILITY_RESERVATION_MAX_MONTHS ||
      reservationMaxMonths > MAX_FACILITY_RESERVATION_MAX_MONTHS
    ) {
      toast.error(`예약 가능 기간은 ${MIN_FACILITY_RESERVATION_MAX_MONTHS}~${MAX_FACILITY_RESERVATION_MAX_MONTHS}개월 사이의 정수로 입력해주세요.`);
      return null;
    }

    return reservationMaxMonths;
  }

  function getValidExternalAdvanceDaysDraft() {
    const externalAdvanceDays = Number(
      pageSettingDrafts[EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY] || DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS,
    );

    if (
      !Number.isInteger(externalAdvanceDays) ||
      externalAdvanceDays < MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS ||
      externalAdvanceDays > MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS
    ) {
      toast.error(`외부인 예약 가능 기간은 ${MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS}~${MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS}일 사이의 정수로 입력해 주세요.`);
      return null;
    }

    return externalAdvanceDays;
  }

  async function savePageSettings() {
    try {
      for (const field of FACILITY_PAGE_SETTING_FIELDS) {
        await updateFacilityPageSetting.mutateAsync({
          key: field.key,
          value: pageSettingDrafts[field.key],
        });
      }
      await utils.home.settings.invalidate();
      toast.success("시설예약 페이지 문구가 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문구 저장에 실패했습니다.");
    }
  }

  async function saveReservationWindowSetting() {
    const reservationMaxMonths = getValidReservationMaxMonthsDraft();
    if (reservationMaxMonths === null) return;

    try {
      await updateFacilityPageSetting.mutateAsync({
        key: FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY,
        value: String(reservationMaxMonths),
      });
      await utils.home.settings.invalidate();
      toast.success("예약 가능 기간이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "예약 가능 기간 저장에 실패했습니다.");
    }
  }

  async function saveExternalAdvanceDaysSetting() {
    const externalAdvanceDays = getValidExternalAdvanceDaysDraft();
    if (externalAdvanceDays === null) return;

    try {
      await updateFacilityPageSetting.mutateAsync({
        key: EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY,
        value: String(externalAdvanceDays),
      });
      await utils.home.settings.invalidate();
      toast.success("외부인 예약 가능 기간이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "외부인 예약 가능 기간 저장에 실패했습니다.");
    }
  }

  function updateBuildingScheduleDraft(building: FacilityBuilding, nextHours: FacilityHoursForm) {
    setBuildingScheduleDrafts(prev => ({
      ...prev,
      [building]: nextHours.map(hour => ({ ...hour })),
    }));
  }

  async function applyBuildingSchedule(building: FacilityBuilding) {
    const targetFacilities = facilityRowsForMode.filter((facility) => normalizeFacilityBuilding(facility.building) === building);
    const buildingLabel = getFacilityBuildingLabel(building);

    if (targetFacilities.length === 0) {
      toast.error(`${buildingLabel}에 등록된 시설이 없습니다.`);
      return;
    }

    const shouldOverwrite = window.confirm(
      `${buildingLabel} 시설 ${targetFacilities.length}개의 요일별 예약 가능 시간을 일괄 적용합니다.\n기존 개별 시간 설정이 덮어써집니다. 계속할까요?`
    );
    if (!shouldOverwrite) return;

    setApplyingBuilding(building);
    try {
      const draftHours = buildingScheduleDrafts[building];
      for (const facility of targetFacilities) {
        for (const hour of draftHours) {
          await upsertHourForMode({
            facilityId: facility.id,
            dayOfWeek: hour.dayOfWeek,
            isOpen: hour.isOpen,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            breakStart: hour.breakStart || null,
            breakEnd: hour.breakEnd || null,
          });
        }
      }

      await Promise.all(targetFacilities.flatMap((facility) => [
        utils.cms.facilities.hours.list.invalidate({ facilityId: facility.id }),
        utils.cms.facilities.externalHours.list.invalidate({ facilityId: facility.id }),
        utils.home.facilityHours.invalidate({ facilityId: facility.id }),
        utils.home.externalFacilityHours.invalidate({ facilityId: facility.id }),
      ]));
      toast.success(`${buildingLabel} 시설 ${targetFacilities.length}개의 스케줄을 일괄 적용했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "건물별 스케줄 일괄 적용에 실패했습니다.");
    } finally {
      setApplyingBuilding(null);
    }
  }

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

  function invalidateFacilityImages(facilityId: number) {
    utils.cms.facilities.images.list.invalidate({ facilityId });
    utils.cms.facilities.list.invalidate();
    utils.home.facilities.invalidate();
    utils.home.facilityImages.invalidate({ facilityId });
  }

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
        // 수정 모드: 즉시 서버에 업로드하고 새 이미지를 대표 사진으로 교체
        const result = await uploadImageMutation.mutateAsync({
          facilityId: editingId,
          base64,
          mimeType: file.type,
          isThumbnail: true,
        });
        setImages(prev => [
          { id: result.id ?? undefined, imageUrl: result.url, isThumbnail: true },
          ...prev.map(image => ({ ...image, isThumbnail: false })),
        ]);
        invalidateFacilityImages(editingId);
      } else {
        // 등록 모드: 로컬 미리보기 후 저장 시 서버 업로드
        const localUrl = URL.createObjectURL(file);
        setImages(prev => [...prev, {
          imageUrl: localUrl,
          isThumbnail: prev.length === 0,
          base64,
          mimeType: file.type,
          localPreview: true,
        }]);
      }
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleImageRemove(idx: number) {
    const target = images[idx];
    if (editingId && target?.id) {
      setBusyImageId(target.id);
      try {
        await deleteImageMutation.mutateAsync({ id: target.id });
        const next = images.filter((_, i) => i !== idx);
        if (target.isThumbnail && next[0]?.id) {
          await setThumbnailMutation.mutateAsync({ facilityId: editingId, imageId: next[0].id });
          setImages(next.map((image, imageIndex) => ({ ...image, isThumbnail: imageIndex === 0 })));
        } else {
          setImages(next);
        }
        invalidateFacilityImages(editingId);
        toast.success("시설 사진이 삭제되었습니다.");
      } catch {
        toast.error("시설 사진 삭제에 실패했습니다.");
      } finally {
        setBusyImageId(null);
      }
      return;
    }

    setImages(prev => {
      const removed = prev[idx];
      if (removed?.localPreview) URL.revokeObjectURL(removed.imageUrl);
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0) next[0] = { ...next[0], isThumbnail: true };
      return next;
    });
  }

  async function handleSetThumbnail(idx: number) {
    const target = images[idx];
    if (!target) return;
    if (editingId && target.id) {
      setBusyImageId(target.id);
      try {
        await setThumbnailMutation.mutateAsync({ facilityId: editingId, imageId: target.id });
        setImages(prev => prev.map((image, imageIndex) => ({ ...image, isThumbnail: imageIndex === idx })));
        invalidateFacilityImages(editingId);
        toast.success("대표 사진이 변경되었습니다.");
      } catch {
        toast.error("대표 사진 변경에 실패했습니다.");
      } finally {
        setBusyImageId(null);
      }
      return;
    }
    setImages(prev => prev.map((image, imageIndex) => ({ ...image, isThumbnail: imageIndex === idx })));
  }

  // ── 폼 초기화 ─────────────────────────────────────────
  function resetForm() {
    images.forEach(img => {
      if (img.localPreview) URL.revokeObjectURL(img.imageUrl);
    });
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setHours(createDefaultHours());
    setImages([]);
  }

  function startCreate() {
    resetForm();
    setForm({ ...EMPTY_FORM, building: activeBuilding });
    setShowForm(true);
  }

  function startEdit(f: NonNullable<typeof facilities>[number]) {
    setEditingId(f.id);
    setForm({
      name: f.name,
      description: f.description ?? "",
      location: f.location ?? "",
      building: normalizeFacilityBuilding(f.building),
      capacity: f.capacity,
      pricePerHour: f.pricePerHour,
      slotMinutes: f.slotMinutes,
      minSlots: f.minSlots,
      maxSlots: f.maxSlots,
      approvalType: f.approvalType as "auto" | "manual",
      isExternalReservable: Boolean(f.isExternalReservable),
      useExternalAdvanceDaysDefault: f.externalAdvanceDaysOverride === null || f.externalAdvanceDaysOverride === undefined,
      externalAdvanceDaysOverride:
        f.externalAdvanceDaysOverride === null || f.externalAdvanceDaysOverride === undefined
          ? ""
          : String(f.externalAdvanceDaysOverride),
      contactText: f.contactText ?? "",
      notice: f.notice ?? "",
      externalNotice: f.externalNotice ?? "",
    });
    setImages([]);
    setHours(createDefaultHours());
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── 저장 ──────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { toast.error("시설명을 입력해 주세요."); return; }
    if (editingId && isFetchingFacilityHours) {
      toast.error("운영 시간 정보를 불러오는 중입니다. 잠시 후 다시 저장해 주세요.");
      return;
    }

    const externalAdvanceDaysOverride =
      form.useExternalAdvanceDaysDefault || !form.isExternalReservable
        ? null
        : Number(form.externalAdvanceDaysOverride);

    if (
      externalAdvanceDaysOverride !== null &&
      (!Number.isInteger(externalAdvanceDaysOverride) ||
        externalAdvanceDaysOverride < MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS ||
        externalAdvanceDaysOverride > MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS)
    ) {
      toast.error(`시설별 외부인 예약 가능 기간은 ${MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS}~${MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS}일 사이의 정수로 입력해 주세요.`);
      return;
    }

    const facilityPayload = {
      name: form.name,
      description: form.description,
      location: form.location,
      building: form.building,
      capacity: form.capacity,
      pricePerHour: form.pricePerHour,
      slotMinutes: form.slotMinutes,
      minSlots: 1,
      maxSlots: 96,
      approvalType: form.approvalType,
      isExternalReservable: form.isExternalReservable,
      externalAdvanceDaysOverride,
      contactText: form.contactText,
      notice: form.notice,
      ...(isExternalMode ? { externalNotice: form.externalNotice } : {}),
    };

    if (editingId) {
      updateFacility.mutate({
        id: editingId,
        ...facilityPayload,
      });
    } else {
      // 등록 모드: 먼저 시설 생성 후 이미지 업로드
      createFacility.mutate({
        ...facilityPayload,
        isReservable: true,
        isVisible: true,
        sortOrder: getNextFacilitySortOrder(facilityRows, form.building),
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (isExternalMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeFacilities.findIndex((facility) => facility.id === active.id);
    const newIndex = activeFacilities.findIndex((facility) => facility.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextRows = arrayMove(activeFacilities, oldIndex, newIndex);
    reorderFacility.mutate({
      items: nextRows.map((row, index) => ({ id: row.id, sortOrder: index + 1 })),
    });
  }

  const isSaving = createFacility.isPending || updateFacility.isPending || upsertExternalHour.isPending || Boolean(editingId && isFetchingFacilityHours);
  const title = mode === "buildingSchedule"
    ? "\uc2dc\uc124 \uc2a4\ucf00\uc904"
    : isExternalMode
      ? "\uc678\ubd80\uc778 \uc2dc\uc124 \uad00\ub9ac"
      : "\uc2dc\uc124 \uad00\ub9ac";
  const description = mode === "buildingSchedule"
    ? "\uc131\ub3c4 \uc608\uc57d \ud654\uba74\uc5d0\uc11c \uc0ac\uc6a9\ud558\ub294 \uacf5\ud1b5 \uc608\uc57d \uac00\ub2a5 \uc2dc\uac04\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4."
    : isExternalMode
      ? "\uc678\ubd80\uc778\uc5d0\uac8c \uacf5\uac1c\ud55c \uc2dc\uc124\ub9cc \ubaa8\uc544 \ubcf4\uace0, \uc678\ubd80\uc778 \uc608\uc57d \ud654\uba74 \uc804\uc6a9 \uc6b4\uc601 \uc2dc\uac04\uc744 \uad00\ub9ac\ud569\ub2c8\ub2e4."
      : "\uc2dc\uc124\uc744 \ub4f1\ub85d\ud558\uace0 \uc6b4\uc601 \uc2dc\uac04, \uc608\uc57d \uc870\uac74\uc744 \uc124\uc815\ud569\ub2c8\ub2e4.";
  const scheduleTitle = isExternalMode ? "\uc678\ubd80\uc778 \uc804\uc6a9 \uc2a4\ucf00\uc904 \uc77c\uad04\uc801\uc6a9" : "\uac74\ubb3c\ubcc4 \uc2a4\ucf00\uc904 \uc77c\uad04\uc801\uc6a9";
  const scheduleDescription = isExternalMode
    ? "\uc678\ubd80\uc778\uc5d0\uac8c \uacf5\uac1c\ub41c \uc2dc\uc124\uc5d0\ub9cc \uc801\uc6a9\ub429\ub2c8\ub2e4. \uc131\ub3c4\uc6a9 \uc2dc\uc124 \uc2dc\uac04\ud45c\ub294 \ubc14\ub00c\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    : "\uacf5\ud1b5 \uc608\uc57d \uac00\ub2a5 \uc2dc\uac04\uc744 \uba3c\uc800 \uc801\uc6a9\ud558\uace0 \uc608\uc678 \uc2dc\uc124\uc740 \uc2dc\uc124 \uad00\ub9ac\uc5d0\uc11c \uac1c\ubcc4 \uc870\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";

  const isBuildingScheduleView =
    mode === "buildingSchedule" || (mode === "external" && activeFacilitySubTab === "externalSchedule");
  const buildingScheduleSourceKey = facilityRowsForMode
    .map((facility) => `${facility.id}:${normalizeFacilityBuilding(facility.building)}:${facility.sortOrder ?? 0}`)
    .join("|");

  useEffect(() => {
    if (!isBuildingScheduleView) return;

    let cancelled = false;

    async function hydrateBuildingScheduleDrafts() {
      const nextDrafts: Record<FacilityBuilding, FacilityHoursForm> = {
        hayoungin: createDefaultHours(),
        welfare: createDefaultHours(),
      };

      await Promise.all(
        FACILITY_BUILDINGS.map(async ({ value }) => {
          const sourceFacility = facilityRowsForMode
            .filter((facility) => normalizeFacilityBuilding(facility.building) === value)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id)[0];

          if (!sourceFacility) return;

          const savedHours = isExternalMode
            ? await utils.cms.facilities.externalHours.list.fetch({ facilityId: sourceFacility.id })
            : await utils.cms.facilities.hours.list.fetch({ facilityId: sourceFacility.id });

          nextDrafts[value] = mergeFacilityHours(savedHours);
        }),
      );

      if (!cancelled) {
        setBuildingScheduleDrafts(nextDrafts);
      }
    }

    hydrateBuildingScheduleDrafts().catch(() => {
      if (!cancelled) {
        setBuildingScheduleDrafts({
          hayoungin: createDefaultHours(),
          welfare: createDefaultHours(),
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [buildingScheduleSourceKey, facilityRowsForMode, isBuildingScheduleView, isExternalMode, utils]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#1B5E20]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {mode === "facilities" && activeFacilitySubTab === "list" && !showForm && (
          <button onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition-colors">
            <Plus className="w-4 h-4" /> 시설 등록
          </button>
        )}
      </div>

      {mode === "facilities" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveFacilitySubTab("list")}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              activeFacilitySubTab === "list"
                ? "bg-[#1B5E20] text-white shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              activeFacilitySubTab === "list" ? "bg-white/15" : "bg-white"
            }`}>
              <Building2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">시설 목록 / 예약 조건</span>
              <span className={`mt-0.5 block text-xs ${
                activeFacilitySubTab === "list" ? "text-white/75" : "text-gray-400"
              }`}>
                시설 등록, 사진, 운영 시간, 예약 조건 관리
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              setActiveFacilitySubTab("pageSettings");
            }}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              activeFacilitySubTab === "pageSettings"
                ? "bg-[#1B5E20] text-white shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              activeFacilitySubTab === "pageSettings" ? "bg-white/15" : "bg-white"
            }`}>
              <Pencil className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">페이지 문구</span>
              <span className={`mt-0.5 block text-xs ${
                activeFacilitySubTab === "pageSettings" ? "text-white/75" : "text-gray-400"
              }`}>
                상단 히어로와 4단계 안내 문구 수정
              </span>
            </span>
          </button>
        </div>
      )}

      {mode === "external" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-2 shadow-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveFacilitySubTab("list")}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              activeFacilitySubTab === "list"
                ? "bg-[#1B5E20] text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-blue-50"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              activeFacilitySubTab === "list" ? "bg-white/15" : "bg-blue-50"
            }`}>
              <Building2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">외부인 공개 시설</span>
              <span className={`mt-0.5 block text-xs ${
                activeFacilitySubTab === "list" ? "text-white/75" : "text-gray-500"
              }`}>
                외부인 예약 공개 체크 시설만 표시
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              setActiveFacilitySubTab("externalSchedule");
            }}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              activeFacilitySubTab === "externalSchedule"
                ? "bg-[#1B5E20] text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-blue-50"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              activeFacilitySubTab === "externalSchedule" ? "bg-white/15" : "bg-blue-50"
            }`}>
              <Clock className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">외부인 전용 스케줄</span>
              <span className={`mt-0.5 block text-xs ${
                activeFacilitySubTab === "externalSchedule" ? "text-white/75" : "text-gray-500"
              }`}>
                성도용 시간과 별도로 운영 시간 관리
              </span>
            </span>
          </button>
        </div>
      )}

      {isExternalMode && activeFacilitySubTab === "list" && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Settings className="h-4 w-4 text-amber-600" />
                {pageSettingDrafts[FACILITY_EXTERNAL_RULES_TITLE_KEY] || "외부 시설사용 주의사항"}
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                외부 신청서에 표시되는 주의사항입니다. 제목은 시설예약 페이지 문구에서 수정하고, 줄바꿈한 각 줄이 번호 목록으로 표시됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateExternalFacilityRules.mutate({ rules: externalRulesText })}
              disabled={updateExternalFacilityRules.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
            >
              {updateExternalFacilityRules.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              주의사항 저장
            </button>
          </div>
          <textarea
            value={externalRulesText}
            onChange={(e) => setExternalRulesText(e.target.value)}
            rows={7}
            placeholder="외부 시설 사용 시 주의사항을 한 줄에 하나씩 입력해 주세요."
            className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none"
          />
        </div>
      )}

      {mode === "facilities" && activeFacilitySubTab === "pageSettings" && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Settings className="h-4 w-4 text-[#1B5E20]" />
                시설예약 페이지 문구
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                사용자 화면의 상단 히어로 문구와 4단계 안내 문구를 여기서 바로 수정합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={savePageSettings}
              disabled={updateFacilityPageSetting.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
            >
              {updateFacilityPageSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              문구 저장
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-white/70 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-bold text-gray-900">상단 히어로</p>
                <p className="mt-1 text-xs text-gray-400">시설예약 화면 맨 위의 제목, 설명, 배경 이미지를 수정합니다.</p>
              </div>
              <div className="space-y-3">
                {FACILITY_PAGE_SETTING_FIELDS.slice(0, 4).map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}</span>
                    {field.key === "facility_hero_description" ? (
                      <textarea
                        value={pageSettingDrafts[field.key]}
                        onChange={(e) => updatePageSettingDraft(field.key, e.target.value)}
                        rows={4}
                        placeholder={field.helper}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={pageSettingDrafts[field.key]}
                        onChange={(e) => updatePageSettingDraft(field.key, e.target.value)}
                        placeholder={field.helper}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-[#123F17] p-4 text-white">
                <p className="text-xs font-semibold tracking-[0.18em] text-white/70">
                  {pageSettingDrafts.facility_hero_eyebrow || "FACILITY RESERVATION"}
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {pageSettingDrafts.facility_hero_title || "시설 사용 예약"}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/80">
                  {pageSettingDrafts.facility_hero_description || "기쁨의교회의 다양한 공간을 예약하여 사용하실 수 있습니다. 원하시는 시설을 선택하고 예약 신청서를 작성해 주세요."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/70 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-bold text-gray-900">4단계 안내 문구</p>
                <p className="mt-1 text-xs text-gray-400">실제 화면에 보이는 순서대로 제목과 설명을 바로 수정합니다.</p>
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((index) => {
                  const titleField = FACILITY_PAGE_SETTING_FIELDS[4 + index * 2];
                  const descField = FACILITY_PAGE_SETTING_FIELDS[5 + index * 2];

                  return (
                    <div key={titleField.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <p className="text-sm font-bold text-gray-900">{index + 1}단계 안내</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.2fr]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">제목</span>
                          <input
                            type="text"
                            value={pageSettingDrafts[titleField.key]}
                            onChange={(e) => updatePageSettingDraft(titleField.key, e.target.value)}
                            placeholder={titleField.helper}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-600">설명</span>
                          <input
                            type="text"
                            value={pageSettingDrafts[descField.key]}
                            onChange={(e) => updatePageSettingDraft(descField.key, e.target.value)}
                            placeholder={descField.helper}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/70 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4">
                <p className="text-sm font-bold text-gray-900">시설문의 / 주의사항 문구</p>
                <p className="mt-1 text-xs text-gray-400">시설별 문의문구가 비어 있으면 기본 문의문구가 사용됩니다. 교인 주의사항은 신청서에 공통으로 표시됩니다.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">시설문의 기본 문구</span>
                  <textarea
                    value={pageSettingDrafts[FACILITY_CONTACT_DEFAULT_TEXT_KEY]}
                    onChange={(e) => updatePageSettingDraft(FACILITY_CONTACT_DEFAULT_TEXT_KEY, e.target.value)}
                    rows={3}
                    placeholder="예: 기쁨의교회 사무국 054-270-1002"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">교인 주의사항 제목</span>
                    <input
                      type="text"
                      value={pageSettingDrafts[FACILITY_MEMBER_RULES_TITLE_KEY]}
                      onChange={(e) => updatePageSettingDraft(FACILITY_MEMBER_RULES_TITLE_KEY, e.target.value)}
                      placeholder="교인 시설사용 주의사항"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">외부인 주의사항 제목</span>
                    <input
                      type="text"
                      value={pageSettingDrafts[FACILITY_EXTERNAL_RULES_TITLE_KEY]}
                      onChange={(e) => updatePageSettingDraft(FACILITY_EXTERNAL_RULES_TITLE_KEY, e.target.value)}
                      placeholder="외부 시설사용 주의사항"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block lg:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">교인 주의사항 내용</span>
                  <textarea
                    value={pageSettingDrafts[FACILITY_MEMBER_RULES_TEXT_KEY]}
                    onChange={(e) => updatePageSettingDraft(FACILITY_MEMBER_RULES_TEXT_KEY, e.target.value)}
                    rows={5}
                    placeholder="교인 시설사용 공지와 주의사항을 한 줄에 하나씩 입력해 주세요."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {(mode === "buildingSchedule" || (mode === "external" && activeFacilitySubTab === "externalSchedule")) && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Clock className="h-4 w-4 text-[#1B5E20]" />
                {scheduleTitle}
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                {scheduleDescription}
              </p>
            </div>
            <p className="rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-medium text-[#1B5E20]">
              월요일 기본 휴무
            </p>
          </div>
          {mode === "buildingSchedule" && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">예약 가능 기간</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  일반 성도는 오늘 기준 설정한 개월 수 이후 날짜를 예약할 수 없습니다.
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  기본값은 {DEFAULT_FACILITY_RESERVATION_MAX_MONTHS}개월이며, {MIN_FACILITY_RESERVATION_MAX_MONTHS}~{MAX_FACILITY_RESERVATION_MAX_MONTHS}개월 사이에서 설정할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_FACILITY_RESERVATION_MAX_MONTHS}
                    max={MAX_FACILITY_RESERVATION_MAX_MONTHS}
                    step={1}
                    value={pageSettingDrafts[FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY]}
                    onChange={(e) => updatePageSettingDraft(FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY, e.target.value)}
                    className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm font-semibold focus:border-[#1B5E20] focus:outline-none"
                  />
                  <span className="text-sm font-medium text-gray-700">개월</span>
                </label>
                <button
                  type="button"
                  onClick={saveReservationWindowSetting}
                  disabled={updateFacilityPageSetting.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  {updateFacilityPageSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  기간 저장
                </button>
              </div>
            </div>
          </div>
          )}
          {mode === "external" && activeFacilitySubTab === "externalSchedule" && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">외부인 공통 예약 가능 기간</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  외부인 시설에서 따로 기간을 정하지 않으면, 아래 일수가 기본값으로 적용됩니다.
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  기본값은 {DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS}일이며, {MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS}~{MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS}일 사이에서 설정할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS}
                    max={MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS}
                    step={1}
                    value={pageSettingDrafts[EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY]}
                    onChange={(e) => updatePageSettingDraft(EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY, e.target.value)}
                    className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm font-semibold focus:border-[#1B5E20] focus:outline-none"
                  />
                  <span className="text-sm font-medium text-gray-700">일</span>
                </label>
                <button
                  type="button"
                  onClick={saveExternalAdvanceDaysSetting}
                  disabled={updateFacilityPageSetting.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  {updateFacilityPageSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  기간 저장
                </button>
              </div>
            </div>
          </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {FACILITY_BUILDINGS.map((building) => {
              const count = buildingCounts.get(building.value) ?? 0;
              const isApplying = applyingBuilding === building.value;

              return (
                <div key={building.value} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{building.label}</p>
                      <p className="text-xs text-gray-500">대상 시설 {count}개</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyBuildingSchedule(building.value)}
                      disabled={isApplying || count === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E20] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {building.label} 일괄적용
                    </button>
                  </div>
                  <HoursEditor
                    hours={buildingScheduleDrafts[building.value]}
                    onChange={(next) => updateBuildingScheduleDraft(building.value, next)}
                    dayOrder={MONDAY_FIRST_DAY_ORDER}
                  />
                  <p className="mt-3 text-[11px] text-gray-400">
                    예약 불가 시간대가 있으면 불가 시작/종료에 입력하세요. 예: 12:00~13:00
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isFacilityResourceMode && activeFacilitySubTab === "list" && showForm && (
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
              <label className="block text-xs font-medium text-gray-600 mb-1">건물 분류</label>
              <select
                value={form.building}
                onChange={e => setForm(p => ({ ...p, building: normalizeFacilityBuilding(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20]"
              >
                {FACILITY_BUILDINGS.map((building) => (
                  <option key={building.value} value={building.value}>{building.label}</option>
                ))}
              </select>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">시설문의 문구 (개별)</label>
              <textarea value={form.contactText}
                onChange={e => setForm(p => ({ ...p, contactText: e.target.value }))}
                placeholder="비워두면 일괄 시설문의 기본 문구를 사용합니다."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none" />
              <p className="mt-1 text-[11px] text-gray-400">시설 상세와 신청서의 시설문의 영역에 표시됩니다.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">이용 안내 (예약 시 성도에게 표시)</label>
              <textarea value={form.notice}
                onChange={e => setForm(p => ({ ...p, notice: e.target.value }))}
                placeholder="예: 사용 후 반드시 원상복구 해주세요. 음식물 반입 금지."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none" />
            </div>
            {isExternalMode && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">외부 신청 안내문</label>
                <textarea value={form.externalNotice}
                  onChange={e => setForm(p => ({ ...p, externalNotice: e.target.value }))}
                  placeholder="예: 외부 신청 전 사무국에 장소 사용 가능 여부를 확인해 주세요."
                  rows={3}
                  className="w-full border border-teal-100 bg-teal-50/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B5E20] resize-none" />
                <p className="mt-1 text-[11px] text-gray-400">외부 신청서와 외부 시설 상세 화면에만 표시됩니다.</p>
              </div>
            )}
          </div>

          {/* 예약 조건 */}
          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> 예약 조건
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <label className="col-span-2 md:col-span-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isExternalReservable}
                  onChange={e => setForm(p => ({ ...p, isExternalReservable: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-blue-300 text-[#1B5E20]"
                />
                <span>
                  <span className="block text-sm font-bold text-blue-900">외부인 예약 공개</span>
                  <span className="mt-0.5 block text-xs leading-5 text-blue-700">
                    체크하면 시설사용예약 &gt; 외부인 화면에 노출되고, 비회원도 이름/연락처를 입력해 예약을 신청할 수 있습니다.
                  </span>
                </span>
              </label>
              {isExternalMode && form.isExternalReservable && (
                <div className="col-span-2 md:col-span-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-4">
                  <div className="flex flex-col gap-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.useExternalAdvanceDaysDefault}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            useExternalAdvanceDaysDefault: e.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-amber-300 text-[#1B5E20]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-amber-900">이 시설은 공통 기간 그대로 사용</span>
                        <span className="mt-0.5 block text-xs leading-5 text-amber-700">
                          체크하면 위에서 정한 외부인 공통 예약 가능 기간이 그대로 적용됩니다.
                        </span>
                      </span>
                    </label>
                    {!form.useExternalAdvanceDaysDefault && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-gray-600">이 시설만 따로 기간 설정</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS}
                            max={MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS}
                            step={1}
                            value={form.externalAdvanceDaysOverride}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                externalAdvanceDaysOverride: e.target.value,
                              }))
                            }
                            className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm font-semibold focus:border-[#1B5E20] focus:outline-none"
                          />
                          <span className="text-sm font-medium text-gray-700">일</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 운영 시간 */}
          <div>
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {isExternalMode ? "외부인 전용 요일별 운영 시간" : "요일별 운영 시간"}
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
              onSetThumbnail={handleSetThumbnail}
              uploading={uploadingImage}
              busyImageId={busyImageId}
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
      {isFacilityResourceMode && activeFacilitySubTab === "list" && (facilityRowsForMode.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{isExternalMode ? "외부인에게 공개된 시설이 없습니다." : "등록된 시설이 없습니다."}</p>
          <p className="text-sm mt-1">
            {isExternalMode
              ? "시설 관리에서 필요한 시설의 외부인 예약 공개를 먼저 체크해 주세요."
              : "\"시설 등록\" 버튼을 눌러 첫 시설을 등록해 보세요."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">건물 선택</h4>
                <p className="text-xs text-gray-500">시설을 관리할 건물을 선택해 주세요.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FACILITY_BUILDINGS.map((building) => {
                const isActive = activeBuilding === building.value;
                return (
                  <button
                    key={building.value}
                    type="button"
                    onClick={() => setActiveBuilding(building.value)}
                    className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-all ${
                      isActive
                        ? "border-[#1B5E20] bg-[#F1F8E9] shadow-sm"
                        : "border-gray-200 bg-white hover:border-[#1B5E20]/60 hover:bg-green-50/40"
                    }`}
                  >
                    <span>
                      <span className={`block text-base font-bold ${isActive ? "text-[#1B5E20]" : "text-gray-800"}`}>
                        {building.label}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        등록 시설 {buildingCounts.get(building.value) ?? 0}개
                      </span>
                    </span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isActive ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {isActive ? "선택" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="inline-flex items-center gap-2 text-sm font-bold text-gray-800">
                <Building2 className="h-4 w-4 text-[#1B5E20]" />
                {activeBuildingOption.label}
              </h4>
              <span className="text-xs text-gray-400">{activeFacilities.length}개 시설</span>
            </div>
            {activeFacilities.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                이 건물에 등록된 시설이 없습니다.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeFacilities.map((facility) => facility.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {activeFacilities.map((f) => (
                      <SortableFacilityRow
                        key={f.id}
                        facility={f as Facility & { thumbnailUrl?: string }}
                        isExpanded={expandedId === f.id}
                        blockedDates={blockedDates ?? []}
                        newBlockDate={newBlockDate}
                        newBlockReason={newBlockReason}
                        isAddingBlockedDate={addBlockedDate.isPending}
                        isDeleting={deleteFacility.isPending}
                        onToggleExpanded={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        onEdit={() => startEdit(f)}
                        onDelete={() => {
                          if (confirm(`"${f.name}" 시설을 삭제하시겠습니까?\n예약 내역이 있는 시설은 삭제되지 않습니다.`)) {
                            deleteFacility.mutate({ id: f.id });
                          }
                        }}
                        onNewBlockDateChange={setNewBlockDate}
                        onNewBlockReasonChange={setNewBlockReason}
                        onAddBlockedDate={() => {
                          if (!newBlockDate) { toast.error("날짜를 선택해 주세요."); return; }
                          addBlockedDate.mutate({
                            facilityId: f.id,
                            blockedDate: newBlockDate,
                            reason: newBlockReason || undefined,
                            isPartialBlock: false,
                          });
                        }}
                        onRemoveBlockedDate={(id) => removeBlockedDate.mutate({ id })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        </div>
      ))}
    </div>
  );
}
