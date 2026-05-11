/**
 * SundaySchool.tsx
 * 교회학교 전체 부서 페이지 (영아부 ~ AWANA)
 * 디자인: DepartmentPage 템플릿 재사용
 */

import { DepartmentPage, type DepartmentInfo } from "@/components/PageTemplates";

const kidsImg = "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80";
const youthImg = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80";
const adultImg = "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80";

// ── 각 부서 데이터 ──
const departments: Record<string, DepartmentInfo> = {
  infant: {
    name: "영아부",
    ageRange: "0 ~ 24개월",
    vision: "하나님의 사랑 안에서 자라는 아이들",
    description: "영아부는 0~24개월의 영아들을 위한 부서입니다. 부모와 함께 예배드리며, 하나님의 사랑을 온몸으로 느낄 수 있는 환경을 제공합니다. 전문 교사들이 안전하고 따뜻한 환경에서 아이들을 돌봅니다.",
    image: kidsImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 1층 영아부실" }],
    programs: ["감각 놀이 예배", "부모 교육 프로그램", "영아 찬양", "성경 이야기 (그림책)"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  toddler: {
    name: "유아부",
    ageRange: "만 2 ~ 4세",
    vision: "말씀으로 자라는 어린 새싹",
    description: "유아부는 만 2~4세 아이들을 위한 부서입니다. 노래와 율동, 그림 성경 이야기를 통해 하나님을 처음 만나는 소중한 시간을 갖습니다. 아이들의 눈높이에 맞는 예배와 교육으로 신앙의 첫 걸음을 내딛습니다.",
    image: kidsImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 1층 유아부실" }],
    programs: ["율동 찬양 예배", "성경 이야기 (그림)", "만들기 활동", "성경 암송"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  kindergarten: {
    name: "유치부",
    ageRange: "만 5 ~ 7세",
    vision: "예수님을 닮아가는 어린이",
    description: "유치부는 만 5~7세 아이들을 위한 부서입니다. 체계적인 성경 교육과 다양한 활동을 통해 하나님을 알아가고 예수님을 닮아가는 신앙을 형성합니다. 또래 친구들과 함께 신앙 공동체를 경험합니다.",
    image: kidsImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 2층 유치부실" }],
    programs: ["어린이 예배", "성경 퀴즈", "찬양 율동", "성경 암송", "미술 활동", "성경 캠프 (여름)"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  elementary1: {
    name: "유년부",
    ageRange: "초등학교 1 ~ 2학년",
    vision: "말씀을 사랑하는 어린이",
    description: "유년부는 초등학교 1~2학년 어린이들을 위한 부서입니다. 본격적인 성경 공부와 암송을 통해 말씀의 기초를 쌓고, 예배의 즐거움을 발견합니다. 소그룹 활동을 통해 신앙 친구들과 함께 자랍니다.",
    image: kidsImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 2층 유년부실" }],
    programs: ["어린이 예배", "성경 암송 대회", "소그룹 나눔", "전도 훈련", "여름 성경학교"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  elementary2: {
    name: "초등부",
    ageRange: "초등학교 3 ~ 4학년",
    vision: "하나님의 꿈을 꾸는 어린이",
    description: "초등부는 초등학교 3~4학년 어린이들을 위한 부서입니다. 성경 말씀을 통해 하나님의 꿈을 발견하고, 다양한 사역 활동을 통해 섬김의 삶을 배웁니다. 활동적이고 역동적인 예배로 신앙의 열정을 키웁니다.",
    image: kidsImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 3층 초등부실" }],
    programs: ["어린이 예배", "성경 퀴즈 대회", "찬양팀 활동", "봉사 활동", "여름 캠프"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  elementary3: {
    name: "소년부",
    ageRange: "초등학교 5 ~ 6학년",
    vision: "다음 세대를 이끄는 리더",
    description: "소년부는 초등학교 5~6학년 어린이들을 위한 부서입니다. 신앙의 기초를 더욱 단단히 하고, 리더십을 개발하는 시기입니다. 제자훈련의 기초 과정을 통해 다음 세대 리더로 세워집니다.",
    image: youthImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 3층 소년부실" }],
    programs: ["어린이 예배", "리더십 훈련", "성경 통독", "봉사 프로젝트", "수련회 (여름/겨울)"],
    teachers: [{ name: "부서 담당자", role: "부장" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  youth: {
    name: "청소년부",
    ageRange: "중학교 1학년 ~ 고등학교 3학년",
    vision: "세상을 변화시키는 다음 세대",
    description: "청소년부는 중·고등학생들을 위한 부서입니다. 정체성의 혼란을 겪는 청소년 시기에 하나님 안에서 자신의 정체성을 발견하고, 세상을 변화시킬 다음 세대 리더로 세워집니다.\n\n활동적인 예배와 소그룹 나눔, 다양한 문화 활동을 통해 신앙과 삶이 하나 되는 청소년을 양육합니다.",
    image: youthImg,
    schedule: [
      { day: "주일", time: "오전 11시", place: "교육관 4층 청소년부실" },
      { day: "금요일", time: "오후 7시", place: "교육관 4층 청소년부실" },
    ],
    programs: ["청소년 예배", "소그룹 나눔", "제자훈련 기초", "문화 사역 (음악/미디어)", "수련회", "선교 여행"],
    teachers: [{ name: "부서 담당자", role: "담당" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  youngAdult: {
    name: "청년부",
    ageRange: "19세 ~ 35세",
    vision: "하나님 나라를 위해 헌신하는 청년",
    description: "청년부는 19~35세 청년들을 위한 부서입니다. 대학생부터 직장인까지 다양한 청년들이 함께 모여 예배하고 교제합니다. 사회 속에서 그리스도인으로 살아가는 방법을 함께 고민하고 훈련합니다.\n\n활발한 소그룹 활동, 선교 참여, 봉사 활동을 통해 하나님 나라를 위해 헌신하는 청년 공동체를 이룹니다.",
    image: youthImg,
    schedule: [
      { day: "주일", time: "오전 11시", place: "본관 소예배실" },
      { day: "목요일", time: "오후 7시 30분", place: "본관 소예배실" },
    ],
    programs: ["청년 예배", "소그룹 나눔", "제자훈련", "선교 참여", "직장인 모임", "청년 수련회"],
    teachers: [{ name: "부서 담당자", role: "담당" }, { name: "부서 간사", role: "간사" }, { name: "부서 간사", role: "간사" }],
  },
  hope: {
    name: "소망부",
    ageRange: "장애인 성도",
    vision: "모두가 하나 되는 예배 공동체",
    description: "소망부는 장애를 가진 성도들을 위한 특별 부서입니다. 장애의 유무와 관계없이 모든 성도가 동등하게 예배드리고 공동체의 일원으로 섬길 수 있도록 돕습니다.\n\n전문 교사들이 각 성도의 필요에 맞는 맞춤형 예배와 교육을 제공하며, 가족들과 함께하는 프로그램도 운영합니다.",
    image: adultImg,
    schedule: [{ day: "주일", time: "오전 11시", place: "교육관 1층 소망부실" }],
    programs: ["특별 예배", "재활 프로그램", "가족 지원 프로그램", "사회 통합 활동"],
    teachers: [{ name: "부서 담당자", role: "담당" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
  adult: {
    name: "장년부",
    ageRange: "36세 이상 성인",
    vision: "성숙한 신앙으로 교회를 세우는 장년",
    description: "장년부는 36세 이상 성인 성도들을 위한 부서입니다. 신앙의 성숙을 이루고, 교회와 가정과 사회에서 그리스도인으로서의 역할을 감당하도록 돕습니다.\n\n다양한 소그룹(순 모임)을 통해 깊은 교제와 나눔이 이루어지며, 각 연령대와 상황에 맞는 맞춤형 프로그램을 제공합니다.",
    image: adultImg,
    schedule: [
      { day: "주일", time: "오전 9시 / 11시 / 오후 2시", place: "본관 대예배실" },
    ],
    programs: ["주일 예배", "소그룹 나눔 (순 모임)", "성경 공부", "부부 세미나", "장년 수련회"],
    teachers: [{ name: "담임목사", role: "담당" }, { name: "부서 담당자", role: "담당" }],
  },
  awana: {
    name: "AWANA",
    ageRange: "유치원 ~ 초등학교 6학년",
    vision: "말씀으로 무장된 어린이 사역",
    description: "AWANA(Approved Workmen Are Not Ashamed)는 성경 암송을 중심으로 한 국제적인 어린이 사역 프로그램입니다. 기쁨의교회는 AWANA 공인 클럽으로 운영되며, 체계적인 성경 암송과 게임, 예배를 통해 어린이들의 신앙을 훈련합니다.\n\n매주 금요일 저녁에 모이며, 유니폼을 입고 팀별 활동을 통해 말씀을 즐겁게 배웁니다.",
    image: kidsImg,
    schedule: [{ day: "금요일", time: "오후 7시", place: "교육관 체육관" }],
    programs: ["성경 암송 훈련", "팀 게임 활동", "AWANA 예배", "포인트 시스템", "연말 시상식"],
    teachers: [{ name: "부서 담당자", role: "클럽 디렉터" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }, { name: "부서 교사", role: "교사" }],
  },
};

// ── 페이지 컴포넌트 ──
export function InfantPage() { return <DepartmentPage breadcrumb={["교회학교", "영아부"]} info={departments.infant} />; }
export function ToddlerPage() { return <DepartmentPage breadcrumb={["교회학교", "유아부"]} info={departments.toddler} />; }
export function KindergartenPage() { return <DepartmentPage breadcrumb={["교회학교", "유치부"]} info={departments.kindergarten} />; }
export function Elementary1Page() { return <DepartmentPage breadcrumb={["교회학교", "유년부"]} info={departments.elementary1} />; }
export function Elementary2Page() { return <DepartmentPage breadcrumb={["교회학교", "초등부"]} info={departments.elementary2} />; }
export function Elementary3Page() { return <DepartmentPage breadcrumb={["교회학교", "소년부"]} info={departments.elementary3} />; }
export function YouthPage() { return <DepartmentPage breadcrumb={["교회학교", "청소년부"]} info={departments.youth} />; }
export function YoungAdultPage() { return <DepartmentPage breadcrumb={["교회학교", "청년부"]} info={departments.youngAdult} />; }
export function HopePage() { return <DepartmentPage breadcrumb={["교회학교", "소망부"]} info={departments.hope} />; }
export function AdultPage() { return <DepartmentPage breadcrumb={["교회학교", "장년부"]} info={departments.adult} />; }
export function AwanaPage() { return <DepartmentPage breadcrumb={["교회학교", "AWANA"]} info={departments.awana} />; }
