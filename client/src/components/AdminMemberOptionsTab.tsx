/**
 * AdminMemberOptionsTab.tsx
 * 관리자가 직분/부서/구역/세례 선택지를 직접 관리하는 탭
 * 성도 회원가입 폼에 표시될 선택지 목록을 추가/수정/삭제할 수 있습니다.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

type FieldType = "position" | "department" | "district" | "baptism";

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

export default function AdminMemberOptionsTab() {
  const [activeType, setActiveType] = useState<FieldType>("position");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editItem, setEditItem] = useState<{ id: number; label: string } | null>(null);

  const utils = trpc.useUtils();

  // 전체 선택지 조회
  const { data: options = [], isLoading } = trpc.members.adminFieldOptions.useQuery();

  // 현재 탭의 선택지만 필터링
  const filteredOptions = options.filter(o => o.fieldType === activeType);

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

  // 삭제
  const deleteMutation = trpc.members.deleteFieldOption.useMutation({
    onSuccess: () => {
      utils.members.adminFieldOptions.invalidate();
      toast.success("삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

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

  return (
    <div className="space-y-6">
      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">선택지 관리 안내</p>
        <p>여기서 추가한 선택지는 성도 회원가입 화면에서 선택할 수 있는 목록으로 표시됩니다.</p>
        <p className="mt-1">교회 상황에 맞게 자유롭게 추가, 수정, 삭제하세요. 삭제해도 기존 성도 정보는 유지됩니다.</p>
      </div>

      {/* 탭 선택 */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
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
            <div className="space-y-2">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-300" />
                    <span className="text-sm font-medium text-gray-800">{option.label}</span>
                    {!option.isActive && (
                      <Badge variant="secondary" className="text-xs">비활성</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditItem({ id: option.id, label: option.label });
                        setEditDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(option.id, option.label)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
