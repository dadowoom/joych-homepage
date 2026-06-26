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

const clubs = [
  { name: "기쁨 산악회", desc: "매월 둘째 주 토요일 등산 모임. 자연 속에서 하나님의 창조를 느끼며 교제합니다.", members: 35, icon: "⛰️" },
  { name: "기쁨 독서클럽", desc: "매월 한 권의 책을 함께 읽고 나누는 독서 모임. 신앙 서적 중심.", members: 20, icon: "📚" },
  { name: "기쁨 테니스회", desc: "매주 토요일 오전 테니스 모임. 초보자도 환영합니다.", members: 18, icon: "🎾" },
  { name: "기쁨 사진클럽", desc: "사진을 통해 하나님의 아름다운 세계를 기록하는 모임.", members: 15, icon: "📷" },
  { name: "기쁨 요리클럽", desc: "함께 요리하고 나누는 친교 모임. 매월 셋째 주 토요일.", members: 22, icon: "🍳" },
  { name: "기쁨 골프회", desc: "골프를 통한 성도 간 친목 도모. 월 1회 라운딩.", members: 25, icon: "⛳" },
];

export default function ClubPage() {
  return (
    <PageWrapper title="동호회" breadcrumb={["커뮤니티", "동호회"]}>
      <p className="text-gray-600 mb-8 leading-relaxed">
        기쁨의교회 동호회는 같은 취미를 가진 성도들이 함께 모여 교제하고 신앙을 나누는 공동체입니다. 새로운 동호회 창설을 원하시면 교회 행정실로 문의해 주세요.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clubs.map((club, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="text-4xl mb-3">{club.icon}</div>
            <h3 className="font-bold text-gray-900 mb-2">{club.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{club.desc}</p>
            <p className="text-[#2d6a4f] text-sm font-semibold">👥 회원 {club.members}명</p>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
