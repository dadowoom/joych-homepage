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

export default function DonationReceiptPage() {
  return (
    <SupportPageWrapper title="기부금 영수증" activeHref="/support/donation">
      <div className="max-w-2xl">
        <div className="bg-[#d8f3dc] rounded-xl p-6 mb-8">
          <h2 className="font-bold text-[#1b4332] mb-2 flex items-center gap-2">
            <Receipt className="w-5 h-5" /> 기부금 영수증 발급 안내
          </h2>
          <ul className="text-gray-700 text-sm space-y-2">
            <li>• 기부금 영수증은 연말정산 시 소득공제를 받을 수 있습니다.</li>
            <li>• 발급 기간: 매년 1월 1일 ~ 2월 28일</li>
            <li>• 발급은 교회 행정실 문의 후 안내받아 주세요.</li>
            <li>• 문의: 054-270-1000 (행정실)</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-4">
          <p className="text-sm text-amber-900 leading-relaxed">
            주민등록번호 등 민감한 개인정보는 홈페이지 입력폼으로 받지 않습니다. 안전한 발급을 위해 교회 행정실을 통해 안내받아 주세요.
          </p>
        </div>
        <OfficeContactBox serviceName="기부금 영수증 발급" />
        <button
          type="button"
          onClick={() => notifyOfficeContact("기부금 영수증 발급")}
          className="mt-4 w-full bg-[#2d6a4f] text-white py-3 rounded-lg font-semibold hover:bg-[#1b4332] transition-colors"
        >
          행정실 문의 안내
        </button>
      </div>
    </SupportPageWrapper>
  );
}
