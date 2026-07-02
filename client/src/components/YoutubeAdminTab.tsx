import { useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Loader2, Pencil, Plus, Trash2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type VideoListItem = {
  id: number;
  videoId?: string | null;
  videoUrl?: string | null;
  title: string;
  preacher?: string | null;
  scripture?: string | null;
  sermonDate?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  isVisible?: boolean | null;
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(url) ||
    (url.startsWith("http") && !url.includes("youtube") && !url.includes("youtu.be"));
}

function optionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getThumbnailUrl(video: VideoListItem) {
  return video.thumbnailUrl || (video.videoId ? `https://img.youtube.com/vi/${video.videoId}/default.jpg` : null);
}

function SortableVideoItem({
  video,
  onDelete,
  onEdit,
  onToggleVisible,
  isTogglePending,
}: {
  video: VideoListItem;
  onDelete: (id: number) => void;
  onEdit: (video: VideoListItem) => void;
  onToggleVisible: (video: VideoListItem) => void;
  isTogglePending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: video.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = [video.preacher, video.scripture, video.sermonDate].filter(Boolean).join(" · ");
  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="h-9 w-16 shrink-0 rounded bg-gray-100 object-cover"
         loading="lazy"/>
      ) : (
        <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-[#eef4ed] text-[#1B5E20]">
          <Youtube className="h-4 w-4 opacity-70" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium leading-tight text-gray-800">{video.title}</p>
        {meta && <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{meta}</p>}
        {video.isVisible === false && (
          <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            숨김
          </span>
        )}
      </div>
      <button
        onClick={() => onToggleVisible(video)}
        disabled={isTogglePending}
        className={`shrink-0 opacity-0 transition-colors group-hover:opacity-100 ${
          video.isVisible === false ? "text-gray-400 hover:text-[#1B5E20]" : "text-[#1B5E20] hover:text-[#154a19]"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        type="button"
        title={video.isVisible === false ? "영상 노출하기" : "영상 숨기기"}
      >
        {video.isVisible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        onClick={() => onEdit(video)}
        className="shrink-0 text-gray-300 opacity-0 transition-colors hover:text-[#1B5E20] group-hover:opacity-100"
        type="button"
        title="영상 정보 수정"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(video.id)}
        className="shrink-0 text-gray-300 opacity-0 transition-colors hover:text-red-500 group-hover:opacity-100"
        type="button"
        title="영상 삭제"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function YoutubeAdminTab() {
  const utils = trpc.useUtils();

  const { data: playlists = [], isLoading: playlistsLoading } = trpc.youtube.getPlaylists.useQuery();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = trpc.youtube.getVideosAdmin.useQuery(
    { playlistId: selectedPlaylistId! },
    { enabled: selectedPlaylistId !== null },
  );

  const [addingVideo, setAddingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoPreacher, setVideoPreacher] = useState("");
  const [videoScripture, setVideoScripture] = useState("");
  const [videoSermonDate, setVideoSermonDate] = useState("");
  const [videoDescription, setVideoDescription] = useState("");

  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [editVideoTitle, setEditVideoTitle] = useState("");
  const [editVideoPreacher, setEditVideoPreacher] = useState("");
  const [editVideoScripture, setEditVideoScripture] = useState("");
  const [editVideoSermonDate, setEditVideoSermonDate] = useState("");
  const [editVideoDescription, setEditVideoDescription] = useState("");

  const createPlaylist = trpc.youtube.createPlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setNewPlaylistTitle("");
      setShowNewPlaylist(false);
      toast.success("플레이리스트가 생성되었습니다.");
    },
    onError: (err) => toast.error(err.message || "플레이리스트 생성에 실패했습니다."),
  });

  const deletePlaylist = trpc.youtube.deletePlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getPlaylists.invalidate();
      setSelectedPlaylistId(null);
      toast.success("플레이리스트가 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message || "플레이리스트 삭제에 실패했습니다."),
  });

  const addVideo = trpc.youtube.addVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      resetAddVideoForm();
      toast.success("영상이 추가되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 추가에 실패했습니다."),
  });

  const updateVideo = trpc.youtube.updateVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      resetEditVideoForm();
      toast.success("영상 정보가 수정되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 정보 수정에 실패했습니다."),
  });

  const toggleVideoVisibility = trpc.youtube.updateVideo.useMutation({
    onSuccess: (_, variables) => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      toast.success(variables.isVisible ? "영상이 노출되도록 변경했습니다." : "영상을 숨김 처리했습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 노출 상태 변경에 실패했습니다."),
  });

  const deleteVideo = trpc.youtube.deleteVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      toast.success("영상이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 삭제에 실패했습니다."),
  });

  const reorderVideos = trpc.youtube.reorderVideos.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function resetAddVideoForm() {
    setVideoUrl("");
    setVideoTitle("");
    setVideoPreacher("");
    setVideoScripture("");
    setVideoSermonDate("");
    setVideoDescription("");
    setAddingVideo(false);
  }

  function resetEditVideoForm() {
    setEditingVideoId(null);
    setEditVideoTitle("");
    setEditVideoPreacher("");
    setEditVideoScripture("");
    setEditVideoSermonDate("");
    setEditVideoDescription("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(videos, oldIndex, newIndex);
    reorderVideos.mutate({ orderedIds: reordered.map((v) => v.id) });
  }

  function handleAddVideo() {
    if (!selectedPlaylistId) return toast.error("플레이리스트를 먼저 선택해주세요.");
    const trimmedUrl = videoUrl.trim();
    if (!trimmedUrl) return toast.error("영상 주소를 입력해주세요.");

    const videoId = extractVideoId(trimmedUrl);
    const title = videoTitle.trim() || "제목 없음";
    const basePayload = {
      playlistId: selectedPlaylistId,
      title,
      preacher: optionalValue(videoPreacher),
      scripture: optionalValue(videoScripture),
      sermonDate: optionalValue(videoSermonDate),
      description: optionalValue(videoDescription),
      sortOrder: videos.length,
    };

    if (videoId) {
      addVideo.mutate({
        ...basePayload,
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
      return;
    }

    if (isDirectVideoUrl(trimmedUrl)) {
      addVideo.mutate({ ...basePayload, videoId: null, videoUrl: trimmedUrl });
      return;
    }

    toast.error("올바른 유튜브 링크 또는 영상 파일 주소를 입력해주세요.");
  }

  function startEditVideo(video: VideoListItem) {
    setAddingVideo(false);
    setEditingVideoId(video.id);
    setEditVideoTitle(video.title ?? "");
    setEditVideoPreacher(video.preacher ?? "");
    setEditVideoScripture(video.scripture ?? "");
    setEditVideoSermonDate(video.sermonDate ?? "");
    setEditVideoDescription(video.description ?? "");
  }

  function handleUpdateVideo() {
    if (!editingVideoId) return;
    const title = editVideoTitle.trim();
    if (!title) return toast.error("영상 제목을 입력해주세요.");
    updateVideo.mutate({
      id: editingVideoId,
      title,
      preacher: optionalValue(editVideoPreacher),
      scripture: optionalValue(editVideoScripture),
      sermonDate: optionalValue(editVideoSermonDate),
      description: optionalValue(editVideoDescription),
    });
  }

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Youtube className="h-5 w-5 text-red-500" />
        <h3 className="text-lg font-bold text-gray-800">예배영상 관리</h3>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        플레이리스트를 만들고 영상 링크를 추가하면 예배영상 페이지에 표시됩니다.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">플레이리스트</span>
            <button
              onClick={() => setShowNewPlaylist(!showNewPlaylist)}
              className="flex items-center gap-1 text-xs text-[#1B5E20] hover:underline"
              type="button"
            >
              <Plus className="h-3 w-3" /> 새 목록 만들기
            </button>
          </div>

          {showNewPlaylist && (
            <div className="mb-3 flex gap-2">
              <Input
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="목록 이름 (예: 주일예배)"
                className="h-8 flex-1 text-sm"
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

          {playlistsLoading ? (
            <p className="py-4 text-center text-xs text-gray-400">불러오는 중...</p>
          ) : playlists.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
              <Youtube className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">플레이리스트가 없습니다.</p>
              <p className="mt-1 text-xs text-gray-400">위에서 새 목록을 만들어보세요.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                    selectedPlaylistId === pl.id
                      ? "bg-[#1B5E20] text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    resetAddVideoForm();
                    resetEditVideoForm();
                  }}
                >
                  <span className="truncate text-sm font-medium">{pl.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${pl.title}" 플레이리스트를 삭제할까요? 영상도 모두 삭제됩니다.`)) {
                        deletePlaylist.mutate({ id: pl.id });
                      }
                    }}
                    className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
                      selectedPlaylistId === pl.id ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-red-500"
                    }`}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {!selectedPlaylistId ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">왼쪽에서 플레이리스트를 선택해주세요.</p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  {selectedPlaylist?.title} 영상 목록
                </span>
                <button
                  onClick={() => {
                    setAddingVideo(!addingVideo);
                    resetEditVideoForm();
                  }}
                  className="flex items-center gap-1 text-xs text-[#1B5E20] hover:underline"
                  type="button"
                >
                  <Plus className="h-3 w-3" /> 영상 추가
                </button>
              </div>

              {addingVideo && (
                <div className="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">유튜브 링크, 영상 파일 주소, 옛 홈페이지 목록/상세주소</label>
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="http://www.joych.org/main/sub.html?pageCode=424"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">제목</label>
                    <Input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="옛 홈페이지 주소는 비워두면 자동 입력됩니다"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">설교자</label>
                      <Input
                        value={videoPreacher}
                        onChange={(e) => setVideoPreacher(e.target.value)}
                        placeholder="예: 박진석 위임목사"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">날짜</label>
                      <Input
                        type="date"
                        value={videoSermonDate}
                        onChange={(e) => setVideoSermonDate(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">본문</label>
                    <Input
                      value={videoScripture}
                      onChange={(e) => setVideoScripture(e.target.value)}
                      placeholder="예: 창세기 45:10-11 / 출애굽기 8:22-23"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">설명</label>
                    <Input
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="필요한 경우 짧은 설명을 입력하세요"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAddVideoForm}
                      className="h-7 text-xs"
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddVideo}
                      disabled={addVideo.isPending || !videoUrl.trim()}
                      className="h-7 bg-[#1B5E20] text-xs hover:bg-[#2E7D32]"
                    >
                      {addVideo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "추가"}
                    </Button>
                  </div>
                </div>
              )}

              {editingVideoId !== null && (
                <div className="mb-3 space-y-2 rounded-lg border border-[#1B5E20]/20 bg-[#F4FAF1] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1B5E20]">영상 정보 수정</span>
                    <button
                      onClick={resetEditVideoForm}
                      className="text-xs text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">제목</label>
                    <Input
                      value={editVideoTitle}
                      onChange={(e) => setEditVideoTitle(e.target.value)}
                      className="h-8 bg-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">설교자</label>
                      <Input
                        value={editVideoPreacher}
                        onChange={(e) => setEditVideoPreacher(e.target.value)}
                        className="h-8 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">날짜</label>
                      <Input
                        type="date"
                        value={editVideoSermonDate}
                        onChange={(e) => setEditVideoSermonDate(e.target.value)}
                        className="h-8 bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">본문</label>
                    <Input
                      value={editVideoScripture}
                      onChange={(e) => setEditVideoScripture(e.target.value)}
                      className="h-8 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">설명</label>
                    <Input
                      value={editVideoDescription}
                      onChange={(e) => setEditVideoDescription(e.target.value)}
                      className="h-8 bg-white text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={resetEditVideoForm} className="h-7 text-xs">
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateVideo}
                      disabled={updateVideo.isPending || !editVideoTitle.trim()}
                      className="h-7 bg-[#1B5E20] text-xs hover:bg-[#2E7D32]"
                    >
                      {updateVideo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "저장"}
                    </Button>
                  </div>
                </div>
              )}

              {videosLoading ? (
                <p className="py-4 text-center text-xs text-gray-400">불러오는 중...</p>
              ) : videos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                  <p className="text-sm text-gray-400">등록된 영상이 없습니다.</p>
                  <p className="mt-1 text-xs text-gray-400">위에서 영상을 추가해보세요.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {videos.map((video) => (
                        <SortableVideoItem
                          key={video.id}
                          video={video}
                          onEdit={startEditVideo}
                          onToggleVisible={(item) => {
                            toggleVideoVisibility.mutate({
                              id: item.id,
                              isVisible: item.isVisible === false,
                            });
                          }}
                          isTogglePending={
                            toggleVideoVisibility.isPending &&
                            toggleVideoVisibility.variables?.id === video.id
                          }
                          onDelete={(id) => {
                            if (confirm("이 영상을 삭제할까요?")) deleteVideo.mutate({ id });
                          }}
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
