/**
 * 기쁨의교회 — 예배/미디어 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: JoyfulTV / WorshipSchedule / Bulletin
 */

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { getSupportSideMenuItems } from "@/lib/supportSideMenu";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { ViewModeToggle, type ViewMode } from "@/components/dynamic-page/ViewModeToggle";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Images, Paperclip, Upload, X, ZoomIn } from "lucide-react";

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

type BulletinPageImage = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileMime: string | null;
  sortOrder?: number | null;
};

type BulletinWithPages = {
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileMime: string | null;
  images?: BulletinPageImage[];
};

function getBulletinPages(bulletin: BulletinWithPages) {
  return bulletin.images && bulletin.images.length > 0
    ? bulletin.images
    : [{
        id: 0,
        fileName: bulletin.fileName,
        fileUrl: bulletin.fileUrl,
        fileSize: bulletin.fileSize,
        fileMime: bulletin.fileMime,
        sortOrder: 0,
      }];
}

const MAX_BULLETIN_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_BULLETIN_UPLOAD_COUNT = 12;
const ALLOWED_BULLETIN_UPLOAD_RE = /\.(jpg|jpeg|png)$/i;

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getMemberLoginHref(fallbackPath = "/worship/bulletin") {
  const currentPath = typeof window === "undefined"
    ? fallbackPath
    : `${window.location.pathname}${window.location.search}`;
  return `/member/login?next=${encodeURIComponent(currentPath || fallbackPath)}`;
}

function BulletinAccessRequired() {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#D8E8DA] bg-[#F8FCF8] px-5 py-20 text-center">
      <i className="fas fa-lock mb-4 text-4xl text-[#1B5E20]" />
      <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>
        성도 로그인 후 이용할 수 있습니다
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
        주보 보기는 성도 이상 읽기 권한이 필요한 자료입니다. 성도 로그인 후 다시 확인해 주세요.
      </p>
      <Link
        href={getMemberLoginHref()}
        className="mt-6 inline-flex h-10 items-center justify-center border border-[#1B5E20] bg-[#1B5E20] px-5 text-sm font-semibold text-white hover:bg-[#2E7D32]"
      >
        성도 로그인
      </Link>
    </div>
  );
}

function readBulletinFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function sortBulletinUploadFiles(files: File[]) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "ko-KR", { numeric: true, sensitivity: "base" })
  );
}

function BulletinUploadPanel() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    bulletinDate: getTodayDateInputValue(),
    status: "published" as "published" | "hidden",
  });

  const createBulletin = trpc.cms.bulletins.create.useMutation({
    onSuccess: async () => {
      toast.success("주보가 등록되었습니다.");
      setForm({
        title: "",
        bulletinDate: getTodayDateInputValue(),
        status: "published",
      });
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await Promise.all([
        utils.home.bulletins.invalidate(),
        utils.cms.bulletins.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = sortBulletinUploadFiles(Array.from(event.target.files ?? []));
    if (files.length > MAX_BULLETIN_UPLOAD_COUNT) {
      toast.error(`주보 이미지는 최대 ${MAX_BULLETIN_UPLOAD_COUNT}장까지 등록할 수 있습니다.`);
      event.currentTarget.value = "";
      return;
    }
    if (files.some((file) => !ALLOWED_BULLETIN_UPLOAD_RE.test(file.name))) {
      toast.error("주보 이미지는 JPG, PNG 파일만 등록할 수 있습니다.");
      event.currentTarget.value = "";
      return;
    }
    if (files.some((file) => file.size > MAX_BULLETIN_UPLOAD_BYTES)) {
      toast.error("주보 이미지는 한 장당 최대 8MB까지 업로드할 수 있습니다.");
      event.currentTarget.value = "";
      return;
    }
    setSelectedFiles(files);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error("등록할 주보 이미지를 선택해주세요.");
      return;
    }

    await createBulletin.mutateAsync({
      title: form.title,
      bulletinDate: form.bulletinDate,
      status: form.status,
      files: await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: await readBulletinFile(file),
        }))
      ),
    });
  };

  return (
    <section className="mb-5 border border-[#D8E8DA] bg-[#F8FCF8] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#1B5E20]">주보 등록</p>
          <p className="mt-1 text-xs text-gray-500">권한 계정은 이 화면에서 주보 이미지를 여러 장 등록할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-9 items-center justify-center gap-2 border border-[#1B5E20] bg-white px-3 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]"
        >
          <Upload className="h-3.5 w-3.5" />
          {isOpen ? "등록 닫기" : "주보 등록"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 lg:grid-cols-[1fr_150px_130px_auto]">
          <input
            required
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="예: 2026년 6월 7일 주보"
            className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
          />
          <input
            type="date"
            required
            value={form.bulletinDate}
            onChange={(event) => setForm((prev) => ({ ...prev, bulletinDate: event.target.value }))}
            className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "published" | "hidden" }))}
            className="h-10 border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
          >
            <option value="published">공개</option>
            <option value="hidden">숨김</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#1B5E20]/30 bg-white px-3 text-sm font-medium text-[#1B5E20] hover:bg-[#F1F8E9]">
              <Paperclip className="h-4 w-4" />
              이미지
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".jpg,.jpeg,.png"
                multiple
                onChange={handleFilesChange}
              />
            </label>
            <button
              type="submit"
              disabled={createBulletin.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 bg-[#1B5E20] px-4 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              등록
            </button>
          </div>
          {selectedFiles.length > 0 && (
            <div className="lg:col-span-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Images className="h-3.5 w-3.5 text-[#1B5E20]" />
              <span>선택된 이미지 {selectedFiles.length}장</span>
              <span className="text-gray-300">|</span>
              <span className="truncate">{selectedFiles.map((file) => file.name).join(", ")}</span>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

export function BulletinDetail() {
  const utils = trpc.useUtils();
  const params = useParams<{ id?: string }>();
  const bulletinId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const canReadBulletins = Boolean(memberMe) || canManageBoardContent(user, "content:bulletins");
  const bulletinsQuery = trpc.home.bulletins.useQuery(undefined, {
    enabled: canReadBulletins,
    retry: false,
  });
  const bulletins = bulletinsQuery.data ?? [];
  const isAccessDenied = !authLoading && !memberLoading && !canReadBulletins;
  const isLoading = authLoading || memberLoading || (canReadBulletins && bulletinsQuery.isLoading);
  const { data: allMenus } = trpc.home.menus.useQuery();
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [lightboxPageIndex, setLightboxPageIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const viewedBulletinIdsRef = useRef<Set<number>>(new Set());
  const { parentLabel, sideMenuItems } = getSupportSideMenuItems(allMenus, "/worship/bulletin");
  const bulletin = Number.isFinite(bulletinId)
    ? bulletins.find((item) => item.id === bulletinId) ?? null
    : null;
  const pages = bulletin ? getBulletinPages(bulletin) : [];
  const maxPageIndex = Math.max(pages.length - 1, 0);
  const pageIndex = Math.min(selectedPageIndex, maxPageIndex);
  const page = pages[pageIndex] ?? null;
  const lightboxPage = lightboxPageIndex !== null ? pages[lightboxPageIndex] : null;

  const trackBulletinView = trpc.home.trackBulletinView.useMutation({
    onSuccess: () => {
      void utils.home.bulletins.invalidate();
    },
  });

  useEffect(() => {
    if (!canReadBulletins || !bulletin?.id || viewedBulletinIdsRef.current.has(bulletin.id)) return;

    viewedBulletinIdsRef.current.add(bulletin.id);
    trackBulletinView.mutate({ id: bulletin.id });
  }, [bulletin?.id, canReadBulletins]);

  const movePage = (direction: -1 | 1) => {
    setSelectedPageIndex((current) => Math.min(Math.max(current + direction, 0), maxPageIndex));
  };

  const moveLightbox = (direction: -1 | 1) => {
    setLightboxPageIndex((current) => {
      if (current === null) return current;
      return Math.min(Math.max(current + direction, 0), pages.length - 1);
    });
  };

  const handleTouchEnd = (clientX: number) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null || pages.length <= 1) return;
    const deltaX = clientX - startX;
    if (Math.abs(deltaX) < 36) return;
    movePage(deltaX < 0 ? 1 : -1);
  };

  return (
    <SubPageLayout pageTitle="주보 보기" parentLabel={parentLabel} sideMenuItems={sideMenuItems}>
      <div className="max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <Link href="/worship/bulletin" className="text-sm font-semibold text-[#1B5E20] hover:underline">
            ← 주보 목록
          </Link>
          {bulletin && (
            <span className="text-xs text-gray-400">
              등록일 {formatBulletinDate(bulletin.bulletinDate)}
            </span>
          )}
        </div>

        {isAccessDenied ? (
          <BulletinAccessRequired />
        ) : isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : !bulletin ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <i className="fas fa-file-alt mb-3 text-4xl text-gray-300" />
            <p className="text-sm text-gray-400">주보를 찾을 수 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-hidden border border-gray-200 bg-white">
            <div className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] px-5 py-3">
              <h2 className="font-bold text-[#0F607A]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {bulletin.title}
              </h2>
            </div>
            <div className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
              관리자 <span className="mx-2 text-gray-300">|</span>
              등록일 {formatBulletinDate(bulletin.bulletinDate)}
              <span className="mx-2 text-gray-300">|</span>
              첨부 {pages.length}개
              <span className="mx-2 text-gray-300">|</span>
              조회수 {bulletin.viewCount ?? 0}
            </div>
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div
                className="bg-gray-50 p-3 sm:p-5"
                onTouchStart={(event) => {
                  touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  const clientX = event.changedTouches[0]?.clientX;
                  if (typeof clientX === "number") handleTouchEnd(clientX);
                }}
              >
                {page && (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => movePage(-1)}
                        disabled={pageIndex === 0}
                        className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-700 disabled:opacity-30"
                        aria-label="이전 주보 페이지"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 text-center">
                        <p className="text-xs font-semibold text-[#1B5E20]">
                          {pageIndex + 1} / {pages.length}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{page.fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => movePage(1)}
                        disabled={pageIndex >= pages.length - 1}
                        className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-700 disabled:opacity-30"
                        aria-label="다음 주보 페이지"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>

                    {isImageBulletin(page.fileMime, page.fileName) ? (
                      <button
                        type="button"
                        onClick={() => setLightboxPageIndex(pageIndex)}
                        className="group block w-full cursor-zoom-in border border-gray-200 bg-white shadow-sm"
                        aria-label={`${bulletin.title} ${pageIndex + 1}페이지 크게 보기`}
                      >
                        <img
                          src={page.fileUrl}
                          alt={`${bulletin.title} ${pageIndex + 1}페이지`}
                          className="h-auto w-full object-contain"
                        />
                        <span className="flex items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs text-gray-400 group-hover:text-[#1B5E20]">
                          <ZoomIn className="h-3.5 w-3.5" />
                          이미지를 누르면 크게 볼 수 있습니다.
                        </span>
                      </button>
                    ) : (
                      <iframe
                        src={page.fileUrl}
                        title={`${bulletin.title} ${pageIndex + 1}페이지`}
                        className="h-[720px] w-full border border-gray-200 bg-white"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="border border-gray-200 bg-white p-4 text-sm">
                <p className="mb-3 font-semibold text-gray-800">첨부 이미지</p>
                <div className="space-y-2">
                  {pages.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.id}-${item.fileUrl}-select`}
                      onClick={() => setSelectedPageIndex(index)}
                      className={`flex w-full items-start justify-between gap-3 rounded border border-dashed p-3 text-left text-xs ${
                        index === pageIndex
                          ? "border-[#1B5E20]/50 bg-[#F1F8E9] text-[#1B5E20]"
                          : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:bg-[#F1F8E9]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{index + 1}페이지</span>
                        <span className="mt-0.5 block truncate">{item.fileName}</span>
                        <span className="mt-0.5 block text-gray-400">{formatBulletinFileSize(item.fileSize)}</span>
                      </span>
                      <Download className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    </button>
                  ))}
                </div>
                <a
                  href={page?.fileUrl ?? bulletin.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block w-full border border-[#1B5E20] px-4 py-2 text-center text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
                >
                  현재 페이지 열기
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {lightboxPageIndex !== null && lightboxPage && (
        <div
          className="fixed inset-0 z-[500] overflow-auto overscroll-contain bg-black/90 px-3 py-16 sm:px-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${bulletin?.title ?? "주보"} 크게 보기`}
          onClick={() => setLightboxPageIndex(null)}
        >
          <div className="fixed right-3 top-3 z-[501] flex items-center gap-2 sm:right-6 sm:top-6">
            <a
              href={lightboxPage.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="현재 페이지 새 창으로 열기"
              onClick={(event) => event.stopPropagation()}
            >
              <ZoomIn className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setLightboxPageIndex(null)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="닫기"
            >
              <X className="h-7 w-7" />
            </button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveLightbox(-1);
            }}
            disabled={lightboxPageIndex === 0}
            className="fixed left-2 top-1/2 z-[501] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-20 sm:left-6 sm:h-16 sm:w-16"
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-11 w-11 sm:h-16 sm:w-16" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveLightbox(1);
            }}
            disabled={lightboxPageIndex >= pages.length - 1}
            className="fixed right-2 top-1/2 z-[501] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-20 sm:right-6 sm:h-16 sm:w-16"
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-11 w-11 sm:h-16 sm:w-16" />
          </button>

          <div className="mx-auto w-max max-w-none pb-10" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 text-center text-sm text-white/80">
              {bulletin?.title ?? "주보"} · {lightboxPageIndex + 1} / {pages.length}
            </div>
            <img
              src={lightboxPage.fileUrl}
              alt={`${bulletin?.title ?? "주보"} ${lightboxPageIndex + 1}페이지`}
              className="mx-auto h-auto w-[min(920px,calc(100vw-24px))] max-w-none bg-white sm:w-[min(920px,calc(100vw-64px))]"
            />
          </div>
        </div>
      )}
    </SubPageLayout>
  );
}

export function Bulletin() {
  const { user, loading: authLoading } = useAuth();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, { retry: false });
  const canManage = canManageBoardContent(user, "content:bulletins");
  const canReadBulletins = Boolean(memberMe) || canManage;
  const bulletinsQuery = trpc.home.bulletins.useQuery(undefined, {
    enabled: canReadBulletins,
    retry: false,
  });
  const bulletins = bulletinsQuery.data ?? [];
  const isAccessDenied = !authLoading && !memberLoading && !canReadBulletins;
  const isLoading = authLoading || memberLoading || (canReadBulletins && bulletinsQuery.isLoading);
  const { data: allMenus } = trpc.home.menus.useQuery();
  const [expandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [lightbox, setLightbox] = useState<{ bulletinId: number; pageIndex: number } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const touchStartXRef = useRef<number | null>(null);
  const { parentLabel, sideMenuItems } = getSupportSideMenuItems(allMenus, "/worship/bulletin");
  const filteredBulletins = searchKeyword.trim()
    ? bulletins.filter((bulletin) => bulletin.title.toLowerCase().includes(searchKeyword.trim().toLowerCase()))
    : bulletins;
  const selectedBulletin = filteredBulletins.find((bulletin) => bulletin.id === expandedId) ?? null;
  const selectedPages = selectedBulletin ? getBulletinPages(selectedBulletin) : [];
  const maxSelectedPageIndex = Math.max(selectedPages.length - 1, 0);
  const mobilePageIndex = Math.min(selectedPageIndex, maxSelectedPageIndex);
  const mobilePage = selectedPages[mobilePageIndex] ?? null;
  const lightboxBulletin = lightbox ? bulletins.find((bulletin) => bulletin.id === lightbox.bulletinId) : null;
  const lightboxPages = lightboxBulletin ? getBulletinPages(lightboxBulletin) : [];
  const lightboxPage = lightbox ? lightboxPages[lightbox.pageIndex] : null;
  const lightboxTitle = lightboxBulletin?.title ?? "주보";
  const closeLightbox = () => setLightbox(null);
  const moveSelectedPage = (direction: -1 | 1) => {
    setSelectedPageIndex((current) => Math.min(Math.max(current + direction, 0), maxSelectedPageIndex));
  };
  const handleMobileTouchEnd = (clientX: number) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null || selectedPages.length <= 1) return;
    const deltaX = clientX - startX;
    if (Math.abs(deltaX) < 36) return;
    moveSelectedPage(deltaX < 0 ? 1 : -1);
  };
  const moveLightbox = (direction: -1 | 1) => {
    setLightbox((current) => {
      if (!current) return current;
      const nextIndex = Math.min(Math.max(current.pageIndex + direction, 0), lightboxPages.length - 1);
      return { ...current, pageIndex: nextIndex };
    });
  };
  return (
    <SubPageLayout pageTitle="주보 보기" parentLabel={parentLabel} sideMenuItems={sideMenuItems}>
      <div className="max-w-5xl">
        {isAccessDenied ? (
          <BulletinAccessRequired />
        ) : (
          <>
        <div className="mb-5 border-b border-gray-100 pb-4">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{bulletins.length}</span>개의 주보
            {searchKeyword && <span className="ml-2 text-gray-400">검색 결과 {filteredBulletins.length}개</span>}
          </p>
          <p className="mt-1 text-xs text-gray-400">목록에서 주보를 선택해 미리보고 내려받을 수 있습니다.</p>
        </div>

        {canManage && <BulletinUploadPanel />}

        <div className="mb-4 flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
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
          <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-24" />
              <col className="w-20" />
            </colgroup>
            <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
              <tr>
                <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">첨부</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">조회수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBulletins.map((bulletin, index) => {
                const pageCount = getBulletinPages(bulletin).length;
                return (
                  <tr key={bulletin.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-3 py-3 text-center text-gray-500">{filteredBulletins.length - index}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/worship/bulletin/${bulletin.id}`}
                        className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                      >
                        {bulletin.title}
                        <span className="ml-2 text-[#0F8FB3]">▣</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">관리자</td>
                    <td className="px-3 py-3 text-center text-gray-500">{formatBulletinDate(bulletin.bulletinDate)}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{pageCount}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{bulletin.viewCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {!isLoading && (
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
          {filteredBulletins.map((bulletin, index) => {
            const pages = getBulletinPages(bulletin);
            const coverPage = pages[0] ?? null;
            const hasCoverImage = coverPage ? isImageBulletin(coverPage.fileMime, coverPage.fileName) : false;
            const isGridMode = viewMode === "grid";
            return (
              <article key={bulletin.id} className={isGridMode ? "overflow-hidden border border-gray-200 bg-white p-2.5 sm:p-4" : "p-4"}>
                {isGridMode ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span>번호 {filteredBulletins.length - index}</span>
                      <span>{formatBulletinDate(bulletin.bulletinDate)}</span>
                    </div>
                    <Link href={`/worship/bulletin/${bulletin.id}`} className="mb-2 block">
                      <div className="relative overflow-hidden border border-gray-200 bg-gray-50">
                        <div className="relative aspect-[3/4] w-full">
                          {hasCoverImage && coverPage ? (
                            <img
                              src={coverPage.fileUrl}
                              alt={`${bulletin.title} 대표이미지`}
                              className="absolute inset-0 h-full w-full object-contain p-2"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs text-gray-300">이미지 미리보기 없음</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                    <Link
                      href={`/worship/bulletin/${bulletin.id}`}
                      className="block w-full text-left text-sm font-bold leading-5 text-gray-900"
                    >
                      {bulletin.title}
                    </Link>
                    <p className="mt-1 text-xs font-medium text-[#1B5E20]">관리자 · 첨부 {pages.length}장 · 조회수 {bulletin.viewCount ?? 0}</p>
                  </>
                ) : (
                  <Link href={`/worship/bulletin/${bulletin.id}`} className="flex items-center gap-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-xs font-semibold text-gray-500">
                      {filteredBulletins.length - index}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{bulletin.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{formatBulletinDate(bulletin.bulletinDate)}</span>
                        <span className="text-gray-300">|</span>
                        <span>첨부 {pages.length}장</span>
                        <span className="text-gray-300">|</span>
                        <span>조회수 {bulletin.viewCount ?? 0}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </Link>
                )}
              </article>
            );
          })}
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
              첨부 {selectedPages.length}개
              <span className="mx-2 text-gray-300">|</span>
              조회수 {selectedBulletin.viewCount ?? 0}
            </div>
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="bg-gray-50 p-3 sm:p-5">
                {mobilePage && (
                  <div
                    className="md:hidden"
                    onTouchStart={(event) => {
                      touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                      const clientX = event.changedTouches[0]?.clientX;
                      if (typeof clientX === "number") handleMobileTouchEnd(clientX);
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => moveSelectedPage(-1)}
                        disabled={mobilePageIndex === 0}
                        className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-700 disabled:opacity-30"
                        aria-label="이전 주보 페이지"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 text-center">
                        <p className="text-xs font-semibold text-[#1B5E20]">
                          {mobilePageIndex + 1} / {selectedPages.length}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{mobilePage.fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveSelectedPage(1)}
                        disabled={mobilePageIndex >= selectedPages.length - 1}
                        className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-700 disabled:opacity-30"
                        aria-label="다음 주보 페이지"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>

                    {isImageBulletin(mobilePage.fileMime, mobilePage.fileName) ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ bulletinId: selectedBulletin.id, pageIndex: mobilePageIndex })}
                        className="group block w-full cursor-zoom-in border border-gray-200 bg-white shadow-sm"
                        aria-label={`${selectedBulletin.title} ${mobilePageIndex + 1}페이지 크게 보기`}
                      >
                        <img
                          src={mobilePage.fileUrl}
                          alt={`${selectedBulletin.title} ${mobilePageIndex + 1}페이지`}
                          className="h-auto w-full object-contain"
                        />
                        <span className="flex items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs text-gray-400">
                          <ZoomIn className="h-3.5 w-3.5" />
                          이미지를 누르면 크게 볼 수 있습니다.
                        </span>
                      </button>
                    ) : (
                      <iframe
                        src={mobilePage.fileUrl}
                        title={`${selectedBulletin.title} ${mobilePageIndex + 1}페이지`}
                        className="h-[520px] w-full border border-gray-200 bg-white"
                      />
                    )}

                    {selectedPages.length > 1 && (
                      <p className="mt-3 text-center text-xs text-gray-400">좌우로 밀거나 화살표를 눌러 넘겨보세요.</p>
                    )}
                  </div>
                )}
                <div className="hidden space-y-6 md:block">
                  {selectedPages.map((page, index) => {
                    const isImage = isImageBulletin(page.fileMime, page.fileName);
                    return (
                      <div key={`${page.id}-${page.fileUrl}`} className="mx-auto max-w-[780px]">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                          <span>{index + 1} / {selectedPages.length}</span>
                          <span className="truncate">{page.fileName}</span>
                        </div>
                        {isImage ? (
                          <button
                            type="button"
                            onClick={() => setLightbox({ bulletinId: selectedBulletin.id, pageIndex: index })}
                            className="group block w-full cursor-zoom-in border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                            aria-label={`${selectedBulletin.title} ${index + 1}페이지 크게 보기`}
                          >
                            <img
                              src={page.fileUrl}
                              alt={`${selectedBulletin.title} ${index + 1}페이지`}
                              className="h-auto w-full object-contain"
                            />
                            <span className="flex items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs text-gray-400 group-hover:text-[#1B5E20]">
                              <ZoomIn className="h-3.5 w-3.5" />
                              이미지를 클릭하면 크게 볼 수 있습니다.
                            </span>
                          </button>
                        ) : (
                          <iframe
                            src={page.fileUrl}
                            title={`${selectedBulletin.title} ${index + 1}페이지`}
                            className="h-[720px] w-full border border-gray-200 bg-white"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border border-gray-200 bg-white p-4 text-sm">
                <p className="mb-3 font-semibold text-gray-800">첨부 이미지</p>
                <div className="space-y-2">
                  {selectedPages.map((page, index) => (
                    <a
                      key={`${page.id}-${page.fileUrl}-download`}
                      href={page.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-3 rounded border border-dashed border-gray-200 p-3 text-xs text-gray-500 hover:border-[#1B5E20]/40 hover:bg-[#F1F8E9]"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-700">{index + 1}페이지</span>
                        <span className="mt-0.5 block truncate">{page.fileName}</span>
                        <span className="mt-0.5 block text-gray-400">{formatBulletinFileSize(page.fileSize)}</span>
                      </span>
                      <Download className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#1B5E20]" />
                    </a>
                  ))}
                </div>
                <a
                  href={selectedPages[0]?.fileUrl ?? selectedBulletin.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block w-full border border-[#1B5E20] px-4 py-2 text-center text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
                >
                  첫 페이지 열기
                </a>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {lightbox && lightboxPage && (
        <div
          className="fixed inset-0 z-[500] overflow-auto bg-black/90 px-3 py-16 sm:px-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxTitle} 크게 보기`}
          onClick={closeLightbox}
        >
          <div className="fixed right-3 top-3 z-[501] flex items-center gap-2 sm:right-6 sm:top-6">
            <a
              href={lightboxPage.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="현재 페이지 새 창으로 열기"
              onClick={(event) => event.stopPropagation()}
            >
              <ZoomIn className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={closeLightbox}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="닫기"
            >
              <X className="h-7 w-7" />
            </button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveLightbox(-1);
            }}
            disabled={lightbox.pageIndex === 0}
            className="fixed left-2 top-1/2 z-[501] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-20 sm:left-6 sm:h-16 sm:w-16"
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-11 w-11 sm:h-16 sm:w-16" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveLightbox(1);
            }}
            disabled={lightbox.pageIndex >= lightboxPages.length - 1}
            className="fixed right-2 top-1/2 z-[501] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-20 sm:right-6 sm:h-16 sm:w-16"
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-11 w-11 sm:h-16 sm:w-16" />
          </button>

          <div className="mx-auto max-w-[920px]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 text-center text-sm text-white/80">
              {lightboxTitle} · {lightbox.pageIndex + 1} / {lightboxPages.length}
            </div>
            <img
              src={lightboxPage.fileUrl}
              alt={`${lightboxTitle} ${lightbox.pageIndex + 1}페이지`}
              className="mx-auto h-auto w-full max-w-full bg-white"
            />
          </div>
        </div>
      )}
    </SubPageLayout>
  );
}
