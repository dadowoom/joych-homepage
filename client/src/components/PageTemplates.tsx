/**
 * PageTemplates.tsx
 * 
 * 재사용 가능한 페이지 템플릿 컴포넌트 모음
 * 디자인 철학: 녹색(#2d6a4f) 포인트 + Noto Serif KR + 카드 레이아웃 통일
 * 
 * 포함된 템플릿:
 * 1. VideoListPage  - 영상 목록 페이지 (조이풀TV 하위 메뉴 공용)
 * 2. MinistryPage   - 사역/부서 소개 페이지 (사역부, 선교부 등 공용)
 * 3. DepartmentPage - 교회학교 부서 소개 페이지 공용
 * 4. PageBanner     - 공통 상단 배너 컴포넌트
 * 5. SimplePage     - 단순 텍스트/이미지 소개 페이지 공용
 */

import { Link } from "wouter";
import { ChevronRight, Play, Calendar, Users, BookOpen, Heart, ArrowLeft } from "lucide-react";

// ─────────────────────────────────────────────
// 공통 상단 배너
// ─────────────────────────────────────────────
interface PageBannerProps {
  title: string;
  subtitle?: string;
  breadcrumb: string[];
  bgColor?: string;
}

export function PageBanner({ title, subtitle, breadcrumb, bgColor = "bg-[#1a3a2a]" }: PageBannerProps) {
  return (
    <div className={`${bgColor} text-white py-16`}>
      <div className="max-w-6xl mx-auto px-4">
        <nav className="flex items-center gap-2 text-sm text-green-300 mb-4">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : "hover:text-white transition-colors"}>{item}</span>
            </span>
          ))}
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h1>
        {subtitle && <p className="text-green-200 text-lg mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 1. 영상 목록 페이지 템플릿
// ─────────────────────────────────────────────
export interface VideoItem {
  id: string;
  title: string;
  date: string;
  thumbnail: string;
  youtubeId?: string;
  duration?: string;
  preacher?: string;
  description?: string;
}

interface VideoListPageProps {
  title: string;
  subtitle?: string;
  breadcrumb: string[];
  videos: VideoItem[];
}

export function VideoListPage({ title, subtitle, breadcrumb, videos }: VideoListPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageBanner title={title} subtitle={subtitle} breadcrumb={breadcrumb} />
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <div className="relative aspect-video bg-gray-200 overflow-hidden">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-[#2d6a4f] ml-1" fill="currentColor" />
                  </div>
                </div>
                {video.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">{video.duration}</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-[#2d6a4f] transition-colors">{video.title}</h3>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  {video.preacher && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{video.preacher}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{video.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {videos.length === 0 && (
          <div className="text-center py-24 text-gray-400">
            <Play className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>등록된 영상이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2. 사역/부서 소개 페이지 템플릿
// ─────────────────────────────────────────────
export interface MinistryInfo {
  name: string;
  vision?: string;
  description: string;
  image?: string;
  activities?: { title: string; desc: string; icon?: string }[];
  contact?: { label: string; value: string }[];
  leader?: { name: string; title: string; photo?: string };
}

interface MinistryPageProps {
  title: string;
  breadcrumb: string[];
  info: MinistryInfo;
}

export function MinistryPage({ title, breadcrumb, info }: MinistryPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageBanner title={title} breadcrumb={breadcrumb} />
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* 소개 섹션 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="md:flex">
            {info.image && (
              <div className="md:w-2/5">
                <img src={info.image} alt={info.name} className="w-full h-64 md:h-full object-cover" />
              </div>
            )}
            <div className="p-8 md:flex-1">
              {info.vision && (
                <div className="inline-block bg-[#2d6a4f]/10 text-[#2d6a4f] text-sm font-medium px-3 py-1 rounded-full mb-4">
                  {info.vision}
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>{info.name}</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{info.description}</p>
              {info.leader && (
                <div className="mt-6 flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  {info.leader.photo && (
                    <img src={info.leader.photo} alt={info.leader.name} className="w-12 h-12 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="text-xs text-gray-500">{info.leader.title}</p>
                    <p className="font-semibold text-gray-800">{info.leader.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 주요 활동 */}
        {info.activities && info.activities.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>주요 활동</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {info.activities.map((act, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-[#2d6a4f]">
                  <h4 className="font-semibold text-gray-900 mb-2">{act.title}</h4>
                  <p className="text-sm text-gray-600">{act.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 연락처 */}
        {info.contact && info.contact.length > 0 && (
          <div className="bg-[#1a3a2a] text-white rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-4">문의 및 연락처</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {info.contact.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-green-300 text-sm font-medium w-24 shrink-0">{c.label}</span>
                  <span className="text-white">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3. 교회학교 부서 소개 페이지 템플릿
// ─────────────────────────────────────────────
export interface DepartmentInfo {
  name: string;
  ageRange: string;
  vision: string;
  description: string;
  image?: string;
  schedule?: { day: string; time: string; place: string }[];
  programs?: string[];
  teachers?: { name: string; role: string }[];
}

interface DepartmentPageProps {
  breadcrumb: string[];
  info: DepartmentInfo;
}

export function DepartmentPage({ breadcrumb, info }: DepartmentPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageBanner
        title={info.name}
        subtitle={info.ageRange}
        breadcrumb={breadcrumb}
        bgColor="bg-gradient-to-r from-[#1a3a2a] to-[#2d6a4f]"
      />
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* 비전 & 소개 */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="md:flex gap-8 items-start">
            {info.image && (
              <img src={info.image} alt={info.name} className="w-full md:w-64 h-48 object-cover rounded-xl mb-6 md:mb-0 shrink-0" />
            )}
            <div>
              <div className="inline-block bg-[#2d6a4f]/10 text-[#2d6a4f] text-sm font-semibold px-3 py-1 rounded-full mb-3">
                {info.vision}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>{info.name}</h2>
              <p className="text-gray-600 leading-relaxed">{info.description}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 예배 일정 */}
          {info.schedule && info.schedule.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2d6a4f]" />예배 일정
              </h3>
              <div className="space-y-3">
                {info.schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-[#2d6a4f] font-semibold text-sm w-16 shrink-0">{s.day}</span>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{s.time}</p>
                      <p className="text-gray-500 text-xs">{s.place}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 프로그램 */}
          {info.programs && info.programs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#2d6a4f]" />주요 프로그램
              </h3>
              <ul className="space-y-2">
                {info.programs.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700 text-sm">
                    <span className="w-1.5 h-1.5 bg-[#2d6a4f] rounded-full shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 교사 소개 */}
        {info.teachers && info.teachers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#2d6a4f]" />섬기는 선생님
            </h3>
            <div className="flex flex-wrap gap-3">
              {info.teachers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                  <div className="w-7 h-7 bg-[#2d6a4f]/20 rounded-full flex items-center justify-center text-[#2d6a4f] text-xs font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t.role} </span>
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 4. 단순 소개 페이지 템플릿 (게시판형)
// ─────────────────────────────────────────────
export interface BoardItem {
  id: string;
  title: string;
  date: string;
  category?: string;
  thumbnail?: string;
  excerpt?: string;
  isNew?: boolean;
}

interface BoardPageProps {
  title: string;
  subtitle?: string;
  breadcrumb: string[];
  items: BoardItem[];
  categories?: string[];
}

export function BoardPage({ title, subtitle, breadcrumb, items, categories }: BoardPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageBanner title={title} subtitle={subtitle} breadcrumb={breadcrumb} />
      <div className="max-w-5xl mx-auto px-4 py-12">
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button className="px-4 py-2 bg-[#2d6a4f] text-white rounded-full text-sm font-medium">전체</button>
            {categories.map((cat, i) => (
              <button key={i} className="px-4 py-2 bg-white text-gray-600 rounded-full text-sm font-medium hover:bg-[#2d6a4f] hover:text-white transition-colors border border-gray-200">
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {items.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors cursor-pointer ${i !== items.length - 1 ? "border-b border-gray-100" : ""}`}>
              {item.thumbnail && (
                <img src={item.thumbnail} alt={item.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.category && <span className="text-xs bg-[#2d6a4f]/10 text-[#2d6a4f] px-2 py-0.5 rounded-full">{item.category}</span>}
                  {item.isNew && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">NEW</span>}
                </div>
                <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                {item.excerpt && <p className="text-sm text-gray-500 truncate mt-0.5">{item.excerpt}</p>}
              </div>
              <span className="text-sm text-gray-400 shrink-0">{item.date}</span>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>등록된 게시물이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
