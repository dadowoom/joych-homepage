type MemberAlertSummaryItem = {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  district: string | null;
  birthDate?: string | null;
  effectiveRegisteredAt?: string | null;
};

type HomeMemberAlertsProps = {
  birthdaysToday: MemberAlertSummaryItem[];
  last7Days: MemberAlertSummaryItem[];
  last30Days: MemberAlertSummaryItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

function MetaLine({ member }: { member: MemberAlertSummaryItem }) {
  const parts = [member.position, member.department, member.district].filter(Boolean);
  if (parts.length === 0) {
    return <p className="text-xs text-slate-500">등록 정보 확인 필요</p>;
  }
  return <p className="text-xs text-slate-500">{parts.join(" · ")}</p>;
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
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-blue-50 text-blue-800 border-blue-200";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{count}</p>
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
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {items.length}명
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-5 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 6).map((member) => (
            <div key={member.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
                <MetaLine member={member} />
              </div>
              {dateLabel ? (
                <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
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

export default function HomeMemberAlerts({
  birthdaysToday,
  last7Days,
  last30Days,
  isLoading = false,
  errorMessage,
}: HomeMemberAlertsProps) {
  return (
    <section className="border-y border-slate-200 bg-[#F7F8F5] py-10">
      <div className="container">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8C6B2F]">Pastor Desk</p>
          <h2
            className="text-2xl font-bold text-slate-900 md:text-3xl"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            오늘 확인할 성도 요약
          </h2>
          <p className="text-sm text-slate-600">홈페이지 첫 화면에서 생일과 최근 등록 성도를 바로 확인합니다.</p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="오늘 생일" count={birthdaysToday.length} tone="amber" />
          <SummaryCard label="최근 7일 등록" count={last7Days.length} tone="emerald" />
          <SummaryCard label="최근 30일 등록" count={last30Days.length} tone="blue" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
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
      </div>
    </section>
  );
}
