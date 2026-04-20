/**
 * 유튜브 콘텐츠 컴포넌트
 * pageType="youtube" 메뉴에서 표시됩니다.
 * 메뉴에 연결된 플레이리스트의 영상 목록을 표시합니다.
 */
import { Youtube } from "lucide-react";
import YoutubeListPage from "@/pages/YoutubeListPage";

export function YoutubeContent({
  label,
  playlistId,
}: {
  label?: string;
  playlistId?: number | null;
}) {
  if (!playlistId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <Youtube className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-gray-500 text-sm font-medium">
          아직 영상이 연결되지 않았습니다.
        </p>
        <p className="text-gray-400 text-xs mt-1">
          관리자 패널 → 메뉴 편집에서 이 메뉴를 선택하면 영상을 추가할 수 있습니다.
        </p>
      </div>
    );
  }

  return <YoutubeListPage playlistId={playlistId} title={label} />;
}
