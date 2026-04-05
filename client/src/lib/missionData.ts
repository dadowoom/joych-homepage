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

// ── 선교사 목록 ────────────────────────────────────────────
export const MISSIONARIES: Missionary[] = [
  {
    id: "kim-jungsoo",
    name: "김정수 선교사",
    region: "인도네시아 수라바야",
    continent: "asia",
    sentYear: 2015,
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    organization: "GMS 국제선교회",
  },
  {
    id: "lee-mikyung",
    name: "이미경 선교사",
    region: "케냐 나이로비",
    continent: "africa",
    sentYear: 2012,
    profileImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    organization: "OMF 선교회",
  },
  {
    id: "park-sungho",
    name: "박성호 선교사",
    region: "캄보디아 프놈펜",
    continent: "asia",
    sentYear: 2018,
    profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    organization: "GP 선교회",
  },
  {
    id: "choi-yunjin",
    name: "최윤진 선교사",
    region: "브라질 상파울루",
    continent: "americas",
    sentYear: 2010,
    profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    organization: "KWMA 선교연합",
  },
  {
    id: "jung-hyunwoo",
    name: "정현우 선교사",
    region: "몽골 울란바토르",
    continent: "asia",
    sentYear: 2020,
    profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
    organization: "GMS 국제선교회",
  },
];

// ── 선교보고 목록 (최신순) ─────────────────────────────────
export const MOCK_REPORTS: MissionReport[] = [
  {
    id: "report-2026-03-kim",
    missionaryId: "kim-jungsoo",
    missionary: MISSIONARIES[0],
    title: "2026년 3월 수라바야 현지 교회 개척 보고",
    date: "2026-03-28",
    thumbnail: "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600&q=80",
    summary: "이번 달 수라바야 외곽 지역에 새로운 가정교회 2곳이 세워졌습니다. 현지 청년 리더 훈련이 결실을 맺어 기쁨이 넘칩니다.",
    content: `사랑하는 기쁨의교회 성도 여러분, 평안하신지요.\n\n이번 3월은 정말 감사한 일들이 많았습니다. 지난 6개월간 훈련해 온 현지 청년 리더 5명이 드디어 각자의 마을에서 가정교회를 시작하게 되었습니다.\n\n수라바야 외곽 찌뿌뚜 지역의 안디 형제는 자신의 집을 열어 매주 15명이 모이는 예배 공동체를 이끌고 있습니다. 처음에는 두려워하던 그가 이제는 직접 말씀을 전하고 기도를 인도하는 모습을 보며 눈물이 났습니다.\n\n또한 이번 달에는 현지 초등학교와 협력하여 방과 후 성경 교실을 시작했습니다. 매주 화·목요일 오후, 30여 명의 아이들이 모여 성경 이야기를 듣고 찬양을 배우고 있습니다. 아이들의 밝은 눈빛이 이 사역의 가장 큰 보람입니다.\n\n후원해 주시는 기쁨의교회 성도님들 덕분에 이 모든 일이 가능합니다. 진심으로 감사드립니다.`,
    images: [
      "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&q=80",
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
      "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
    ],
    prayerTopics: [
      "새로 세워진 가정교회 2곳이 든든히 성장할 수 있도록",
      "현지 청년 리더들의 믿음과 지혜를 위해",
      "방과 후 성경 교실 아이들이 복음을 마음에 받아들이도록",
      "선교사 가정의 건강과 안전을 위해",
    ],
  },
  {
    id: "report-2026-03-lee",
    missionaryId: "lee-mikyung",
    missionary: MISSIONARIES[1],
    title: "케냐 나이로비 의료 선교 및 어린이 사역 보고",
    date: "2026-03-20",
    thumbnail: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80",
    summary: "3월 의료 선교 캠프에서 450명의 주민이 무료 진료를 받았습니다. 특히 어린이 영양 지원 프로그램이 큰 호응을 얻었습니다.",
    content: `기쁨의교회 성도 여러분, 케냐 나이로비에서 인사드립니다.\n\n이번 달 가장 감사한 소식은 3월 14일~16일 진행된 의료 선교 캠프입니다. 한국에서 오신 의료팀 7명과 함께 나이로비 외곽 키베라 슬럼 지역에서 무료 진료를 실시했습니다.\n\n3일간 총 450명의 주민이 진료를 받았으며, 그중 어린이가 180명이었습니다. 많은 아이들이 영양 부족 상태였는데, 이번 캠프를 계기로 월 1회 영양 지원 프로그램을 시작하게 되었습니다.\n\n진료를 받으러 온 한 어머니가 "우리 아이가 처음으로 의사 선생님께 진찰을 받았다"며 눈물을 흘리던 모습이 잊히지 않습니다. 이것이 선교의 이유임을 다시 한번 깨달았습니다.\n\n현지 교회와 협력하여 매주 일요일 어린이 예배도 꾸준히 진행 중입니다. 현재 65명의 아이들이 정기적으로 참석하고 있습니다.`,
    images: [
      "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
      "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&q=80",
    ],
    prayerTopics: [
      "영양 지원 프로그램이 지속적으로 운영될 수 있도록",
      "어린이 예배에 참석하는 아이들이 복음을 받아들이도록",
      "의료 사역을 위한 지속적인 후원과 의료팀 연결을 위해",
      "이미경 선교사의 건강 회복을 위해 (3월 초 감기로 고생)",
    ],
  },
  {
    id: "report-2026-03-park",
    missionaryId: "park-sungho",
    missionary: MISSIONARIES[2],
    title: "캄보디아 청소년 제자훈련 및 지역 사회 봉사 보고",
    date: "2026-03-10",
    thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80",
    summary: "프놈펜 청소년 제자훈련 1기 수료식이 열렸습니다. 20명의 청소년이 6개월 과정을 마치고 각자의 학교에서 신앙 모임을 시작했습니다.",
    content: `기쁨의교회 성도 여러분, 캄보디아 프놈펜에서 인사드립니다.\n\n3월 5일, 드디어 청소년 제자훈련 1기 수료식이 열렸습니다. 지난 6개월간 매주 토요일 모여 말씀을 배우고 기도하며 함께 성장한 20명의 청소년들이 수료증을 받았습니다.\n\n이 친구들은 이제 각자의 학교에서 작은 신앙 모임을 시작하기로 결단했습니다. 17살 소팟은 자신의 반 친구 5명을 모아 매주 점심시간에 성경을 읽는 모임을 시작했다고 연락이 왔습니다. 이런 소식이 선교사로서 가장 큰 기쁨입니다.\n\n또한 이번 달에는 지역 고아원과 협력하여 집수리 봉사를 진행했습니다. 교회 청년들 15명과 함께 이틀간 지붕 수리와 페인트 작업을 했는데, 아이들이 너무 좋아해서 함께 많이 웃었습니다.`,
    images: [
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    ],
    prayerTopics: [
      "제자훈련 1기 수료생들이 각 학교에서 신앙 모임을 잘 이끌도록",
      "2기 제자훈련 참가자 모집을 위해",
      "고아원 아이들의 영적·육체적 성장을 위해",
    ],
  },
  {
    id: "report-2026-02-choi",
    missionaryId: "choi-yunjin",
    missionary: MISSIONARIES[3],
    title: "브라질 한인 교회 연합 수련회 및 이민자 사역 보고",
    date: "2026-02-25",
    thumbnail: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80",
    summary: "상파울루 한인 교회 연합 수련회에서 150명이 참석했습니다. 이민 2세대 청년들을 위한 정체성 회복 프로그램이 큰 감동을 주었습니다.",
    content: `기쁨의교회 성도 여러분, 브라질 상파울루에서 인사드립니다.\n\n2월 14일~16일, 상파울루 한인 교회 연합 수련회가 열렸습니다. 올해는 특별히 이민 2세대 청년들을 위한 프로그램을 집중적으로 준비했습니다.\n\n"나는 누구인가 — 이민자의 자녀로 살아가기"라는 주제로 진행된 세션에서 많은 청년들이 눈물을 흘렸습니다. 한국인도 아니고 브라질인도 아닌 것 같은 정체성의 혼란 속에서, 하나님의 자녀라는 정체성이 모든 것을 넘어선다는 말씀이 큰 위로가 되었습니다.\n\n수련회 이후 5명의 청년이 세례를 받기로 결단했고, 다음 달 세례식을 준비 중입니다. 또한 이민자 자녀 무료 한국어 교실도 3월부터 시작하기로 했습니다.`,
    images: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
    ],
    prayerTopics: [
      "세례를 준비하는 5명의 청년들을 위해",
      "이민 2세대 청년들의 신앙 정체성 확립을 위해",
      "한국어 교실이 복음 전도의 통로가 되도록",
    ],
  },
  {
    id: "report-2026-02-jung",
    missionaryId: "jung-hyunwoo",
    missionary: MISSIONARIES[4],
    title: "몽골 울란바토르 겨울 구제 사역 및 교회 개척 보고",
    date: "2026-02-10",
    thumbnail: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80",
    summary: "영하 30도의 혹한 속에서도 노숙자 200명에게 따뜻한 식사와 방한용품을 전달했습니다. 새 교회 건물 착공도 시작되었습니다.",
    content: `기쁨의교회 성도 여러분, 몽골 울란바토르에서 인사드립니다.\n\n2월 울란바토르는 영하 30도를 오르내리는 혹독한 겨울이었습니다. 이런 날씨 속에서도 거리의 노숙자들을 섬기는 사역을 계속했습니다.\n\n매주 토요일 오전, 현지 교회 봉사자 10명과 함께 울란바토르 중앙역 인근에서 따뜻한 국밥과 방한 장갑, 양말을 나누어 드렸습니다. 2월 한 달간 총 200명에게 식사를 제공했습니다.\n\n그 중 한 분이 "이렇게 추운 날 나를 기억해 주는 사람이 있다는 것이 감사하다"고 하셨는데, 그 말이 마음에 오래 남습니다.\n\n또한 기쁨의교회 성도님들의 헌금으로 마련된 교회 건물 착공식이 2월 20일에 있었습니다. 내년 봄 완공을 목표로 공사가 시작되었습니다. 이 건물이 완성되면 현재 가정집을 빌려 예배드리던 성도 80명이 드디어 자신들의 예배 공간을 갖게 됩니다.`,
    images: [
      "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80",
      "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80",
    ],
    prayerTopics: [
      "교회 건물 공사가 안전하고 순조롭게 진행되도록",
      "겨울 구제 사역을 통해 만난 분들이 복음을 듣게 되도록",
      "정현우 선교사 가정의 건강 (특히 어린 자녀들의 감기 조심)",
      "내년 봄 교회 건물 완공을 위한 지속적인 후원을 위해",
    ],
  },
  {
    id: "report-2026-01-kim",
    missionaryId: "kim-jungsoo",
    missionary: MISSIONARIES[0],
    title: "2026년 1월 신년 사역 계획 및 현지 교회 현황 보고",
    date: "2026-01-15",
    thumbnail: "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=600&q=80",
    summary: "새해를 맞아 수라바야 현지 교회 3곳과 함께 신년 예배를 드렸습니다. 올해 사역 목표와 기도 제목을 나눕니다.",
    content: `기쁨의교회 성도 여러분, 새해 복 많이 받으세요!\n\n2026년 첫 선교보고를 드립니다. 새해 첫날, 수라바야 현지 교회 3곳의 성도들과 함께 신년 예배를 드렸습니다. 총 120여 명이 모여 새해를 하나님께 드리는 시간을 가졌습니다.\n\n올해 사역의 주요 목표는 세 가지입니다. 첫째, 현지 청년 리더 10명 추가 훈련. 둘째, 방과 후 성경 교실 참가 어린이 50명 달성. 셋째, 새로운 마을 2곳에 복음 전도 시작입니다.\n\n지난 한 해 기쁨의교회 성도님들의 기도와 후원으로 많은 일들이 이루어졌습니다. 올해도 함께해 주시길 부탁드립니다.`,
    images: [
      "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&q=80",
    ],
    prayerTopics: [
      "2026년 세 가지 사역 목표가 이루어지도록",
      "현지 청년 리더들의 영적 성장을 위해",
      "새로운 마을 복음 전도의 문이 열리도록",
    ],
  },
];
