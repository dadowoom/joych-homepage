import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight, Pencil, Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { getSupportSideMenuItems } from "@/lib/supportSideMenu";
import {
  SUPPORT_BOARD_INTRO_DEFAULTS,
  SUPPORT_BOARD_INTRO_SETTING_KEYS,
  type SupportBoardIntroKind,
} from "@shared/supportBoardIntro";
import { toast } from "sonner";

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
    region: "",
    denomination: "",
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

export function SupportBoardIntro({
  kind,
  canManage,
}: {
  kind: SupportBoardIntroKind;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.home.settings.useQuery();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const description = settings?.[SUPPORT_BOARD_INTRO_SETTING_KEYS[kind]]?.trim()
    || SUPPORT_BOARD_INTRO_DEFAULTS[kind];
  const updateIntro = trpc.cms.supportRequests.updateBoardIntro.useMutation({
    onSuccess: async () => {
      await utils.home.settings.invalidate();
      setIsEditing(false);
      toast.success("신청 게시판 안내 문구가 저장됐습니다.");
    },
    onError: (error) => toast.error(error.message || "안내 문구 저장에 실패했습니다."),
  });

  return (
    <div className="mt-1">
      <p className="text-xs leading-5 text-gray-400">
        {description}
        {canManage && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setDraft(description);
              setIsEditing(true);
            }}
            className="ml-2 inline-flex items-center gap-1 font-medium text-[#1B5E20] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            안내 수정
          </button>
        )}
      </p>
      {canManage && isEditing && (
        <form
          className="mt-3 max-w-2xl border border-emerald-100 bg-emerald-50/60 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            updateIntro.mutate({ kind, description: draft });
          }}
        >
          <label className="block text-xs font-semibold text-gray-700">
            상단 안내 문구
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full resize-y border border-gray-300 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[#1B5E20]"
            />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="h-8 border border-gray-300 bg-white px-3 text-xs text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={updateIntro.isPending}
              className="inline-flex h-8 items-center gap-1 bg-[#1B5E20] px-3 text-xs font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {updateIntro.isPending ? "저장 중" : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
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
