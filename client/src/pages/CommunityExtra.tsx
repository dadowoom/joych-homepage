/**
 * CommunityExtra.tsx
 * 커뮤니티/행정 신규 페이지 모음
 * 디자인: 녹색(#2d6a4f) 포인트 + 통일된 레이아웃
 */

import { Fragment, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Users, MessageCircle, Building, MapPin, Receipt, ChevronRight, Phone, FileText, Paperclip, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import SubPageLayout from "@/components/SubPageLayout";
import { getSupportSideMenuItems } from "@/lib/supportSideMenu";
import { ViewModeToggle, type ViewMode } from "@/components/dynamic-page/ViewModeToggle";

function notifyOfficeContact(serviceName: string) {
  window.alert(`${serviceName} 온라인 접수 기능은 준비 중입니다. 교회 행정실(054-270-1000)로 문의해 주세요.`);
}

function OfficeContactBox({ serviceName }: { serviceName: string }) {
  return (
    <div className="rounded-xl border border-[#d8f3dc] bg-[#f1f8f3] p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <Phone className="w-5 h-5 text-[#2d6a4f]" />
        </div>
        <div>
          <h3 className="font-bold text-[#1b4332] mb-2">온라인 접수 준비 중</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {serviceName}은 현재 홈페이지에서 바로 저장되지 않습니다. 접수나 상담이 필요하시면 교회 행정실로 문의해 주세요.
          </p>
          <p className="mt-3 text-[#2d6a4f] font-semibold">054-270-1000</p>
        </div>
      </div>
    </div>
  );
}

// ── 공통 페이지 래퍼 ──
function PageWrapper({ title, breadcrumb, children }: { title: string; breadcrumb: string[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* 상단 배너 */}
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

function SupportPageWrapper({
  title,
  activeHref,
  children,
}: {
  title: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  const { data: allMenus } = trpc.home.menus.useQuery();
  const { parentLabel, sideMenuItems } = getSupportSideMenuItems(allMenus, activeHref);

  return (
    <SubPageLayout pageTitle={title} parentLabel={parentLabel} sideMenuItems={sideMenuItems}>
      {children}
    </SubPageLayout>
  );
}

// ── 순모임 ──
const sunGroups = [
  { name: "순모임 1", leader: "담당 순장", members: 8, day: "화요일 오후 7시", place: "교육관 301호" },
  { name: "순모임 2", leader: "담당 순장", members: 6, day: "목요일 오후 7시 30분", place: "교육관 302호" },
  { name: "순모임 3", leader: "담당 순장", members: 10, day: "수요일 오후 8시", place: "교육관 303호" },
  { name: "순모임 4", leader: "담당 순장", members: 7, day: "금요일 오후 7시", place: "교육관 304호" },
  { name: "순모임 5", leader: "담당 순장", members: 9, day: "토요일 오전 10시", place: "교육관 305호" },
  { name: "순모임 6", leader: "담당 순장", members: 5, day: "화요일 오전 10시", place: "교육관 306호" },
];

export function SunMeetingPage() {
  return (
    <PageWrapper title="순모임" breadcrumb={["커뮤니티", "순모임"]}>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-4 font-['Noto_Serif_KR']">소그룹 순모임 안내</h2>
        <p className="text-gray-600 leading-relaxed">
          순모임은 기쁨의교회의 핵심 소그룹 공동체입니다. 10명 내외의 소그룹으로 모여 말씀을 나누고, 서로의 삶을 돌보며, 함께 기도합니다.
          새가족이시라면 담당 전도사님을 통해 가장 가까운 순모임에 연결해 드립니다.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {sunGroups.map((g, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#d8f3dc] rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{g.name}</h3>
                <p className="text-sm text-gray-500">순장: {g.leader}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>👥 구성원: {g.members}명</p>
              <p>📅 모임: {g.day}</p>
              <p>📍 장소: {g.place}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#d8f3dc] rounded-xl p-6">
        <h3 className="font-bold text-[#1b4332] mb-2">순모임 참여 신청</h3>
        <p className="text-gray-700 text-sm mb-4">새가족이시거나 순모임에 참여를 원하시면 교회 행정실로 연락해 주세요.</p>
        <p className="text-[#2d6a4f] font-semibold">📞 054-270-1000</p>
      </div>
    </PageWrapper>
  );
}

// ── 자치기관 ──
const organizations = [
  { name: "기쁨의교회 남선교회", desc: "교회 내 남성 성도들의 신앙 공동체. 매월 첫째 주 토요일 모임.", icon: "🙏" },
  { name: "기쁨의교회 여선교회", desc: "교회 내 여성 성도들의 신앙 공동체. 다양한 봉사와 선교 활동 전개.", icon: "🌸" },
  { name: "기쁨의교회 청년회", desc: "19~35세 청년들의 자치 기관. 청년 문화 사역 및 봉사 활동.", icon: "✨" },
  { name: "기쁨의교회 장로회", desc: "교회 장로들의 협의 기관. 교회 행정과 영적 지도력 담당.", icon: "⚓" },
  { name: "기쁨의교회 권사회", desc: "교회 권사들의 협의 기관. 중보기도와 성도 돌봄 사역.", icon: "💐" },
  { name: "기쁨의교회 집사회", desc: "교회 집사들의 협의 기관. 교회 봉사와 섬김 사역 담당.", icon: "🤝" },
];

export function OrganizationPage() {
  return (
    <PageWrapper title="자치기관" breadcrumb={["커뮤니티", "자치기관"]}>
      <p className="text-gray-600 mb-8 leading-relaxed">
        기쁨의교회 각 자치기관은 교회 공동체를 더욱 풍성하게 세워가는 중요한 역할을 담당합니다. 각 기관은 자체적인 모임과 활동을 통해 성도들의 신앙 성장과 교회 사역에 헌신합니다.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        {organizations.map((org, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex gap-4">
            <div className="text-3xl">{org.icon}</div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">{org.name}</h3>
              <p className="text-gray-600 text-sm">{org.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 동호회 ──
const clubs = [
  { name: "기쁨 산악회", desc: "매월 둘째 주 토요일 등산 모임. 자연 속에서 하나님의 창조를 느끼며 교제합니다.", members: 35, icon: "⛰️" },
  { name: "기쁨 독서클럽", desc: "매월 한 권의 책을 함께 읽고 나누는 독서 모임. 신앙 서적 중심.", members: 20, icon: "📚" },
  { name: "기쁨 테니스회", desc: "매주 토요일 오전 테니스 모임. 초보자도 환영합니다.", members: 18, icon: "🎾" },
  { name: "기쁨 사진클럽", desc: "사진을 통해 하나님의 아름다운 세계를 기록하는 모임.", members: 15, icon: "📷" },
  { name: "기쁨 요리클럽", desc: "함께 요리하고 나누는 친교 모임. 매월 셋째 주 토요일.", members: 22, icon: "🍳" },
  { name: "기쁨 골프회", desc: "골프를 통한 성도 간 친목 도모. 월 1회 라운딩.", members: 25, icon: "⛳" },
];

export function ClubPage() {
  return (
    <PageWrapper title="동호회" breadcrumb={["커뮤니티", "동호회"]}>
      <p className="text-gray-600 mb-8 leading-relaxed">
        기쁨의교회 동호회는 같은 취미를 가진 성도들이 함께 모여 교제하고 신앙을 나누는 공동체입니다. 새로운 동호회 창설을 원하시면 교회 행정실로 문의해 주세요.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clubs.map((club, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-3">{club.icon}</div>
            <h3 className="font-bold text-gray-900 mb-2">{club.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{club.desc}</p>
            <p className="text-[#2d6a4f] text-sm font-semibold">👥 회원 {club.members}명</p>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 사진 갤러리 ──
const photoCategories = ["전체", "주일예배", "행사", "선교", "교회학교", "친교"];
const photos = [
  { id: 1, title: "2024 성탄절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80" },
  { id: 2, title: "여름 수련회", category: "행사", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { id: 3, title: "단기 선교팀 파송", category: "선교", img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80" },
  { id: 4, title: "새가족 환영회", category: "친교", img: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80" },
  { id: 5, title: "추수감사절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=400&q=80" },
  { id: 6, title: "청년부 MT", category: "교회학교", img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80" },
  { id: 7, title: "어린이날 행사", category: "교회학교", img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80" },
  { id: 8, title: "부활절 예배", category: "주일예배", img: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80" },
  { id: 9, title: "교회 창립 기념일", category: "행사", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80" },
  { id: 10, title: "겨울 수련회", category: "행사", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { id: 11, title: "선교사 파송 예배", category: "선교", img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80" },
  { id: 12, title: "성도 체육대회", category: "친교", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
];

export function PhotoPage() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const visiblePhotos = activeCategory === "전체" ? photos : photos.filter((photo) => photo.category === activeCategory);

  return (
    <PageWrapper title="사진" breadcrumb={["커뮤니티", "사진"]}>
      <div className="flex gap-2 flex-wrap mb-8">
        {photoCategories.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat ? "bg-[#2d6a4f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visiblePhotos.map((photo) => (
          <div key={photo.id} className="group relative overflow-hidden rounded-xl">
            <img src={photo.img} alt={photo.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80"; }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <p className="text-white text-sm font-medium">{photo.title}</p>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 기쁨톡 ──
const joyTalkPosts = [
  { author: "기쁨의교회", date: "공지 예정", title: "기쁨톡 게시판은 준비 중입니다", content: "성도 나눔 게시판은 운영 정책과 개인정보 보호 기준을 확정한 뒤 제공됩니다.", replies: 0 },
];

export function JoyTalkPage() {
  return (
    <PageWrapper title="기쁨톡" breadcrumb={["커뮤니티", "기쁨톡"]}>
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">성도들이 자유롭게 소통하는 공간입니다.</p>
        <button
          type="button"
          onClick={() => notifyOfficeContact("기쁨톡 글쓰기")}
          className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors"
        >
          글쓰기
        </button>
      </div>
      <div className="space-y-4">
        {joyTalkPosts.map((post, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 hover:text-[#2d6a4f]">{post.title}</h3>
              <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">{post.date}</span>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.content}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>✍️ {post.author}</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.replies}개의 댓글</span>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 자막 신청 ──
export function SubtitleRequestPage() {
  const utils = trpc.useUtils();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: subtitleRequests = [], isLoading } = trpc.support.listSubtitles.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    authorName: "",
    phone: "",
    email: "",
    requestedDate: "",
    content: "",
  });

  const resetForm = () => {
    setForm({
      title: "",
      authorName: "",
      phone: "",
      email: "",
      requestedDate: "",
      content: "",
    });
    setSelectedFile(null);
    setShowForm(false);
  };

  const submitSubtitle = trpc.support.submitSubtitle.useMutation({
    onSuccess: () => {
      toast.success("자막 신청이 접수되었습니다.");
      resetForm();
      setPage(1);
      utils.support.listSubtitles.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pageSize = 15;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredRequests = normalizedKeyword
    ? subtitleRequests.filter((request) => {
        const titleText = request.title.toLowerCase();
        const authorText = request.authorName.toLowerCase();
        const contentText = request.content.toLowerCase();
        if (searchField === "author") return authorText.includes(normalizedKeyword);
        if (searchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : subtitleRequests;
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleRequests = filteredRequests.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newRequestCount = filteredRequests.filter((request) => isToday(request.createdAt)).length;

  const handleWriteClick = () => {
    if (!memberLoading && !memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/subtitle")}`;
      return;
    }
    setShowForm((value) => !value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/subtitle")}`;
      return;
    }

    let attachment: { fileName: string; mimeType: string; base64: string } | undefined;
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("첨부파일은 최대 10MB까지 업로드할 수 있습니다.");
        return;
      }
      try {
        attachment = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          base64: await fileToBase64(selectedFile),
        };
      } catch {
        toast.error("첨부파일을 읽는 중 문제가 발생했습니다.");
        return;
      }
    }

    submitSubtitle.mutate({
      title: form.title,
      requestedDate: form.requestedDate || undefined,
      content: form.content,
      attachment,
    });
  };

  const isSaving = submitSubtitle.isPending;

  return (
    <SupportPageWrapper title="자막 신청" activeHref="/support/subtitle">
      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                총 <span className="font-semibold text-[#1B5E20]">{subtitleRequests.length}</span>개의 신청
                {searchKeyword && (
                  <span className="ml-2 text-gray-400">검색 결과 {filteredRequests.length}개</span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                예배 자막, 광고, 찬양 가사 요청을 접수합니다. 첨부파일은 관리자만 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWriteClick}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
            >
              {showForm ? "작성 닫기" : "자막 신청서 작성"}
            </button>
          </div>
        </div>

        {!memberLoading && !memberMe && (
          <div className="border border-[#d8f3dc] bg-[#f1f8f3] px-5 py-4 text-sm text-gray-700">
            자막신청은 로그인한 성도만 작성할 수 있습니다.
            <Link href="/member/login?next=/support/subtitle" className="ml-2 font-semibold text-[#1B5E20] underline-offset-2 hover:underline">
              성도 로그인
            </Link>
          </div>
        )}

        {showForm && memberMe && (
          <div className="border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  자막 신청서
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  작성자: {memberMe.name} · 연락처 {memberMe.phone || "미등록"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="작성 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="예: 6월 7일 2부 예배 특송 자막"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">작성자</label>
                  <input
                    type="text"
                    readOnly
                    value={memberMe.name ?? ""}
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">연락처</label>
                  <input
                    type="tel"
                    readOnly
                    value={memberMe.phone ?? "미등록"}
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    readOnly
                    value={memberMe.email ?? "미등록"}
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">자막 필요일</label>
                  <input
                    type="date"
                    value={form.requestedDate}
                    onChange={(event) => setForm({ ...form, requestedDate: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청 내용</label>
                  <textarea
                    required
                    rows={7}
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="예배 시간, 자막 문구, 필요한 표시 방식 등을 적어 주세요."
                    className="w-full resize-y border border-gray-200 px-4 py-3 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">첨부파일</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#1B5E20]/30 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]">
                      <Paperclip className="h-4 w-4" />
                      파일 선택
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && file.size > 10 * 1024 * 1024) {
                            toast.error("첨부파일은 최대 10MB까지 업로드할 수 있습니다.");
                            event.currentTarget.value = "";
                            return;
                          }
                          setSelectedFile(file);
                        }}
                      />
                    </label>
                    <span className="min-w-0 truncate text-sm text-gray-500">
                      {selectedFile ? selectedFile.name : "PDF, DOCX, HWP, TXT, JPG, PNG / 최대 10MB"}
                    </span>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        파일 제거
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  {isSaving ? "접수 중..." : "신청"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <span>새 글 {newRequestCount} / {filteredRequests.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
              setPage(1);
            }}
          >
            <select
              value={searchField}
              onChange={(event) => setSearchField(event.target.value)}
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
            >
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">작성자</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
              aria-label="검색"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">등록된 자막 신청이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-16" />
                  <col />
                  <col className="w-28" />
                  <col className="w-32" />
                  <col className="w-20" />
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
                  {visibleRequests.map((request, index) => {
                    const requestNumber = filteredRequests.length - (pageStart + index);
                    const isExpanded = expandedId === request.id;
                    return (
                      <Fragment key={request.id}>
                        <tr className="transition-colors hover:bg-gray-50">
                          <td className="px-3 py-3 text-center text-gray-500">{requestNumber}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : request.id)}
                              className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                              aria-expanded={isExpanded}
                            >
                              {request.title}
                              {request.attachmentName && (
                                <Paperclip className="ml-2 inline h-3.5 w-3.5 text-[#0F8FB3]" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">{request.authorName}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatSupportDate(request.createdAt)}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{request.attachmentName ? "있음" : "-"}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={5} className="px-8 py-5">
                              <div className="mb-3 text-xs text-gray-400">
                                자막 필요일 {request.requestedDate || "-"}
                                <span className="mx-2 text-gray-300">|</span>
                                처리상태 {request.status === "completed" ? "처리완료" : "접수"}
                              </div>
                              <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                                {request.content}
                              </div>
                              {request.adminMemo && (
                                <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-4 py-3">
                                  <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                                  <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                                </div>
                              )}
                              {request.attachmentName && (
                                <p className="mt-3 text-xs text-[#0F607A]">
                                  첨부파일은 관리자 확인용으로 접수되었습니다.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
              {visibleRequests.map((request, index) => {
                const requestNumber = filteredRequests.length - (pageStart + index);
                const isExpanded = expandedId === request.id;
                return (
                  <article key={request.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span>번호 {requestNumber}</span>
                      <span>{formatSupportDate(request.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      className="block w-full text-left text-base font-bold text-gray-900"
                      aria-expanded={isExpanded}
                    >
                      {request.title}
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#1B5E20]">{request.authorName}</span>
                      {request.attachmentName && <Paperclip className="h-3.5 w-3.5 text-[#0F8FB3]" />}
                    </div>
                    {isExpanded && (
                      <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                        <p className="mb-2 text-xs text-gray-400">자막 필요일 {request.requestedDate || "-"}</p>
                        <p className="whitespace-pre-line">{request.content}</p>
                        {request.adminMemo && (
                          <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-3 py-3">
                            <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                            <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                          </div>
                        )}
                        {request.attachmentName && (
                          <p className="mt-3 text-xs text-[#0F607A]">첨부파일은 관리자 확인용으로 접수되었습니다.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {filteredRequests.length > pageSize && (
              <div className="flex justify-center gap-1">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm ${
                      activePage === pageNumber
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20]"
                    }`}
                    aria-current={activePage === pageNumber ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SupportPageWrapper>
  );
}

// ── 주보 광고신청 ──
export function BulletinAdRequestPage() {
  const utils = trpc.useUtils();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: requests = [], isLoading } = trpc.support.listBulletinAds.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    requestedDate: "",
    content: "",
  });

  const resetForm = () => {
    setForm({
      title: "",
      requestedDate: "",
      content: "",
    });
    setSelectedFile(null);
    setShowForm(false);
  };

  const submitBulletinAd = trpc.support.submitBulletinAd.useMutation({
    onSuccess: () => {
      toast.success("주보 광고신청이 접수되었습니다.");
      resetForm();
      setPage(1);
      utils.support.listBulletinAds.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pageSize = 15;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredRequests = normalizedKeyword
    ? requests.filter((request) => {
        const titleText = request.title.toLowerCase();
        const authorText = request.authorName.toLowerCase();
        const contentText = request.content.toLowerCase();
        if (searchField === "author") return authorText.includes(normalizedKeyword);
        if (searchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : requests;
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleRequests = filteredRequests.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newRequestCount = filteredRequests.filter((request) => isToday(request.createdAt)).length;

  const handleWriteClick = () => {
    if (!memberLoading && !memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/bulletin-ad")}`;
      return;
    }
    setShowForm((value) => !value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/bulletin-ad")}`;
      return;
    }

    let attachment: { fileName: string; mimeType: string; base64: string } | undefined;
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("첨부파일은 최대 10MB까지 업로드할 수 있습니다.");
        return;
      }
      try {
        attachment = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          base64: await fileToBase64(selectedFile),
        };
      } catch {
        toast.error("첨부파일을 읽는 중 문제가 발생했습니다.");
        return;
      }
    }

    submitBulletinAd.mutate({
      ...form,
      requestedDate: form.requestedDate || undefined,
      attachment,
    });
  };

  const isSaving = submitBulletinAd.isPending;

  return (
    <SupportPageWrapper title="주보 광고신청" activeHref="/support/bulletin-ad">
      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                총 <span className="font-semibold text-[#1B5E20]">{requests.length}</span>개의 신청
                {searchKeyword && (
                  <span className="ml-2 text-gray-400">검색 결과 {filteredRequests.length}개</span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                주보에 실릴 광고, 부서 안내, 행사 안내 요청을 접수합니다. 연락처와 첨부파일은 관리자만 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWriteClick}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
            >
              {showForm ? "작성 닫기" : "주보 광고신청서 작성"}
            </button>
          </div>
        </div>

        {!memberLoading && !memberMe && (
          <div className="border border-[#d8f3dc] bg-[#f1f8f3] px-5 py-4 text-sm text-gray-700">
            주보 광고신청은 로그인한 성도만 작성할 수 있습니다.
            <Link href="/member/login?next=/support/bulletin-ad" className="ml-2 font-semibold text-[#1B5E20] underline-offset-2 hover:underline">
              성도 로그인
            </Link>
          </div>
        )}

        {showForm && memberMe && (
          <div className="border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  주보 광고신청서
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  작성자: {memberMe.name} · 연락처 {memberMe.phone || "미등록"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="작성 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="예: 6월 14일 주보 광고 요청"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">게재 희망일</label>
                  <input
                    type="date"
                    value={form.requestedDate}
                    onChange={(event) => setForm({ ...form, requestedDate: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">작성자</label>
                  <input
                    type="text"
                    readOnly
                    value={memberMe.name ?? ""}
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청 내용</label>
                  <textarea
                    required
                    rows={7}
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="주보에 실릴 문구, 게재 희망 주차, 담당 부서, 참고사항 등을 적어 주세요."
                    className="w-full resize-y border border-gray-200 px-4 py-3 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">첨부파일</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#1B5E20]/30 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]">
                      <Paperclip className="h-4 w-4" />
                      파일 선택
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && file.size > 10 * 1024 * 1024) {
                            toast.error("첨부파일은 최대 10MB까지 업로드할 수 있습니다.");
                            event.currentTarget.value = "";
                            return;
                          }
                          setSelectedFile(file);
                        }}
                      />
                    </label>
                    <span className="min-w-0 truncate text-sm text-gray-500">
                      {selectedFile ? selectedFile.name : "PDF, DOCX, HWP, TXT, JPG, PNG / 최대 10MB"}
                    </span>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        파일 제거
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  {isSaving ? "접수 중..." : "신청"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <span>새 글 {newRequestCount} / {filteredRequests.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
              setPage(1);
            }}
          >
            <select
              value={searchField}
              onChange={(event) => setSearchField(event.target.value)}
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
            >
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">작성자</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
              aria-label="검색"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">등록된 주보 광고신청이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-16" />
                  <col />
                  <col className="w-28" />
                  <col className="w-32" />
                  <col className="w-20" />
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
                  {visibleRequests.map((request, index) => {
                    const requestNumber = filteredRequests.length - (pageStart + index);
                    const isExpanded = expandedId === request.id;
                    return (
                      <Fragment key={request.id}>
                        <tr className="transition-colors hover:bg-gray-50">
                          <td className="px-3 py-3 text-center text-gray-500">{requestNumber}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : request.id)}
                              className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                              aria-expanded={isExpanded}
                            >
                              {request.title}
                              {request.attachmentName && (
                                <Paperclip className="ml-2 inline h-3.5 w-3.5 text-[#0F8FB3]" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">{request.authorName}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatSupportDate(request.createdAt)}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{request.attachmentName ? "있음" : "-"}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={5} className="px-8 py-5">
                              <div className="mb-3 text-xs text-gray-400">
                                게재 희망일 {request.requestedDate || "-"}
                                <span className="mx-2 text-gray-300">|</span>
                                처리상태 {request.status === "completed" ? "처리완료" : "접수"}
                              </div>
                              <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                                {request.content}
                              </div>
                              {request.adminMemo && (
                                <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-4 py-3">
                                  <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                                  <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                                </div>
                              )}
                              {request.attachmentName && (
                                <p className="mt-3 text-xs text-[#0F607A]">
                                  첨부파일은 관리자 확인용으로 접수되었습니다.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
              {visibleRequests.map((request, index) => {
                const requestNumber = filteredRequests.length - (pageStart + index);
                const isExpanded = expandedId === request.id;
                return (
                  <article key={request.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span>번호 {requestNumber}</span>
                      <span>{formatSupportDate(request.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      className="block w-full text-left text-base font-bold text-gray-900"
                      aria-expanded={isExpanded}
                    >
                      {request.title}
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#1B5E20]">{request.authorName}</span>
                      {request.attachmentName && <Paperclip className="h-3.5 w-3.5 text-[#0F8FB3]" />}
                    </div>
                    {isExpanded && (
                      <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                        <p className="mb-2 text-xs text-gray-400">게재 희망일 {request.requestedDate || "-"}</p>
                        <p className="whitespace-pre-line">{request.content}</p>
                        {request.adminMemo && (
                          <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-3 py-3">
                            <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                            <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                          </div>
                        )}
                        {request.attachmentName && (
                          <p className="mt-3 text-xs text-[#0F607A]">첨부파일은 관리자 확인용으로 접수되었습니다.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {filteredRequests.length > pageSize && (
              <div className="flex justify-center gap-1">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm ${
                      activePage === pageNumber
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20]"
                    }`}
                    aria-current={activePage === pageNumber ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SupportPageWrapper>
  );
}

// ── 온라인 사무국 ──
const officeServices = [
  { title: "새가족 등록", desc: "새가족 등록 신청 화면으로 이동하여 접수할 수 있습니다.", icon: "👋", href: "/support/new-member" },
  { title: "주보 광고신청", desc: "성도 로그인 후 주보 광고와 부서 안내 게재를 신청할 수 있습니다.", icon: "📰", href: "/support/bulletin-ad" },
  { title: "헌금 조회", desc: "현재 온라인 조회는 준비 중입니다. 행정실로 문의해 주세요.", icon: "💰" },
  { title: "봉사 신청", desc: "현재 온라인 접수는 준비 중입니다. 담당 부서 또는 행정실로 문의해 주세요.", icon: "🙌" },
  { title: "증명서 발급", desc: "현재 온라인 발급은 준비 중입니다. 필요한 서류는 행정실로 문의해 주세요.", icon: "📄" },
  { title: "상담 신청", desc: "현재 온라인 접수는 준비 중입니다. 행정실로 연락해 일정을 문의해 주세요.", icon: "💬" },
  { title: "기타 문의", desc: "교회 관련 문의는 행정실에서 안내해 드립니다.", icon: "❓" },
];

export function OnlineOfficePage() {
  return (
    <SupportPageWrapper title="온라인 사무국" activeHref="/support/office">
      <p className="text-gray-600 mb-8">현재 온라인 처리 기능은 순차 준비 중입니다. 접수 가능한 항목과 행정실 문의 항목을 구분해 안내합니다.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officeServices.map((service, i) => {
          const commonClass =
            "text-left border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all cursor-pointer group";

          if (service.href) {
            return (
              <Link key={i} href={service.href} className={commonClass}>
                <div className="text-3xl mb-3">{service.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#2d6a4f]">{service.title}</h3>
                <p className="text-gray-600 text-sm">{service.desc}</p>
              </Link>
            );
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => notifyOfficeContact(service.title)}
              className={commonClass}
            >
              <div className="text-3xl mb-3">{service.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#2d6a4f]">{service.title}</h3>
              <p className="text-gray-600 text-sm">{service.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-10 bg-gray-50 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Building className="w-5 h-5 text-[#2d6a4f]" /> 교회 행정실 운영 시간</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div><p className="font-medium text-gray-800">평일</p><p>월~금 09:00 ~ 18:00</p></div>
          <div><p className="font-medium text-gray-800">주일</p><p>08:00 ~ 14:00</p></div>
        </div>
        <p className="mt-3 text-[#2d6a4f] font-semibold">📞 054-270-1000</p>
      </div>
    </SupportPageWrapper>
  );
}

// ── 탐방 신청 ──
export function VisitRequestPage() {
  return <VisitRequestApplicationPage />;
}

// ── 탐방 신청서 ──
export function VisitRequestApplicationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    applicantName: "",
    phone: "",
    email: "",
    visitDate: "",
    visitTime: "",
    headcount: "1",
    visitorType: "church",
    purpose: "",
    message: "",
    agreePrivacy: false,
  });

  const submitVisit = trpc.support.submitVisit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setForm({
        organizationName: "",
        applicantName: "",
        phone: "",
        email: "",
        visitDate: "",
        visitTime: "",
        headcount: "1",
        visitorType: "church",
        purpose: "",
        message: "",
        agreePrivacy: false,
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.agreePrivacy) {
      toast.error("개인정보 수집 및 이용에 동의해 주세요.");
      return;
    }

    submitVisit.mutate({
      organizationName: form.organizationName,
      applicantName: form.applicantName,
      phone: form.phone,
      email: form.email,
      visitDate: form.visitDate,
      visitTime: form.visitTime || undefined,
      headcount: Math.max(1, Number(form.headcount) || 1),
      visitorType: form.visitorType as "church" | "institution" | "individual" | "other",
      purpose: form.purpose,
      message: form.message,
    });
  };

  return (
    <SupportPageWrapper title="탐방 신청" activeHref="/support/tour">
      <div className="max-w-4xl">
        {submitted ? (
          <div className="border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
              <i className="fas fa-check text-2xl text-[#1B5E20]" />
            </div>
            <h2 className="mb-3 text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              탐방신청이 접수되었습니다
            </h2>
            <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-gray-500">
              담당자가 신청 내용을 확인한 뒤 일정 가능 여부와 안내 사항을 연락드리겠습니다.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="bg-[#1B5E20] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32]"
            >
              추가 신청하기
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="flex items-center gap-2 font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                <MapPin className="h-5 w-5 text-[#1B5E20]" /> 탐방신청 글쓰기
              </h2>
              <p className="mt-1 text-xs text-gray-400">작성한 신청 내용은 관리자만 확인합니다.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">교회명 / 단체명</label>
                  <input
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                    placeholder="예: ○○교회, ○○기관"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청자 이름</label>
                  <input
                    type="text"
                    required
                    value={form.applicantName}
                    onChange={(event) => setForm({ ...form, applicantName: event.target.value })}
                    placeholder="담당자 이름"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">연락처</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="name@example.com"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 희망일</label>
                  <input
                    type="date"
                    required
                    value={form.visitDate}
                    onChange={(event) => setForm({ ...form, visitDate: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 희망 시간</label>
                  <input
                    type="time"
                    value={form.visitTime}
                    onChange={(event) => setForm({ ...form, visitTime: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 인원</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={form.headcount}
                    onChange={(event) => setForm({ ...form, headcount: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청 구분</label>
                  <select
                    value={form.visitorType}
                    onChange={(event) => setForm({ ...form, visitorType: event.target.value })}
                    className="w-full border border-gray-200 bg-white px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  >
                    <option value="church">교회</option>
                    <option value="institution">기관 / 단체</option>
                    <option value="individual">개인</option>
                    <option value="other">기타</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">탐방 목적</label>
                <input
                  type="text"
                  required
                  value={form.purpose}
                  onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                  placeholder="예: 교회 시설 탐방, 사역 운영 사례 견학, 예배 방문"
                  className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">탐방 내용 / 요청사항</label>
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  rows={5}
                  placeholder="탐방하고 싶은 내용, 관심 사역, 안내가 필요한 내용을 자유롭게 적어 주세요."
                  className="w-full resize-none border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                />
              </div>

              <label className="flex items-start gap-3 border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.agreePrivacy}
                  onChange={(event) => setForm({ ...form, agreePrivacy: event.target.checked })}
                  className="mt-1"
                />
                <span>
                  탐방 신청 접수 및 연락을 위해 입력한 개인정보를 수집·이용하는 데 동의합니다.
                  <span className="text-red-500"> *</span>
                </span>
              </label>

              {submitVisit.error && (
                <p className="text-center text-sm text-red-500">{submitVisit.error.message}</p>
              )}

              <div className="border-t border-gray-100 pt-5">
                <button
                  type="submit"
                  disabled={submitVisit.isPending}
                  className="w-full bg-[#1B5E20] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitVisit.isPending ? "등록 중..." : "탐방신청 글 등록하기"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </SupportPageWrapper>
  );
}

function formatSupportDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function isToday(value: string | Date | null | undefined) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export function DonationReceiptPage() {
  return (
    <SupportPageWrapper title="기부금 영수증" activeHref="/support/donation">
      <div className="max-w-2xl">
        <div className="bg-[#d8f3dc] rounded-xl p-6 mb-8">
          <h2 className="font-bold text-[#1b4332] mb-2 flex items-center gap-2">
            <Receipt className="w-5 h-5" /> 기부금 영수증 발급 안내
          </h2>
          <ul className="text-gray-700 text-sm space-y-2">
            <li>• 기부금 영수증은 연말정산 시 소득공제를 받을 수 있습니다.</li>
            <li>• 발급 기간: 매년 1월 1일 ~ 2월 28일</li>
            <li>• 발급은 교회 행정실 문의 후 안내받아 주세요.</li>
            <li>• 문의: 054-270-1000 (행정실)</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-4">
          <p className="text-sm text-amber-900 leading-relaxed">
            주민등록번호 등 민감한 개인정보는 홈페이지 입력폼으로 받지 않습니다. 안전한 발급을 위해 교회 행정실을 통해 안내받아 주세요.
          </p>
        </div>
        <OfficeContactBox serviceName="기부금 영수증 발급" />
        <button
          type="button"
          onClick={() => notifyOfficeContact("기부금 영수증 발급")}
          className="mt-4 w-full bg-[#2d6a4f] text-white py-3 rounded-lg font-semibold hover:bg-[#1b4332] transition-colors"
        >
          행정실 문의 안내
        </button>
      </div>
    </SupportPageWrapper>
  );
}
