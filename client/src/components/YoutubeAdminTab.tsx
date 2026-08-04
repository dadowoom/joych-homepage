import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, LayoutGrid, List, Loader2, Pencil, Plus, Search, Trash2, Youtube } from "lucide-react";
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

type AdminPlaylist = {
  id: number;
  title: string;
  description?: string | null;
  menuLabel?: string;
  menuPath?: string;
  menuHref?: string | null;
  menuVisible?: boolean;
};

type VideoViewMode = "list" | "thumbnail";

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

/** 브라우저의 오늘 날짜를 date 입력값(YYYY-MM-DD)으로 반환합니다. */
function getTodayDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getThumbnailUrl(video: VideoListItem) {
  return video.thumbnailUrl || (video.videoId ? `https://img.youtube.com/vi/${video.videoId}/default.jpg` : null);
}

function VideoItem({
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
  const meta = [video.preacher, video.scripture, video.sermonDate].filter(Boolean).join(" · ");
  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
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
        className={`shrink-0 transition-colors ${
          video.isVisible === false ? "text-gray-400 hover:text-[#1B5E20]" : "text-[#1B5E20] hover:text-[#154a19]"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        type="button"
        title={video.isVisible === false ? "영상 노출하기" : "영상 숨기기"}
      >
        {video.isVisible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        onClick={() => onEdit(video)}
        className="shrink-0 text-gray-400 transition-colors hover:text-[#1B5E20]"
        type="button"
        title="영상 정보 수정"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(video.id)}
        className="shrink-0 text-gray-400 transition-colors hover:text-red-500"
        type="button"
        title="영상 삭제"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function VideoThumbnailItem({
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
  const meta = [video.preacher, video.sermonDate].filter(Boolean).join(" · ");
  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="relative aspect-video bg-[#eef4ed]">
        {video.isVisible === false && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-gray-900/75 px-2 py-0.5 text-[11px] font-medium text-white">
            숨김
          </span>
        )}
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#1B5E20]">
            <Youtube className="h-8 w-8 opacity-70" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="min-h-[44px]">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{video.title}</p>
          {meta && <p className="mt-1 line-clamp-1 text-xs text-gray-500">{meta}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
          <button
            onClick={() => onToggleVisible(video)}
            disabled={isTogglePending}
            className={`rounded p-1 transition-colors ${
              video.isVisible === false ? "text-gray-400 hover:text-[#1B5E20]" : "text-[#1B5E20] hover:text-[#154a19]"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            type="button"
            title={video.isVisible === false ? "영상 노출하기" : "영상 숨기기"}
          >
            {video.isVisible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(video)}
            className="rounded p-1 text-gray-500 transition-colors hover:text-[#1B5E20]"
            type="button"
            title="영상 정보 수정"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(video.id)}
            className="rounded p-1 text-gray-500 transition-colors hover:text-red-500"
            type="button"
            title="영상 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function YoutubeAdminTab() {
  const utils = trpc.useUtils();

  const { data: playlistGroups, isLoading: playlistsLoading } = trpc.youtube.getAdminPlaylists.useQuery();
  const linkedPlaylists: AdminPlaylist[] = playlistGroups?.linked ?? [];
  const unlinkedPlaylists: AdminPlaylist[] = playlistGroups?.unlinked ?? [];
  const playlists: AdminPlaylist[] = [...linkedPlaylists, ...unlinkedPlaylists];
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
  const [videoSermonDate, setVideoSermonDate] = useState(() => getTodayDateInputValue());
  const [videoDescription, setVideoDescription] = useState("");
  const [metadataNotice, setMetadataNotice] = useState("");
  const metadataRequestVersion = useRef(0);
  const lastMetadataVideoId = useRef<string | null>(null);

  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editVideoTitle, setEditVideoTitle] = useState("");
  const [editVideoPreacher, setEditVideoPreacher] = useState("");
  const [editVideoScripture, setEditVideoScripture] = useState("");
  const [editVideoSermonDate, setEditVideoSermonDate] = useState("");
  const [editVideoDescription, setEditVideoDescription] = useState("");
  const [videoSearchTerm, setVideoSearchTerm] = useState("");
  const [videoViewMode, setVideoViewMode] = useState<VideoViewMode>("list");

  const createPlaylist = trpc.youtube.createPlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getAdminPlaylists.invalidate();
      setNewPlaylistTitle("");
      setShowNewPlaylist(false);
      toast.success("플레이리스트가 생성되었습니다.");
    },
    onError: (err) => toast.error(err.message || "플레이리스트 생성에 실패했습니다."),
  });

  const deletePlaylist = trpc.youtube.deletePlaylist.useMutation({
    onSuccess: () => {
      utils.youtube.getAdminPlaylists.invalidate();
      utils.youtube.getHomeLatest.invalidate();
      setSelectedPlaylistId(null);
      toast.success("플레이리스트가 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message || "플레이리스트 삭제에 실패했습니다."),
  });

  const addVideo = trpc.youtube.addVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      utils.youtube.getHomeLatest.invalidate();
      resetAddVideoForm();
      toast.success("영상이 추가되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 추가에 실패했습니다."),
  });

  const lookupVideoMetadata = trpc.youtube.lookupVideoMetadata.useMutation();

  const updateVideo = trpc.youtube.updateVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      utils.youtube.getHomeLatest.invalidate();
      resetEditVideoForm();
      toast.success("영상 정보가 수정되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 정보 수정에 실패했습니다."),
  });

  const toggleVideoVisibility = trpc.youtube.updateVideo.useMutation({
    onSuccess: (_, variables) => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      utils.youtube.getHomeLatest.invalidate();
      toast.success(variables.isVisible ? "영상이 노출되도록 변경했습니다." : "영상을 숨김 처리했습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 노출 상태 변경에 실패했습니다."),
  });

  const deleteVideo = trpc.youtube.deleteVideo.useMutation({
    onSuccess: () => {
      utils.youtube.getVideosAdmin.invalidate();
      utils.youtube.getVideos.invalidate();
      utils.youtube.getHomeLatest.invalidate();
      toast.success("영상이 삭제되었습니다.");
    },
    onError: (err) => toast.error(err.message || "영상 삭제에 실패했습니다."),
  });

  function resetAddVideoForm() {
    metadataRequestVersion.current += 1;
    lastMetadataVideoId.current = null;
    setVideoUrl("");
    setVideoTitle("");
    setVideoPreacher("");
    setVideoScripture("");
    setVideoSermonDate(getTodayDateInputValue());
    setVideoDescription("");
    setMetadataNotice("");
    setAddingVideo(false);
  }

  async function fillVideoMetadata(url: string, force = false) {
    const videoId = extractVideoId(url.trim());
    if (!videoId || (!force && lastMetadataVideoId.current === videoId)) return;

    const requestVersion = ++metadataRequestVersion.current;
    lastMetadataVideoId.current = videoId;
    setMetadataNotice("유튜브 영상 정보를 가져오는 중입니다.");
    try {
      const metadata = await lookupVideoMetadata.mutateAsync({ videoUrl: url });
      if (requestVersion !== metadataRequestVersion.current) return;

      setVideoTitle((previous) => previous.trim() || metadata.title);
      setVideoSermonDate((previous) => previous.trim() || metadata.publishedDate || "");
      setVideoDescription((previous) => previous.trim() || metadata.description || "");
      setMetadataNotice(
        `${metadata.channelTitle ? `${metadata.channelTitle} · ` : ""}제목${metadata.publishedDate ? "·업로드일·설명" : "·설명"}을 불러왔습니다. 업로드일은 예배일과 다를 수 있으니 확인해 주세요.`
      );
    } catch (error) {
      if (requestVersion !== metadataRequestVersion.current) return;
      lastMetadataVideoId.current = null;
      setMetadataNotice("");
      toast.error(error instanceof Error ? error.message : "유튜브 영상 정보를 가져오지 못했습니다.");
    }
  }

  function handleVideoUrlChange(url: string) {
    setVideoUrl(url);
    if (extractVideoId(url.trim())) {
      void fillVideoMetadata(url);
      return;
    }
    metadataRequestVersion.current += 1;
    lastMetadataVideoId.current = null;
    setMetadataNotice("");
  }

  function resetEditVideoForm() {
    setEditingVideoId(null);
    setEditVideoUrl("");
    setEditVideoTitle("");
    setEditVideoPreacher("");
    setEditVideoScripture("");
    setEditVideoSermonDate("");
    setEditVideoDescription("");
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
    setEditVideoUrl(video.videoUrl ?? video.videoId ?? "");
    setEditVideoTitle(video.title ?? "");
    setEditVideoPreacher(video.preacher ?? "");
    setEditVideoScripture(video.scripture ?? "");
    setEditVideoSermonDate(video.sermonDate ?? "");
    setEditVideoDescription(video.description ?? "");
  }

  function handleUpdateVideo() {
    if (!editingVideoId) return;
    const trimmedUrl = editVideoUrl.trim();
    if (!trimmedUrl) return toast.error("영상 주소를 입력해주세요.");
    const title = editVideoTitle.trim();
    if (!title) return toast.error("영상 제목을 입력해주세요.");

    const currentVideo = videos.find((video) => video.id === editingVideoId);
    const originalSource = (currentVideo?.videoUrl ?? currentVideo?.videoId ?? "").trim();
    let source: { videoId: string | null; videoUrl: string | null } | undefined;
    if (trimmedUrl !== originalSource) {
      const nextVideoId = extractVideoId(trimmedUrl);
      source = nextVideoId
        ? { videoId: nextVideoId, videoUrl: null }
        : isDirectVideoUrl(trimmedUrl)
          ? { videoId: null, videoUrl: trimmedUrl }
          : undefined;
      if (!source) {
        return toast.error("올바른 유튜브 링크 또는 영상 파일 주소를 입력해주세요.");
      }
    }

    updateVideo.mutate({
      id: editingVideoId,
      ...(source ?? {}),
      title,
      preacher: optionalValue(editVideoPreacher),
      scripture: optionalValue(editVideoScripture),
      sermonDate: optionalValue(editVideoSermonDate),
      description: optionalValue(editVideoDescription),
    });
  }

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const filteredVideos = useMemo(() => {
    const search = videoSearchTerm.trim().toLowerCase();
    if (!search) return videos;
    return videos.filter(video => [
      video.title,
      video.preacher,
      video.scripture,
      video.sermonDate,
      video.description,
      video.videoId,
      video.videoUrl,
    ].some(value => (value ?? "").toLowerCase().includes(search)));
  }, [videoSearchTerm, videos]);

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
            <span className="text-sm font-semibold text-gray-700">조이풀TV 게시판</span>
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
              {linkedPlaylists.map((pl) => (
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
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{pl.menuLabel ?? pl.title}</span>
                    {pl.menuPath && (
                      <span className={`block truncate text-[11px] ${
                        selectedPlaylistId === pl.id ? "text-white/70" : "text-gray-400"
                      }`}>
                        {pl.menuPath}{pl.menuVisible === false ? " · 메뉴 숨김" : ""}
                      </span>
                    )}
                  </div>
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
              {unlinkedPlaylists.length > 0 && (
                <details className="mt-3 rounded-lg border border-dashed border-gray-200 bg-amber-50/50 p-2">
                  <summary className="cursor-pointer text-xs font-medium text-amber-800">
                    조이풀TV에 연결되지 않은 보관 목록 ({unlinkedPlaylists.length})
                  </summary>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                    공개 조이풀TV에는 보이지 않습니다. 기존 영상을 안전하게 관리하기 위한 목록입니다.
                  </p>
                  <div className="mt-2 space-y-1">
                    {unlinkedPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        className={`group flex w-full items-center rounded text-xs transition-colors ${
                          selectedPlaylistId === pl.id
                            ? "bg-amber-700 text-white"
                            : "bg-white text-gray-600 hover:bg-amber-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlaylistId(pl.id);
                            resetAddVideoForm();
                            resetEditVideoForm();
                          }}
                          className="min-w-0 flex-1 px-2 py-1.5 text-left"
                        >
                          <span className="block truncate">{pl.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`\"${pl.title}\" 플레이리스트를 삭제할까요? 영상도 모두 삭제됩니다.`)) {
                              deletePlaylist.mutate({ id: pl.id });
                            }
                          }}
                          className={`mr-1 shrink-0 p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                            selectedPlaylistId === pl.id ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-red-500"
                          }`}
                          title="플레이리스트 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
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
                  {selectedPlaylist?.menuLabel ?? selectedPlaylist?.title} 영상 목록
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
                    <label className="mb-1 block text-xs text-gray-500">제목</label>
                    <Input
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">설교자</label>
                      <Input
                        value={videoPreacher}
                        onChange={(e) => setVideoPreacher(e.target.value)}
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
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">영상 링크</label>
                    <Input
                      value={videoUrl}
                      onChange={(e) => handleVideoUrlChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                    {metadataNotice && (
                      <div className="mt-2 flex items-start justify-between gap-2 text-[11px] leading-relaxed text-[#1B5E20]">
                        <p>{metadataNotice}</p>
                        {extractVideoId(videoUrl.trim()) && !lookupVideoMetadata.isPending && (
                          <button
                            type="button"
                            className="shrink-0 font-semibold underline"
                            onClick={() => void fillVideoMetadata(videoUrl, true)}
                          >
                            다시 불러오기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">설명</label>
                    <Input
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
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
                      disabled={addVideo.isPending || lookupVideoMetadata.isPending || !videoUrl.trim()}
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
                    <label className="mb-1 block text-xs text-gray-500">영상 주소</label>
                    <Input
                      value={editVideoUrl}
                      onChange={(e) => setEditVideoUrl(e.target.value)}
                      placeholder="유튜브 링크 또는 MP4 영상 주소"
                      className="h-8 bg-white text-sm"
                    />
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
                      disabled={updateVideo.isPending || !editVideoUrl.trim() || !editVideoTitle.trim()}
                      className="h-7 bg-[#1B5E20] text-xs hover:bg-[#2E7D32]"
                    >
                      {updateVideo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "저장"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={videoSearchTerm}
                    onChange={(event) => setVideoSearchTerm(event.target.value)}
                    placeholder="설교제목, 날짜, 설교자, 본문 검색"
                    className="h-8 bg-white pl-8 text-sm"
                  />
                </label>
                <div className="flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setVideoViewMode("list")}
                    className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium ${
                      videoViewMode === "list" ? "bg-[#1B5E20] text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" /> 목록
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoViewMode("thumbnail")}
                    className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium ${
                      videoViewMode === "thumbnail" ? "bg-[#1B5E20] text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> 썸네일
                  </button>
                </div>
              </div>
              <p className="mb-3 text-xs text-gray-500">설교 날짜 최신순으로 자동 정렬됩니다.</p>

              {videosLoading ? (
                <p className="py-4 text-center text-xs text-gray-400">불러오는 중...</p>
              ) : videos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                  <p className="text-sm text-gray-400">등록된 영상이 없습니다.</p>
                  <p className="mt-1 text-xs text-gray-400">위에서 영상을 추가해보세요.</p>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                  <p className="text-sm text-gray-400">검색 결과가 없습니다.</p>
                  <p className="mt-1 text-xs text-gray-400">설교제목, 날짜, 설교자, 본문을 다시 확인해 주세요.</p>
                </div>
              ) : (
                <div className={videoViewMode === "thumbnail" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
                  {filteredVideos.map((video) => {
                    const commonProps = {
                      video,
                      onEdit: startEditVideo,
                      onToggleVisible: (item: VideoListItem) => {
                        toggleVideoVisibility.mutate({
                          id: item.id,
                          isVisible: item.isVisible === false,
                        });
                      },
                      isTogglePending:
                        toggleVideoVisibility.isPending &&
                        toggleVideoVisibility.variables?.id === video.id,
                      onDelete: (id: number) => {
                        if (confirm("이 영상을 삭제할까요?")) deleteVideo.mutate({ id });
                      },
                    };
                    return videoViewMode === "thumbnail" ? (
                      <VideoThumbnailItem key={video.id} {...commonProps} />
                    ) : (
                      <VideoItem key={video.id} {...commonProps} />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
