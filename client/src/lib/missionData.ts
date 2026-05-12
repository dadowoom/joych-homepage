/**
 * 기쁨의교회 선교보고 — 공통 데이터 및 타입 정의
 * 공개 화면 데이터는 mission tRPC API에서 조회합니다.
 */

export interface Missionary {
  id: number;
  name: string;
  region: string;       // 사역 지역 (나라)
  continent: MissionContinent;
  sentYear: number;     // 파송 연도
  profileImage: string | null;
  organization: string | null; // 소속 선교 단체
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
  id: number;
  missionaryId: number;
  missionary: Missionary;
  title: string;
  reportDate: string;     // "YYYY-MM-DD" 형식
  thumbnailUrl: string | null;
  summary: string | null; // 목록에서 보이는 짧은 미리보기
  content: string | null; // 상세 페이지 본문 (줄바꿈 \n 사용)
  images: string[];       // 본문 사진 목록
  prayerTopics: string[]; // 기도 제목 목록
}
