/**
 * 기쁨의교회 시설 사용 예약 — 공통 데이터 및 타입 정의
 * 규칙: any 타입 금지, 나중에 DB 연결 시 이 파일의 타입을 그대로 사용
 * 백엔드 연결 전까지는 이 파일의 MOCK_FACILITIES 데이터를 사용
 */

export interface FacilityEquipment {
  name: string;
  icon: string;
}

export interface FacilitySchedule {
  date: string;       // "2026-04-10" 형식
  timeSlots: string[]; // ["09:00-12:00", "14:00-17:00"] 형식
  status: "booked" | "available";
}

export interface Facility {
  id: string;
  name: string;
  category: "worship" | "education" | "fellowship" | "other";
  floor: string;
  capacity: number;
  description: string;
  longDescription: string;
  imageUrl: string;
  galleryImages: string[];
  equipment: FacilityEquipment[];
  availableHours: string;   // "09:00 ~ 22:00"
  notice: string[];         // 이용 시 주의사항
  isActive: boolean;
}

export const CATEGORY_LABELS: Record<Facility["category"], string> = {
  worship: "예배공간",
  education: "교육공간",
  fellowship: "친교공간",
  other: "기타",
};

export const MOCK_FACILITIES: Facility[] = [
  {
    id: "main-hall",
    name: "대예배실",
    category: "worship",
    floor: "본관 3층",
    capacity: 1000,
    description: "1,000석 규모의 메인 예배 공간으로 최신 음향·영상 시스템을 갖추고 있습니다.",
    longDescription:
      "기쁨의교회 대예배실은 1,000석 규모의 웅장한 예배 공간입니다. 최신 디지털 음향 시스템, 대형 LED 스크린, 전문 조명 시스템을 갖추고 있어 예배, 콘서트, 대규모 행사에 최적화되어 있습니다. 넓은 무대와 분리된 사운드 부스, 동시 통역 시설도 완비되어 있습니다.",
    imageUrl: "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80",
      "https://images.unsplash.com/photo-1520880867055-1e30d1cb001c?w=800&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    ],
    equipment: [
      { name: "디지털 음향 시스템", icon: "fa-volume-up" },
      { name: "대형 LED 스크린", icon: "fa-tv" },
      { name: "전문 조명", icon: "fa-lightbulb" },
      { name: "동시 통역 시설", icon: "fa-headphones" },
      { name: "방송 장비", icon: "fa-video" },
    ],
    availableHours: "09:00 ~ 22:00",
    notice: [
      "사용 3일 전까지 신청해 주세요.",
      "음향·조명 장비는 담당 사역자 입회 하에 사용 가능합니다.",
      "사용 후 원상 복구 및 청소를 완료해 주세요.",
      "외부 단체의 경우 담임목사 승인이 필요합니다.",
    ],
    isActive: true,
  },
  {
    id: "small-chapel",
    name: "소예배실",
    category: "worship",
    floor: "본관 2층",
    capacity: 200,
    description: "200석 규모의 소예배실로 중소 규모 예배 및 세미나에 적합합니다.",
    longDescription:
      "소예배실은 200석 규모로 중소 규모의 예배, 특별 집회, 세미나 등에 활용됩니다. 아늑한 분위기와 함께 음향 시스템, 프로젝터, 마이크 시스템이 완비되어 있습니다. 소그룹 예배나 부서별 행사에 최적화된 공간입니다.",
    imageUrl: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80",
      "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&q=80",
    ],
    equipment: [
      { name: "음향 시스템", icon: "fa-volume-up" },
      { name: "빔 프로젝터", icon: "fa-projector" },
      { name: "마이크 시스템", icon: "fa-microphone" },
      { name: "피아노", icon: "fa-music" },
    ],
    availableHours: "09:00 ~ 21:00",
    notice: [
      "사용 2일 전까지 신청해 주세요.",
      "피아노 사용 시 별도 신청이 필요합니다.",
      "사용 후 의자 정리 및 청소를 완료해 주세요.",
    ],
    isActive: true,
  },
  {
    id: "fellowship-hall",
    name: "친교홀",
    category: "fellowship",
    floor: "본관 1층",
    capacity: 300,
    description: "300명 수용 가능한 넓은 친교 공간으로 식사 및 행사에 활용됩니다.",
    longDescription:
      "친교홀은 300명을 수용할 수 있는 넓은 다목적 공간입니다. 주방 시설과 연결되어 있어 식사 행사, 바자회, 전시회 등 다양한 용도로 활용 가능합니다. 테이블과 의자가 완비되어 있으며, 이동식 파티션으로 공간 분리도 가능합니다.",
    imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
      "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80",
    ],
    equipment: [
      { name: "테이블·의자 (300인분)", icon: "fa-chair" },
      { name: "주방 시설", icon: "fa-utensils" },
      { name: "이동식 파티션", icon: "fa-border-all" },
      { name: "음향 시스템", icon: "fa-volume-up" },
    ],
    availableHours: "09:00 ~ 21:00",
    notice: [
      "주방 사용 시 별도 신청이 필요합니다.",
      "음식물 반입은 허용되나 반드시 뒷정리를 해주세요.",
      "사용 후 테이블·의자를 원위치해 주세요.",
    ],
    isActive: true,
  },
  {
    id: "seminar-a",
    name: "세미나실 A",
    category: "education",
    floor: "교육관 3층",
    capacity: 50,
    description: "50명 규모의 세미나실로 강의, 소그룹 모임, 회의에 최적화되어 있습니다.",
    longDescription:
      "세미나실 A는 50명 규모의 교육 공간입니다. 강의식 배치와 토론식 배치 모두 가능하며, 화이트보드, 프로젝터, 빠른 Wi-Fi가 갖추어져 있습니다. 소그룹 성경공부, 부서 회의, 외부 강사 초청 강의 등에 활용하기 좋은 공간입니다.",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
    ],
    equipment: [
      { name: "빔 프로젝터", icon: "fa-projector" },
      { name: "화이트보드", icon: "fa-chalkboard" },
      { name: "Wi-Fi", icon: "fa-wifi" },
      { name: "마이크", icon: "fa-microphone" },
    ],
    availableHours: "09:00 ~ 21:00",
    notice: [
      "사용 1일 전까지 신청해 주세요.",
      "음식물 반입은 음료만 허용됩니다.",
      "사용 후 화이트보드를 깨끗이 지워주세요.",
    ],
    isActive: true,
  },
  {
    id: "seminar-b",
    name: "세미나실 B",
    category: "education",
    floor: "교육관 3층",
    capacity: 30,
    description: "30명 규모의 소형 세미나실로 소그룹 모임과 스터디에 적합합니다.",
    longDescription:
      "세미나실 B는 30명 규모의 아늑한 소형 교육 공간입니다. 원형 배치가 가능해 토론 중심의 소그룹 모임에 특히 적합합니다. 세미나실 A와 인접해 있어 대규모 행사 시 연계 사용도 가능합니다.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    ],
    equipment: [
      { name: "TV 모니터", icon: "fa-tv" },
      { name: "화이트보드", icon: "fa-chalkboard" },
      { name: "Wi-Fi", icon: "fa-wifi" },
    ],
    availableHours: "09:00 ~ 21:00",
    notice: [
      "사용 1일 전까지 신청해 주세요.",
      "음식물 반입은 음료만 허용됩니다.",
    ],
    isActive: true,
  },
  {
    id: "small-group",
    name: "소그룹실",
    category: "education",
    floor: "교육관 2층",
    capacity: 15,
    description: "15명 규모의 소그룹 전용 공간으로 셀 모임, 기도 모임에 최적입니다.",
    longDescription:
      "소그룹실은 15명 규모의 아늑한 공간으로 셀 모임, 기도 모임, 소규모 성경공부에 최적화되어 있습니다. 편안한 소파와 낮은 테이블로 구성되어 있어 친밀한 교제 분위기를 만들어 줍니다.",
    imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
    galleryImages: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
    ],
    equipment: [
      { name: "TV 모니터", icon: "fa-tv" },
      { name: "Wi-Fi", icon: "fa-wifi" },
    ],
    availableHours: "09:00 ~ 22:00",
    notice: [
      "당일 신청도 가능합니다 (담당자 확인 후 사용).",
      "음식물 반입은 음료만 허용됩니다.",
    ],
    isActive: true,
  },
];
