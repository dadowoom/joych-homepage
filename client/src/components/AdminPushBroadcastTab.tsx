import { useMemo, useState } from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TargetScope = "all" | "position" | "department" | "district" | "members";

type TargetInput =
  | { scope: "all" }
  | { scope: "position" | "department" | "district"; values: string[] }
  | { scope: "members"; memberIds: number[] };

const TARGET_TABS: Array<{ scope: TargetScope; label: string; helper: string }> = [
  { scope: "all", label: "전체 성도", helper: "승인된 성도 전체에게 발송" },
  { scope: "position", label: "직분별", helper: "장로, 권사, 집사 등" },
  { scope: "district", label: "구역/순별", helper: "구역 또는 순 단위" },
  { scope: "department", label: "부서별", helper: "교회학교, 사역부서 등" },
  { scope: "members", label: "개별 성도", helper: "특정 성도만 선택" },
];

function buildTarget(scope: TargetScope, selectedValues: string[], selectedMemberIds: number[]): TargetInput {
  if (scope === "all") return { scope: "all" };
  if (scope === "members") return { scope: "members", memberIds: selectedMemberIds };
  return { scope, values: selectedValues };
}

function toggleValue<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function memberLabel(member: {
  id: number;
  name: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  district: string | null;
}) {
  const meta = [member.position, member.department, member.district].filter(Boolean).join(" / ");
  return `${member.name}${meta ? ` (${meta})` : ""}${member.phone ? ` · ${member.phone}` : ""}`;
}

export default function AdminPushBroadcastTab() {
  const [scope, setScope] = useState<TargetScope>("all");
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [lastPreview, setLastPreview] = useState<{ memberCount: number; subscriptionCount: number } | null>(null);

  const optionsQuery = trpc.cms.pushBroadcast.targetOptions.useQuery();
  const previewMutation = trpc.cms.pushBroadcast.preview.useMutation({
    onSuccess: (data) => setLastPreview(data),
    onError: (error) => toast.error(error.message),
  });
  const sendMutation = trpc.cms.pushBroadcast.send.useMutation({
    onSuccess: (data) => {
      setLastPreview({ memberCount: data.memberCount, subscriptionCount: data.subscriptionCount });
      toast.success(`푸시 발송 완료: 성공 ${data.sentCount}건, 실패 ${data.failedCount}건`);
    },
    onError: (error) => toast.error(error.message),
  });

  const options = optionsQuery.data;
  const currentOptions = useMemo(() => {
    if (!options) return [];
    if (scope === "position") return options.positions;
    if (scope === "district") return options.districts;
    if (scope === "department") return options.departments;
    return [];
  }, [options, scope]);

  const filteredMembers = useMemo(() => {
    const members = options?.members ?? [];
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return members.slice(0, 80);
    return members
      .filter((member) => memberLabel(member).toLowerCase().includes(keyword))
      .slice(0, 80);
  }, [memberSearch, options?.members]);

  const target = buildTarget(scope, selectedValues, selectedMemberIds);
  const hasTarget =
    scope === "all" ||
    (scope === "members" ? selectedMemberIds.length > 0 : selectedValues.length > 0);
  const canSend = title.trim() && body.trim() && hasTarget && !sendMutation.isPending;

  const resetSelectionsForScope = (nextScope: TargetScope) => {
    setScope(nextScope);
    setSelectedValues([]);
    setSelectedMemberIds([]);
    setLastPreview(null);
  };

  const previewTarget = () => {
    if (!hasTarget) {
      toast.error("발송 대상을 선택해주세요.");
      return;
    }
    previewMutation.mutate({ target });
  };

  const sendPush = () => {
    if (!canSend) {
      toast.error("제목, 내용, 발송 대상을 확인해주세요.");
      return;
    }
    const confirmed = window.confirm("선택한 대상에게 푸시 알림을 발송할까요?");
    if (!confirmed) return;
    sendMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      url: url.trim() || "/",
      target,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-bold text-[#1B5E20]">
            <BellRing className="h-3.5 w-3.5" />
            PWA 푸시 알림
          </p>
          <h3 className="mt-3 text-xl font-bold text-gray-900">전체/대상별 푸시 발송</h3>
          <p className="mt-1 text-sm text-gray-500">
            홈 화면에 추가하고 알림 받기를 켠 성도 기기에만 발송됩니다.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-gray-500">최근 대상 확인</p>
          <p className="mt-1 font-bold text-gray-900">
            대상 {lastPreview?.memberCount ?? "-"}명 / 구독 {lastPreview?.subscriptionCount ?? "-"}개
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">푸시 제목</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                placeholder="예: 새 공지사항 안내"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">누르면 이동할 주소</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                maxLength={512}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                placeholder="/support/notice"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700">푸시 내용</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={240}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
              placeholder="성도들에게 표시될 알림 내용을 입력하세요."
            />
            <span className="mt-1 block text-right text-xs text-gray-400">{body.length}/240</span>
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700">발송 대상</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {TARGET_TABS.map((item) => (
                <button
                  key={item.scope}
                  type="button"
                  onClick={() => resetSelectionsForScope(item.scope)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    scope === item.scope
                      ? "border-[#1B5E20] bg-[#E8F5E9] text-[#1B5E20]"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{item.helper}</span>
                </button>
              ))}
            </div>
          </div>

          {scope !== "all" && scope !== "members" && (
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">선택 항목</p>
                <span className="text-xs text-gray-400">{selectedValues.length}개 선택</span>
              </div>
              <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                {currentOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelectedValues((previous) => toggleValue(previous, option));
                      setLastPreview(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selectedValues.includes(option)
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option}
                  </button>
                ))}
                {currentOptions.length === 0 && (
                  <p className="text-sm text-gray-400">등록된 선택지가 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {scope === "members" && (
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-gray-800">개별 성도 선택</p>
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20] sm:w-72"
                  placeholder="이름, 직분, 구역, 연락처 검색"
                />
              </div>
              <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
                {filteredMembers.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => {
                        setSelectedMemberIds((previous) => toggleValue(previous, member.id));
                        setLastPreview(null);
                      }}
                    />
                    <span>{memberLabel(member)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h4 className="text-sm font-bold text-gray-900">발송 전 확인</h4>
          <p className="text-xs leading-5 text-gray-500">
            대상 확인을 누르면 현재 조건에 맞는 승인 성도 수와 실제 구독 기기 수를 계산합니다.
          </p>
          <button
            type="button"
            onClick={previewTarget}
            disabled={previewMutation.isPending}
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#1B5E20] bg-white px-4 py-2 text-sm font-semibold text-[#1B5E20] hover:bg-[#F1F8E9] disabled:opacity-50"
          >
            {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            대상 확인
          </button>
          <button
            type="button"
            onClick={sendPush}
            disabled={!canSend}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            푸시 발송
          </button>
          {lastPreview && (
            <div className="rounded-lg bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">대상 성도 {lastPreview.memberCount}명</p>
              <p className="mt-1 text-gray-500">발송 가능 구독 {lastPreview.subscriptionCount}개</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
