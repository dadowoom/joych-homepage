/**
 * Ministry.tsx
 * 양육/훈련 + 사역/선교 하위 메뉴 전체 페이지
 * 화면 템플릿은 유지하고, 본문 데이터는 CMS static_page 콘텐츠를 우선 사용합니다.
 */

import { MinistryPage, type MinistryInfo } from "@/components/PageTemplates";
import { useStaticPageContent } from "@/hooks/useStaticPageContent";
import { getStaticPageSeed } from "@shared/staticPageContent";

function getFallbackInfo(href: string): MinistryInfo {
  const seed = getStaticPageSeed(href);
  if (!seed || seed.template !== "ministry") {
    throw new Error(`등록되지 않은 사역 페이지입니다: ${href}`);
  }
  return seed.content as MinistryInfo;
}

function StaticMinistryPage({
  href,
  title,
  breadcrumb,
}: {
  href: string;
  title: string;
  breadcrumb: string[];
}) {
  const info = useStaticPageContent<MinistryInfo>(href, getFallbackInfo(href));
  return <MinistryPage title={title} breadcrumb={breadcrumb} info={info} />;
}

export function HesedAsiaPage() {
  return <StaticMinistryPage href="/education/hesed" title="헤세드아시아포재팬" breadcrumb={["양육/훈련", "헤세드아시아포재팬"]} />;
}

export function DiscipleTrainingPage() {
  return <StaticMinistryPage href="/education/disciple2" title="제자훈련" breadcrumb={["양육/훈련", "제자훈련"]} />;
}

export function ElderTrainingPage() {
  return <StaticMinistryPage href="/education/elder" title="순장 훈련" breadcrumb={["양육/훈련", "순장"]} />;
}

export function OneOnOnePage() {
  return <StaticMinistryPage href="/education/one-on-one" title="일대일 양육" breadcrumb={["양육/훈련", "일대일양육"]} />;
}

export function SunseumSchoolPage() {
  return <StaticMinistryPage href="/education/sunseumschool" title="순세움학교" breadcrumb={["양육/훈련", "순세움학교"]} />;
}

export function SaengseonConferencePage() {
  return <StaticMinistryPage href="/education/saengseon" title="생선 컨퍼런스" breadcrumb={["양육/훈련", "생선 컨퍼런스"]} />;
}

export function WorldMissionPage() {
  return <StaticMinistryPage href="/ministry/world-mission" title="세계선교부" breadcrumb={["사역/선교", "세계선교부"]} />;
}

export function EvangelismPage() {
  return <StaticMinistryPage href="/ministry/evangelism" title="기쁨의 전도부" breadcrumb={["사역/선교", "기쁨의 전도부"]} />;
}

export function PrayerMinistryPage() {
  return <StaticMinistryPage href="/ministry/prayer" title="기도사역부" breadcrumb={["사역/선교", "기도사역부"]} />;
}

export function WelfarePage() {
  return <StaticMinistryPage href="/ministry/welfare" title="기쁨의 복지재단" breadcrumb={["사역/선교", "기쁨의 복지재단"]} />;
}

export function VisionUniversityPage() {
  return <StaticMinistryPage href="/ministry/vision-univ" title="비전대학" breadcrumb={["사역/선교", "비전대학"]} />;
}

export function JoyLabPage() {
  return <StaticMinistryPage href="/ministry/joylab" title="조이랩" breadcrumb={["사역/선교", "조이랩"]} />;
}
