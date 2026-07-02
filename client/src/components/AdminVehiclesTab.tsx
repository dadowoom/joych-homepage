/**
 * 차량예약 관리 탭
 * - 차량 등록/수정
 * - 차량 예약 승인/거절/삭제
 * - 차량예약을 볼 수 있고 신청할 수 있는 성도 그룹 설정
 */

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Clock,
  Car,
  ImageIcon,
  KeyRound,
  List,
  Loader2,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

type AdminVehicleTabMode = "vehicles" | "reservations" | "access";
type VehicleReservationViewMode = "list" | "calendar";
type VehicleStatusFilter = "approval" | "cancelled";
type VehicleReservationStatus = "pending" | "approved" | "rejected" | "cancelled";
type FieldType = "position" | "department" | "district" | "baptism";

// 차량예약은 당분간 직분 기준으로만 메뉴 노출/신청 권한을 관리합니다.
// 나중에 부서/구역 기준이 필요하면 이 배열에 다시 추가하면 됩니다.
const VEHICLE_ACCESS_FIELD_TYPES: FieldType[] = ["position"];
const VEHICLE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const MAX_VEHICLE_IMAGE_BYTES = 10 * 1024 * 1024;
const TIME_24H_RE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

type VehicleRow = {
  id: number;
  name: string;
  description?: string | null;
  plateNumber?: string | null;
  location?: string | null;
  driverInfo?: string | null;
  capacity: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  isReservable: boolean;
  isVisible: boolean;
  notice?: string | null;
  caution?: string | null;
  sortOrder: number;
  openTime: string;
  closeTime: string;
  thumbnailUrl?: string | null;
};

type VehicleImageRow = {
  id: number;
  vehicleId: number;
  imageUrl: string;
  fileKey?: string | null;
  caption?: string | null;
  isThumbnail: boolean;
  sortOrder: number;
  createdAt?: Date | string;
};

type VehicleReservationRow = {
  id: number;
  vehicleId: number;
  reserverName: string;
  reserverPhone?: string | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  status: VehicleReservationStatus;
  purpose: string;
  department?: string | null;
  passengers: number;
  notes?: string | null;
  adminComment?: string | null;
  createdAt: Date | string;
  vehicleName?: string | null;
  plateNumber?: string | null;
  userName?: string | null;
  memberPosition?: string | null;
  memberPhone?: string | null;
};

type VehicleReservationTimeEditForm = {
  reservationDate: string;
  startTime: string;
  endTime: string;
};

const VEHICLE_RESERVATION_GRID =
  "120px 120px minmax(130px, 1fr) minmax(160px, 1.2fr) 110px 90px 130px 100px 70px 130px";

type AccessRuleDraft = {
  fieldType: FieldType;
  fieldValue: string;
  isActive: boolean;
  sortOrder: number;
};

type VehicleForm = {
  name: string;
  description: string;
  plateNumber: string;
  location: string;
  driverInfo: string;
  capacity: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  isReservable: boolean;
  isVisible: boolean;
  notice: string;
  caution: string;
  openTime: string;
  closeTime: string;
};

const EMPTY_FORM: VehicleForm = {
  name: "",
  description: "",
  plateNumber: "",
  location: "",
  driverInfo: "",
  capacity: 5,
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 8,
  approvalType: "manual",
  isReservable: true,
  isVisible: true,
  notice: "",
  caution: "",
  openTime: "00:00",
  closeTime: "24:00",
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  position: "직분",
  department: "부서",
  district: "구역/순",
  baptism: "세례 구분",
};

const STATUS_LABELS: Record<VehicleReservationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "승인 대기", color: "bg-amber-100 text-amber-700", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "승인 완료", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "거절", color: "bg-red-100 text-red-700", icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500", icon: <AlertCircle className="h-3 w-3" /> },
};

function formatDate(dateKey: string) {
  const date = new Date(dateKey);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// 관리자 화면에서는 브라우저 언어 설정에 흔들리지 않도록 HH:MM 24시간제로 통일합니다.
function normalizeTimeValue(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const normalized = normalizeTimeValue(value);
  return TIME_24H_RE.test(normalized) ? normalized : value;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  return `${formatTime(start)}~${formatTime(end)}`;
}

function formatCreatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function readImageFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64] = result.split(",");
      if (!base64) reject(new Error("이미지 파일을 읽지 못했습니다."));
      else resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getNextSortOrder(rows: VehicleRow[]) {
  return rows.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0) + 1;
}

function getRuleKey(rule: Pick<AccessRuleDraft, "fieldType" | "fieldValue">) {
  return `${rule.fieldType}:${rule.fieldValue}`;
}

function getReservationName(row: VehicleReservationRow) {
  return row.reserverName || row.userName || "이름 없음";
}

function getReservationPhone(row: VehicleReservationRow) {
  return row.reserverPhone || row.memberPhone || "-";
}

function getReservationPosition(row: VehicleReservationRow) {
  return row.memberPosition || row.department || "-";
}

function getVehicleDisplayName(vehicle: Pick<VehicleRow, "name" | "plateNumber">) {
  return vehicle.plateNumber ? `${vehicle.plateNumber} ${vehicle.name}` : vehicle.name;
}

function getReservationVehicleName(row: VehicleReservationRow) {
  return row.vehicleName ?? "차량";
}

function getReservationPlateNumber(row: VehicleReservationRow) {
  return row.plateNumber || "-";
}

function getReservationGroupLabel(row: VehicleReservationRow) {
  const lowerName = getReservationName(row).toLowerCase();
  const lowerDepartment = (row.department ?? "").toLowerCase();
  const isAdminLike =
    lowerName.includes("관리자") ||
    lowerName.includes("admin") ||
    lowerDepartment.includes("관리자") ||
    lowerDepartment.includes("admin");
  if (isAdminLike) return "관리자";

  const label = getReservationPosition(row);
  return label && label !== "-" ? label : "기타";
}

export default function AdminVehiclesTab() {
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<AdminVehicleTabMode>("vehicles");
  const activeMode: AdminVehicleTabMode = isMobile ? "reservations" : mode;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [reservationVehicleFilter, setReservationVehicleFilter] = useState<number | undefined>();
  const [reservationStatusFilter, setReservationStatusFilter] = useState<VehicleStatusFilter>("approval");
  const [reservationViewMode, setReservationViewMode] = useState<VehicleReservationViewMode>("list");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [editingReservationId, setEditingReservationId] = useState<number | null>(null);
  const [reservationTimeForm, setReservationTimeForm] = useState<VehicleReservationTimeEditForm>({
    reservationDate: "",
    startTime: "",
    endTime: "",
  });
  const [accessDraft, setAccessDraft] = useState<AccessRuleDraft[] | null>(null);
  const [imageVehicleId, setImageVehicleId] = useState<number | null>(null);
  const [uploadingVehicleImage, setUploadingVehicleImage] = useState(false);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const vehicleImageInputRef = useRef<HTMLInputElement | null>(null);

  const { data: vehicles = [], isLoading: vehiclesLoading } = trpc.cms.vehicles.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: reservations = [], isLoading: reservationsLoading } =
    trpc.cms.vehicleReservations.list.useQuery(
      { vehicleId: reservationVehicleFilter },
      { refetchInterval: 30000 }
    );
  const { data: memberOptions = [] } = trpc.members.adminFieldOptions.useQuery();
  const { data: accessRules = [], isLoading: accessLoading } = trpc.cms.vehicles.accessRules.list.useQuery(undefined);
  const { data: vehicleImages = [], isLoading: vehicleImagesLoading } = trpc.cms.vehicles.images.list.useQuery(
    { vehicleId: imageVehicleId ?? 1 },
    { enabled: imageVehicleId !== null }
  );

  const vehicleRows = vehicles as VehicleRow[];
  const reservationRows = reservations as VehicleReservationRow[];
  const accessRuleRows = accessRules as AccessRuleDraft[];
  const vehicleImageRows = vehicleImages as VehicleImageRow[];
  const imageVehicle = vehicleRows.find(vehicle => vehicle.id === imageVehicleId) ?? null;

  const createVehicle = trpc.cms.vehicles.create.useMutation({
    onSuccess: () => {
      utils.cms.vehicles.list.invalidate();
      utils.home.vehicles.invalidate();
      resetForm();
      toast.success("차량이 등록되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateVehicle = trpc.cms.vehicles.update.useMutation({
    onSuccess: () => {
      utils.cms.vehicles.list.invalidate();
      utils.home.vehicles.invalidate();
      resetForm();
      toast.success("차량 정보가 수정되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteVehicle = trpc.cms.vehicles.delete.useMutation({
    onSuccess: () => {
      utils.cms.vehicles.list.invalidate();
      utils.home.vehicles.invalidate();
      toast.success("차량이 삭제되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const approveReservation = trpc.cms.vehicleReservations.approve.useMutation({
    onSuccess: () => {
      utils.cms.vehicleReservations.list.invalidate();
      toast.success("차량 예약이 승인되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const rejectReservation = trpc.cms.vehicleReservations.reject.useMutation({
    onSuccess: () => {
      utils.cms.vehicleReservations.list.invalidate();
      setRejectingId(null);
      setRejectComment("");
      toast.success("차량 예약이 거절되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelReservation = trpc.cms.vehicleReservations.cancel.useMutation({
    onSuccess: () => {
      utils.cms.vehicleReservations.list.invalidate();
      toast.success("차량 예약을 취소했습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateReservationTime = trpc.cms.vehicleReservations.updateTime.useMutation({
    onSuccess: () => {
      utils.cms.vehicleReservations.list.invalidate();
      setEditingReservationId(null);
      toast.success("차량 예약 시간이 수정되었습니다.");
    },
    onError: (error) => toast.error(error.message || "차량 예약 시간 수정에 실패했습니다."),
  });
  const deleteReservation = trpc.cms.vehicleReservations.delete.useMutation({
    onSuccess: () => {
      utils.cms.vehicleReservations.list.invalidate();
      toast.success("차량 예약이 삭제되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const replaceAccessRules = trpc.cms.vehicles.accessRules.replace.useMutation({
    onSuccess: () => {
      utils.cms.vehicles.accessRules.list.invalidate();
      utils.home.vehicleReservationAccess.invalidate();
      utils.home.vehicles.invalidate();
      setAccessDraft(null);
      toast.success("차량예약 가능 그룹이 저장되었습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadVehicleImage = trpc.cms.vehicles.images.upload.useMutation();
  const deleteVehicleImage = trpc.cms.vehicles.images.delete.useMutation();
  const setVehicleThumbnailMutation = trpc.cms.vehicles.images.setThumbnail.useMutation();

  const stats = useMemo(() => ({
    total: reservationRows.length,
    pending: reservationRows.filter(row => row.status === "pending").length,
    approved: reservationRows.filter(row => row.status === "approved").length,
    rejected: reservationRows.filter(row => row.status === "rejected").length,
    cancelled: reservationRows.filter(row => row.status === "cancelled").length,
    approval: reservationRows.filter(row => row.status === "pending" || row.status === "approved").length,
  }), [reservationRows]);

  const filteredReservations = reservationRows.filter(row =>
    reservationStatusFilter === "approval"
      ? row.status === "pending" || row.status === "approved"
      : row.status === "cancelled"
  );

  const optionGroups = useMemo(() => {
    const groups: Record<FieldType, string[]> = {
      position: [],
      department: [],
      district: [],
      baptism: [],
    };
    memberOptions.forEach((option) => {
      const fieldType = option.fieldType as FieldType;
      if (!groups[fieldType] || !option.isActive) return;
      groups[fieldType].push(option.label);
    });
    return groups;
  }, [memberOptions]);

  const displayedAccessRules = (accessDraft ?? accessRuleRows.filter(rule => rule.isActive))
    .filter(rule => VEHICLE_ACCESS_FIELD_TYPES.includes(rule.fieldType));
  const selectedAccessKeys = new Set(displayedAccessRules.map(getRuleKey));

  function invalidateVehicleImages(vehicleId: number) {
    utils.cms.vehicles.images.list.invalidate({ vehicleId });
    utils.cms.vehicles.list.invalidate();
    utils.home.vehicles.invalidate();
    utils.home.vehicle.invalidate({ id: vehicleId });
    utils.home.vehicleImages.invalidate({ vehicleId });
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setImageVehicleId(null);
    setForm(EMPTY_FORM);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setImageVehicleId(null);
    setShowForm(true);
  }

  function startEdit(vehicle: VehicleRow) {
    setEditingId(vehicle.id);
    setImageVehicleId(null);
    setForm({
      name: vehicle.name,
      description: vehicle.description ?? "",
      plateNumber: vehicle.plateNumber ?? "",
      location: vehicle.location ?? "",
      driverInfo: vehicle.driverInfo ?? "",
      capacity: vehicle.capacity,
      slotMinutes: vehicle.slotMinutes,
      minSlots: vehicle.minSlots,
      maxSlots: vehicle.maxSlots,
      approvalType: vehicle.approvalType,
      isReservable: vehicle.isReservable,
      isVisible: vehicle.isVisible,
      notice: vehicle.notice ?? "",
      caution: vehicle.caution ?? "",
      openTime: vehicle.openTime,
      closeTime: vehicle.closeTime,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openImageManager(vehicle: VehicleRow) {
    setImageVehicleId(vehicle.id);
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateForm<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function saveVehicle() {
    if (!form.name.trim()) {
      toast.error("차량 이름을 입력해주세요.");
      return;
    }

    const openTime = normalizeTimeValue(form.openTime);
    const closeTime = normalizeTimeValue(form.closeTime);
    if (!TIME_24H_RE.test(openTime) || !TIME_24H_RE.test(closeTime)) {
      toast.error("운영 시간은 09:00처럼 24시간제로 입력해주세요.");
      return;
    }
    if (openTime >= closeTime) {
      toast.error("시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    if (form.maxSlots < form.minSlots) {
      toast.error("최대 예약 시간은 최소 예약 시간보다 크거나 같아야 합니다.");
      return;
    }

    const payload = { ...form, openTime, closeTime };
    if (editingId) {
      updateVehicle.mutate({ id: editingId, ...payload });
      return;
    }
    createVehicle.mutate({
      ...payload,
      sortOrder: getNextSortOrder(vehicleRows),
    });
  }

  function removeVehicle(vehicle: VehicleRow) {
    if (!confirm(`${vehicle.name} 차량을 삭제하시겠습니까?\n예약 내역이 있으면 삭제되지 않습니다.`)) return;
    deleteVehicle.mutate({ id: vehicle.id });
  }

  function removeReservation(row: VehicleReservationRow) {
    if (!confirm("차량 예약을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.")) return;
    deleteReservation.mutate({ id: row.id });
  }

  function cancelVehicleReservation(row: VehicleReservationRow) {
    if (!confirm("차량 예약을 취소하시겠습니까?")) return;
    cancelReservation.mutate({ id: row.id });
  }

  function startReservationTimeEdit(row: VehicleReservationRow) {
    setRejectingId(null);
    setEditingReservationId(row.id);
    setReservationTimeForm({
      reservationDate: row.reservationDate,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  }

  function saveReservationTime(row: VehicleReservationRow) {
    if (!reservationTimeForm.reservationDate || !reservationTimeForm.startTime || !reservationTimeForm.endTime) {
      toast.error("예약 날짜와 시간을 입력해주세요.");
      return;
    }
    if (reservationTimeForm.startTime >= reservationTimeForm.endTime) {
      toast.error("시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    updateReservationTime.mutate({
      id: row.id,
      reservationDate: reservationTimeForm.reservationDate,
      startTime: reservationTimeForm.startTime,
      endTime: reservationTimeForm.endTime,
    });
  }

  async function handleVehicleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !imageVehicleId) return;
    if (!VEHICLE_IMAGE_MIME_TYPES.has(file.type)) {
      toast.error("차량 이미지는 jpg, png, webp, gif 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_VEHICLE_IMAGE_BYTES) {
      toast.error("차량 이미지는 최대 10MB까지 업로드할 수 있습니다.");
      return;
    }

    setUploadingVehicleImage(true);
    try {
      const base64 = await readImageFileAsBase64(file);
      await uploadVehicleImage.mutateAsync({
        vehicleId: imageVehicleId,
        base64,
        mimeType: file.type,
        caption: "",
        isThumbnail: vehicleImageRows.length === 0,
      });
      invalidateVehicleImages(imageVehicleId);
      toast.success("차량 이미지가 등록되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "차량 이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingVehicleImage(false);
    }
  }

  async function handleVehicleThumbnail(image: VehicleImageRow) {
    if (!imageVehicleId || image.isThumbnail) return;
    setBusyImageId(image.id);
    try {
      await setVehicleThumbnailMutation.mutateAsync({ vehicleId: imageVehicleId, imageId: image.id });
      invalidateVehicleImages(imageVehicleId);
      toast.success("대표 이미지가 변경되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "대표 이미지 변경에 실패했습니다.");
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleVehicleImageDelete(image: VehicleImageRow) {
    if (!imageVehicleId) return;
    if (!confirm("차량 이미지를 삭제하시겠습니까?")) return;

    setBusyImageId(image.id);
    try {
      await deleteVehicleImage.mutateAsync({ id: image.id });
      const nextThumbnail = image.isThumbnail
        ? vehicleImageRows.find(row => row.id !== image.id)
        : null;
      if (nextThumbnail) {
        await setVehicleThumbnailMutation.mutateAsync({ vehicleId: imageVehicleId, imageId: nextThumbnail.id });
      }
      invalidateVehicleImages(imageVehicleId);
      toast.success("차량 이미지가 삭제되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "차량 이미지 삭제에 실패했습니다.");
    } finally {
      setBusyImageId(null);
    }
  }

  function toggleAccessRule(fieldType: FieldType, fieldValue: string, checked: boolean) {
    const base = accessDraft ?? accessRuleRows.filter(rule => rule.isActive);
    const next = base.filter(rule => getRuleKey(rule) !== `${fieldType}:${fieldValue}`);
    if (checked) {
      next.push({
        fieldType,
        fieldValue,
        isActive: true,
        sortOrder: next.length + 1,
      });
    }
    setAccessDraft(next.map((rule, index) => ({ ...rule, sortOrder: index + 1 })));
  }

  function saveAccessRules() {
    const rules = (accessDraft ?? accessRuleRows.filter(rule => rule.isActive))
      .filter(rule => VEHICLE_ACCESS_FIELD_TYPES.includes(rule.fieldType))
      .map((rule, index) => ({
        fieldType: "position" as const,
        fieldValue: rule.fieldValue,
        isActive: true,
        sortOrder: index + 1,
      }));
    replaceAccessRules.mutate({ rules });
  }

  const isSavingVehicle = createVehicle.isPending || updateVehicle.isPending;
  const isMutatingReservation =
    approveReservation.isPending || rejectReservation.isPending || cancelReservation.isPending || updateReservationTime.isPending || deleteReservation.isPending;

  if (vehiclesLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#1B5E20]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">차량예약 관리</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            차량 등록, 예약 승인, 예약 가능 성도 그룹을 한곳에서 관리합니다.
          </p>
        </div>
        {activeMode === "vehicles" && !showForm && (
          <Button onClick={startCreate} className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
            <Plus className="mr-1.5 h-4 w-4" /> 차량 등록
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm md:grid-cols-3">
        {(isMobile ? [
          { id: "reservations", label: "예약 승인", desc: `대기 ${stats.pending}건`, icon: <Clock className="h-4 w-4" /> },
        ] : [
          { id: "vehicles", label: "차량 목록", desc: "차량과 예약 조건", icon: <CalendarCheck className="h-4 w-4" /> },
          { id: "reservations", label: "예약 승인", desc: `대기 ${stats.pending}건`, icon: <Clock className="h-4 w-4" /> },
          { id: "access", label: "예약 가능 그룹", desc: "메뉴 노출/신청 권한", icon: <KeyRound className="h-4 w-4" /> },
        ]).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              setImageVehicleId(null);
              setMode(item.id as AdminVehicleTabMode);
            }}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
              activeMode === item.id
                ? "bg-[#1B5E20] text-white shadow-sm"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
              activeMode === item.id ? "bg-white/15" : "bg-white text-[#1B5E20]"
            }`}>
              {item.icon}
            </span>
            <span>
              <span className="block text-sm font-bold">{item.label}</span>
              <span className={`mt-0.5 block text-xs ${activeMode === item.id ? "text-white/75" : "text-gray-400"}`}>
                {item.desc}
              </span>
            </span>
          </button>
        ))}
      </div>

      {activeMode === "vehicles" && showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-900">{editingId ? "차량 수정" : "차량 등록"}</h4>
              <p className="mt-0.5 text-xs text-gray-500">차량은 차단일 없이 매일 운영 시간 안에서 예약됩니다.</p>
            </div>
            <button type="button" onClick={resetForm} className="text-sm text-gray-400 hover:text-gray-600">취소</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">차량 이름 *</span>
              <input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="예: 1호차, 스타리아"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">차량 번호</span>
              <input
                value={form.plateNumber}
                onChange={(e) => updateForm("plateNumber", e.target.value)}
                placeholder="예: 12가 3456"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">위치/출발 장소</span>
              <input
                value={form.location}
                onChange={(e) => updateForm("location", e.target.value)}
                placeholder="예: 본관 주차장"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">담당/기사 안내</span>
              <input
                value={form.driverInfo}
                onChange={(e) => updateForm("driverInfo", e.target.value)}
                placeholder="예: 행정실 확인 후 배정"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">탑승 정원</span>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => updateForm("capacity", Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">시간 단위(분)</span>
              <input
                type="number"
                min={5}
                value={form.slotMinutes}
                onChange={(e) => updateForm("slotMinutes", Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">최소 단위</span>
                <input
                  type="number"
                  min={1}
                  value={form.minSlots}
                  onChange={(e) => updateForm("minSlots", Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">최대 단위</span>
                <input
                  type="number"
                  min={1}
                  value={form.maxSlots}
                  onChange={(e) => updateForm("maxSlots", Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">운영 시작</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                  maxLength={5}
                  placeholder="00:00"
                  value={form.openTime}
                  onChange={(e) => updateForm("openTime", e.target.value)}
                  onBlur={() => updateForm("openTime", normalizeTimeValue(form.openTime))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">운영 종료</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                  maxLength={5}
                  placeholder="24:00"
                  value={form.closeTime}
                  onChange={(e) => updateForm("closeTime", e.target.value)}
                  onBlur={() => updateForm("closeTime", normalizeTimeValue(form.closeTime))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">승인 방식</span>
              <select
                value={form.approvalType}
                onChange={(e) => updateForm("approvalType", e.target.value as "auto" | "manual")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              >
                <option value="manual">관리자 승인</option>
                <option value="auto">자동 승인</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={form.isVisible} onCheckedChange={(checked) => updateForm("isVisible", checked === true)} />
                화면 노출
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={form.isReservable} onCheckedChange={(checked) => updateForm("isReservable", checked === true)} />
                예약 가능
              </label>
            </div>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">차량 설명</span>
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">예약 안내</span>
              <textarea
                value={form.notice}
                onChange={(e) => updateForm("notice", e.target.value)}
                rows={3}
                placeholder="사용자 신청 화면에 보여줄 안내문"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>취소</Button>
            <Button type="button" onClick={saveVehicle} disabled={isSavingVehicle} className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
              {isSavingVehicle ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>
      )}

      {activeMode === "vehicles" && !showForm && imageVehicle && (
        <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <input
            ref={vehicleImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleVehicleImageUpload}
          />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#1B5E20]">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">{imageVehicle.name} 이미지 관리</h4>
                <p className="mt-1 text-xs text-gray-500">
                  첫 이미지는 자동으로 대표 이미지가 됩니다. 대표 이미지는 사용자 차량예약 화면에도 표시됩니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => vehicleImageInputRef.current?.click()}
                disabled={uploadingVehicleImage}
                className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
              >
                {uploadingVehicleImage ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                이미지 추가
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setImageVehicleId(null)}>
                닫기
              </Button>
            </div>
          </div>

          {vehicleImagesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#1B5E20]" />
            </div>
          ) : vehicleImageRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
              등록된 차량 이미지가 없습니다. 이미지 추가 버튼으로 사진을 넣어주세요.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicleImageRows.map(image => (
                <div key={image.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="relative aspect-video bg-gray-100">
                    <img
                      src={image.imageUrl}
                      alt={`${imageVehicle.name} 차량 이미지`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {image.isThumbnail && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#1B5E20] px-2 py-1 text-xs font-medium text-white">
                        <Star className="h-3 w-3 fill-current" /> 대표
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={image.isThumbnail || busyImageId === image.id}
                      onClick={() => handleVehicleThumbnail(image)}
                    >
                      {busyImageId === image.id && !image.isThumbnail ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Star className="mr-1 h-3.5 w-3.5" />}
                      대표 지정
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyImageId === image.id}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleVehicleImageDelete(image)}
                    >
                      {busyImageId === image.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeMode === "vehicles" && !showForm && (
        <div className="space-y-3">
          {vehicleRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
              등록된 차량이 없습니다. 먼저 차량을 등록해주세요.
            </div>
          ) : (
            vehicleRows.map(vehicle => (
              <div key={vehicle.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  {vehicle.thumbnailUrl ? (
                    <img
                      src={vehicle.thumbnailUrl}
                      alt={vehicle.name}
                      className="h-20 w-28 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#1B5E20]">
                      <Car className="h-8 w-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-gray-900">{vehicle.name}</h4>
                      {vehicle.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{vehicle.plateNumber}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${vehicle.isVisible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {vehicle.isVisible ? "노출" : "숨김"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${vehicle.isReservable ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-600"}`}>
                        {vehicle.isReservable ? "예약 가능" : "예약 중단"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {vehicle.location || "출발 장소 미입력"} · {formatTimeRange(vehicle.openTime, vehicle.closeTime)} · {vehicle.slotMinutes}분 단위 · 정원 {vehicle.capacity}명
                    </p>
                    {vehicle.description && <p className="mt-1 line-clamp-1 text-xs text-gray-400">{vehicle.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => openImageManager(vehicle)}>
                      <ImageIcon className="mr-1 h-3.5 w-3.5" /> 이미지
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(vehicle)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> 수정
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => removeVehicle(vehicle)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> 삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeMode === "reservations" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-900">차량 예약 스케줄</h4>
              <p className="mt-0.5 text-xs text-gray-500">목록 또는 달력으로 차량 예약 흐름을 확인합니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReservationViewMode("list")}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                  reservationViewMode === "list"
                    ? "bg-[#1B5E20] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <List className="h-4 w-4" /> 목록
              </button>
              <button
                type="button"
                onClick={() => setReservationViewMode("calendar")}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
                  reservationViewMode === "calendar"
                    ? "bg-[#1B5E20] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Calendar className="h-4 w-4" /> 달력
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "승인", value: stats.approval, color: "bg-green-50 text-green-700" },
              { label: "취소", value: stats.cancelled, color: "bg-gray-50 text-gray-600" },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border border-gray-100 p-4 text-center ${item.color}`}>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="mt-0.5 text-xs">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={reservationVehicleFilter ?? ""}
              onChange={(e) => setReservationVehicleFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none sm:min-h-0"
            >
              <option value="">전체 차량</option>
              {vehicleRows.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{getVehicleDisplayName(vehicle)}</option>)}
            </select>
            {([
              { value: "approval", label: "승인" },
              { value: "cancelled", label: "취소" },
            ] as const).map(status => (
              <button
                key={status.value}
                type="button"
                onClick={() => setReservationStatusFilter(status.value)}
                className={`min-h-11 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:min-h-0 ${
                  reservationStatusFilter === status.value
                    ? "bg-[#1B5E20] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

          {reservationViewMode === "calendar" && (
            <VehicleReservationCalendarView
              reservations={filteredReservations}
              vehicleFilter={reservationVehicleFilter}
              vehicles={vehicleRows}
              isMutatingReservation={isMutatingReservation}
              onApprove={(row) => approveReservation.mutate({ id: row.id })}
              onCancel={cancelVehicleReservation}
            />
          )}

          {reservationViewMode === "list" && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {reservationsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B5E20]" /></div>
            ) : filteredReservations.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">해당 조건의 차량 예약이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1230px]">
                <div
                  className="grid gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500"
                  style={{ gridTemplateColumns: VEHICLE_RESERVATION_GRID }}
                >
                  <div>시간</div>
                  <div>차량번호</div>
                  <div>차량</div>
                  <div>목적</div>
                  <div>신청자</div>
                  <div>직분</div>
                  <div>연락처</div>
                  <div>상태</div>
                  <div>인원</div>
                  <div>관리</div>
                </div>
                {filteredReservations.map(row => {
                  const status = STATUS_LABELS[row.status] ?? STATUS_LABELS.pending;
                  return (
                    <div key={row.id} className="border-b border-gray-100 p-4 last:border-b-0">
                      <div
                        className="grid items-center gap-3 text-sm"
                        style={{ gridTemplateColumns: VEHICLE_RESERVATION_GRID }}
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{formatDate(row.reservationDate)}</p>
                          <p className="text-xs text-gray-600">{formatTimeRange(row.startTime, row.endTime)}</p>
                        </div>
                        <div>
                          <p className="font-extrabold text-gray-950">{getReservationPlateNumber(row)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{getReservationVehicleName(row)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{row.purpose || "-"}</p>
                          {row.notes && <p className="mt-0.5 truncate text-xs text-gray-500">요청: {row.notes}</p>}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{getReservationName(row)}</p>
                          <p className="text-[11px] text-gray-400">신청 {formatCreatedAt(row.createdAt)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{getReservationPosition(row)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{getReservationPhone(row)}</p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                            {status.icon} {status.label}
                          </span>
                          {row.adminComment && <p className="mt-1 text-xs text-red-600">{row.adminComment}</p>}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{row.passengers}명</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.status !== "approved" && (
                            <Button
                              size="sm"
                              className="min-h-10 bg-green-600 text-white hover:bg-green-700 sm:min-h-0"
                              disabled={isMutatingReservation}
                              onClick={() => approveReservation.mutate({ id: row.id })}
                            >
                              승인
                            </Button>
                          )}
                          {row.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-10 border-red-200 text-red-600 hover:bg-red-50 sm:min-h-0"
                              disabled={isMutatingReservation}
                              onClick={() => cancelVehicleReservation(row)}
                            >
                              취소
                            </Button>
                          )}
                        </div>
                      </div>

                      {rejectingId === row.id && (
                        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3">
                          <p className="mb-1 text-xs font-medium text-red-700">거절 사유</p>
                          <textarea
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                            placeholder="예: 해당 시간에는 차량 사용이 어렵습니다."
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="min-h-11 bg-red-600 text-white hover:bg-red-700 sm:min-h-0"
                              disabled={!rejectComment.trim() || isMutatingReservation}
                              onClick={() => rejectReservation.mutate({ id: row.id, comment: rejectComment })}
                            >
                              거절 확정
                            </Button>
                            <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => setRejectingId(null)}>취소</Button>
                          </div>
                        </div>
                      )}

                      {editingReservationId === row.id && (
                        <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
                          <p className="mb-2 text-xs font-medium text-green-800">예약 날짜/시간 수정</p>
                          <div className="grid gap-3 md:grid-cols-4">
                            <label className="block">
                              <span className="mb-1 block text-xs text-green-800">예약 날짜</span>
                              <input
                                type="date"
                                value={reservationTimeForm.reservationDate}
                                onChange={(e) => setReservationTimeForm(prev => ({ ...prev, reservationDate: e.target.value }))}
                                className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-green-800">시작 시간</span>
                              <input
                                type="time"
                                value={reservationTimeForm.startTime}
                                onChange={(e) => setReservationTimeForm(prev => ({ ...prev, startTime: e.target.value }))}
                                className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-green-800">종료 시간</span>
                              <input
                                type="time"
                                value={reservationTimeForm.endTime}
                                onChange={(e) => setReservationTimeForm(prev => ({ ...prev, endTime: e.target.value }))}
                                className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                              />
                            </label>
                            <div className="flex items-end gap-2">
                              <Button
                                size="sm"
                                className="min-h-11 bg-[#1B5E20] text-white hover:bg-[#2E7D32] sm:min-h-0"
                                disabled={isMutatingReservation}
                                onClick={() => saveReservationTime(row)}
                              >
                                저장
                              </Button>
                              <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => setEditingReservationId(null)}>
                                취소
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {activeMode === "access" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <KeyRound className="h-4 w-4 text-[#1B5E20]" />
                차량예약 가능 그룹
              </h4>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                여기서 체크된 성도 그룹만 차량예약 메뉴를 볼 수 있고 신청할 수 있습니다.
                아무것도 체크하지 않으면 일반 성도는 차량예약을 이용할 수 없습니다.
                특정 성도 한 명에게만 열어줄 때는 운영 설정 &gt; 관리 권한에서 차량예약 관리를 체크해주세요.
              </p>
            </div>
            <Button
              type="button"
              onClick={saveAccessRules}
              disabled={accessLoading || replaceAccessRules.isPending}
              className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
            >
              {replaceAccessRules.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              그룹 저장
            </Button>
          </div>

          {accessLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#1B5E20]" /></div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {VEHICLE_ACCESS_FIELD_TYPES.map(fieldType => (
                <section key={fieldType} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{FIELD_TYPE_LABELS[fieldType]}</p>
                      <p className="text-xs text-gray-400">해당 값과 일치하는 성도에게 허용</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#1B5E20]">
                      {optionGroups[fieldType].filter(value => selectedAccessKeys.has(`${fieldType}:${value}`)).length}개 선택
                    </span>
                  </div>
                  {optionGroups[fieldType].length === 0 ? (
                    <p className="rounded-lg bg-white px-3 py-3 text-xs text-gray-400">
                      선택지 관리에서 {FIELD_TYPE_LABELS[fieldType]} 항목을 먼저 등록해주세요.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {optionGroups[fieldType].map(value => {
                        const checked = selectedAccessKeys.has(`${fieldType}:${value}`);
                        return (
                          <label
                            key={value}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              checked
                                ? "border-[#A5D6A7] bg-[#F1F8E9] text-[#1B5E20]"
                                : "border-gray-100 bg-white text-gray-600"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) => toggleAccessRule(fieldType, value, nextChecked === true)}
                            />
                            <span className="truncate">{value}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {displayedAccessRules.length === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>현재 차량예약 가능 그룹이 없습니다. 저장 후에도 일반 성도는 차량예약 메뉴와 신청 기능을 사용할 수 없습니다.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleReservationCalendarView({
  reservations,
  vehicleFilter,
  vehicles,
  isMutatingReservation,
  onApprove,
  onCancel,
}: {
  reservations: VehicleReservationRow[];
  vehicleFilter: number | undefined;
  vehicles: VehicleRow[];
  isMutatingReservation: boolean;
  onApprove: (row: VehicleReservationRow) => void;
  onCancel: (row: VehicleReservationRow) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const reservationsByDate = useMemo(() => {
    const grouped: Record<string, VehicleReservationRow[]> = {};
    reservations.forEach((reservation) => {
      const key = reservation.reservationDate;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(reservation);
    });
    Object.values(grouped).forEach((items) => {
      items.sort((a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        (a.vehicleName ?? "").localeCompare(b.vehicleName ?? "") ||
        getReservationName(a).localeCompare(getReservationName(b))
      );
    });
    return grouped;
  }, [reservations]);

  const selectedReservations = reservationsByDate[selectedDate] ?? [];
  const selectedDateLabel = formatDate(selectedDate);
  const selectedVehicle = vehicleFilter ? vehicles.find((vehicle) => vehicle.id === vehicleFilter) : null;

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg p-2 transition-colors hover:bg-gray-100">
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        <h4 className="font-bold text-gray-800">{year}년 {month + 1}월</h4>
        <button type="button" onClick={nextMonth} className="rounded-lg p-2 transition-colors hover:bg-gray-100">
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>

      {selectedVehicle && (
        <div className="mb-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
          현재 차량 필터: {getVehicleDisplayName(selectedVehicle)}
        </div>
      )}

      <div className="mb-1 grid grid-cols-7 gap-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
          <div
            key={day}
            className={`py-1 text-center text-xs font-medium ${
              index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayReservations = reservationsByDate[dateKey] ?? [];
          const groupCounts = Array.from(
            dayReservations.reduce((map, reservation) => {
              const label = getReservationGroupLabel(reservation);
              map.set(label, (map.get(label) ?? 0) + 1);
              return map;
            }, new Map<string, number>()),
          );
          const isToday = getLocalDateKey() === dateKey;
          const isSelected = selectedDate === dateKey;
          const isSunday = index % 7 === 0;
          const isSaturday = index % 7 === 6;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDate(dateKey)}
              className={`group relative min-h-[78px] rounded-lg border p-1.5 text-left transition-colors ${
                isSelected
                  ? "border-[#1B5E20] bg-[#F1F8E9] ring-1 ring-[#1B5E20]"
                  : isToday
                  ? "border-[#1B5E20]/40 bg-[#F8FCF8]"
                  : "border-gray-100 hover:border-gray-300"
              }`}
            >
              <p className={`mb-1 text-xs font-medium ${
                isToday ? "text-[#1B5E20]" : isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-gray-700"
              }`}>
                {day}
              </p>
              {groupCounts.slice(0, 3).map(([label, count]) => (
                <CalendarBadge key={label} className="bg-green-50 text-green-700">
                  {label} {count}
                </CalendarBadge>
              ))}
              {groupCounts.length > 3 && <CalendarBadge className="bg-gray-100 text-gray-500">+{groupCounts.length - 3}</CalendarBadge>}
              {dayReservations.length > 0 && (
                <div className="mt-1 hidden text-[10px] leading-4 text-gray-500 sm:block">
                  {dayReservations.slice(0, 2).map((reservation) => (
                    <p key={reservation.id} className="truncate">
                      {reservation.startTime} {getReservationPlateNumber(reservation)} {getReservationVehicleName(reservation)}
                    </p>
                  ))}
                  {dayReservations.length > 2 && <p className="text-gray-400">+{dayReservations.length - 2}건</p>}
                </div>
              )}
              {dayReservations.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg group-hover:block">
                  <p className="mb-2 text-xs font-bold text-gray-800">{formatDate(dateKey)} 차량 예약</p>
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {dayReservations.map((reservation) => (
                      <div key={reservation.id} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                        <p className="truncate text-xs font-semibold text-gray-800">
                          {formatTimeRange(reservation.startTime, reservation.endTime)} · {getReservationPlateNumber(reservation)} {getReservationVehicleName(reservation)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
                          {getReservationName(reservation)} · {getReservationPosition(reservation)} · {getReservationPhone(reservation)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-50 ring-1 ring-green-200" />달력 칸은 직분/분류별 예약 수로 표시됩니다.</span>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{selectedDateLabel} 차량 예약 상세</p>
            <p className="text-xs text-gray-500">날짜를 누르면 해당 날짜 차량 예약 정보가 바로 바뀝니다.</p>
          </div>
          <span className="text-xs font-medium text-[#1B5E20]">총 {selectedReservations.length}건</span>
        </div>

        {selectedReservations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">이 날짜에는 차량 예약이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1230px]">
            <div
              className="grid gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500"
              style={{ gridTemplateColumns: VEHICLE_RESERVATION_GRID }}
            >
              <div>시간</div>
              <div>차량번호</div>
              <div>차량</div>
              <div>목적</div>
              <div>신청자</div>
              <div>직분</div>
              <div>연락처</div>
              <div>상태</div>
              <div>인원</div>
              <div>관리</div>
            </div>
            {selectedReservations.map((reservation) => {
              const status = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.pending;
              return (
                <div
                  key={reservation.id}
                  className="grid items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0"
                  style={{ gridTemplateColumns: VEHICLE_RESERVATION_GRID }}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{formatTimeRange(reservation.startTime, reservation.endTime)}</p>
                  </div>
                  <div>
                    <p className="font-extrabold text-gray-950">{getReservationPlateNumber(reservation)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{getReservationVehicleName(reservation)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{reservation.purpose || "-"}</p>
                    {reservation.notes && <p className="mt-0.5 truncate text-xs text-gray-500">요청: {reservation.notes}</p>}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{getReservationName(reservation)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{getReservationPosition(reservation)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{getReservationPhone(reservation)}</p>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{reservation.passengers}명</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reservation.status !== "approved" && (
                      <Button
                        size="sm"
                        className="min-h-10 bg-green-600 text-white hover:bg-green-700 sm:min-h-0"
                        disabled={isMutatingReservation}
                        onClick={() => onApprove(reservation)}
                      >
                        승인
                      </Button>
                    )}
                    {reservation.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-10 border-red-200 text-red-600 hover:bg-red-50 sm:min-h-0"
                        disabled={isMutatingReservation}
                        onClick={() => onCancel(reservation)}
                      >
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarBadge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] ${className}`}>
      {children}
    </div>
  );
}
