/**
 * 유튜브 편집 패널 (관리자용)
 * - 플레이리스트 생성/선택/삭제
 * - 영상 추가: 유튜브 링크 붙여넣기 → videoId + 제목 자동 추출
 * - 영상 순서 드래그로 변경
 * - 영상 삭제
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Youtube, ChevronDown, Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── 유튜브 URL에서 videoId 추출 ───────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // 직접 ID 입력
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── 영상 카드 (드래그 가능) ───────────────────────────────────
function SortableVideoItem({
  video,
  onDelete,
}: {
  video: { id: number; videoId: string; title: string; thumbnailUrl?: string | null };
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 group"
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* 썸네일 */}
      <img
        src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/default.jpg`}
        alt={video.title}
        className="w-16 h-9 object-cover rounded flex-shrink-0 bg-gray-100"
      />

      {/* 제목 */}
      <p className="flex-1 text-sm text-gray-800 line-clamp-2 leading-tight min-w-0">{video.title}</p>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onDelete(video.id)}
        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export default function YoutubeEditPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  // sonner toast 사용
  const utils = trpc.useUtils();

  // 플레이리스트 목록
  const { data: playlists = [], isLoading: playlistsLoading } = trpc.youtube.getPlaylists.useQuery();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  // 영상 목록
  const { data: videos = [], isLoading: videosLoading } = trpc.youtube.getVideosAdmin.useQuery(
    { playlistId: selectedPlaylistId! },
    { enabled: selectedPlaylistId !== null }
  );

  // 영상 추가 폼
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  // Mutations
  const createPlaylist = trpc.youtube.createPlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setNewPlaylistTitle("");
      setShowNewPlaylist(false);
       toast.success("플레이리스트가 생성됩니다.");
    },
  });

  const deletePlaylist = trpc.youtube.deletePlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setSelectedPlaylistId(null);
      toast.success("플레이리스트가 삭제됩니다.");;
    },
  });

  const addVideo = trpc.youtube.addVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate({ playlistId: selectedPlaylistId! });
      setVideoUrl("");
      setVideoTitle("");
      setAddingVideo(false);
      toast.success("영상이 추가됩니다.");;
    },
    onError: (err) => {
      toast.error("영상 추가 실패: " + err.message);
    },
  });

  const deleteVideo = trpc.youtube.deleteVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate({ playlistId: selectedPlaylistId! });
      toast.success("영상이 삭제됩니다.");;
    },
  });

  const reorderVideos = trpc.youtube.reorderVideos.useMutation();

  // 드래그 센서
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // 드래그 종료 처리
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const newOrder = arrayMove(videos, oldIndex, newIndex);
    reorderVideos.mutate({ orderedIds: newOrder.map((v) => v.id) });
    utils.youtube.getVideosAdmin.setData(
      { playlistId: selectedPlaylistId! },
      newOrder
    );
  };

  // URL 입력 시 videoId 자동 추출 + 제목 자동 채우기
  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    const vid = extractVideoId(url.trim());
    if (vid && !videoTitle) {
      setVideoTitle(`영상 ${vid}`);
    }
  };

  // 영상 추가 제출
  const handleAddVideo = () => {
    if (!selectedPlaylistId) return;
    const vid = extractVideoId(videoUrl.trim());
    if (!vid) {
      toast.error("유효한 유튜브 링크를 입력해 주세요.");
      return;
    }
    const title = videoTitle.trim() || `영상 ${vid}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
    addVideo.mutate({
      playlistId: selectedPlaylistId,
      videoId: vid,
      title,
      thumbnailUrl,
      sortOrder: videos.length,
    });
  };

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] max-w-full p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Youtube className="w-5 h-5 text-red-500" />
            유튜브 영상 관리
          </SheetTitle>
        </SheetHeader>
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
      <h3 className="sr-only">유튜브 영상 관리</h3>

      {/* ── 플레이리스트 선택 ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">플레이리스트</span>
          <button
            onClick={() => setShowNewPlaylist(!showNewPlaylist)}
            className="text-xs text-[#1B5E20] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> 새 목록 만들기
          </button>
        </div>

        {/* 새 플레이리스트 입력 */}
        {showNewPlaylist && (
          <div className="flex gap-2 mb-2">
            <Input
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              placeholder="목록 이름 입력"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createPlaylist.mutate({ title: newPlaylistTitle })}
            />
            <Button
              size="sm"
              className="h-8 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              onClick={() => createPlaylist.mutate({ title: newPlaylistTitle })}
              disabled={!newPlaylistTitle.trim() || createPlaylist.isPending}
            >
              {createPlaylist.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "생성"}
            </Button>
          </div>
        )}

        {/* 플레이리스트 목록 */}
        {playlistsLoading ? (
          <div className="text-sm text-gray-400 py-2">불러오는 중...</div>
        ) : playlists.length === 0 ? (
          <div className="text-sm text-gray-400 py-2 text-center border border-dashed border-gray-200 rounded-lg">
            플레이리스트가 없습니다. 먼저 새 목록을 만들어 주세요.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setSelectedPlaylistId(pl.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedPlaylistId === pl.id
                    ? "bg-[#1B5E20] text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="font-medium">{pl.title}</span>
                {selectedPlaylistId === pl.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${pl.title}" 플레이리스트와 모든 영상을 삭제할까요?`)) {
                        deletePlaylist.mutate({ id: pl.id });
                      }
                    }}
                    className="text-white/70 hover:text-white ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 선택된 플레이리스트의 영상 관리 ── */}
      {selectedPlaylistId !== null && (
        <>
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                영상 목록 <span className="text-gray-400">({videos.length}개)</span>
              </span>
              <button
                onClick={() => setAddingVideo(!addingVideo)}
                className="text-xs text-[#1B5E20] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 영상 추가
              </button>
            </div>

            {/* 영상 추가 폼 */}
            {addingVideo && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 flex flex-col gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">유튜브 링크 또는 영상 ID</label>
                  <Input
                    value={videoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">영상 제목</label>
                  <Input
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="영상 제목 입력"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                    onClick={handleAddVideo}
                    disabled={!videoUrl.trim() || addVideo.isPending}
                  >
                    {addVideo.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    추가
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => { setAddingVideo(false); setVideoUrl(""); setVideoTitle(""); }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}

            {/* 영상 목록 (드래그 가능) */}
            {videosLoading ? (
              <div className="text-sm text-gray-400 py-4 text-center">불러오는 중...</div>
            ) : videos.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                영상이 없습니다. 위에서 영상을 추가해 주세요.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {videos.map((video) => (
                      <SortableVideoItem
                        key={video.id}
                        video={video}
                        onDelete={(id) => {
                          if (confirm("이 영상을 삭제할까요?")) deleteVideo.mutate({ id });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
      </SheetContent>
    </Sheet>
  );
}
