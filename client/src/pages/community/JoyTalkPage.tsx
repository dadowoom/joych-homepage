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

const joyTalkPosts = [
  { author: "기쁨의교회", date: "공지 예정", title: "기쁨톡 게시판은 준비 중입니다", content: "성도 나눔 게시판은 운영 정책과 개인정보 보호 기준을 확정한 뒤 제공됩니다.", replies: 0 },
];

export default function JoyTalkPage() {
  return (
    <PageWrapper title="기쁨톡" breadcrumb={["커뮤니티", "기쁨톡"]}>
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">성도들이 자유롭게 소통하는 공간입니다.</p>
        <button
          type="button"
          onClick={() => notifyOfficeContact("기쁨톡 글쓰기")}
          className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors"
        >
          글쓰기
        </button>
      </div>
      <div className="space-y-4">
        {joyTalkPosts.map((post, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 hover:text-[#2d6a4f]">{post.title}</h3>
              <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">{post.date}</span>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.content}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>✍️ {post.author}</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.replies}개의 댓글</span>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
