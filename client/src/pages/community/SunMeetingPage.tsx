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

const sunGroups = [
  { name: "순모임 1", leader: "담당 순장", members: 8, day: "화요일 오후 7시", place: "교육관 301호" },
  { name: "순모임 2", leader: "담당 순장", members: 6, day: "목요일 오후 7시 30분", place: "교육관 302호" },
  { name: "순모임 3", leader: "담당 순장", members: 10, day: "수요일 오후 8시", place: "교육관 303호" },
  { name: "순모임 4", leader: "담당 순장", members: 7, day: "금요일 오후 7시", place: "교육관 304호" },
  { name: "순모임 5", leader: "담당 순장", members: 9, day: "토요일 오전 10시", place: "교육관 305호" },
  { name: "순모임 6", leader: "담당 순장", members: 5, day: "화요일 오전 10시", place: "교육관 306호" },
];

export default function SunMeetingPage() {
  return (
    <PageWrapper title="순모임" breadcrumb={["커뮤니티", "순모임"]}>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-4 font-['Noto_Serif_KR']">소그룹 순모임 안내</h2>
        <p className="text-gray-600 leading-relaxed">
          순모임은 기쁨의교회의 핵심 소그룹 공동체입니다. 10명 내외의 소그룹으로 모여 말씀을 나누고, 서로의 삶을 돌보며, 함께 기도합니다.
          새가족이시라면 담당 전도사님을 통해 가장 가까운 순모임에 연결해 드립니다.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {sunGroups.map((g, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#d8f3dc] rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{g.name}</h3>
                <p className="text-sm text-gray-500">순장: {g.leader}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>👥 구성원: {g.members}명</p>
              <p>📅 모임: {g.day}</p>
              <p>📍 장소: {g.place}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#d8f3dc] rounded-xl p-6">
        <h3 className="font-bold text-[#1b4332] mb-2">순모임 참여 신청</h3>
        <p className="text-gray-700 text-sm mb-4">새가족이시거나 순모임에 참여를 원하시면 교회 행정실로 연락해 주세요.</p>
        <p className="text-[#2d6a4f] font-semibold">📞 054-270-1000</p>
      </div>
    </PageWrapper>
  );
}
