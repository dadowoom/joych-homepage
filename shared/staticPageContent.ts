export type MinistryInfoContent = {
  name: string;
  vision?: string;
  description: string;
  image?: string;
  activities?: { title: string; desc: string; icon?: string }[];
  contact?: { label: string; value: string }[];
  leader?: { name: string; title: string; photo?: string };
};

export type StaticPageTemplate = "ministry";

export type StaticPageContent = MinistryInfoContent;

export type StaticPageSeed = {
  href: string;
  group: string;
  title: string;
  template: StaticPageTemplate;
  content: StaticPageContent;
};

const churchImg = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600https://images.unsplash.com/photo-1438232992991-995b671e4668?w=600&q=80q=80";
const bibleImg = "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80";
const prayerImg = "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=600&q=80";
const missionImg = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80";
const communityImg = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80";

export const STATIC_PAGE_SEEDS: StaticPageSeed[] = [
  {
    href: "/education/hesed",
    group: "양육/훈련",
    title: "헤세드아시아포재팬",
    template: "ministry",
    content: {
      name: "헤세드아시아포재팬",
      vision: "일본을 향한 선교적 양육",
      description: "헤세드아시아포재팬은 일본 선교를 위한 특별 양육 과정입니다. 일본의 문화와 언어를 이해하고, 복음을 효과적으로 전하기 위한 선교사 훈련 프로그램입니다.\n\n기쁨의교회는 일본 선교에 특별한 부담을 가지고 이 사역을 진행하고 있으며, 매년 일본 현지 방문 및 단기 선교를 통해 실제적인 선교 경험을 쌓고 있습니다.",
      image: missionImg,
      activities: [
        { title: "일본어 기초 과정", desc: "선교를 위한 일본어 기초 회화 및 성경 용어 학습" },
        { title: "일본 문화 이해", desc: "일본의 종교적 배경과 문화적 특성 이해 교육" },
        { title: "단기 선교 파송", desc: "연 1회 일본 현지 단기 선교팀 파송" },
        { title: "일본 선교사 지원", desc: "현지 사역 선교사와의 연계 및 후원" },
      ],
      contact: [{ label: "담당 부서", value: "세계선교부" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/education/disciple2",
    group: "양육/훈련",
    title: "제자훈련",
    template: "ministry",
    content: {
      name: "제자훈련",
      vision: "예수님의 제자를 세우는 훈련",
      description: "기쁨의교회 제자훈련은 성경적 원리에 기초하여 그리스도의 제자를 세우는 핵심 양육 과정입니다. 1년 과정으로 진행되며, 말씀 묵상, 기도, 전도, 섬김의 삶을 훈련합니다.\n\n매주 소그룹 모임을 통해 삶을 나누고, 서로를 세워가는 공동체적 훈련이 이루어집니다.",
      image: bibleImg,
      activities: [
        { title: "말씀 묵상 훈련", desc: "매일 QT(큐티)를 통한 체계적인 말씀 묵상 훈련" },
        { title: "기도 훈련", desc: "개인 기도와 중보기도의 삶을 훈련" },
        { title: "전도 훈련", desc: "복음 제시 방법과 전도 실습" },
        { title: "소그룹 리더십", desc: "순 모임을 이끄는 리더십 훈련" },
        { title: "성경 통독", desc: "1년 성경 통독 과정 완주" },
        { title: "섬김의 삶", desc: "교회 봉사와 지역사회 섬김 실천" },
      ],
      contact: [{ label: "훈련 기간", value: "매년 3월 ~ 12월 (10개월)" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/education/elder",
    group: "양육/훈련",
    title: "순장 훈련",
    template: "ministry",
    content: {
      name: "순장 훈련",
      vision: "소그룹을 이끄는 리더 세우기",
      description: "순장 훈련은 소그룹(순 모임)을 이끌어갈 리더를 세우는 훈련 과정입니다. 제자훈련을 수료한 성도들이 참여하며, 소그룹 인도법, 상담, 돌봄 등 실제적인 리더십 역량을 키웁니다.\n\n기쁨의교회의 모든 순장은 이 과정을 통해 검증되고 세워집니다.",
      image: communityImg,
      activities: [
        { title: "소그룹 인도법", desc: "효과적인 순 모임 인도 방법 훈련" },
        { title: "성도 돌봄", desc: "순원들을 돌보고 세우는 목양 훈련" },
        { title: "상담 기초", desc: "기독교 상담의 기초 원리 학습" },
        { title: "리더십 개발", desc: "섬기는 리더십의 원리와 실천" },
      ],
      contact: [{ label: "대상", value: "제자훈련 수료자" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/education/one-on-one",
    group: "양육/훈련",
    title: "일대일 양육",
    template: "ministry",
    content: {
      name: "일대일 양육",
      vision: "개인 맞춤형 신앙 성장",
      description: "일대일 양육은 신앙 성장을 원하는 성도와 훈련된 양육자가 1:1로 만나 성경 말씀을 함께 공부하고 신앙을 성장시켜 나가는 양육 프로그램입니다.\n\n새가족부터 기존 성도까지 누구나 참여할 수 있으며, 각자의 신앙 수준에 맞는 맞춤형 양육이 이루어집니다.",
      image: bibleImg,
      activities: [
        { title: "기초 신앙 과정", desc: "구원의 확신, 기도, 말씀, 교회 생활 기초" },
        { title: "성경 공부", desc: "체계적인 성경 공부를 통한 말씀 이해" },
        { title: "신앙 상담", desc: "개인적인 신앙 고민과 문제 상담" },
        { title: "영적 멘토링", desc: "삶의 전반에 걸친 영적 멘토링" },
      ],
      contact: [{ label: "신청 방법", value: "교회 행정실 방문 또는 전화 신청" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/education/sunseumschool",
    group: "양육/훈련",
    title: "순세움학교",
    template: "ministry",
    content: {
      name: "순세움학교",
      vision: "건강한 소그룹 문화 세우기",
      description: "순세움학교는 기쁨의교회 소그룹(순 모임) 문화를 건강하게 세워가기 위한 집중 훈련 과정입니다. 순장과 순원이 함께 참여하여 소그룹의 본질과 방향을 재정립합니다.\n\n매년 상반기에 집중 과정으로 진행되며, 소그룹 활성화를 위한 실제적인 도구와 방법을 배웁니다.",
      image: communityImg,
      activities: [
        { title: "소그룹 본질 이해", desc: "성경적 소그룹의 의미와 목적 재발견" },
        { title: "관계 훈련", desc: "신뢰와 사랑을 기반으로 한 관계 형성" },
        { title: "나눔 훈련", desc: "삶을 나누는 건강한 나눔 문화 훈련" },
        { title: "전도 소그룹", desc: "전도 중심의 소그룹 운영 방법" },
      ],
      contact: [{ label: "일정", value: "매년 3월 (집중 과정 2주)" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/education/saengseon",
    group: "양육/훈련",
    title: "생선 컨퍼런스",
    template: "ministry",
    content: {
      name: "생선 컨퍼런스",
      vision: "생명을 살리는 선교 컨퍼런스",
      description: "생선 컨퍼런스는 기쁨의교회가 주관하는 선교 및 전도 집중 훈련 컨퍼런스입니다. '생선'은 '생명을 살리는 선교'의 줄임말로, 매년 수백 명의 성도들이 참여하는 대형 행사입니다.\n\n국내외 유명 강사를 초청하여 선교의 비전과 전략을 나누며, 참가자들이 선교사적 삶을 살도록 도전합니다.",
      image: missionImg,
      activities: [
        { title: "주제 강의", desc: "국내외 선교 전문가의 특별 강의" },
        { title: "워크숍", desc: "전도 및 선교 실습 워크숍" },
        { title: "간증 나눔", desc: "선교사 및 전도자들의 현장 간증" },
        { title: "선교 전시", desc: "세계 선교 현황 전시 및 선교사 만남" },
      ],
      contact: [{ label: "일정", value: "매년 3월 (3일간)" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/world-mission",
    group: "사역/선교",
    title: "세계선교부",
    template: "ministry",
    content: {
      name: "세계선교부",
      vision: "땅 끝까지 복음을 전하라",
      description: "기쁨의교회 세계선교부는 전 세계 선교사 파송과 지원을 담당하는 핵심 사역 부서입니다. 현재 20여 개국에 30여 명의 선교사를 파송하고 있으며, 지속적인 기도와 재정 지원을 통해 세계 선교에 헌신하고 있습니다.\n\n단기 선교팀 파송, 선교사 자녀 지원, 현지 교회 개척 지원 등 다양한 방식으로 세계 선교에 참여합니다.",
      image: missionImg,
      activities: [
        { title: "선교사 파송", desc: "장기 선교사 훈련 및 파송 지원" },
        { title: "단기 선교", desc: "연 2회 단기 선교팀 파송 (여름/겨울)" },
        { title: "선교사 케어", desc: "파송 선교사 정기 방문 및 돌봄" },
        { title: "선교 기도회", desc: "매월 선교사를 위한 중보기도회" },
        { title: "선교 헌금", desc: "선교 전용 헌금을 통한 재정 지원" },
        { title: "현지 교회 개척", desc: "선교지 현지 교회 개척 지원" },
      ],
      contact: [{ label: "담당", value: "세계선교부장" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/evangelism",
    group: "사역/선교",
    title: "기쁨의 전도부",
    template: "ministry",
    content: {
      name: "기쁨의 전도부",
      vision: "이웃에게 복음을 전하는 교회",
      description: "기쁨의 전도부는 지역사회에 복음을 전하고 새가족을 교회로 인도하는 사역을 담당합니다. 다양한 전도 방법을 개발하고 훈련하여 모든 성도가 전도자로 살아갈 수 있도록 돕습니다.\n\n정기적인 노방 전도, 전도 폭발 훈련, 새가족 초청 행사 등을 통해 활발한 전도 사역을 펼치고 있습니다.",
      image: communityImg,
      activities: [
        { title: "노방 전도", desc: "매주 토요일 지역사회 노방 전도" },
        { title: "전도 폭발 훈련", desc: "체계적인 전도 방법 훈련 과정" },
        { title: "새가족 초청 행사", desc: "분기별 새가족 초청 특별 행사" },
        { title: "전도 세미나", desc: "전도 방법론 및 사례 공유 세미나" },
      ],
      contact: [{ label: "담당", value: "전도부장" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/prayer",
    group: "사역/선교",
    title: "기도사역부",
    template: "ministry",
    content: {
      name: "기도사역부",
      vision: "기도로 세워지는 교회",
      description: "기도사역부는 교회의 모든 사역이 기도 위에 세워질 수 있도록 중보기도 사역을 담당합니다. 24시간 기도 릴레이, 새벽기도회 운영, 특별 기도회 등을 통해 교회의 영적 기반을 든든히 합니다.\n\n성도들이 기도의 사람으로 세워질 수 있도록 기도 훈련과 기도 모임을 지속적으로 운영합니다.",
      image: prayerImg,
      activities: [
        { title: "새벽기도회", desc: "월~토 오전 5시 30분 새벽기도회 운영" },
        { title: "24시간 기도 릴레이", desc: "연 2회 24시간 찬양기도회 개최" },
        { title: "중보기도팀", desc: "교회와 성도를 위한 전문 중보기도팀 운영" },
        { title: "기도 훈련", desc: "기도의 원리와 방법 집중 훈련" },
      ],
      contact: [{ label: "담당", value: "기도사역부장" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/welfare",
    group: "사역/선교",
    title: "기쁨의 복지재단",
    template: "ministry",
    content: {
      name: "기쁨의 복지재단",
      vision: "사랑으로 섬기는 복지 사역",
      description: "기쁨의 복지재단은 기쁨의교회가 설립한 사회복지 기관으로, 지역사회의 소외된 이웃을 섬기는 사역을 담당합니다. 노인 복지, 아동 복지, 장애인 복지 등 다양한 분야에서 하나님의 사랑을 실천합니다.\n\n교회와 지역사회를 연결하는 다리 역할을 하며, 그리스도의 사랑을 구체적인 섬김으로 표현합니다.",
      image: communityImg,
      activities: [
        { title: "노인 돌봄 서비스", desc: "독거노인 방문 돌봄 및 식사 지원" },
        { title: "아동 교육 지원", desc: "저소득 가정 아동 학습 지원 프로그램" },
        { title: "장애인 사역", desc: "장애인 예배 및 사회 통합 프로그램" },
        { title: "긴급 복지 지원", desc: "위기 가정 긴급 생계 지원" },
      ],
      contact: [{ label: "주소", value: "경북 포항시 북구 상흥로 411" }, { label: "전화", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/vision-univ",
    group: "사역/선교",
    title: "비전대학",
    template: "ministry",
    content: {
      name: "비전대학",
      vision: "다음 세대 리더를 세우는 교육",
      description: "비전대학은 기쁨의교회가 운영하는 평신도 신학 교육 과정입니다. 성경, 신학, 선교, 상담 등 다양한 과목을 통해 평신도 사역자를 양성합니다.\n\n2년 과정으로 운영되며, 수료 후 교회 각 부서에서 전문적인 사역자로 활동할 수 있도록 준비시킵니다.",
      image: bibleImg,
      activities: [
        { title: "성경 신학 과정", desc: "구약/신약 성경 개론 및 신학 기초" },
        { title: "선교학 과정", desc: "선교학 개론 및 문화 인류학" },
        { title: "기독교 상담", desc: "기독교 상담의 이론과 실제" },
        { title: "예배학", desc: "예배의 신학과 실제적 예배 인도" },
      ],
      contact: [{ label: "과정 기간", value: "2년 (4학기)" }, { label: "문의", value: "054-270-1000" }],
    },
  },
  {
    href: "/ministry/joylab",
    group: "사역/선교",
    title: "조이랩",
    template: "ministry",
    content: {
      name: "조이랩",
      vision: "창의적 사역의 실험실",
      description: "조이랩(JoyLab)은 기쁨의교회의 창의적인 사역 실험 공간입니다. 미디어, 디자인, 음악, 기술 등 다양한 분야의 재능 있는 성도들이 모여 교회 사역을 더욱 풍성하게 만드는 창의적인 작업을 합니다.\n\n예배 미디어 제작, 교회 홍보물 디자인, 온라인 사역 개발 등 현대적인 방식으로 복음을 전하는 사역을 담당합니다.",
      image: churchImg,
      activities: [
        { title: "미디어 사역", desc: "예배 영상 촬영 및 편집, 유튜브 채널 운영" },
        { title: "디자인 사역", desc: "교회 홍보물, 주보, 현수막 디자인" },
        { title: "음악 사역", desc: "찬양팀 지원 및 음악 프로덕션" },
        { title: "IT 사역", desc: "교회 홈페이지 및 앱 개발·운영" },
      ],
      contact: [{ label: "담당", value: "조이랩 디렉터" }, { label: "문의", value: "054-270-1000" }],
    },
  },
];

export const STATIC_PAGE_HREFS = new Set(STATIC_PAGE_SEEDS.map((page) => page.href));

export function getStaticPageSeed(href: string) {
  return STATIC_PAGE_SEEDS.find((page) => page.href === href) ?? null;
}
