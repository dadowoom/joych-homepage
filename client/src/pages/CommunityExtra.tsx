/**
 * CommunityExtra.tsx
 * 커뮤니티/행정 신규 페이지 모음
 * 디자인: 녹색(#2d6a4f) 포인트 + 통일된 레이아웃
 */

import { Link } from "wouter";
import { ArrowLeft, Users, Camera, MessageCircle, FileText, Building, MapPin, Receipt, Subtitles, ChevronRight } from "lucide-react";

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
        <Link href="/" className="inline-flex items-center gap-2 text-[#2d6a4f] hover:underline mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        {children}
      </div>
    </div>
  );
}

// ── 순모임 ──
const sunGroups = [
  { name: "다윗순", leader: "김성실", members: 8, day: "화요일 오후 7시", place: "교육관 301호" },
  { name: "에스더순", leader: "이믿음", members: 6, day: "목요일 오후 7시 30분", place: "교육관 302호" },
  { name: "바울순", leader: "박소망", members: 10, day: "수요일 오후 8시", place: "교육관 303호" },
  { name: "룻순", leader: "최기쁨", members: 7, day: "금요일 오후 7시", place: "교육관 304호" },
  { name: "요셉순", leader: "정사랑", members: 9, day: "토요일 오전 10시", place: "교육관 305호" },
  { name: "마리아순", leader: "강은혜", members: 5, day: "화요일 오전 10시", place: "교육관 306호" },
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
  return (
    <PageWrapper title="사진" breadcrumb={["커뮤니티", "사진"]}>
      <div className="flex gap-2 flex-wrap mb-8">
        {photoCategories.map((cat, i) => (
          <button key={i} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${i === 0 ? "bg-[#2d6a4f] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative overflow-hidden rounded-xl cursor-pointer">
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
  { author: "김성도", date: "2024.12.15", title: "이번 주 설교 말씀이 너무 은혜로웠어요", content: "목사님의 설교를 듣고 많은 위로를 받았습니다. 특히 요한복음 15장 말씀이 제 마음에 깊이 와닿았어요.", replies: 5 },
  { author: "이믿음", date: "2024.12.14", title: "새벽기도회 참여 후기", content: "처음으로 새벽기도회에 참석했는데 정말 좋았습니다. 조용한 새벽에 하나님과 단둘이 있는 느낌이랄까요.", replies: 3 },
  { author: "박소망", date: "2024.12.13", title: "성탄절 행사 기대됩니다!", content: "이번 성탄절 행사 일정이 어떻게 되나요? 가족들을 데려오고 싶어서요.", replies: 8 },
  { author: "최기쁨", date: "2024.12.12", title: "제자훈련 수료 소감", content: "1년간의 제자훈련을 마쳤습니다. 정말 많이 성장한 것 같아요. 함께한 모든 분들께 감사드립니다.", replies: 12 },
  { author: "정사랑", date: "2024.12.11", title: "오시는 길 질문", content: "처음 방문하는데 주차 공간이 충분한가요? 가족이 4명이라서요.", replies: 4 },
];

export function JoyTalkPage() {
  return (
    <PageWrapper title="기쁨톡" breadcrumb={["커뮤니티", "기쁨톡"]}>
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">성도들이 자유롭게 소통하는 공간입니다.</p>
        <button className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors">
          글쓰기
        </button>
      </div>
      <div className="space-y-4">
        {joyTalkPosts.map((post, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
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
  return (
    <PageWrapper title="자막 신청" breadcrumb={["행정지원", "자막 신청"]}>
      <div className="max-w-2xl">
        <div className="bg-[#d8f3dc] rounded-xl p-6 mb-8">
          <h2 className="font-bold text-[#1b4332] mb-2 flex items-center gap-2">
            <Subtitles className="w-5 h-5" /> 자막 신청 안내
          </h2>
          <ul className="text-gray-700 text-sm space-y-2">
            <li>• 예배 중 특별 광고, 생일 축하, 기념일 등 자막 신청이 가능합니다.</li>
            <li>• 신청은 예배 최소 3일 전까지 완료해 주세요.</li>
            <li>• 신청 내용은 담당자 확인 후 승인됩니다.</li>
          </ul>
        </div>
        <div className="space-y-4">
          {[
            { label: "신청자 이름", type: "text", placeholder: "홍길동" },
            { label: "연락처", type: "tel", placeholder: "010-0000-0000" },
            { label: "자막 내용", type: "text", placeholder: "예: 김성도 집사님 생일을 축하합니다!" },
            { label: "표시 예배", type: "text", placeholder: "예: 12월 22일 주일 1부 예배" },
          ].map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]" />
            </div>
          ))}
          <button className="w-full bg-[#2d6a4f] text-white py-3 rounded-lg font-semibold hover:bg-[#1b4332] transition-colors">
            자막 신청하기
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

// ── 온라인 사무국 ──
const officeServices = [
  { title: "새가족 등록", desc: "처음 오신 분들의 새가족 등록을 도와드립니다.", icon: "👋" },
  { title: "헌금 조회", desc: "온라인으로 헌금 내역을 조회할 수 있습니다.", icon: "💰" },
  { title: "봉사 신청", desc: "교회 각 부서 봉사자 신청을 접수합니다.", icon: "🙌" },
  { title: "증명서 발급", desc: "세례 증명서, 등록 증명서 등 각종 증명서를 발급합니다.", icon: "📄" },
  { title: "상담 신청", desc: "목사님 또는 전도사님과의 상담을 신청합니다.", icon: "💬" },
  { title: "기타 문의", desc: "교회 관련 기타 문의사항을 접수합니다.", icon: "❓" },
];

export function OnlineOfficePage() {
  return (
    <PageWrapper title="온라인 사무국" breadcrumb={["행정지원", "온라인 사무국"]}>
      <p className="text-gray-600 mb-8">온라인으로 교회 행정 서비스를 편리하게 이용하세요.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officeServices.map((service, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all cursor-pointer group">
            <div className="text-3xl mb-3">{service.icon}</div>
            <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#2d6a4f]">{service.title}</h3>
            <p className="text-gray-600 text-sm">{service.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 bg-gray-50 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Building className="w-5 h-5 text-[#2d6a4f]" /> 교회 행정실 운영 시간</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div><p className="font-medium text-gray-800">평일</p><p>월~금 09:00 ~ 18:00</p></div>
          <div><p className="font-medium text-gray-800">주일</p><p>08:00 ~ 14:00</p></div>
        </div>
        <p className="mt-3 text-[#2d6a4f] font-semibold">📞 054-270-1000</p>
      </div>
    </PageWrapper>
  );
}

// ── 탐방 신청 ──
export function VisitRequestPage() {
  return (
    <PageWrapper title="탐방 신청" breadcrumb={["행정지원", "탐방 신청"]}>
      <div className="max-w-2xl">
        <div className="bg-[#d8f3dc] rounded-xl p-6 mb-8">
          <h2 className="font-bold text-[#1b4332] mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> 교회 탐방 안내
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            기쁨의교회를 방문하여 교회 시설과 사역을 직접 경험해 보세요. 탐방 신청 후 담당자가 연락드려 일정을 조율해 드립니다.
            단체 탐방(10인 이상)의 경우 최소 2주 전에 신청해 주세요.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { label: "단체/개인명", type: "text", placeholder: "예: OO교회 청년부" },
            { label: "대표자 이름", type: "text", placeholder: "홍길동" },
            { label: "연락처", type: "tel", placeholder: "010-0000-0000" },
            { label: "방문 인원", type: "number", placeholder: "예: 20" },
            { label: "희망 방문일", type: "date", placeholder: "" },
            { label: "탐방 목적", type: "text", placeholder: "예: 교회 사역 벤치마킹" },
          ].map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]" />
            </div>
          ))}
          <button className="w-full bg-[#2d6a4f] text-white py-3 rounded-lg font-semibold hover:bg-[#1b4332] transition-colors">
            탐방 신청하기
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

// ── 기부금 영수증 ──
export function DonationReceiptPage() {
  return (
    <PageWrapper title="기부금 영수증" breadcrumb={["행정지원", "기부금 영수증"]}>
      <div className="max-w-2xl">
        <div className="bg-[#d8f3dc] rounded-xl p-6 mb-8">
          <h2 className="font-bold text-[#1b4332] mb-2 flex items-center gap-2">
            <Receipt className="w-5 h-5" /> 기부금 영수증 발급 안내
          </h2>
          <ul className="text-gray-700 text-sm space-y-2">
            <li>• 기부금 영수증은 연말정산 시 소득공제를 받을 수 있습니다.</li>
            <li>• 발급 기간: 매년 1월 1일 ~ 2월 28일</li>
            <li>• 발급 방법: 온라인 신청 또는 교회 행정실 방문</li>
            <li>• 문의: 054-270-1000 (행정실)</li>
          </ul>
        </div>
        <div className="space-y-4">
          {[
            { label: "성명", type: "text", placeholder: "홍길동" },
            { label: "주민등록번호 앞 6자리", type: "text", placeholder: "000000" },
            { label: "연락처", type: "tel", placeholder: "010-0000-0000" },
            { label: "이메일 (영수증 수신)", type: "email", placeholder: "example@email.com" },
            { label: "발급 연도", type: "text", placeholder: "예: 2024" },
          ].map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]" />
            </div>
          ))}
          <button className="w-full bg-[#2d6a4f] text-white py-3 rounded-lg font-semibold hover:bg-[#1b4332] transition-colors">
            영수증 발급 신청
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
