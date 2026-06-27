import { Fragment, useState } from "react";
import { Link } from "wouter";
import {
  Building,
  FileText,
  MapPin,
  MessageCircle,
  Paperclip,
  Receipt,
  Search,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ViewModeToggle, type ViewMode } from "@/components/dynamic-page/ViewModeToggle";
import {
  PageWrapper,
  SupportPageWrapper,
  notifyOfficeContact,
  OfficeContactBox,
  formatSupportDate,
  isToday,
  fileToBase64,
  getEmptyVisitForm,
} from "./_shared";

const organizations = [
  { name: "기쁨의교회 남선교회", desc: "교회 내 남성 성도들의 신앙 공동체. 매월 첫째 주 토요일 모임.", icon: "🙏" },
  { name: "기쁨의교회 여선교회", desc: "교회 내 여성 성도들의 신앙 공동체. 다양한 봉사와 선교 활동 전개.", icon: "🌸" },
  { name: "기쁨의교회 청년회", desc: "19~35세 청년들의 자치 기관. 청년 문화 사역 및 봉사 활동.", icon: "✨" },
  { name: "기쁨의교회 장로회", desc: "교회 장로들의 협의 기관. 교회 행정과 영적 지도력 담당.", icon: "⚓" },
  { name: "기쁨의교회 권사회", desc: "교회 권사들의 협의 기관. 중보기도와 성도 돌봄 사역.", icon: "💐" },
  { name: "기쁨의교회 집사회", desc: "교회 집사들의 협의 기관. 교회 봉사와 섬김 사역 담당.", icon: "🤝" },
];

export default function OrganizationPage() {
  return (
    <PageWrapper title="자치기관" breadcrumb={["커뮤니티", "자치기관"]}>
      <p className="text-gray-600 mb-8 leading-relaxed">
        기쁨의교회 각 자치기관은 교회 공동체를 더욱 풍성하게 세워가는 중요한 역할을 담당합니다. 각 기관은 자체적인 모임과 활동을 통해 성도들의 신앙 성장과 교회 사역에 헌신합니다.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        {organizations.map((org, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex gap-4">
            <div className="text-3xl">{org.icon}</div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">{org.name}</h3>
              <p className="text-gray-600 text-sm">{org.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
