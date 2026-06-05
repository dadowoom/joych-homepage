/**
 * ChurchIntro.tsx
 * 교회소개 신규 페이지: 섬기는분, 교회백서, 사역원리, CI, 셔틀버스
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { RouteComponentProps } from "wouter";
import { ArrowLeft, CalendarDays, ChevronRight, Bus, BookOpen, ExternalLink, Heart, Mail, Palette, Phone, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";

function PageWrapper({ title, breadcrumb, children }: { title: string; breadcrumb: string[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-3">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {item}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold font-['Noto_Serif_KR']">{title}</h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-[#2d6a4f] hover:underline mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> 뒤로 가기
        </button>
        {children}
      </div>
    </div>
  );
}

function alertPendingResource(label: string) {
  window.alert(`${label} 자료는 현재 준비 중입니다. 자료가 필요하시면 교회 사무실(054-270-1000)로 문의해 주세요.`);
}

// ── 섬기는 분 ──
const STAFF_CATEGORIES = [
  { value: "senior", label: "담임목사" },
  { value: "associate", label: "부교역자" },
  { value: "education", label: "교회학교 교역자" },
  { value: "cooperation", label: "협력사역자" },
  { value: "elder", label: "장로" },
  { value: "office", label: "교회직원" },
  { value: "other", label: "사회복지법인 기쁨의복지재단" },
] as const;

const ELDER_GROUP_LABELS = ["시무장로", "휴무장로", "원로장로", "은퇴장로"] as const;
const FALLBACK_ELDER_GROUP_LABEL = "장로";

type StaffCategoryFilter = typeof STAFF_CATEGORIES[number]["value"];
type StaffCategory = StaffCategoryFilter;
type StaffMenuTreeItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  isVisible?: boolean;
  subItems?: StaffMenuTreeItem[];
};
type StaffMenuTree = Array<{
  label: string;
  items?: StaffMenuTreeItem[];
}>;
type StaffPageProps = {
  initialCategory?: StaffCategoryFilter;
} & Partial<RouteComponentProps<Record<string, string | undefined>>>;

const PASTOR_GREETING_HREF = "/page/교회소개-담임목사-소개";
const PASTOR_BOOKS_HREF = "/page/교회소개-담임목사-저서";

type StaffSideMenuItem = {
  id: number;
  label: string;
  href: string | null;
  isActive?: boolean;
  subItems?: StaffSideMenuItem[];
};

const STAFF_SIDE_MENU_ITEMS: StaffSideMenuItem[] = [
  {
    id: 1,
    label: "담임목사 소개",
    href: null,
    subItems: [
      { id: 101, label: "담임목사인사", href: PASTOR_GREETING_HREF },
      { id: 102, label: "담임목사 저서", href: PASTOR_BOOKS_HREF },
    ],
  },
  { id: 2, label: "섬기는 분", href: "/page/교회소개-섬기는-분" },
  { id: 3, label: "부교역자", href: "/page/교회소개-부교역자" },
  { id: 4, label: "교회 역사", href: "/about/history" },
  { id: 5, label: "교회 비전", href: "/page/교회소개-3대-비전" },
  { id: 6, label: "오시는 길", href: "/about/directions" },
];

function getInitialStaffCategory(location: string, fallback: StaffCategoryFilter = "senior"): StaffCategoryFilter {
  if (location.includes("/associate") || location.includes("부교역자")) return "associate";
  return fallback;
}

function getStaffCategoryLabel(category: string) {
  return STAFF_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

function normalizeElderGroup(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function getElderGroupLabel(value: string | null | undefined) {
  const normalized = normalizeElderGroup(value);
  return ELDER_GROUP_LABELS.find((label) => normalizeElderGroup(label) === normalized) ?? FALLBACK_ELDER_GROUP_LABEL;
}

function isPastorIntroMenuItem(item: { label: string; href?: string | null }) {
  const label = item.label.replace(/\s+/g, "");
  const href = item.href?.trim();
  return (
    href === PASTOR_GREETING_HREF ||
    label === "담임목사소개" ||
    label === "담임목사인사" ||
    label === "담임목사인사말"
  );
}

function isPastorBooksMenuItem(item: { label: string; href?: string | null }) {
  const label = item.label.replace(/\s+/g, "");
  return item.href?.trim() === PASTOR_BOOKS_HREF || label === "담임목사저서";
}

function ensurePastorBooksSideMenuItems(items: StaffSideMenuItem[], pageTitle: string): StaffSideMenuItem[] {
  const bookItem: StaffSideMenuItem = {
    id: 120012,
    label: "담임목사 저서",
    href: PASTOR_BOOKS_HREF,
    isActive: pageTitle === "담임목사 저서",
  };
  const next: StaffSideMenuItem[] = items.map((item): StaffSideMenuItem => ({
    ...item,
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      isActive: isPastorBooksMenuItem(subItem) ? pageTitle === "담임목사 저서" : subItem.isActive,
    })),
  }));
  const alreadyExists = next.some((item) =>
    isPastorBooksMenuItem(item) ||
    item.subItems?.some((subItem) => isPastorBooksMenuItem(subItem))
  );

  if (alreadyExists) {
    return next.map((item) => ({
      ...item,
      isActive: item.isActive || item.subItems?.some((subItem) => subItem.isActive),
    }));
  }

  const parentIndex = next.findIndex((item) => isPastorIntroMenuItem(item));
  if (parentIndex >= 0) {
    const parent = next[parentIndex];
    next[parentIndex] = {
      ...parent,
      isActive: parent.isActive || pageTitle === "담임목사 저서",
      subItems: [...(parent.subItems ?? []), bookItem],
    };
    return next;
  }

  const greetingIndex = next.findIndex((item) => item.href === PASTOR_GREETING_HREF);
  if (greetingIndex >= 0) {
    next.splice(greetingIndex + 1, 0, bookItem);
    return next;
  }

  return [...next, bookItem];
}

function hasOwnStaffMenuContent(item: StaffMenuTreeItem) {
  const pageType = item.pageType ?? "image";
  if (pageType === "image") {
    return Boolean(item.pageImageUrl?.trim());
  }
  return true;
}

function getStaffSideMenuItems(menuTree: StaffMenuTree | undefined, pageTitle: string) {
  const liveItems = menuTree
    ?.find((menu) => menu.label === "교회소개")
    ?.items
    ?.filter((item) => item.isVisible !== false)
    .map((item) => {
      const subItems = item.subItems?.filter((subItem) => subItem.isVisible !== false) ?? [];
      const hasSubItems = subItems.length > 0;
      return {
        id: item.id,
        label: item.label,
        href: hasSubItems && !hasOwnStaffMenuContent(item) ? null : item.href ?? null,
        isActive: item.label === pageTitle,
        subItems: subItems.map((subItem) => ({
          id: subItem.id,
          label: subItem.label,
          href: subItem.href ?? null,
          isActive: subItem.label === pageTitle,
        })),
      };
    });

  if (liveItems?.length) return ensurePastorBooksSideMenuItems(liveItems, pageTitle);
  return ensurePastorBooksSideMenuItems(STAFF_SIDE_MENU_ITEMS, pageTitle).map((item) => ({
    ...item,
    isActive: item.label === pageTitle || item.subItems?.some((subItem) => subItem.label === pageTitle),
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      isActive: subItem.label === pageTitle,
    })),
  }));
}

export function StaffPage({
  initialCategory = "senior",
}: StaffPageProps = {}) {
  const [location] = useLocation();
  const [activeCategory, setActiveCategory] = useState<StaffCategoryFilter>(() => getInitialStaffCategory(location, initialCategory));

  useEffect(() => {
    setActiveCategory(getInitialStaffCategory(location, initialCategory));
  }, [initialCategory, location]);

  const queryInput = useMemo(
    () => ({ category: activeCategory as StaffCategory }),
    [activeCategory],
  );
  const { data: staffList = [], isLoading } = trpc.home.staff.useQuery(queryInput);
  const { data: menuTree } = trpc.home.menus.useQuery();
  const pageTitle = activeCategory === "associate" ? "부교역자" : "섬기는 분";
  const profileIntro = activeCategory === "associate"
    ? "기쁨의교회를 함께 섬기는 부교역자를 소개합니다."
    : "기쁨의교회를 섬기는 목회자와 사역자들을 소개합니다.";
  const sideMenuItems = useMemo(
    () => getStaffSideMenuItems(menuTree, pageTitle),
    [menuTree, pageTitle],
  );
  const elderGroups = useMemo(() => {
    if (activeCategory !== "elder") return [];

    const knownGroups = ELDER_GROUP_LABELS.map((label) => ({
      label,
      members: staffList.filter((staff) => getElderGroupLabel(staff.department) === label),
    })).filter((group) => group.members.length > 0);
    const fallbackMembers = staffList.filter((staff) => getElderGroupLabel(staff.department) === FALLBACK_ELDER_GROUP_LABEL);

    return fallbackMembers.length > 0
      ? [...knownGroups, { label: FALLBACK_ELDER_GROUP_LABEL, members: fallbackMembers }]
      : knownGroups;
  }, [activeCategory, staffList]);

  const renderStaffCard = (
    staff: typeof staffList[number],
    options: { hideDepartment?: boolean } = {},
  ) => {
    const departmentLabel = staff.department?.trim() || getStaffCategoryLabel(staff.category);
    const email = staff.email?.trim();
    const phone = staff.phone?.trim();

    return (
      <article
        key={staff.id}
        className="group relative flex h-full min-h-72 flex-col items-center border border-gray-200 bg-white px-4 pb-7 pt-40 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md"
      >
        <div className="absolute -top-10 left-1/2 flex h-48 w-40 -translate-x-1/2 items-center justify-center overflow-hidden bg-gray-50 ring-1 ring-gray-100 transition-transform group-hover:-translate-y-1">
          {staff.imageUrl ? (
            <img
              src={staff.imageUrl}
              alt={staff.name}
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <UserRound className="h-14 w-14 text-gray-300" />
          )}
        </div>
        <h3 className="text-base font-bold text-gray-900">{staff.name}</h3>
        {!options.hideDepartment && (
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {departmentLabel}
          </p>
        )}
        {(email || phone) && (
          <div className="mt-auto min-h-16 w-full border-t border-gray-100 pt-4 text-left text-xs leading-6 text-gray-500">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-2 break-all hover:text-[#1B5E20]">
                <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-[#1B5E20]">
                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {phone}
              </a>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <SubPageLayout
      pageTitle={pageTitle}
      parentLabel="교회소개"
      sideMenuItems={sideMenuItems}
    >
      <p className="sr-only">{profileIntro}</p>

      <div className="mb-12 border-y border-gray-200">
        <div className="flex flex-wrap gap-x-8 gap-y-0">
        {STAFF_CATEGORIES.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setActiveCategory(category.value)}
            className={`border-b-2 px-0 py-4 text-sm transition-colors ${
              activeCategory === category.value
                ? "border-gray-900 text-gray-900 font-semibold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {category.label}
          </button>
        ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500 py-12 text-center">불러오는 중...</p>
      ) : staffList.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-16 text-center">
          <UserRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">등록된 섬기는 분 정보가 없습니다.</p>
        </div>
      ) : activeCategory === "elder" ? (
        <div className="space-y-16 pt-6">
          {elderGroups.map((group) => (
            <section key={group.label}>
              <div className="mb-12 flex items-center gap-4 border-b border-gray-200 pb-3">
                <h2 className="text-lg font-bold text-[#1B5E20]">{group.label}</h2>
                <span className="text-xs text-gray-400">{group.members.length}명</span>
              </div>
              <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.members.map((staff) => renderStaffCard(staff, {
                  hideDepartment: group.label !== FALLBACK_ELDER_GROUP_LABEL,
                }))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-16 pt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {staffList.map((staff) => renderStaffCard(staff))}
        </div>
      )}
    </SubPageLayout>
  );
}

// ── 담임목사 저서 ──
const PASTOR_BOOKS = [
  {
    num: "48406",
    title: "생선 아카데미 인간론⑧ 『하나님과 화목하라』 : 하나님의 주권과 인간의 자유의지",
    imageUrl: "/pastor-books/48406.png",
    publishedAt: "2023.05.18",
  },
  {
    num: "48405",
    title: "생선 아카데미 인간론⑦ 『고난을 이기는 법』 : 고난은 축복의 밑거름입니다",
    imageUrl: "/pastor-books/48405.jpg",
    publishedAt: "2023.05.18",
  },
  {
    num: "48202",
    title: "생선 아카데미 인간론⑥ 『영광에서 영광으로』 : 승리의 면류관을 얻는 방법",
    imageUrl: "/pastor-books/48202.png",
    publishedAt: "2022.10.22",
  },
  {
    num: "47951",
    title: "생선 아카데미 인간론⑤ 『그리스도로 옷 입은 사람』 : 하늘의 영광 속에 거하는 삶",
    imageUrl: "/pastor-books/47951.jpg",
    publishedAt: "2022.09.25",
  },
  {
    num: "47950",
    title: "생선 아카데미 인간론④ 『일하는 인간』 : 하나님나라 통치의 동역자",
    imageUrl: "/pastor-books/47950.jpg",
    publishedAt: "2022.09.25",
  },
  {
    num: "47519",
    title: "생선 아카데미 인간론③ 『푯대를 향하여』 : 그리스도인의 영적 성장 단계",
    imageUrl: "/pastor-books/47519.png",
    publishedAt: "2022.02.03",
  },
  {
    num: "47518",
    title: "생선 아카데미 인간론② 『토기장이와 그릇』 : 하나님의 절대주권과 인간의 사명",
    imageUrl: "/pastor-books/47518.png",
    publishedAt: "2022.02.03",
  },
  {
    num: "47517",
    title: "생선 아카데미 인간론① 『본향을 향하여』 : 인간은 어디로부터 와서 어디로 가는가?",
    imageUrl: "/pastor-books/47517.png",
    publishedAt: "2022.02.03",
  },
  {
    num: "47104",
    title: "열두 물멧돌",
    imageUrl: "/pastor-books/47104.png",
    publishedAt: "2020.12.14",
  },
  {
    num: "45367",
    title: "그의 기이한 빛으로 들어가라",
    imageUrl: "/pastor-books/45367.jpg",
    publishedAt: "2019.03.21",
  },
  {
    num: "34550",
    title: "실종된 천국을 회복하라",
    imageUrl: "/pastor-books/34550.jpg",
    publishedAt: "2015.01.16",
  },
  {
    num: "476",
    title: "은혜, 아직 끝나지 않았다.",
    imageUrl: "/pastor-books/476.jpg",
    publishedAt: "2013.03.30",
  },
  {
    num: "475",
    title: "받은 복을 세어 보아라",
    imageUrl: "/pastor-books/475.jpg",
    publishedAt: "2011.06.03",
  },
  {
    num: "474",
    title: "기독교 교육과 리더십",
    imageUrl: "/pastor-books/474.jpg",
    publishedAt: "2010.04.04",
  },
  {
    num: "473",
    title: "리더십 바톤터치",
    imageUrl: "/pastor-books/473.gif",
    publishedAt: "2009.03.01",
  },
];

function getPastorBookDetailUrl(num: string) {
  return `http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=${num}&page=0&keyfield=&key=&bCate=`;
}

export function PastorBooksPage() {
  const { data: menuTree } = trpc.home.menus.useQuery();
  const sideMenuItems = useMemo(
    () => getStaffSideMenuItems(menuTree, "담임목사 저서"),
    [menuTree],
  );

  return (
    <SubPageLayout
      pageTitle="담임목사 저서"
      parentLabel="교회소개"
      sideMenuItems={sideMenuItems}
    >
      <div className="mb-8 flex flex-col gap-2 border-b border-gray-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1B5E20]">Pastor Books</p>
          <p className="mt-2 text-sm text-gray-500">
            박진석 담임목사의 저서를 한곳에서 확인할 수 있습니다.
          </p>
        </div>
        <p className="text-sm text-gray-400">총 {PASTOR_BOOKS.length}권</p>
      </div>

      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PASTOR_BOOKS.map((book) => (
          <a
            key={book.num}
            href={getPastorBookDetailUrl(book.num)}
            target="_blank"
            rel="noreferrer"
            className="group block border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex h-64 items-center justify-center overflow-hidden bg-gray-50">
              <img
                src={book.imageUrl}
                alt={book.title}
                loading="lazy"
                className="max-h-full max-w-full object-contain transition-transform group-hover:scale-[1.02]"
              />
            </div>
            <div className="pt-4">
              <h2 className="min-h-12 text-sm font-semibold leading-6 text-gray-800 group-hover:text-[#1B5E20]">
                {book.title}
              </h2>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {book.publishedAt}
                </span>
                <span className="inline-flex items-center gap-1 text-[#1B5E20]">
                  보기
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </SubPageLayout>
  );
}

// ── 교회백서 ──
const whiteBookSections = [
  { year: "2024", title: "2024 기쁨의교회 백서", desc: "2024년 한 해 동안의 교회 사역 현황, 재정 보고, 성도 현황 등을 담은 연간 보고서입니다.", pages: 48 },
  { year: "2023", title: "2023 기쁨의교회 백서", desc: "2023년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 52 },
  { year: "2022", title: "2022 기쁨의교회 백서", desc: "2022년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 44 },
];

export function WhiteBookPage() {
  return (
    <PageWrapper title="교회백서" breadcrumb={["교회소개", "교회백서"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <BookOpen className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">교회백서란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            교회백서는 기쁨의교회가 매년 발행하는 연간 보고서입니다. 한 해 동안의 사역 현황, 재정 투명성, 성도 현황 등을 성도들과 투명하게 공유합니다.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {whiteBookSections.map((book, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#1b4332] text-white rounded-xl flex items-center justify-center font-bold text-lg">{book.year}</div>
              <div>
                <h3 className="font-bold text-gray-900">{book.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{book.desc}</p>
                <p className="text-gray-400 text-xs mt-1">총 {book.pages}페이지</p>
              </div>
            </div>
            <button type="button" onClick={() => alertPendingResource(book.title)} className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors whitespace-nowrap">
              PDF 보기
            </button>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 사역원리 ──
const principles = [
  { title: "말씀 중심", icon: "📖", desc: "모든 사역의 근거는 하나님의 말씀입니다. 성경의 가르침을 삶 속에서 실천하는 교회를 지향합니다.", verse: "\"모든 성경은 하나님의 감동으로 된 것으로 교훈과 책망과 바르게 함과 의로 교육하기에 유익하니\" (딤후 3:16)" },
  { title: "기도의 교회", icon: "🙏", desc: "기도는 교회 사역의 동력입니다. 개인 기도, 소그룹 기도, 교회 공동 기도를 통해 하나님과 깊이 교제합니다.", verse: "\"쉬지 말고 기도하라\" (살전 5:17)" },
  { title: "제자 삼는 교회", icon: "✝️", desc: "예수님의 지상 명령에 순종하여 모든 성도가 예수님의 제자가 되고, 또 다른 제자를 세우는 사역을 감당합니다.", verse: "\"그러므로 너희는 가서 모든 민족을 제자로 삼아\" (마 28:19)" },
  { title: "선교하는 교회", icon: "🌍", desc: "땅 끝까지 복음을 전하는 선교적 교회입니다. 국내외 선교사를 파송하고 지원하며 세계 선교에 헌신합니다.", verse: "\"오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라\" (행 1:8)" },
  { title: "섬기는 교회", icon: "🤝", desc: "예수님의 섬김을 본받아 교회 안팎에서 낮은 자세로 섬기는 공동체를 이룹니다.", verse: "\"인자가 온 것은 섬김을 받으려 함이 아니라 도리어 섬기려 하고\" (마 20:28)" },
  { title: "기쁨의 공동체", icon: "😊", desc: "성령 안에서 기쁨이 넘치는 공동체입니다. 어떤 상황에서도 주 안에서 기뻐하는 교회를 지향합니다.", verse: "\"주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라\" (빌 4:4)" },
];

export function MinistryPrinciplePage() {
  return (
    <PageWrapper title="사역원리" breadcrumb={["교회소개", "사역원리"]}>
      <p className="text-gray-600 mb-10 text-lg leading-relaxed">기쁨의교회가 사역을 감당하는 핵심 원리들을 소개합니다. 이 원리들은 교회의 모든 사역과 프로그램의 기초가 됩니다.</p>
      <div className="grid md:grid-cols-2 gap-8">
        {principles.map((p, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{p.icon}</span>
              <h3 className="text-xl font-bold text-[#1b4332] font-['Noto_Serif_KR']">{p.title}</h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">{p.desc}</p>
            <blockquote className="bg-[#F1F8E9] rounded-lg px-4 py-3 text-[#2d6a4f] text-sm italic">{p.verse}</blockquote>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── CI (교회 아이덴티티) ──
export function CIPage() {
  return (
    <PageWrapper title="CI" breadcrumb={["교회소개", "CI"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Palette className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">CI(Church Identity)란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            기쁨의교회의 시각적 정체성을 나타내는 로고, 색상, 서체 등의 디자인 가이드라인입니다. 교회의 모든 공식 자료에 통일된 CI를 사용합니다.
          </p>
        </div>
      </div>

      {/* 로고 섹션 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 로고</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { bg: "bg-white border-2 border-gray-200", label: "기본형 (흰 배경)", textColor: "text-[#1b4332]" },
            { bg: "bg-[#1b4332]", label: "반전형 (어두운 배경)", textColor: "text-white" },
            { bg: "bg-gray-100", label: "단색형 (회색 배경)", textColor: "text-gray-700" },
          ].map((item, i) => (
            <div key={i} className={`${item.bg} rounded-xl p-8 flex flex-col items-center justify-center min-h-[160px]`}>
              <div className={`text-3xl font-bold font-['Noto_Serif_KR'] ${item.textColor} mb-2`}>기쁨의교회</div>
              <div className={`text-sm ${item.textColor} opacity-70`}>Joy Church</div>
              <p className="text-xs text-gray-400 mt-4">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 색상 팔레트 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 색상</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { color: "#1b4332", name: "딥 그린", hex: "#1b4332", use: "주요 배경, 헤더" },
            { color: "#2d6a4f", name: "메인 그린", hex: "#2d6a4f", use: "포인트 컬러, 버튼" },
            { color: "#52b788", name: "라이트 그린", hex: "#52b788", use: "강조, 아이콘" },
            { color: "#d8f3dc", name: "페일 그린", hex: "#d8f3dc", use: "배경, 카드" },
          ].map((c, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-200">
              <div className="h-20" style={{ backgroundColor: c.color }} />
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs">{c.hex}</p>
                <p className="text-gray-400 text-xs mt-1">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 자료 안내 */}
      <section>
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">CI 자료 안내</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {["로고 AI 파일", "로고 PNG 파일", "CI 가이드라인 PDF"].map((file, i) => (
            <button key={i} type="button" onClick={() => alertPendingResource(file)} className="border-2 border-[#2d6a4f] text-[#2d6a4f] rounded-xl p-4 hover:bg-[#2d6a4f] hover:text-white transition-colors text-sm font-semibold">
              {file} 문의
            </button>
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}

// ── 셔틀버스 ──
const busRoutes = [
  { route: "1호차", area: "주일 셔틀", stops: ["세부 승차 위치는 주보 및 교회 공지를 확인해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "2호차", area: "주일 셔틀", stops: ["세부 승차 위치는 안내 데스크로 문의해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "3호차", area: "특별 행사", stops: ["행사 일정에 따라 별도 안내됩니다.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
];

export function ShuttleBusPage() {
  return (
    <PageWrapper title="셔틀버스" breadcrumb={["교회소개", "셔틀버스"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Bus className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">셔틀버스 운행 안내</h2>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>• 운행 시간: 매주 주일 오전 (1부 예배 기준)</li>
            <li>• 탑승 신청: 교회 행정실 또는 각 차량 담당자에게 연락</li>
            <li>• 문의: 054-270-1000</li>
          </ul>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {busRoutes.map((bus, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1b4332] text-white rounded-full flex items-center justify-center font-bold text-sm">{bus.route}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{bus.area}</h3>
              <p className="text-xs text-gray-500">문의: {bus.driver}</p>
                </div>
              </div>
              <a href={`tel:${bus.contact}`} className="text-[#2d6a4f] text-sm font-semibold hover:underline">{bus.contact}</a>
            </div>
            <div className="space-y-2">
              {bus.stops.map((stop, j) => (
                <div key={j} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${j === bus.stops.length - 1 ? "bg-[#2d6a4f]" : "bg-gray-300"}`} />
                  <span className={j === bus.stops.length - 1 ? "text-[#2d6a4f] font-semibold" : "text-gray-600"}>{stop}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
