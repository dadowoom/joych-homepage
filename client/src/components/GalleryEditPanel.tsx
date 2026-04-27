/**
 * 갤러리 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 갤러리 사진 추가(파일 업로드), 삭제, 표시/숨기기, 설명 수정 기능
 * - 드래그 앤 드롭으로 순서 변경 가능
 */
import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Trash2, Eye, EyeOff, Upload, ImageIcon, Pencil, Check, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

type GalleryRow = {
  id: number;
  imageUrl: string;
  caption: string | null;
  gridSpan: string | null;
  sortOrder: number;
  isVisible: boolean;
};

interface GalleryEditPanelProps {
  open: boolean;
  onClose: () => void;
}

const GRID_SPAN_OPTIONS = [
  { value: "col-span-1 row-span-1", label: "기본 (1×1)" },
  { value: "col-span-2 row-span-1", label: "가로 넓게 (2×1)" },
  { value: "col-span-1 row-span-2", label: "세로 높게 (1×2)" },
  { value: "col-span-2 row-span-2", label: "크게 (2×2)" },
];

// ─── 드래그 가능한 개별 갤러리 항목 ─────────────────────────────────────────
function SortableGalleryItem({
  item,
  editingId,
  editCaption,
  setEditCaption,
  editGridSpan,
  setEditGridSpan,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onDelete,
  updatePending,
  deletePending,
}: {
  item: GalleryRow;
  editingId: number | null;
  editCaption: string;
  setEditCaption: (v: string) => void;
  editGridSpan: string;
  setEditGridSpan: (v: string) => void;
  onStartEdit: (item: GalleryRow) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  updatePending: boolean;
  deletePending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditing = editingId === item.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-2 ${!item.isVisible ? "opacity-50 bg-gray-50" : "bg-white"}`}
    >
      {isEditing ? (
        /* 편집 모드 */
        <div className="space-y-2">
          <img
            src={item.imageUrl}
            alt={item.caption ?? ""}
            className="w-full h-28 object-cover rounded border border-gray-200"
          />
          <Input
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            placeholder="사진 설명"
            className="text-sm"
          />
          <select
            value={editGridSpan}
            onChange={(e) => setEditGridSpan(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          >
            {GRID_SPAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              onClick={onSaveEdit}
              disabled={updatePending}
            >
              <Check className="w-3 h-3 mr-1" /> {updatePending ? "저장 중..." : "저장"}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              <X className="w-3 h-3 mr-1" /> 취소
            </Button>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <div className="flex items-center gap-2">
          {/* 드래그 핸들 */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            title="드래그하여 순서 변경"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <img
            src={item.imageUrl}
            alt={item.caption ?? ""}
            className="w-14 h-14 object-cover rounded border border-gray-200 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {item.caption || <span className="text-gray-400 italic">설명 없음</span>}
            </p>
            <p className="text-xs text-gray-400">
              {GRID_SPAN_OPTIONS.find(o => o.value === item.gridSpan)?.label ?? "기본"}
              {!item.isVisible && " · 숨김"}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              title={item.isVisible ? "숨기기" : "표시하기"}
              onClick={onToggle}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {item.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              title="수정"
              onClick={() => onStartEdit(item)}
              className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              title="삭제"
              onClick={onDelete}
              disabled={deletePending}
              className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 패널 컴포넌트 ──────────────────────────────────────────────────────
export default function GalleryEditPanel({ open, onClose }: GalleryEditPanelProps) {
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.cms.content.gallery.list.useQuery(undefined, {
    enabled: open,
  });

  // 로컬 순서 상태 (드래그 중 즉시 반영)
  const [localOrder, setLocalOrder] = useState<GalleryRow[] | null>(null);
  const displayItems = localOrder ?? (items ?? []);

  // 업로드 상태
  const [isUploading, setIsUploading] = useState(false);
  const [newCaption, setNewCaption] = useState("");
  const [newGridSpan, setNewGridSpan] = useState("col-span-1 row-span-1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 편집 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editGridSpan, setEditGridSpan] = useState("col-span-1 row-span-1");

  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const invalidate = () => {
    utils.cms.content.gallery.list.invalidate();
    utils.home.gallery.invalidate();
  };

  const uploadMutation = trpc.cms.upload.galleryImage.useMutation({
    onError: (e) => {
      toast.error("이미지 업로드 실패: " + e.message);
      setIsUploading(false);
    },
  });

  const createMutation = trpc.cms.content.gallery.create.useMutation({
    onSuccess: () => {
      toast.success("사진이 추가됐습니다.");
      setNewCaption("");
      setNewGridSpan("col-span-1 row-span-1");
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const updateMutation = trpc.cms.content.gallery.update.useMutation({
    onSuccess: () => {
      toast.success("사진 정보가 수정됐습니다.");
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const deleteMutation = trpc.cms.content.gallery.delete.useMutation({
    onSuccess: () => {
      toast.success("사진이 삭제됐습니다.");
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.content.gallery.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const reorderMutation = trpc.cms.content.gallery.reorder.useMutation({
    onSuccess: () => {
      toast.success("순서가 저장됐습니다.");
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => {
      toast.error("순서 저장 실패: " + e.message);
      setLocalOrder(null);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("파일 크기가 너무 큽니다. 10MB 이하의 이미지를 선택해 주세요.");
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { url } = await uploadMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });

      await createMutation.mutateAsync({
        imageUrl: url,
        caption: newCaption.trim() || undefined,
        gridSpan: newGridSpan,
      });

      toast.success("사진이 업로드됐습니다!");
    } catch {
      // 에러는 각 mutation의 onError에서 처리
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const startEdit = (item: GalleryRow) => {
    setEditingId(item.id);
    setEditCaption(item.caption ?? "");
    setEditGridSpan(item.gridSpan ?? "col-span-1 row-span-1");
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      caption: editCaption || undefined,
      gridSpan: editGridSpan,
    });
  };

  // 드래그 종료 시 순서 업데이트
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = localOrder ?? (items ?? []);
    const oldIndex = current.findIndex((m) => m.id === active.id);
    const newIndex = current.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(current, oldIndex, newIndex);
    setLocalOrder(reordered);

    reorderMutation.mutate(
      reordered.map((m, idx) => ({ id: m.id, sortOrder: idx + 1 }))
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] overflow-y-auto bg-white"
        style={{ top: "144px", height: "calc(100vh - 144px)" }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>갤러리 편집</SheetTitle>
          <SheetDescription>
            사진을 추가·삭제하거나, 왼쪽 핸들(<GripVertical className="inline w-3 h-3" />)을 드래그해 순서를 바꿀 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        {/* 사진 추가 영역 */}
        <div className="mb-4 p-3 border-2 border-dashed border-[#1B5E20] rounded-xl bg-[#F1F8E9] space-y-2">
          <p className="text-xs font-semibold text-[#1B5E20]">새 사진 추가</p>

          <Input
            value={newCaption}
            onChange={(e) => setNewCaption(e.target.value)}
            placeholder="사진 설명 (선택)"
            className="text-sm bg-white"
          />

          <div>
            <label className="text-xs text-gray-500 mb-1 block">표시 크기</label>
            <select
              value={newGridSpan}
              onChange={(e) => setNewGridSpan(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5 bg-white"
            >
              {GRID_SPAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5 animate-bounce" />
                업로드 중...
              </>
            ) : (
              <>
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                사진 파일 선택하여 추가
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-gray-400">JPG, PNG, WEBP, GIF · 최대 10MB</p>
        </div>

        {/* 드래그 안내 */}
        {!isLoading && displayItems.length > 1 && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> 왼쪽 핸들을 드래그하면 순서를 바꿀 수 있습니다.
          </p>
        )}

        {/* 갤러리 목록 */}
        {isLoading ? (
          <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayItems.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {displayItems.length === 0 && (
                  <div className="text-center text-gray-400 py-8 text-sm">등록된 사진이 없습니다.</div>
                )}
                {displayItems.map((item) => (
                  <SortableGalleryItem
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    editCaption={editCaption}
                    setEditCaption={setEditCaption}
                    editGridSpan={editGridSpan}
                    setEditGridSpan={setEditGridSpan}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onToggle={() => toggleMutation.mutate({ id: item.id, isVisible: !item.isVisible })}
                    onDelete={() => {
                      if (!confirm("이 사진을 삭제하시겠습니까?")) return;
                      deleteMutation.mutate({ id: item.id });
                    }}
                    updatePending={updateMutation.isPending}
                    deletePending={deleteMutation.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </SheetContent>
    </Sheet>
  );
}
