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

const officeServices = [
  { title: "새가족 등록", desc: "새가족 등록 신청 화면으로 이동하여 접수할 수 있습니다.", icon: "👋", href: "/support/new-member" },
  { title: "주보 광고신청", desc: "성도 로그인 후 주보 광고와 부서 안내 게재를 신청할 수 있습니다.", icon: "📰", href: "/support/bulletin-ad" },
  { title: "헌금 조회", desc: "현재 온라인 조회는 준비 중입니다. 행정실로 문의해 주세요.", icon: "💰" },
  { title: "봉사 신청", desc: "현재 온라인 접수는 준비 중입니다. 담당 부서 또는 행정실로 문의해 주세요.", icon: "🙌" },
  { title: "증명서 발급", desc: "현재 온라인 발급은 준비 중입니다. 필요한 서류는 행정실로 문의해 주세요.", icon: "📄" },
  { title: "상담 신청", desc: "현재 온라인 접수는 준비 중입니다. 행정실로 연락해 일정을 문의해 주세요.", icon: "💬" },
  { title: "기타 문의", desc: "교회 관련 문의는 행정실에서 안내해 드립니다.", icon: "❓" },
];

export default function OnlineOfficePage() {
  return (
    <SupportPageWrapper title="온라인 사무국" activeHref="/support/office">
      <p className="text-gray-600 mb-8">현재 온라인 처리 기능은 순차 준비 중입니다. 접수 가능한 항목과 행정실 문의 항목을 구분해 안내합니다.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {officeServices.map((service, i) => {
          const commonClass =
            "text-left border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all cursor-pointer group";

          if (service.href) {
            return (
              <Link key={i} href={service.href} className={commonClass}>
                <div className="text-3xl mb-3">{service.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#2d6a4f]">{service.title}</h3>
                <p className="text-gray-600 text-sm">{service.desc}</p>
              </Link>
            );
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => notifyOfficeContact(service.title)}
              className={commonClass}
            >
              <div className="text-3xl mb-3">{service.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#2d6a4f]">{service.title}</h3>
              <p className="text-gray-600 text-sm">{service.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-10 bg-gray-50 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Building className="w-5 h-5 text-[#2d6a4f]" /> 교회 행정실 운영 시간</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div><p className="font-medium text-gray-800">평일</p><p>월~금 09:00 ~ 18:00</p></div>
          <div><p className="font-medium text-gray-800">주일</p><p>08:00 ~ 14:00</p></div>
        </div>
        <p className="mt-3 text-[#2d6a4f] font-semibold">📞 054-270-1000</p>
      </div>
    </SupportPageWrapper>
  );
}
