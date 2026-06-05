/**
 * 기쁨의교회 — 예배/미디어 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: JoyfulTV / WorshipSchedule / Bulletin
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

function PageHeader({ title, subtitle, breadcrumb }: { title: string; subtitle?: string; breadcrumb: string[] }) {
  return (
    <div className="bg-[#1B5E20] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-green-200 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              <i className="fas fa-chevron-right text-xs text-green-400"></i>
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : ""}>{b}</span>
            </span>
          ))}
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h1>
        {subtitle && <p className="mt-3 text-green-100 text-base">{subtitle}</p>}
      </div>
    </div>
  );
}

function SubNav({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto">
        {items.map((item, i) => (
          <Link key={i} href={item.href}
            className="flex-shrink-0 px-5 py-4 text-sm font-medium text-gray-600 hover:text-[#1B5E20] border-b-2 border-transparent hover:border-[#1B5E20] transition-all whitespace-nowrap">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

const WORSHIP_NAV = [
  { label: "실시간 예배", href: "/worship/tv" },
  { label: "설교 영상", href: "/page/조이풀tv-주일예배" },
  { label: "찬양 영상", href: "/worship/tv/praise" },
  { label: "예배시간 안내", href: "/worship/schedule" },
  { label: "주보 보기", href: "/worship/bulletin" },
];

// ── 조이풀TV (설교 영상) ─────────────────────────────────────────
const SERMON_VIDEOS = [
  { id: "1", badge: "주일예배", title: "주일예배 설교 영상", preacher: "기쁨의교회", date: "최신 영상", duration: "예배 영상", href: "/page/조이풀tv-주일예배", thumb: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=400&q=70" },
  { id: "2", badge: "수요예배", title: "수요예배 영상", preacher: "기쁨의교회", date: "조이풀TV", duration: "예배 영상", href: "/worship/tv/hebron", thumb: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=400&q=70" },
  { id: "3", badge: "새벽기도", title: "새벽기도회 영상", preacher: "기쁨의교회", date: "조이풀TV", duration: "예배 영상", href: "/worship/tv/gloria", thumb: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&q=70" },
  { id: "4", badge: "주일예배", title: "주일예배 다시보기", preacher: "기쁨의교회", date: "조이풀TV", duration: "예배 영상", href: "/page/조이풀tv-주일예배", thumb: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=70" },
  { id: "5", badge: "특별집회", title: "특별집회 영상", preacher: "기쁨의교회", date: "조이풀TV", duration: "집회 영상", href: "/worship/tv/special", thumb: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=70" },
  { id: "6", badge: "주일예배", title: "주일예배 말씀 영상", preacher: "기쁨의교회", date: "조이풀TV", duration: "예배 영상", href: "/page/조이풀tv-주일예배", thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=70" },
];

const BADGE_COLORS: Record<string, string> = {
  "주일예배": "bg-green-100 text-green-700",
  "수요예배": "bg-blue-100 text-blue-700",
  "새벽기도": "bg-amber-100 text-amber-700",
  "특별집회": "bg-purple-100 text-purple-700",
};

export function JoyfulTV() {
  const [filter, setFilter] = useState("전체");
  const filters = ["전체", "주일예배", "수요예배", "새벽기도", "특별집회"];
  const filtered = filter === "전체" ? SERMON_VIDEOS : SERMON_VIDEOS.filter(v => v.badge === filter);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="조이풀TV" subtitle="기쁨의교회 예배와 설교 영상을 만나보세요" breadcrumb={["조이풀TV", "설교 영상"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* 최신 영상 (큰 카드) */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-10">
          <div className="relative aspect-video bg-gray-900">
            <img src={SERMON_VIDEOS[0].thumb} alt="최신 설교" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Link href={SERMON_VIDEOS[0].href} className="w-20 h-20 rounded-full bg-white/90 hover:bg-white transition-colors flex items-center justify-center shadow-xl">
                <i className="fas fa-play text-[#1B5E20] text-2xl ml-1"></i>
              </Link>
            </div>
            <span className={`absolute top-4 left-4 text-xs px-3 py-1.5 rounded-full font-medium ${BADGE_COLORS[SERMON_VIDEOS[0].badge]}`}>
              {SERMON_VIDEOS[0].badge}
            </span>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{SERMON_VIDEOS[0].title}</h2>
            <p className="text-gray-500 text-sm">{SERMON_VIDEOS[0].preacher} · {SERMON_VIDEOS[0].date} · {SERMON_VIDEOS[0].duration}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 flex-wrap mb-6">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-[#1B5E20] text-white" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* 영상 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(v => (
            <Link key={v.id} href={v.href} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="relative aspect-video bg-gray-100">
                <img src={v.thumb} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <i className="fas fa-play text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
                <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full font-medium ${BADGE_COLORS[v.badge] || "bg-gray-100 text-gray-700"}`}>{v.badge}</span>
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">{v.duration}</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-800 text-sm leading-snug mb-1.5 line-clamp-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{v.title}</h3>
                <p className="text-gray-400 text-xs">{v.preacher} · {v.date}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 예배시간 안내 ─────────────────────────────────────────────────
const WORSHIP_TIMES = [
  {
    name: "주일예배",
    icon: "fa-sun",
    color: "bg-[#E8F5E9]",
    iconColor: "text-[#1B5E20]",
    times: [
      { label: "1부 예배", time: "오전 7:30", note: "본당" },
      { label: "2부 예배", time: "오전 9:00", note: "본당" },
      { label: "3부 예배", time: "오전 11:00", note: "본당 (주요 예배)" },
      { label: "4부 예배", time: "오후 1:30", note: "본당" },
      { label: "온라인 예배", time: "오전 11:00", note: "유튜브 실시간 방송" },
    ],
  },
  {
    name: "수요예배",
    icon: "fa-church",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
    times: [
      { label: "수요예배", time: "오전 11:00", note: "본당" },
      { label: "수요예배", time: "오후 7:30", note: "본당" },
    ],
  },
  {
    name: "새벽기도회",
    icon: "fa-moon",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
    times: [
      { label: "새벽기도", time: "오전 5:30", note: "월~토 / 본당" },
    ],
  },
  {
    name: "금요기도회",
    icon: "fa-fire",
    color: "bg-rose-50",
    iconColor: "text-rose-600",
    times: [
      { label: "금요기도회", time: "오후 8:00", note: "본당" },
    ],
  },
];

export function WorshipSchedule() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="예배시간 안내" subtitle="기쁨의교회 예배 일정을 확인하세요" breadcrumb={["조이풀TV", "예배시간 안내"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {WORSHIP_TIMES.map((wt, i) => (
            <div key={i} className={`rounded-2xl p-7 shadow-sm ${wt.color}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <i className={`fas ${wt.icon} ${wt.iconColor}`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>{wt.name}</h3>
              </div>
              <div className="space-y-3">
                {wt.times.map((t, j) => (
                  <div key={j} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{t.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-800 text-base">{t.time}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-[#E8F5E9] rounded-2xl p-6 text-sm text-[#1B5E20]">
          <i className="fas fa-info-circle mr-2"></i>
          예배 시간은 교회 사정에 따라 변경될 수 있습니다. 변경 사항은 주보 및 교회 공지를 통해 안내드립니다.
        </div>
      </div>
    </div>
  );
}

// ── 주보 보기 ─────────────────────────────────────────────────────
function formatBulletinDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replaceAll("-", ".");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatBulletinFileSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function isImageBulletin(fileMime: string | null | undefined, fileName: string | null | undefined) {
  const mime = fileMime ?? "";
  const name = fileName?.toLowerCase() ?? "";
  return mime.startsWith("image/") || /\.(jpg|jpeg|png)$/.test(name);
}

export function Bulletin() {
  const { data: bulletins = [], isLoading } = trpc.home.bulletins.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const filteredBulletins = searchKeyword.trim()
    ? bulletins.filter((bulletin) => bulletin.title.toLowerCase().includes(searchKeyword.trim().toLowerCase()))
    : bulletins;
  const selectedBulletin = filteredBulletins.find((bulletin) => bulletin.id === expandedId) ?? filteredBulletins[0] ?? null;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="주보 보기" subtitle="기쁨의교회 주보를 확인하고 내려받을 수 있습니다" breadcrumb={["조이풀TV", "주보 보기"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="mb-5 border-b border-gray-100 pb-4">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{bulletins.length}</span>개의 주보
            {searchKeyword && <span className="ml-2 text-gray-400">검색 결과 {filteredBulletins.length}개</span>}
          </p>
          <p className="mt-1 text-xs text-gray-400">목록에서 주보를 선택해 미리보고 내려받을 수 있습니다.</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-0.5">
              <span className="flex h-6 w-6 items-center justify-center border border-[#86C5D8] bg-white text-[#1B5E20]">
                <span className="h-3.5 w-3.5 border-y-2 border-[#1B5E20]" />
              </span>
              <span className="flex h-6 w-6 items-center justify-center border border-gray-200 bg-gray-50 text-gray-300">
                <span className="grid grid-cols-2 gap-0.5">
                  <span className="h-1.5 w-1.5 bg-gray-300" />
                  <span className="h-1.5 w-1.5 bg-gray-300" />
                  <span className="h-1.5 w-1.5 bg-gray-300" />
                  <span className="h-1.5 w-1.5 bg-gray-300" />
                </span>
              </span>
            </div>
            <span>새 글 0 / {filteredBulletins.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
            }}
          >
            <select
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
              defaultValue="title"
            >
              <option value="title">제목</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="h-8 border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
              aria-label="검색"
            >
              검색
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : (
          <div className="hidden overflow-hidden border border-gray-200 bg-white md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-24" />
            </colgroup>
            <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
              <tr>
                <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">첨부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBulletins.map((bulletin, index) => {
                const isExpanded = expandedId === bulletin.id;
                return (
                  <tr key={bulletin.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-3 py-3 text-center text-gray-500">{filteredBulletins.length - index}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : bulletin.id)}
                        className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                        aria-expanded={isExpanded}
                      >
                        {bulletin.title}
                        <span className="ml-2 text-[#0F8FB3]">▣</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">관리자</td>
                    <td className="px-3 py-3 text-center text-gray-500">{formatBulletinDate(bulletin.bulletinDate)}</td>
                    <td className="px-3 py-3 text-center text-gray-500">1</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {!isLoading && (
          <div className="divide-y divide-gray-100 border border-gray-200 bg-white md:hidden">
          {filteredBulletins.map((bulletin, index) => (
            <article key={bulletin.id} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                <span>번호 {filteredBulletins.length - index}</span>
                <span>{formatBulletinDate(bulletin.bulletinDate)}</span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === bulletin.id ? null : bulletin.id)}
                className="block w-full text-left text-base font-bold text-gray-900"
              >
                {bulletin.title}
              </button>
              <p className="mt-1 text-xs font-medium text-[#1B5E20]">관리자</p>
            </article>
          ))}
          </div>
        )}

        {!isLoading && filteredBulletins.length === 0 && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <i className="fas fa-file-alt mb-3 text-4xl text-gray-300" />
            <p className="text-sm text-gray-400">해당 조건의 주보가 없습니다.</p>
          </div>
        )}

        {selectedBulletin && (
          <div className="mt-8 overflow-hidden border border-gray-200 bg-white">
            <div className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] px-5 py-3">
              <h2 className="font-bold text-[#0F607A]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {selectedBulletin.title}
              </h2>
            </div>
            <div className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
              관리자 <span className="mx-2 text-gray-300">|</span>
              등록일 {formatBulletinDate(selectedBulletin.bulletinDate)}
              <span className="mx-2 text-gray-300">|</span>
              첨부 1개
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-[1fr_220px]">
              <div className="flex min-h-96 items-center justify-center border border-gray-100 bg-gray-50">
                {isImageBulletin(selectedBulletin.fileMime, selectedBulletin.fileName) ? (
                  <img
                    src={selectedBulletin.fileUrl}
                    alt={selectedBulletin.title}
                    className="max-h-[720px] w-auto max-w-full object-contain"
                  />
                ) : (
                  <iframe
                    src={selectedBulletin.fileUrl}
                    title={selectedBulletin.title}
                    className="h-[720px] w-full border-0 bg-white"
                  />
                )}
              </div>
              <div className="border border-gray-200 bg-white p-4 text-sm">
                <p className="mb-3 font-semibold text-gray-800">첨부파일</p>
                <div className="rounded border border-dashed border-gray-200 p-4 text-xs text-gray-500">
                  <p className="font-medium text-gray-700">{selectedBulletin.fileName}</p>
                  <p className="mt-1 text-gray-400">{formatBulletinFileSize(selectedBulletin.fileSize)}</p>
                </div>
                <a
                  href={selectedBulletin.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block w-full border border-[#1B5E20] px-4 py-2 text-center text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
                >
                  파일 열기
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
