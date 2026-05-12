/**
 * 메뉴 편집 패널 — 공유 타입, 상수, 유틸리티
 * ─────────────────────────────────────────────────────────────────────────────
 * MenuEditPanel 및 하위 컴포넌트들이 공유하는 타입/상수/유틸 함수를 정의합니다.
 */

import React from "react";
import { Image, LayoutGrid, FileText, Youtube, Type } from "lucide-react";
import { INTERNAL_PAGES, getInternalPagePaths } from "@shared/siteNavigation";

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

export const PAGE_TYPE_OPTIONS: {
  value: PageType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "image", label: "이미지 전체화면", icon: <Image size={12} /> },
  { value: "gallery", label: "갤러리", icon: <LayoutGrid size={12} /> },
  { value: "board", label: "게시판", icon: <FileText size={12} /> },
  { value: "youtube", label: "유튜브 목록", icon: <Youtube size={12} /> },
  { value: "editor", label: "편집 모드", icon: <Type size={12} /> },
];

// ─── 내부 페이지 경로 목록 ────────────────────────────────────────────────────

export { INTERNAL_PAGES };

// ─── 유틸리티 함수 ────────────────────────────────────────────────────────────

export function detectLinkType(
  href: string
): "internal" | "external" | "custom" {
  if (!href) return "internal";
  if (href.startsWith("http://") || href.startsWith("https://"))
    return "external";
  const allPaths = getInternalPagePaths();
  if (allPaths.includes(href)) return "internal";
  return "custom";
}
