/**
 * JoyfulTV.tsx
 * 조이풀TV 하위 메뉴 전체 페이지
 * - 각 예배 페이지는 href 기반으로 DB 메뉴 아이템을 조회해 playlistId를 가져온 뒤
 *   YoutubeListPage에 전달합니다. 관리자 대시보드에서 영상을 추가/삭제하면 즉시 반영됩니다.
 */
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import YoutubeListPage from "./YoutubeListPage";

function EmptyVideoPage({ title, message }: { title: string; message: string }) {
  return (
    <SubPageLayout pageTitle={title} parentLabel="조이풀TV">
      <div className="min-h-[320px] flex items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="text-center text-gray-500 px-6">
          <i className="fas fa-video text-4xl text-[#1B5E20] mb-4 opacity-70"></i>
          <p className="text-base font-semibold text-gray-700">{message}</p>
          <p className="text-sm mt-2 text-gray-400">영상이 준비되는 대로 이곳에서 보실 수 있습니다.</p>
        </div>
      </div>
    </SubPageLayout>
  );
}

// ── 공통: href로 playlistId를 조회해 YoutubeListPage를 렌더링 ──
function WorshipVideoPage({ href, title }: { href: string; title: string }) {
  const { data: menuItem, isLoading: l1 } = trpc.home.menuItemByHref.useQuery({ href });
  const { data: subItem, isLoading: l2 } = trpc.home.menuSubItemByHref.useQuery({ href });

  const playlistId = menuItem?.playlistId ?? subItem?.playlistId ?? null;
  const isLoading = l1 || l2;

  if (isLoading) {
    return (
      <SubPageLayout pageTitle={title} parentLabel="조이풀TV">
        <div className="min-h-[320px] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-10 h-10 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">영상 목록을 불러오는 중...</p>
          </div>
        </div>
      </SubPageLayout>
    );
  }

  if (!playlistId) {
    return <EmptyVideoPage title={title} message="현재 등록된 영상이 없습니다." />;
  }

  return <YoutubeListPage playlistId={playlistId} title={title} />;
}

export function SundayWorshipPage() {
  return <WorshipVideoPage href="/page/조이풀tv-주일예배" title="주일예배" />;
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
