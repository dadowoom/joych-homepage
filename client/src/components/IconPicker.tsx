/**
 * 아이콘 피커 컴포넌트
 * - Font Awesome 아이콘을 카테고리별로 분류하여 시각적으로 선택
 * - 퀵메뉴, 관련기관 편집 패널에서 공통으로 사용
 */
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── 카테고리별 아이콘 목록 ──────────────────────────────────────
const ICON_CATEGORIES: { label: string; icons: { name: string; class: string }[] }[] = [
  {
    label: "교회·예배",
    icons: [
      { name: "교회", class: "fa-church" },
      { name: "십자가", class: "fa-cross" },
      { name: "성경", class: "fa-bible" },
      { name: "기도", class: "fa-hands-praying" },
      { name: "비둘기", class: "fa-dove" },
      { name: "별", class: "fa-star" },
      { name: "촛불", class: "fa-candle-holder" },
      { name: "찬양", class: "fa-music" },
      { name: "마이크", class: "fa-microphone" },
      { name: "종", class: "fa-bell" },
    ],
  },
  {
    label: "사람·공동체",
    icons: [
      { name: "사람", class: "fa-user" },
      { name: "목사", class: "fa-user-tie" },
      { name: "그룹", class: "fa-users" },
      { name: "아이", class: "fa-child" },
      { name: "아기", class: "fa-baby" },
      { name: "노인", class: "fa-person-cane" },
      { name: "가족", class: "fa-people-roof" },
      { name: "새가족", class: "fa-user-plus" },
      { name: "악수", class: "fa-handshake" },
      { name: "하트", class: "fa-heart" },
    ],
  },
  {
    label: "정보·안내",
    icons: [
      { name: "신문", class: "fa-newspaper" },
      { name: "공지", class: "fa-bullhorn" },
      { name: "달력", class: "fa-calendar" },
      { name: "시계", class: "fa-clock" },
      { name: "지도", class: "fa-map-marker-alt" },
      { name: "전화", class: "fa-phone" },
      { name: "이메일", class: "fa-envelope" },
      { name: "정보", class: "fa-circle-info" },
      { name: "목록", class: "fa-list" },
      { name: "주보", class: "fa-file-alt" },
    ],
  },
  {
    label: "교육·훈련",
    icons: [
      { name: "졸업", class: "fa-graduation-cap" },
      { name: "책", class: "fa-book" },
      { name: "연필", class: "fa-pencil" },
      { name: "학교", class: "fa-school" },
      { name: "칠판", class: "fa-chalkboard-teacher" },
      { name: "상장", class: "fa-award" },
      { name: "지식", class: "fa-lightbulb" },
      { name: "글로벌", class: "fa-globe" },
      { name: "선교", class: "fa-plane" },
      { name: "전도", class: "fa-share-nodes" },
    ],
  },
  {
    label: "봉사·복지",
    icons: [
      { name: "도움", class: "fa-hands-helping" },
      { name: "선물", class: "fa-gift" },
      { name: "병원", class: "fa-hospital" },
      { name: "구호", class: "fa-hand-holding-heart" },
      { name: "식사", class: "fa-utensils" },
      { name: "집", class: "fa-house" },
      { name: "복지관", class: "fa-building" },
      { name: "나무", class: "fa-tree" },
      { name: "재활용", class: "fa-recycle" },
      { name: "씨앗", class: "fa-seedling" },
    ],
  },
  {
    label: "시설·편의",
    icons: [
      { name: "주차", class: "fa-parking" },
      { name: "버스", class: "fa-bus" },
      { name: "차량", class: "fa-car" },
      { name: "카페", class: "fa-mug-hot" },
      { name: "상점", class: "fa-store" },
      { name: "건물", class: "fa-landmark" },
      { name: "시설", class: "fa-warehouse" },
      { name: "예약", class: "fa-calendar-check" },
      { name: "열쇠", class: "fa-key" },
      { name: "Wi-Fi", class: "fa-wifi" },
    ],
  },
  {
    label: "미디어·SNS",
    icons: [
      { name: "유튜브", class: "fa-youtube" },
      { name: "영상", class: "fa-video" },
      { name: "사진", class: "fa-camera" },
      { name: "갤러리", class: "fa-images" },
      { name: "팟캐스트", class: "fa-podcast" },
      { name: "인스타", class: "fa-instagram" },
      { name: "페이스북", class: "fa-facebook-f" },
      { name: "카카오", class: "fa-comment" },
      { name: "링크", class: "fa-link" },
      { name: "공유", class: "fa-share" },
    ],
  },
  {
    label: "행정·기타",
    icons: [
      { name: "기부금", class: "fa-receipt" },
      { name: "헌금", class: "fa-money-bill" },
      { name: "서류", class: "fa-file" },
      { name: "도장", class: "fa-stamp" },
      { name: "자막", class: "fa-closed-captioning" },
      { name: "탐방", class: "fa-binoculars" },
      { name: "설정", class: "fa-gear" },
      { name: "검색", class: "fa-magnifying-glass" },
      { name: "다운로드", class: "fa-download" },
      { name: "프린트", class: "fa-print" },
    ],
  },
];

// 전체 아이콘 목록 (검색용)
const ALL_ICONS = ICON_CATEGORIES.flatMap((cat) =>
  cat.icons.map((icon) => ({ ...icon, category: cat.label }))
);

interface IconPickerProps {
  value: string;
  onChange: (iconClass: string) => void;
  onClose: () => void;
}

export default function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 검색어 필터링
  const filtered = search.trim()
    ? ALL_ICONS.filter(
        (icon) =>
          icon.name.includes(search) ||
          icon.class.includes(search) ||
          icon.category.includes(search)
      )
    : null;

  // 현재 표시할 카테고리 목록
  const displayCategories = activeCategory
    ? ICON_CATEGORIES.filter((c) => c.label === activeCategory)
    : ICON_CATEGORIES;

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="text-xs font-semibold text-gray-600">아이콘 선택</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 검색창 */}
      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveCategory(null);
            }}
            placeholder="아이콘 이름 검색 (예: 교회, 기도)"
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* 카테고리 탭 (검색 중이 아닐 때) */}
      {!search && (
        <div className="px-3 pb-1 flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              !activeCategory
                ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                : "border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            전체
          </button>
          {ICON_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                activeCategory === cat.label
                  ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* 아이콘 그리드 */}
      <div className="px-3 pb-3 max-h-[280px] overflow-y-auto">
        {filtered ? (
          // 검색 결과
          filtered.length > 0 ? (
            <div className="grid grid-cols-6 gap-1 pt-1">
              {filtered.map((icon) => (
                <IconButton
                  key={icon.class}
                  icon={icon}
                  selected={value === icon.class}
                  onClick={() => onChange(icon.class)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400 py-6">검색 결과가 없습니다.</p>
          )
        ) : (
          // 카테고리별 표시
          displayCategories.map((cat) => (
            <div key={cat.label} className="mb-2">
              <p className="text-[10px] text-gray-400 font-medium mb-1 mt-1">{cat.label}</p>
              <div className="grid grid-cols-6 gap-1">
                {cat.icons.map((icon) => (
                  <IconButton
                    key={icon.class}
                    icon={icon}
                    selected={value === icon.class}
                    onClick={() => onChange(icon.class)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 현재 선택된 아이콘 표시 */}
      {value && (
        <div className="px-3 py-2 border-t bg-[#F1F8E9] flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1B5E20] flex items-center justify-center">
            <i className={`fas ${value} text-white text-xs`}></i>
          </div>
          <span className="text-xs text-[#1B5E20] font-medium">선택됨: {value}</span>
        </div>
      )}
    </div>
  );
}

// ── 개별 아이콘 버튼 ─────────────────────────────────────────────
function IconButton({
  icon,
  selected,
  onClick,
}: {
  icon: { name: string; class: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={icon.name}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all ${
        selected
          ? "bg-[#1B5E20] border-[#1B5E20] text-white"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-600"
      }`}
    >
      <i className={`fas ${icon.class} text-sm`}></i>
      <span className="text-[9px] leading-tight text-center truncate w-full">{icon.name}</span>
    </button>
  );
}
