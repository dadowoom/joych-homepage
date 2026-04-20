/**
 * 메뉴 편집 패널 — 공유 타입, 상수, 유틸리티
 * ─────────────────────────────────────────────────────────────────────────────
 * MenuEditPanel 및 하위 컴포넌트들이 공유하는 타입/상수/유틸 함수를 정의합니다.
 */

import React from "react";
import { Image, LayoutGrid, FileText, Youtube, Type } from "lucide-react";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type PageType = "image" | "gallery" | "board" | "youtube" | "editor";

export type MenuSubItemRow = {
  id: number;
  menuItemId: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  pageType: PageType;
  pageImageUrl: string | null;
};

export type MenuItemRow = {
  id: number;
  menuId: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  pageType: PageType;
  pageImageUrl: string | null;
  subItems: MenuSubItemRow[];
};

export type MenuRow = {
  id: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  items: MenuItemRow[];
};

// ─── 페이지 타입 옵션 ─────────────────────────────────────────────────────────

export const PAGE_TYPE_OPTIONS: { value: PageType; label: string; icon: React.ReactNode }[] = [
  { value: "image",   label: "이미지 전체화면", icon: <Image size={12} /> },
  { value: "gallery", label: "갤러리",          icon: <LayoutGrid size={12} /> },
  { value: "board",   label: "게시판",           icon: <FileText size={12} /> },
  { value: "youtube", label: "유튜브 목록",      icon: <Youtube size={12} /> },
  { value: "editor",  label: "편집 모드",        icon: <Type size={12} /> },
];

// ─── 내부 페이지 경로 목록 ────────────────────────────────────────────────────

export const INTERNAL_PAGES = [
  { group: "교회소개", pages: [
    { label: "담임목사 인사", path: "/about/pastor" },
    { label: "교회 역사", path: "/about/history" },
    { label: "교회 비전", path: "/about/vision" },
    { label: "섬기는 분", path: "/about/staff" },
    { label: "교회백서", path: "/about/whitebook" },
    { label: "사역원리", path: "/about/principle" },
    { label: "CI", path: "/about/ci" },
    { label: "셔틀버스", path: "/about/shuttle" },
    { label: "오시는 길", path: "/about/directions" },
  ]},
  { group: "조이풀TV", pages: [
    { label: "조이풀TV 메인", path: "/worship/tv" },
    { label: "주일예배", path: "/worship/tv/sunday" },
    { label: "헤브론 수요예배", path: "/worship/tv/hebron" },
    { label: "쉐키나 금요기도회", path: "/worship/tv/shekhinah" },
    { label: "새벽 글로리아 성서학당", path: "/worship/tv/gloria" },
    { label: "박진석 목사 시리즈설교", path: "/worship/tv/pastor-series" },
    { label: "하영인 새벽기도회 설교", path: "/worship/tv/hayoungin" },
    { label: "특별예배", path: "/worship/tv/special" },
    { label: "특집", path: "/worship/tv/feature" },
    { label: "간증", path: "/worship/tv/testimony" },
    { label: "찬양", path: "/worship/tv/praise" },
    { label: "예배 안내", path: "/worship/schedule" },
    { label: "주보", path: "/worship/bulletin" },
  ]},
  { group: "양육/훈련", pages: [
    { label: "헤세드아시아포재팬", path: "/education/hesed" },
    { label: "제자훈련", path: "/education/disciple2" },
    { label: "장로훈련", path: "/education/elder" },
    { label: "일대일 양육", path: "/education/one-on-one" },
    { label: "선생님학교", path: "/education/sunseumschool" },
    { label: "생선 컨퍼런스", path: "/education/saengseon" },
    { label: "세계선교", path: "/ministry/world-mission" },
    { label: "전도", path: "/ministry/evangelism" },
    { label: "기도사역", path: "/ministry/prayer" },
    { label: "복지사역", path: "/ministry/welfare" },
    { label: "비전대학교", path: "/ministry/vision-univ" },
    { label: "조이랩", path: "/ministry/joylab" },
  ]},
  { group: "교회학교", pages: [
    { label: "영아/유아부", path: "/school/infant" },
    { label: "유치부", path: "/school/kinder" },
    { label: "초등부", path: "/school/elementary" },
    { label: "중고등부", path: "/school/youth" },
    { label: "AWANA", path: "/school/awana" },
    { label: "청년부", path: "/school/young-adult" },
  ]},
  { group: "선교보고", pages: [
    { label: "선교보고 목록", path: "/mission" },
  ]},
  { group: "커뮤니티", pages: [
    { label: "교회 소식", path: "/community/news" },
    { label: "순모임", path: "/community/soon" },
    { label: "자치기관", path: "/community/organization" },
    { label: "동호회", path: "/community/club" },
    { label: "사진", path: "/community/photo" },
    { label: "기쁨톡", path: "/community/joytalk" },
  ]},
  { group: "행정지원", pages: [
    { label: "주보", path: "/worship/bulletin" },
    { label: "자막 신청", path: "/admin/subtitle" },
    { label: "온라인사무국", path: "/admin/office" },
    { label: "탐방신청", path: "/admin/tour" },
    { label: "조이플스토어", path: "/admin/store" },
    { label: "기부금 영수증", path: "/admin/donation" },
    { label: "시설 예약", path: "/facility" },
  ]},
];

// ─── 유틸리티 함수 ────────────────────────────────────────────────────────────

export function detectLinkType(href: string): 'internal' | 'external' | 'custom' {
  if (!href) return 'internal';
  if (href.startsWith('http://') || href.startsWith('https://')) return 'external';
  const allPaths = INTERNAL_PAGES.flatMap(g => g.pages.map(p => p.path));
  if (allPaths.includes(href)) return 'internal';
  return 'custom';
}
