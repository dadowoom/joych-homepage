/**
 * 시설 사용 예약 — 목록 페이지 (/facility)
 * 실제 DB API 연결 버전
 */

import { useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { canManageAdminTab } from "@/lib/contentPermissions";
import type { Facility, FacilityImage } from "../../../drizzle/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, MapPin, CalendarCheck, Phone, Building2, Settings } from "lucide-react";

const FACILITY_BUILDINGS = [
  { value: "hayoungin", label: "하영인관" },
  { value: "welfare", label: "복지관" },
] as const;

type FacilityBuilding = typeof FACILITY_BUILDINGS[number]["value"];
type FacilityAudience = "member" | "external";
type SiteSettings = Record<string, string>;

const DEFAULT_FACILITY_HERO_BACKGROUND =
  "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=60";

const FACILITY_HERO_DEFAULTS = {
  eyebrow: "Facility Reservation",
  title: "시설 사용 예약",
  description:
    "기쁨의교회의 다양한 공간을 예약하여 사용하실 수 있습니다. 원하시는 시설을 선택하고\n예약 신청서를 작성해 주세요.",
  backgroundUrl: DEFAULT_FACILITY_HERO_BACKGROUND,
} as const;

const FACILITY_GUIDE_DEFAULTS = [
  {
    icon: "fa-search",
    titleKey: "facility_guide_step1_title",
    descKey: "facility_guide_step1_desc",
    title: "시설 선택",
    desc: "원하는 공간을 선택하세요",
  },
  {
    icon: "fa-calendar-check",
    titleKey: "facility_guide_step2_title",
    descKey: "facility_guide_step2_desc",
    title: "날짜 확인",
    desc: "예약 가능 일정을 확인하세요",
  },
  {
    icon: "fa-file-alt",
    titleKey: "facility_guide_step3_title",
    descKey: "facility_guide_step3_desc",
    title: "신청서 작성",
    desc: "신청 정보를 입력하세요",
  },
  {
    icon: "fa-phone",
    titleKey: "facility_guide_step4_title",
    descKey: "facility_guide_step4_desc",
    title: "담당자 확인",
    desc: "승인 후 연락을 드립니다",
  },
] as const;

function getSettingText(settings: SiteSettings | undefined, key: string, fallback: string) {
  const value = settings?.[key]?.trim();
  return value || fallback;
}

function normalizeFacilityBuilding(building: string | null | undefined): FacilityBuilding {
  return building === "hayoungin" ? "hayoungin" : "welfare";
}

function getFacilityBuildingFromSearch(searchString: string) {
  return normalizeFacilityBuilding(new URLSearchParams(searchString).get("building"));
}

function getFacilityListHref(building: FacilityBuilding, audience: FacilityAudience = "member") {
  return audience === "external" ? `/facility/external?building=${building}` : `/facility?building=${building}`;
}

function getFacilityDetailHref(facilityId: number, building: FacilityBuilding, audience: FacilityAudience = "member") {
  return audience === "external"
    ? `/facility/external/${facilityId}?building=${building}`
    : `/facility/${facilityId}?building=${building}`;
}

// ── 상단 배너 ──────────────────────────────────────────────
function FacilityHero({ settings, audience }: { settings?: SiteSettings; audience: FacilityAudience }) {
  const isExternal = audience === "external";
  const eyebrow = isExternal ? "External Reservation" : getSettingText(settings, "facility_hero_eyebrow", FACILITY_HERO_DEFAULTS.eyebrow);
  const title = isExternal ? "외부인 시설 사용 예약" : getSettingText(settings, "facility_hero_title", FACILITY_HERO_DEFAULTS.title);
  const description = isExternal
    ? "외부 기관과 방문자를 위해 공유된 시설을 예약 신청할 수 있습니다.\n예약 신청 후 담당자 확인을 거쳐 승인됩니다."
    : getSettingText(settings, "facility_hero_description", FACILITY_HERO_DEFAULTS.description);
  const backgroundUrl = getSettingText(settings, "facility_hero_background_url", FACILITY_HERO_DEFAULTS.backgroundUrl);

  return (
    <section className="relative bg-[#1B5E20] py-16 overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: `url('${backgroundUrl.replace(/'/g, "%27")}')` }}
      />
      <div className="container relative z-10 text-white">
        <p className="text-sm tracking-widest text-green-200 mb-2 uppercase">{eyebrow}</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          {title}
        </h1>
        <p className="text-green-100 text-sm md:text-base max-w-xl whitespace-pre-line">{description}</p>
        <nav className="mt-5 flex items-center gap-2 text-xs text-green-200">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          <i className="fas fa-chevron-right text-[10px]"></i>
          <span className="text-white">{title}</span>
        </nav>
      </div>
    </section>
  );
}

export function ExternalFacilityList() {
  return <FacilityList audience="external" />;
}

function MemberFacilityList() {
  return <FacilityList audience="member" />;
}

export default MemberFacilityList;

// ── 이용 안내 요약 배너 ────────────────────────────────────
function FacilityGuide({ settings, audience }: { settings?: SiteSettings; audience: FacilityAudience }) {
  const steps = FACILITY_GUIDE_DEFAULTS.map((step) => ({
    icon: step.icon,
    title: getSettingText(settings, step.titleKey, step.title),
    desc: getSettingText(settings, step.descKey, step.desc),
  }));
  if (audience === "external") {
    steps[0] = { ...steps[0], title: "공개 시설 선택", desc: "외부인에게 공유된 시설만 표시됩니다" };
    steps[3] = { ...steps[3], title: "담당자 확인", desc: "확인중/승인완료 상태로 처리됩니다" };
  }
  return (
    <section className="bg-[#F1F8E9] border-b border-green-100 py-6">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B5E20] text-white flex items-center justify-center shrink-0 text-sm">
                <i className={`fas ${s.icon}`}></i>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 시설 카드 ──────────────────────────────────────────────
function FacilityCard({ facility, activeBuilding, audience }: { facility: Facility; activeBuilding: FacilityBuilding; audience: FacilityAudience }) {
  const { data: images } = trpc.home.facilityImages.useQuery({ facilityId: facility.id });
  const thumbnail = images?.find((img: FacilityImage) => img.isThumbnail) ?? images?.[0];

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
      {/* 이미지 */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {thumbnail ? (
          <img
            src={thumbnail.imageUrl}
            alt={facility.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <CalendarCheck size={48} />
          </div>
        )}
        <div className="absolute top-3 right-3">
          {facility.isReservable ? (
            <Badge className="bg-green-600 text-white text-xs">예약 가능</Badge>
          ) : (
            <Badge className="bg-gray-500 text-white text-xs">예약 불가</Badge>
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-base mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          {facility.name}
        </h3>
        {facility.description && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">{facility.description}</p>
        )}

        <div className="space-y-1.5 mb-4">
          {facility.location && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin size={12} className="text-green-600 shrink-0" />
              <span>{facility.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Users size={12} className="text-green-600 shrink-0" />
            <span>최대 {facility.capacity}명</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock size={12} className="text-green-600 shrink-0" />
            <span>{facility.slotMinutes}분 단위</span>
          </div>
          {facility.pricePerHour > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-green-600 font-bold text-xs">₩</span>
              <span>시간당 {facility.pricePerHour.toLocaleString()}원</span>
            </div>
          )}
        </div>

        <Link href={getFacilityDetailHref(facility.id, activeBuilding, audience)}>
          <Button
            className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            disabled={!facility.isReservable}
          >
            {facility.isReservable ? "자세히 보기 / 예약하기" : "예약 불가"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────
function FacilityList({ audience = "member" }: { audience?: FacilityAudience }) {
  const isExternal = audience === "external";
  const memberFacilitiesQuery = trpc.home.facilities.useQuery(undefined, { enabled: !isExternal });
  const externalFacilitiesQuery = trpc.home.externalFacilities.useQuery(undefined, { enabled: isExternal });
  const facilities = isExternal ? externalFacilitiesQuery.data : memberFacilitiesQuery.data;
  const isLoading = isExternal ? externalFacilitiesQuery.isLoading : memberFacilitiesQuery.isLoading;
  const { data: authMe } = trpc.auth.me.useQuery(undefined, {
    enabled: !isExternal,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: settings } = trpc.home.settings.useQuery();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const canManageReservations = canManageAdminTab(authMe ?? null, "reservations");
  const activeBuilding = useMemo(
    () => getFacilityBuildingFromSearch(searchString),
    [searchString],
  );
  const visibleFacilities = useMemo(
    () => (facilities ?? []).filter((facility) => normalizeFacilityBuilding(facility.building) === activeBuilding),
    [activeBuilding, facilities],
  );
  const buildingCounts = useMemo(() => {
    const counts = new Map<FacilityBuilding, number>(FACILITY_BUILDINGS.map((building) => [building.value, 0]));
    (facilities ?? []).forEach((facility) => {
      const building = normalizeFacilityBuilding(facility.building);
      counts.set(building, (counts.get(building) ?? 0) + 1);
    });
    return counts;
  }, [facilities]);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <FacilityHero settings={settings as SiteSettings | undefined} audience={audience} />
      <FacilityGuide settings={settings as SiteSettings | undefined} audience={audience} />

      <section className="py-12">
        <div className="container">
          {!isExternal && (
            <div className="mb-6 flex justify-end gap-2">
              <Link href="/facility/my-reservations">
                <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                  <CalendarCheck size={16} className="mr-2" />
                  내 예약 현황
                </Button>
              </Link>
              {canManageReservations && (
                <Link href="/admin_joych_2026?tab=reservations">
                  <Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
                    <Settings size={16} className="mr-2" />
                    {"\uC608\uC57D \uAD00\uB9AC"}
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* 건물 분류 */}
          {!isLoading && facilities && facilities.length > 0 && (
            <div className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">건물 선택</h2>
                  <p className="text-xs text-gray-500">예약할 시설이 있는 건물을 선택해 주세요.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FACILITY_BUILDINGS.map((building) => {
                  const isActive = activeBuilding === building.value;
                  return (
                    <button
                      key={building.value}
                      type="button"
                      onClick={() => navigate(getFacilityListHref(building.value, audience))}
                      className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-all ${
                        isActive
                          ? "border-[#1B5E20] bg-[#F1F8E9] shadow-sm"
                          : "border-gray-200 bg-white hover:border-[#1B5E20]/60 hover:bg-green-50/40"
                      }`}
                    >
                      <span>
                        <span className={`block text-lg font-bold ${isActive ? "text-[#1B5E20]" : "text-gray-800"}`}>
                          {building.label}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          등록 시설 {buildingCounts.get(building.value) ?? 0}개
                        </span>
                      </span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        isActive ? "bg-[#1B5E20] text-white" : "bg-gray-100 text-gray-400"
                      }`}>
                        {isActive ? "선택" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 카드 그리드 */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !facilities || facilities.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <CalendarCheck size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">{isExternal ? "외부인에게 공개된 시설이 없습니다." : "등록된 시설이 없습니다."}</p>
              <p className="text-sm mt-2">관리자에게 문의해 주세요.</p>
            </div>
          ) : visibleFacilities.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <CalendarCheck size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">선택한 건물에 등록된 시설이 없습니다.</p>
              <p className="text-sm mt-2">다른 건물 분류를 선택해 주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleFacilities.map((f: Facility) => (
                <FacilityCard key={f.id} facility={f} activeBuilding={activeBuilding} audience={audience} />
              ))}
            </div>
          )}

          {/* 문의 안내 */}
          <div className="mt-12 bg-white rounded-xl p-6 border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] shrink-0">
              <Phone size={20} />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-gray-800 mb-0.5">시설 사용 문의</p>
              <p className="text-sm text-gray-500">
                시설 사용에 관한 문의는 교회 행정실로 연락해 주세요.
                <span className="ml-2 text-[#1B5E20] font-medium">054-270-1000</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
