/**
 * JoyfulTV.tsx
 * 조이풀TV 하위 메뉴 전체 페이지
 * - 각 예배 페이지는 href 기반으로 DB 메뉴 아이템을 조회해 playlistId를 가져온 뒤
 *   YoutubeListPage에 전달합니다. 관리자 대시보드에서 영상을 추가/삭제하면 즉시 반영됩니다.
 */
import { trpc } from "@/lib/trpc";
import YoutubeListPage from "./YoutubeListPage";

// ── 공통: href로 playlistId를 조회해 YoutubeListPage를 렌더링 ──
function WorshipVideoPage({ href, title }: { href: string; title: string }) {
  const { data: menuItem, isLoading: l1 } = trpc.home.menuItemByHref.useQuery({ href });
  const { data: subItem, isLoading: l2 } = trpc.home.menuSubItemByHref.useQuery({ href });

  const playlistId = menuItem?.playlistId ?? subItem?.playlistId ?? null;
  const isLoading = l1 || l2;

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-10 h-10 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">영상 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!playlistId) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-sm">등록된 영상이 없습니다.</p>
          <p className="text-xs mt-1 text-gray-300">관리자 메뉴에서 이 페이지의 타입을 &apos;유튜브 목록&apos;으로 설정하고 영상을 추가해주세요.</p>
        </div>
      </div>
    );
  }

  return <YoutubeListPage playlistId={playlistId} title={title} />;
}

export function SundayWorshipPage() {
  return <WorshipVideoPage href="/worship/tv/sunday" title="주일예배" />;
}
export function WednesdayWorshipPage() {
  return <WorshipVideoPage href="/worship/tv/hebron" title="헤브론 수요예배" />;
}
export function FridayPrayerPage() {
  return <WorshipVideoPage href="/worship/tv/shekhinah" title="쉐키나 금요기도회" />;
}
export function DawnBiblePage() {
  return <WorshipVideoPage href="/worship/tv/gloria" title="새벽 글로리아 성서학당" />;
}
export function PastorSeriesPage() {
  return <WorshipVideoPage href="/worship/tv/pastor-series" title="박진석 목사 시리즈설교" />;
}
export function HaDawnPage() {
  return <WorshipVideoPage href="/worship/tv/hayoungin" title="하영인 새벽기도회 설교" />;
}
export function SpecialWorshipPage() {
  return <WorshipVideoPage href="/worship/tv/special" title="특별예배" />;
}
export function SpecialFeaturePage() {
  return <WorshipVideoPage href="/worship/tv/feature" title="특집" />;
}
export function TestimonyPage() {
  return <WorshipVideoPage href="/worship/tv/testimony" title="간증" />;
}
export function PraisePage() {
  return <WorshipVideoPage href="/worship/tv/praise" title="찬양" />;
}
