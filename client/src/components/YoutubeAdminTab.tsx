/**
 * 예배영상 관리 탭 (관리자 대시보드용)
 * - YoutubeEditPanel과 동일한 기능을 Sheet 없이 인라인으로 표시
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
import { GripVertical, Trash2, Plus, Youtube, Loader2 } from "lucide-react";

// ─── 유튜브 URL에서 videoId 추출 ───────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
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
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <img
        src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/default.jpg`}
        alt={video.title}
        className="w-16 h-9 object-cover rounded flex-shrink-0 bg-gray-100"
      />
      <p className="flex-1 text-sm text-gray-800 line-clamp-2 leading-tight min-w-0">{video.title}</p>
      <button
        onClick={() => onDelete(video.id)}
        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── 메인 탭 컴포넌트 ─────────────────────────────────────────
export default function YoutubeAdminTab() {
  const utils = trpc.useUtils();

  const { data: playlists = [], isLoading: playlistsLoading } = trpc.youtube.getPlaylists.useQuery();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = trpc.youtube.getVideosAdmin.useQuery(
    { playlistId: selectedPlaylistId! },
    { enabled: selectedPlaylistId !== null }
  );

  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  const createPlaylist = trpc.youtube.createPlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setNewPlaylistTitle("");
      setShowNewPlaylist(false);
      toast.success("플레이리스트가 생성됐습니다.");
    },
  });

  const deletePlaylist = trpc.youtube.deletePlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setSelectedPlaylistId(null);
      toast.success("플레이리스트가 삭제됐습니다.");
    },
  });

  const addVideo = trpc.youtube.addVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      setVideoUrl("");
      setVideoTitle("");
      setAddingVideo(false);
      toast.success("영상이 추가됐습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 추가에 실패했습니다."),
  });

  const deleteVideo = trpc.youtube.deleteVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      toast.success("영상이 삭제됐습니다.");
    },
  });

  const reorderVideos = trpc.youtube.reorderVideos.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(videos, oldIndex, newIndex);
    reorderVideos.mutate({
      orderedIds: reordered.map((v) => v.id),
    });
  }

  function handleAddVideo() {
    if (!selectedPlaylistId) return toast.error("플레이리스트를 먼저 선택하세요.");
    const videoId = extractVideoId(videoUrl.trim());
    if (!videoId) return toast.error("올바른 유튜브 링크를 입력해주세요.");
    const title = videoTitle.trim() || "제목 없음";
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    addVideo.mutate({ playlistId: selectedPlaylistId, videoId, title, thumbnailUrl });
  }

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Youtube className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-bold text-gray-800">예배영상 관리</h3>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        플레이리스트를 만들고 유튜브 영상 링크를 추가하면 예배영상 페이지에 표시됩니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── 왼쪽: 플레이리스트 목록 ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">플레이리스트</span>
            <button
              onClick={() => setShowNewPlaylist(!showNewPlaylist)}
              className="text-xs text-[#1B5E20] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 새 목록 만들기
            </button>
          </div>

          {/* 새 플레이리스트 입력 */}
          {showNewPlaylist && (
            <div className="flex gap-2 mb-3">
              <Input
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="목록 이름 (예: 주일예배)"
                className="flex-1 text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlaylistTitle.trim()) {
                    createPlaylist.mutate({ title: newPlaylistTitle.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newPlaylistTitle.trim()) return;
                  createPlaylist.mutate({ title: newPlaylistTitle.trim() });
                }}
                disabled={createPlaylist.isPending}
                className="h-8 bg-[#1B5E20] hover:bg-[#2E7D32]"
              >
                추가
              </Button>
            </div>
          )}

          {/* 플레이리스트 목록 */}
          {playlistsLoading ? (
            <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
              <Youtube className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">플레이리스트가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">위에서 새 목록을 만들어보세요.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
                    selectedPlaylistId === pl.id
                      ? "bg-[#1B5E20] text-white"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                >
                  <span className="text-sm font-medium truncate">{pl.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${pl.title}" 플레이리스트를 삭제할까요? 영상도 모두 삭제됩니다.`)) {
                        deletePlaylist.mutate({ id: pl.id });
                      }
                    }}
                    className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      selectedPlaylistId === pl.id ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-red-500"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 오른쪽: 영상 목록 ── */}
        <div>
          {!selectedPlaylistId ? (
            <div className="flex items-center justify-center h-full min-h-[200px] border border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-gray-400">왼쪽에서 플레이리스트를 선택하세요</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {selectedPlaylist?.title} 영상 목록
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
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">유튜브 링크</label>
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-sm h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">영상 제목</label>
                    <Input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="영상 제목을 입력하세요"
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingVideo(false); setVideoUrl(""); setVideoTitle(""); }}
                      className="h-7 text-xs"
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddVideo}
                      disabled={addVideo.isPending || !videoUrl.trim()}
                      className="h-7 text-xs bg-[#1B5E20] hover:bg-[#2E7D32]"
                    >
                      {addVideo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "추가"}
                    </Button>
                  </div>
                </div>
              )}

              {/* 영상 목록 */}
              {videosLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
              ) : videos.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-400">등록된 영상이 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-1">위에서 영상을 추가해보세요.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {videos.map((video) => (
                        <SortableVideoItem
                          key={video.id}
                          video={video}
                          onDelete={(id) => deleteVideo.mutate({ id })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
