/**
 * 예배영상 관리 안내 컴포넌트
 * 유튜브 페이지 타입 메뉴 선택 시 3단 컬럼에 표시됩니다.
 */
import { trpc } from "@/lib/trpc";
import { Youtube, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export function YoutubeVideoManager({
  menuItemId,
  label,
  compact = false,
}: {
  menuItemId: number;
  label: string;
  compact?: boolean;
}) {
  const { data: menuItem } = trpc.cms.menus.getItem.useQuery({ id: menuItemId });
  const playlistId = menuItem?.playlistId ?? null;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-full bg-white flex items-center justify-center">
            <Youtube size={16} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">{label} 예배영상</p>
            {playlistId ? (
              <p className="text-[10px] text-green-600">✓ 플레이리스트 연결됨</p>
            ) : (
              <p className="text-[10px] text-amber-500">메뉴를 저장하면 자동 연결됩니다</p>
            )}
          </div>
        </div>
        <Link
          href="/admin_joych_2026?tab=youtube"
          className="shrink-0 flex items-center gap-1 text-[10px] text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md transition-colors"
        >
          <ExternalLink size={10} /> 영상 관리
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
        <Youtube size={20} className="text-red-500" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-700">예배영상 관리</p>
        {playlistId ? (
          <p className="text-[10px] text-green-600">✓ 플레이리스트 연결됨</p>
        ) : (
          <p className="text-[10px] text-amber-500">메뉴를 저장하면 자동 연결됩니다</p>
        )}
        <p className="text-[10px] text-gray-400 leading-relaxed">
          영상 추가·삭제·순서 변경은<br />관리자 대시보드에서 진행해주세요
        </p>
      </div>
      <Link
        href="/admin_joych_2026?tab=youtube"
        className="flex items-center gap-1 text-[10px] text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md transition-colors"
      >
        <ExternalLink size={10} /> 예배영상 관리 바로가기
      </Link>
    </div>
  );
}
