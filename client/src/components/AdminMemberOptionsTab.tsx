/**
 * AdminMemberOptionsTab.tsx
 * 관리자가 회원가입 폼의 직분/부서/구역/세례 선택지를 직접 관리하는 탭
 * 성도 회원가입 폼에 표시될 선택지 목록을 추가/수정/삭제할 수 있습니다.
 */
import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

type FieldType = "position" | "department" | "district" | "baptism";

type MemberFieldOptionRow = {
  id: number;
  fieldType: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  position: "직분",
  department: "부서",
  district: "구역/순",
  baptism: "세례 구분",
};

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  position: "bg-blue-100 text-blue-800",
  department: "bg-green-100 text-green-800",
  district: "bg-amber-100 text-amber-800",
  baptism: "bg-purple-100 text-purple-800",
};

const MEMBER_REGISTER_GUIDE_TITLE_KEY = "member_register_guide_title";
const MEMBER_REGISTER_GUIDE_TEXT_KEY = "member_register_guide_text";
const DEFAULT_MEMBER_REGISTER_GUIDE_TITLE = "기쁨의교회 등록 성도 전용 가입 안내";
const DEFAULT_MEMBER_REGISTER_GUIDE_TEXT =
  "이 회원가입은 기쁨의교회 성도만 신청할 수 있습니다. 방문자나 외부인의 회원가입 관련 문의는 교회 안내 또는 사무실로 문의해 주세요.";

function SortableOptionItem({
  option,
  canMoveUp,
  canMoveDown,
  isSaving,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  option: MemberFieldOptionRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="드래그하여 순서 변경"
          className="p-1 -ml-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-800">{option.label}</span>
        {!option.isActive && (
          <Badge variant="secondary" className="text-xs">비활성</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={!canMoveUp || isSaving}
          title="위로 이동"
          className="h-8 w-8 p-0 text-gray-500 hover:text-[#1B5E20] disabled:opacity-30"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={!canMoveDown || isSaving}
          title="아래로 이동"
          className="h-8 w-8 p-0 text-gray-500 hover:text-[#1B5E20] disabled:opacity-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminMemberOptionsTab() {
  const [activeType, setActiveType] = useState<FieldType>("position");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editItem, setEditItem] = useState<{ id: number; label: string } | null>(null);
  const [localOrder, setLocalOrder] = useState<MemberFieldOptionRow[] | null>(null);
  const [guideTitle, setGuideTitle] = useState(DEFAULT_MEMBER_REGISTER_GUIDE_TITLE);
  const [guideText, setGuideText] = useState(DEFAULT_MEMBER_REGISTER_GUIDE_TEXT);

  const utils = trpc.useUtils();

  // 전체 선택지 조회
  const { data: options = [], isLoading } = trpc.members.adminFieldOptions.useQuery();
  const { data: settings } = trpc.home.settings.useQuery();

  useEffect(() => {
    if (!settings) return;
    setGuideTitle(settings[MEMBER_REGISTER_GUIDE_TITLE_KEY] || DEFAULT_MEMBER_REGISTER_GUIDE_TITLE);
    setGuideText(settings[MEMBER_REGISTER_GUIDE_TEXT_KEY] || DEFAULT_MEMBER_REGISTER_GUIDE_TEXT);
  }, [settings]);

  // 현재 탭의 선택지만 필터링
  const filteredOptions = options.filter(o => o.fieldType === activeType);
  const displayedOptions = localOrder ?? filteredOptions;

  const sensors = useSensors(useSensor(PointerSensor));

  // 추가
  const addMutation = trpc.members.addFieldOption.useMutation({
    onSuccess: () => {
      utils.members.adminFieldOptions.invalidate();
      setAddDialogOpen(false);
      setNewLabel("");
      toast.success(`${FIELD_TYPE_LABELS[activeType]} 선택지가 추가됐습니다.`);
    },
    onError: (e) => toast.error(e.message),
  });

  // 수정
  const updateMutation = trpc.members.updateFieldOption.useMutation({
    onSuccess: () => {
      utils.members.adminFieldOptions.invalidate();
      setEditDialogOpen(false);
      setEditItem(null);
      toast.success("수정 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  // 순서 저장
  const reorderMutation = trpc.members.reorderFieldOptions.useMutation({
    onSuccess: () => {
      utils.members.adminFieldOptions.invalidate();
      setLocalOrder(null);
      toast.success("순서가 저장됐습니다.");
    },
    onError: (e) => {
      setLocalOrder(null);
      toast.error("순서 저장 실패: " + e.message);
    },
  });

  // 삭제
  const deleteMutation = trpc.members.deleteFieldOption.useMutation({
    onSuccess: () => {
      utils.members.adminFieldOptions.invalidate();
      toast.success("삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSettingMutation = trpc.cms.content.settings.update.useMutation({
    onSuccess: () => {
      utils.home.settings.invalidate();
      toast.success("회원가입 안내가 저장되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveGuide = async () => {
    await updateSettingMutation.mutateAsync({
      key: MEMBER_REGISTER_GUIDE_TITLE_KEY,
      value: guideTitle.trim() || DEFAULT_MEMBER_REGISTER_GUIDE_TITLE,
    });
    await updateSettingMutation.mutateAsync({
      key: MEMBER_REGISTER_GUIDE_TEXT_KEY,
      value: guideText.trim() || DEFAULT_MEMBER_REGISTER_GUIDE_TEXT,
    });
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addMutation.mutate({
      fieldType: activeType,
      label: newLabel.trim(),
      sortOrder: filteredOptions.length,
    });
  };

  const handleEdit = () => {
    if (!editItem || !editItem.label.trim()) return;
    updateMutation.mutate({ id: editItem.id, label: editItem.label.trim() });
  };

  const handleDelete = (id: number, label: string) => {
    if (!confirm(`"${label}" 선택지를 삭제하시겠습니까?\n이미 이 항목으로 등록된 성도 정보에는 영향이 없습니다.`)) return;
    deleteMutation.mutate({ id });
  };

  const saveOrder = (reordered: MemberFieldOptionRow[]) => {
    setLocalOrder(reordered);
    reorderMutation.mutate(reordered.map((option, index) => ({
      id: option.id,
      sortOrder: index + 1,
    })));
  };

  const handleMoveOption = (id: number, direction: "up" | "down") => {
    if (reorderMutation.isPending) return;

    const current = localOrder ?? filteredOptions;
    const oldIndex = current.findIndex((option) => option.id === id);
    if (oldIndex === -1) return;

    const newIndex = direction === "up" ? oldIndex - 1 : oldIndex + 1;
    if (newIndex < 0 || newIndex >= current.length) return;

    saveOrder(arrayMove(current, oldIndex, newIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (reorderMutation.isPending) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = localOrder ?? filteredOptions;
    const oldIndex = current.findIndex((option) => option.id === active.id);
    const newIndex = current.findIndex((option) => option.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    saveOrder(arrayMove(current, oldIndex, newIndex));
  };

  return (
    <div className="space-y-6">
      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">회원가입 양식 설정 안내</p>
        <p>여기서 추가한 선택지는 성도 회원가입 화면의 직분, 부서, 구역, 세례 목록으로 표시됩니다.</p>
        <p className="mt-1">교회 상황에 맞게 자유롭게 추가, 수정, 삭제하세요. 삭제해도 기존 성도 정보는 유지됩니다.</p>
      </div>

      {/* 탭 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">회원가입 안내글</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">안내 제목</label>
            <Input
              value={guideTitle}
              onChange={(event) => setGuideTitle(event.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">안내 내용</label>
            <textarea
              value={guideText}
              onChange={(event) => setGuideText(event.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveGuide}
              disabled={updateSettingMutation.isPending}
              className="bg-[#1B5E20] hover:bg-[#154a18]"
            >
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type);
              setLocalOrder(null);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeType === type
                ? "bg-[#1B5E20] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {FIELD_TYPE_LABELS[type]}
            <span className="ml-2 text-xs opacity-70">
              ({options.filter(o => o.fieldType === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* 선택지 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            {FIELD_TYPE_LABELS[activeType]} 목록
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="bg-[#1B5E20] hover:bg-[#154a18]"
          >
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>
          ) : filteredOptions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">등록된 선택지가 없습니다.</p>
              <p className="text-xs mt-1">위 "추가" 버튼을 눌러 선택지를 만들어 주세요.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayedOptions.map((option) => option.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {displayedOptions.map((option, index) => (
                    <SortableOptionItem
                      key={option.id}
                      option={option}
                      canMoveUp={index > 0}
                      canMoveDown={index < displayedOptions.length - 1}
                      isSaving={reorderMutation.isPending}
                      onEdit={() => {
                        setEditItem({ id: option.id, label: option.label });
                        setEditDialogOpen(true);
                      }}
                      onDelete={() => handleDelete(option.id, option.label)}
                      onMoveUp={() => handleMoveOption(option.id, "up")}
                      onMoveDown={() => handleMoveOption(option.id, "down")}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{FIELD_TYPE_LABELS[activeType]} 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              성도 회원가입 화면에 표시될 선택지 이름을 입력하세요.
            </p>
            <Input
              placeholder={`예: ${activeType === 'position' ? '집사' : activeType === 'department' ? '아동부1' : activeType === 'district' ? '1구역' : '세례'}`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim() || addMutation.isPending}
              className="bg-[#1B5E20] hover:bg-[#154a18]"
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{FIELD_TYPE_LABELS[activeType]} 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={editItem?.label ?? ""}
              onChange={(e) => setEditItem(prev => prev ? { ...prev, label: e.target.value } : null)}
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleEdit}
              disabled={!editItem?.label.trim() || updateMutation.isPending}
              className="bg-[#1B5E20] hover:bg-[#154a18]"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
