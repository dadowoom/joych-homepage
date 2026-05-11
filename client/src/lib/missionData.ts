/**
 * 기쁨의교회 선교보고 — 공통 데이터 및 타입 정의
 * 규칙: any 타입 금지, 나중에 DB 연결 시 이 파일의 타입을 그대로 사용
 * 백엔드 연결 전까지는 MOCK_REPORTS 더미 데이터를 사용
 */

export interface Missionary {
  id: string;
  name: string;
  region: string;       // 사역 지역 (나라)
  continent: MissionContinent;
  sentYear: number;     // 파송 연도
  profileImage: string;
  organization: string; // 소속 선교 단체
}

export type MissionContinent = "asia" | "africa" | "americas" | "europe" | "oceania";

export const CONTINENT_LABELS: Record<MissionContinent, string> = {
  asia: "아시아",
  africa: "아프리카",
  americas: "아메리카",
  europe: "유럽",
  oceania: "오세아니아",
};

export interface MissionReport {
  id: string;
  missionaryId: string;
  missionary: Missionary;
  title: string;
  date: string;           // "2026-03-15" 형식
  thumbnail: string;
  summary: string;        // 목록에서 보이는 짧은 미리보기
  content: string;        // 상세 페이지 본문 (줄바꿈 \n 사용)
  images: string[];       // 본문 사진 목록
  prayerTopics: string[]; // 기도 제목 목록
}

// ── 선교 협력 목록 ─────────────────────────────────────────
export const MISSIONARIES: Missionary[] = [
  {
    id: "global-mission",
    name: "협력 선교",
    region: "국내외 선교",
    continent: "asia",
    sentYear: 1946,
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    organization: "기쁨의교회",
  },
];

// ── 선교보고 목록 (최신순) ─────────────────────────────────
export const MOCK_REPORTS: MissionReport[] = [
  {
    id: "mission-report-ready",
    missionaryId: "global-mission",
    missionary: MISSIONARIES[0],
    title: "선교보고는 관리자 등록 후 제공됩니다",
    date: "2026-05-11",
    thumbnail: "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600&q=80",
    summary: "확정된 선교보고 자료가 준비되면 관리자 CMS 또는 데이터 연동을 통해 최신 내용으로 제공됩니다.",
    content: `기쁨의교회 선교보고 페이지입니다.\n\n이 영역은 실제 선교보고 자료가 등록된 뒤 최신 현장 소식과 기도 제목을 성도들과 나누기 위한 공간입니다.\n\n현재는 임의의 선교사 이름이나 현장 이야기를 노출하지 않도록 기본 안내 문구로 정리되어 있습니다.`,
    images: [
      "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80",
    ],
    prayerTopics: [
      "선교 현장을 위해 지속적으로 기도할 수 있도록",
      "확정된 선교보고 자료가 정확하게 등록될 수 있도록",
      "기쁨의교회가 복음의 통로로 쓰임 받을 수 있도록",
    ],
  },
];
