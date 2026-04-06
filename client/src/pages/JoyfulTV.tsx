/**
 * JoyfulTV.tsx
 * 조이풀TV 하위 메뉴 전체 페이지
 * 디자인: 녹색(#2d6a4f) 포인트 + Noto Serif KR + VideoListPage 템플릿 재사용
 */

import { VideoListPage, type VideoItem } from "@/components/PageTemplates";

// ── 공통 유튜브 썸네일 헬퍼 ──
const yt = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

// ── 더미 영상 데이터 ──
const sundayVideos: VideoItem[] = [
  { id: "s1", title: "2026년 3월 마지막 주일예배 설교 - 처음 익은 열매로 여호와를 공경하라", date: "2026.03.29", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "48:22" },
  { id: "s2", title: "2026년 3월 셋째 주일예배 설교 - 믿음으로 사는 삶", date: "2026.03.22", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "45:10" },
  { id: "s3", title: "2026년 3월 둘째 주일예배 설교 - 하나님의 은혜", date: "2026.03.15", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "50:05" },
  { id: "s4", title: "2026년 3월 첫째 주일예배 설교 - 새 출발의 은혜", date: "2026.03.08", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "46:30" },
  { id: "s5", title: "2026년 2월 마지막 주일예배 설교 - 사랑의 계명", date: "2026.02.22", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "44:18" },
  { id: "s6", title: "2026년 2월 셋째 주일예배 설교 - 기도의 능력", date: "2026.02.15", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "47:55" },
];

const wednesdayVideos: VideoItem[] = [
  { id: "w1", title: "헤브론 수요예배 - 말씀 안에 거하라 (요한복음 15장)", date: "2026.04.01", thumbnail: yt("kJQP7kiw5Fk"), preacher: "하영인 목사", duration: "38:14" },
  { id: "w2", title: "헤브론 수요예배 - 성령의 열매 (갈라디아서 5장)", date: "2026.03.25", thumbnail: yt("OPf0YbXqDm0"), preacher: "하영인 목사", duration: "40:22" },
  { id: "w3", title: "헤브론 수요예배 - 믿음의 기도 (야고보서 5장)", date: "2026.03.18", thumbnail: yt("dQw4w9WgXcQ"), preacher: "하영인 목사", duration: "36:50" },
  { id: "w4", title: "헤브론 수요예배 - 복음의 능력 (로마서 1장)", date: "2026.03.11", thumbnail: yt("9bZkp7q19f0"), preacher: "하영인 목사", duration: "42:10" },
  { id: "w5", title: "헤브론 수요예배 - 하나님의 사랑 (요한일서 4장)", date: "2026.03.04", thumbnail: yt("kJQP7kiw5Fk"), preacher: "하영인 목사", duration: "39:45" },
  { id: "w6", title: "헤브론 수요예배 - 구원의 확신 (에베소서 2장)", date: "2026.02.25", thumbnail: yt("OPf0YbXqDm0"), preacher: "하영인 목사", duration: "41:30" },
];

const fridayVideos: VideoItem[] = [
  { id: "f1", title: "쉐키나 금요기도회 - 성령님과 동행하는 삶", date: "2026.04.03", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "55:20" },
  { id: "f2", title: "쉐키나 금요기도회 - 중보기도의 능력", date: "2026.03.27", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "52:40" },
  { id: "f3", title: "쉐키나 금요기도회 - 찬양과 경배", date: "2026.03.20", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "58:15" },
  { id: "f4", title: "쉐키나 금요기도회 - 하나님의 임재", date: "2026.03.13", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "50:30" },
];

const dawnVideos: VideoItem[] = [
  { id: "d1", title: "새벽 글로리아 성서학당 - 창세기 강해 (1강)", date: "2026.04.06", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "25:10" },
  { id: "d2", title: "새벽 글로리아 성서학당 - 창세기 강해 (2강)", date: "2026.04.05", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "23:45" },
  { id: "d3", title: "새벽 글로리아 성서학당 - 창세기 강해 (3강)", date: "2026.04.04", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "26:30" },
  { id: "d4", title: "새벽 글로리아 성서학당 - 창세기 강해 (4강)", date: "2026.04.03", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "24:55" },
  { id: "d5", title: "새벽 글로리아 성서학당 - 창세기 강해 (5강)", date: "2026.04.02", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "27:20" },
  { id: "d6", title: "새벽 글로리아 성서학당 - 창세기 강해 (6강)", date: "2026.04.01", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "22:40" },
];

const seriesVideos: VideoItem[] = [
  { id: "sr1", title: "박진석 목사 시리즈 - 요한복음 강해 1강", date: "2026.01.05", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "52:10" },
  { id: "sr2", title: "박진석 목사 시리즈 - 요한복음 강해 2강", date: "2026.01.12", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "48:30" },
  { id: "sr3", title: "박진석 목사 시리즈 - 요한복음 강해 3강", date: "2026.01.19", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "55:45" },
  { id: "sr4", title: "박진석 목사 시리즈 - 요한복음 강해 4강", date: "2026.01.26", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "50:20" },
  { id: "sr5", title: "박진석 목사 시리즈 - 요한복음 강해 5강", date: "2026.02.02", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "47:15" },
  { id: "sr6", title: "박진석 목사 시리즈 - 요한복음 강해 6강", date: "2026.02.09", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "53:40" },
];

const haVideos: VideoItem[] = [
  { id: "h1", title: "하영인 새벽기도회 설교 - 시편 23편 묵상", date: "2026.04.06", thumbnail: yt("dQw4w9WgXcQ"), preacher: "하영인 목사", duration: "20:15" },
  { id: "h2", title: "하영인 새벽기도회 설교 - 이사야 40장 묵상", date: "2026.04.05", thumbnail: yt("9bZkp7q19f0"), preacher: "하영인 목사", duration: "18:30" },
  { id: "h3", title: "하영인 새벽기도회 설교 - 빌립보서 4장 묵상", date: "2026.04.04", thumbnail: yt("kJQP7kiw5Fk"), preacher: "하영인 목사", duration: "22:10" },
  { id: "h4", title: "하영인 새벽기도회 설교 - 로마서 8장 묵상", date: "2026.04.03", thumbnail: yt("OPf0YbXqDm0"), preacher: "하영인 목사", duration: "19:45" },
];

const specialVideos: VideoItem[] = [
  { id: "sp1", title: "2026 신년예배 - 새 출발의 은혜", date: "2026.01.01", thumbnail: yt("dQw4w9WgXcQ"), preacher: "박진석 목사", duration: "60:00" },
  { id: "sp2", title: "2025 성탄예배 - 임마누엘 하나님", date: "2025.12.25", thumbnail: yt("9bZkp7q19f0"), preacher: "박진석 목사", duration: "55:30" },
  { id: "sp3", title: "2025 추수감사예배 - 감사의 제사", date: "2025.11.23", thumbnail: yt("kJQP7kiw5Fk"), preacher: "박진석 목사", duration: "52:20" },
  { id: "sp4", title: "2025 맥추감사예배 - 처음 익은 열매", date: "2025.07.06", thumbnail: yt("OPf0YbXqDm0"), preacher: "박진석 목사", duration: "48:15" },
];

const specialFeatureVideos: VideoItem[] = [
  { id: "sf1", title: "2026 생선 컨퍼런스 특집 영상", date: "2026.03.15", thumbnail: yt("dQw4w9WgXcQ"), duration: "1:20:00" },
  { id: "sf2", title: "2026 신년교례회 특집", date: "2026.01.05", thumbnail: yt("9bZkp7q19f0"), duration: "45:30" },
  { id: "sf3", title: "기쁨의교회 창립 80주년 기념 특집", date: "2025.11.10", thumbnail: yt("kJQP7kiw5Fk"), duration: "1:05:20" },
];

const testimonyVideos: VideoItem[] = [
  { id: "t1", title: "간증 - 하나님이 살리신 나의 삶", date: "2026.03.01", thumbnail: yt("dQw4w9WgXcQ"), duration: "15:30" },
  { id: "t2", title: "간증 - 제자훈련을 통해 변화된 삶", date: "2026.02.15", thumbnail: yt("9bZkp7q19f0"), duration: "12:45" },
  { id: "t3", title: "간증 - 선교지에서 만난 하나님", date: "2026.01.20", thumbnail: yt("kJQP7kiw5Fk"), duration: "18:10" },
  { id: "t4", title: "간증 - 치유의 은혜", date: "2025.12.08", thumbnail: yt("OPf0YbXqDm0"), duration: "14:20" },
];

const praiseVideos: VideoItem[] = [
  { id: "p1", title: "기쁨의교회 찬양팀 - 주님의 영광 (2026 신년 찬양)", date: "2026.01.01", thumbnail: yt("dQw4w9WgXcQ"), duration: "8:30" },
  { id: "p2", title: "기쁨의교회 찬양팀 - 오직 예수 (주일 찬양)", date: "2026.03.15", thumbnail: yt("9bZkp7q19f0"), duration: "6:45" },
  { id: "p3", title: "기쁨의교회 찬양팀 - 주의 이름 높이세 (성탄 찬양)", date: "2025.12.25", thumbnail: yt("kJQP7kiw5Fk"), duration: "10:20" },
  { id: "p4", title: "기쁨의교회 찬양팀 - 할렐루야 (추수감사 찬양)", date: "2025.11.23", thumbnail: yt("OPf0YbXqDm0"), duration: "7:55" },
  { id: "p5", title: "기쁨의교회 찬양팀 - 내 삶의 이유 (특별 찬양)", date: "2025.10.12", thumbnail: yt("dQw4w9WgXcQ"), duration: "9:10" },
  { id: "p6", title: "기쁨의교회 찬양팀 - 주님 다시 오실 때까지 (찬양예배)", date: "2025.09.07", thumbnail: yt("9bZkp7q19f0"), duration: "11:30" },
];

// ── 페이지 컴포넌트 ──
export function SundayWorshipPage() {
  return <VideoListPage title="주일예배" subtitle="매주일 오전 9시, 11시, 오후 2시" breadcrumb={["조이풀TV", "주일예배"]} videos={sundayVideos} />;
}

export function WednesdayWorshipPage() {
  return <VideoListPage title="헤브론 수요예배" subtitle="매주 수요일 오후 7시 30분" breadcrumb={["조이풀TV", "헤브론 수요예배"]} videos={wednesdayVideos} />;
}

export function FridayPrayerPage() {
  return <VideoListPage title="쉐키나 금요기도회" subtitle="매주 금요일 오후 9시" breadcrumb={["조이풀TV", "쉐키나 금요기도회"]} videos={fridayVideos} />;
}

export function DawnBiblePage() {
  return <VideoListPage title="새벽 글로리아 성서학당" subtitle="월~토 오전 5시 30분" breadcrumb={["조이풀TV", "새벽 글로리아 성서학당"]} videos={dawnVideos} />;
}

export function PastorSeriesPage() {
  return <VideoListPage title="박진석 목사 시리즈설교" subtitle="주제별 연속 강해 설교" breadcrumb={["조이풀TV", "박진석 목사 시리즈설교"]} videos={seriesVideos} />;
}

export function HaDawnPage() {
  return <VideoListPage title="하영인 새벽기도회 설교" subtitle="매일 새벽 말씀 묵상" breadcrumb={["조이풀TV", "하영인 새벽기도회 설교"]} videos={haVideos} />;
}

export function SpecialWorshipPage() {
  return <VideoListPage title="특별예배" subtitle="절기 및 특별 예배 영상" breadcrumb={["조이풀TV", "특별예배"]} videos={specialVideos} />;
}

export function SpecialFeaturePage() {
  return <VideoListPage title="특집" subtitle="교회 주요 행사 특집 영상" breadcrumb={["조이풀TV", "특집"]} videos={specialFeatureVideos} />;
}

export function TestimonyPage() {
  return <VideoListPage title="간증" subtitle="성도들의 은혜로운 간증" breadcrumb={["조이풀TV", "간증"]} videos={testimonyVideos} />;
}

export function PraisePage() {
  return <VideoListPage title="찬양" subtitle="기쁨의교회 찬양팀 영상" breadcrumb={["조이풀TV", "찬양"]} videos={praiseVideos} />;
}
