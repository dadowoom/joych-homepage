/**
 * 에디터 콘텐츠 컴포넌트
 * pageType="editor" 메뉴에서 표시됩니다.
 * 관리자는 블록을 추가/수정/삭제/순서변경/숨김처리 할 수 있습니다.
 * 일반 사용자는 공개된 블록만 볼 수 있습니다.
 */
import { useState } from "react";
import { Edit3, Pencil, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BlockRenderer } from "./BlockRenderer";
import { BlockEditDialog } from "./BlockEditDialog";

export function EditorContent({
  menuItemId,
  menuSubItemId,
}: {
  menuItemId?: number;
  menuSubItemId?: number;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  // 공개용: isVisible=true 블록만
  const { data: blocks, isLoading } = trpc.home.pageBlocks.useQuery(
    { menuItemId, menuSubItemId },
    { enabled: !!(menuItemId || menuSubItemId) }
  );
  // 관리자용: 숨김 포함 전체 블록
  const { data: adminBlocks } = trpc.cms.blocks.list.useQuery(
    { menuItemId, menuSubItemId },
    { enabled: isAdmin && !!(menuItemId || menuSubItemId) }
  );

  const displayBlocks = isAdmin ? (adminBlocks ?? []) : (blocks ?? []);

  // 다이얼로그 상태
  const [editingBlock, setEditingBlock] = useState<{
    id?: number;
    blockType: string;
    content: string;
  } | null>(null);
  const [isNewBlock, setIsNewBlock] = useState(false);

  // 뮤테이션
  const createMut = trpc.cms.blocks.create.useMutation({
    onSuccess: () => {
      utils.home.pageBlocks.invalidate();
      utils.cms.blocks.list.invalidate();
    },
  });
  const updateMut = trpc.cms.blocks.update.useMutation({
    onSuccess: () => {
      utils.home.pageBlocks.invalidate();
      utils.cms.blocks.list.invalidate();
    },
  });
  const deleteMut = trpc.cms.blocks.delete.useMutation({
    onSuccess: () => {
      utils.home.pageBlocks.invalidate();
      utils.cms.blocks.list.invalidate();
    },
  });
  const reorderMut = trpc.cms.blocks.reorder.useMutation({
    onSuccess: () => {
      utils.home.pageBlocks.invalidate();
      utils.cms.blocks.list.invalidate();
    },
  });

  const handleSave = async (blockType: string, content: string) => {
    if (isNewBlock) {
      await createMut.mutateAsync({
        menuItemId,
        menuSubItemId,
        blockType,
        content,
        sortOrder: displayBlocks.length,
      });
    } else if (editingBlock?.id) {
      await updateMut.mutateAsync({ id: editingBlock.id, blockType, content });
    }
    setEditingBlock(null);
    setIsNewBlock(false);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const ids = displayBlocks.map((b) => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderMut.mutate({ orderedIds: ids });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === displayBlocks.length - 1) return;
    const ids = displayBlocks.map((b) => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderMut.mutate({ orderedIds: ids });
  };

  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-400">내용을 불러오는 중...</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 관리자 편집 툴바 */}
      {isAdmin && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700">
            <Edit3 className="w-4 h-4" />
            <span className="text-sm font-medium">
              관리자 편집 모드 — 블록을 추가하거나 수정할 수 있습니다.
            </span>
          </div>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => {
              setIsNewBlock(true);
              setEditingBlock({ blockType: "text-body", content: "{}" });
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> 블록 추가
          </Button>
        </div>
      )}

      {/* 블록 목록 */}
      {displayBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Edit3 className="w-12 h-12 text-blue-300 mb-3" />
          <p className="text-gray-400 text-base font-medium mb-1">
            아직 등록된 내용이 없습니다.
          </p>
          {isAdmin && (
            <p className="text-gray-300 text-sm">
              위의 '블록 추가' 버튼으로 내용을 입력해 보세요.
            </p>
          )}
        </div>
      ) : (
        displayBlocks.map((block, idx) => (
          <div
            key={block.id}
            className={`group relative ${!block.isVisible ? "opacity-50" : ""}`}
          >
            {/* 관리자 액션 버튼 (hover 시 표시) */}
            {isAdmin && (
              <div className="absolute -right-2 top-1 z-10 hidden group-hover:flex flex-col gap-1 bg-white border border-gray-200 rounded-lg shadow-md p-1">
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                  title="수정"
                  onClick={() => {
                    setIsNewBlock(false);
                    setEditingBlock(block);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600 transition-colors"
                  title="위로"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600 transition-colors"
                  title="아래로"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === displayBlocks.length - 1}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-amber-600 transition-colors"
                  title={block.isVisible ? "숨기기" : "보이기"}
                  onClick={() =>
                    updateMut.mutate({ id: block.id, isVisible: !block.isVisible })
                  }
                >
                  {block.isVisible ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600 transition-colors"
                  title="삭제"
                  onClick={() => {
                    if (confirm("이 블록을 삭제하시겠습니까?"))
                      deleteMut.mutate({ id: block.id });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <BlockRenderer block={block} />
          </div>
        ))
      )}

      {/* 블록 편집 다이얼로그 */}
      {editingBlock && (
        <BlockEditDialog
          block={editingBlock}
          isNew={isNewBlock}
          menuItemId={menuItemId}
          menuSubItemId={menuSubItemId}
          onSave={handleSave}
          onClose={() => {
            setEditingBlock(null);
            setIsNewBlock(false);
          }}
        />
      )}
    </div>
  );
}
