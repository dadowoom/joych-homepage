import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { getSupportSideMenuItems } from "@/lib/supportSideMenu";

export function notifyOfficeContact(serviceName: string) {
  window.alert(`${serviceName} 온라인 접수 기능은 준비 중입니다. 교회 행정실(054-270-1000)로 문의해 주세요.`);
}

export function OfficeContactBox({ serviceName }: { serviceName: string }) {
  return (
    <div className="rounded-xl border border-[#d8f3dc] bg-[#f1f8f3] p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <Phone className="w-5 h-5 text-[#2d6a4f]" />
        </div>
        <div>
          <h3 className="font-bold text-[#1b4332] mb-2">온라인 접수 준비 중</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {serviceName}은 현재 홈페이지에서 바로 저장되지 않습니다. 접수나 상담이 필요하시면 교회 행정실로 문의해 주세요.
          </p>
          <p className="mt-3 text-[#2d6a4f] font-semibold">054-270-1000</p>
        </div>
      </div>
    </div>
  );
}

// ── 공통 페이지 래퍼 ──
export function PageWrapper({ title, breadcrumb, children }: { title: string; breadcrumb: string[]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* 상단 배너 */}
      <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-3">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {item}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold font-['Noto_Serif_KR']">{title}</h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-[#2d6a4f] hover:underline mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> 뒤로 가기
        </button>
        {children}
      </div>
    </div>
  );
}

export function SupportPageWrapper({
  title,
  activeHref,
  children,
}: {
  title: string;
  activeHref: string;
  children: ReactNode;
}) {
  const { data: allMenus } = trpc.home.menus.useQuery();
  const { parentLabel, sideMenuItems } = getSupportSideMenuItems(allMenus, activeHref);

  return (
    <SubPageLayout pageTitle={title} parentLabel={parentLabel} sideMenuItems={sideMenuItems}>
      {children}
    </SubPageLayout>
  );
}

export function getEmptyVisitForm() {
  return {
    organizationName: "",
    applicantName: "",
    phone: "",
    email: "",
    visitDate: "",
    visitTime: "",
    headcount: "1",
    visitorType: "church",
    purpose: "",
    message: "",
    agreePrivacy: false,
  };
}

export function getTodayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatSupportDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function isToday(value: string | Date | null | undefined) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
