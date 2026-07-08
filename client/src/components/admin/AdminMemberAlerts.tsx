import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type MemberAlertSummaryItem = {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  district: string | null;
  birthDate?: string | null;
  effectiveRegisteredAt?: string | null;
};

type AdminMemberAlertsProps = {
  birthdaysToday: MemberAlertSummaryItem[];
  last7Days: MemberAlertSummaryItem[];
  last30Days: MemberAlertSummaryItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

function MetaLine({ member }: { member: MemberAlertSummaryItem }) {
  const parts = [member.position, member.department, member.district].filter(Boolean);
  if (parts.length === 0) {
    return <p className="text-xs text-gray-500">등록 정보 확인 필요</p>;
  }

  return <p className="text-xs text-gray-500">{parts.join(" · ")}</p>;
}

function SummaryCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "amber" | "blue" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold">{count}</p>
    </div>
  );
}

function MemberList({
  title,
  emptyText,
  items,
  dateLabel,
}: {
  title: string;
  emptyText: string;
  items: MemberAlertSummaryItem[];
  dateLabel?: (item: MemberAlertSummaryItem) => string | null;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {items.length}명
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-5 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.slice(0, 6).map((member) => (
            <div
              key={member.id}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {member.name}
                </p>
                <MetaLine member={member} />
              </div>
              {dateLabel ? (
                <span className="shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {dateLabel(member)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminMemberAlerts({
  birthdaysToday,
  last7Days,
  last30Days,
  isLoading = false,
  errorMessage,
}: AdminMemberAlertsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-[#D7F0D8] bg-[#F7FBF7] p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#1B5E20] shadow-sm">
            <i className="fas fa-user-check"></i>
          </span>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#1B5E20] px-2.5 py-1 text-xs font-bold text-white">
                목회자 전용
              </span>
              <span className="rounded-full border border-[#A5D6A7] bg-white px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
                공개 홈 미노출
              </span>
            </div>
            <h2
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              성도 알림 요약
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              오늘 생일과 최근 등록 성도를 교적부 흐름에서 바로 확인합니다.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[#D7F0D8] bg-white px-3 py-2 text-xs font-semibold text-[#1B5E20]">
          심방 예정 요약도 관리자/목회자 전용 영역에만 연결
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="오늘 생일" count={birthdaysToday.length} tone="amber" />
        <SummaryCard label="최근 7일 등록" count={last7Days.length} tone="emerald" />
        <SummaryCard label="최근 30일 등록" count={last30Days.length} tone="blue" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          상세 목록은 필요할 때만 펼쳐서 보도록 바꿨습니다.
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D7F0D8] bg-white px-3 py-2 text-sm font-semibold text-[#1B5E20] transition-colors hover:bg-[#F1F8F2]"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "상세 접기" : "상세 보기"}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {isExpanded ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <MemberList
            title="오늘 생일 성도"
            emptyText={isLoading ? "불러오는 중입니다." : "오늘 생일인 성도가 없습니다."}
            items={birthdaysToday}
            dateLabel={(member) => member.birthDate?.slice(5) ?? null}
          />
          <MemberList
            title="최근 7일 등록"
            emptyText={isLoading ? "불러오는 중입니다." : "최근 7일 등록 성도가 없습니다."}
            items={last7Days}
            dateLabel={(member) => member.effectiveRegisteredAt ?? null}
          />
          <MemberList
            title="최근 30일 등록"
            emptyText={isLoading ? "불러오는 중입니다." : "최근 30일 등록 성도가 없습니다."}
            items={last30Days}
            dateLabel={(member) => member.effectiveRegisteredAt ?? null}
          />
        </div>
      ) : null}
    </section>
  );
}
