/**
 * 관리자 공개 접수 관리 탭
 * - 기도 요청
 * - 새가족 등록 문의
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const fieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

const prayerStatusLabels: Record<string, string> = {
  new: "신규",
  reviewed: "확인 완료",
  archived: "보관",
};

const newMemberStatusLabels: Record<string, string> = {
  new: "신규",
  contacted: "연락 완료",
  archived: "보관",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminSupportRequestsTab() {
  const utils = trpc.useUtils();
  const [prayerMemos, setPrayerMemos] = useState<Record<number, string>>({});
  const [newMemberMemos, setNewMemberMemos] = useState<Record<number, string>>({});

  const { data: prayers = [], isLoading: loadingPrayers } =
    trpc.cms.supportRequests.listPrayer.useQuery();
  const { data: newMembers = [], isLoading: loadingNewMembers } =
    trpc.cms.supportRequests.listNewMembers.useQuery();

  const updatePrayer = trpc.cms.supportRequests.updatePrayerStatus.useMutation({
    onSuccess: () => {
      toast.success("기도 요청 상태가 저장됐습니다.");
      utils.cms.supportRequests.listPrayer.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateNewMember = trpc.cms.supportRequests.updateNewMemberStatus.useMutation({
    onSuccess: () => {
      toast.success("새가족 문의 상태가 저장됐습니다.");
      utils.cms.supportRequests.listNewMembers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">접수 관리</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          홈페이지에서 접수된 기도 요청과 새가족 등록 문의를 확인합니다.
        </p>
      </div>

      <section className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-bold text-gray-800">기도 요청</h4>
            <p className="text-xs text-gray-400 mt-0.5">최근 100건 기준</p>
          </div>
          <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
            {prayers.length}건
          </span>
        </div>

        {loadingPrayers ? (
          <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
        ) : prayers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">아직 접수된 기도 요청이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {prayers.map((request) => (
              <div key={request.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">
                      {request.name} · {request.category}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(request.createdAt)} · {prayerStatusLabels[request.status] ?? request.status}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">
                      {request.content}
                    </p>
                  </div>
                  <select
                    className={`${fieldClass} shrink-0`}
                    value={request.status}
                    onChange={(event) =>
                      updatePrayer.mutate({
                        id: request.id,
                        status: event.target.value as "new" | "reviewed" | "archived",
                        adminMemo: prayerMemos[request.id] ?? request.adminMemo ?? undefined,
                      })
                    }
                  >
                    {Object.entries(prayerStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className={`${fieldClass} w-full mt-3 resize-none`}
                  rows={2}
                  placeholder="관리자 메모"
                  value={prayerMemos[request.id] ?? request.adminMemo ?? ""}
                  onChange={(event) =>
                    setPrayerMemos((prev) => ({ ...prev, [request.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    updatePrayer.mutate({
                      id: request.id,
                      status: request.status,
                      adminMemo: prayerMemos[request.id] ?? request.adminMemo ?? undefined,
                    })
                  }
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  메모 저장
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-bold text-gray-800">새가족 등록 문의</h4>
            <p className="text-xs text-gray-400 mt-0.5">최근 100건 기준</p>
          </div>
          <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
            {newMembers.length}건
          </span>
        </div>

        {loadingNewMembers ? (
          <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
        ) : newMembers.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">아직 접수된 새가족 문의가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {newMembers.map((request) => (
              <div key={request.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">
                      {request.name} · {request.phone}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(request.createdAt)} · {newMemberStatusLabels[request.status] ?? request.status}
                    </p>
                    <div className="text-sm text-gray-600 leading-relaxed mt-3 space-y-1">
                      <p>나이: {request.age ?? "-"}</p>
                      <p>거주 지역: {request.address || "-"}</p>
                      <p>알게 된 경로: {request.how || "-"}</p>
                    </div>
                  </div>
                  <select
                    className={`${fieldClass} shrink-0`}
                    value={request.status}
                    onChange={(event) =>
                      updateNewMember.mutate({
                        id: request.id,
                        status: event.target.value as "new" | "contacted" | "archived",
                        adminMemo: newMemberMemos[request.id] ?? request.adminMemo ?? undefined,
                      })
                    }
                  >
                    {Object.entries(newMemberStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className={`${fieldClass} w-full mt-3 resize-none`}
                  rows={2}
                  placeholder="관리자 메모"
                  value={newMemberMemos[request.id] ?? request.adminMemo ?? ""}
                  onChange={(event) =>
                    setNewMemberMemos((prev) => ({ ...prev, [request.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    updateNewMember.mutate({
                      id: request.id,
                      status: request.status,
                      adminMemo: newMemberMemos[request.id] ?? request.adminMemo ?? undefined,
                    })
                  }
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  메모 저장
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
