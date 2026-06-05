/**
 * 관리자 공개 접수 관리 탭
 * - 기도 요청
 * - 새가족 등록 문의
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";

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

const visitStatusLabels: Record<string, string> = {
  new: "신규",
  contacted: "연락 완료",
  scheduled: "일정 확정",
  completed: "탐방 완료",
  archived: "보관",
};

const subtitleStatusLabels: Record<string, string> = {
  new: "신규",
  reviewed: "확인 완료",
  completed: "처리 완료",
  archived: "보관",
};

const visitorTypeLabels: Record<string, string> = {
  church: "교회",
  institution: "기관 / 단체",
  individual: "개인",
  other: "기타",
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

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function SubtitleRequestSection() {
  const utils = trpc.useUtils();
  const [subtitleMemos, setSubtitleMemos] = useState<Record<number, string>>({});
  const { data: subtitles = [], isLoading } = trpc.cms.supportRequests.listSubtitles.useQuery();

  const updateSubtitle = trpc.cms.supportRequests.updateSubtitleStatus.useMutation({
    onSuccess: () => {
      toast.success("자막 신청 상태가 저장되었습니다.");
      utils.cms.supportRequests.listSubtitles.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-bold text-gray-800">자막 신청</h4>
          <p className="text-xs text-gray-400 mt-0.5">예배 자막/광고/찬양 가사 신청 최근 100건</p>
        </div>
        <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
          {subtitles.length}건
        </span>
      </div>

      {isLoading ? (
        <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
      ) : subtitles.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">아직 접수된 자막 신청이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {subtitles.map((request) => (
            <div key={request.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">
                    {request.title} · {request.authorName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(request.createdAt)} · {subtitleStatusLabels[request.status] ?? request.status}
                  </p>
                  <div className="text-sm text-gray-600 leading-relaxed mt-3 space-y-1">
                    <p>연락처: {request.phone}</p>
                    <p>이메일: {request.email || "-"}</p>
                    <p>자막 필요일: {request.requestedDate || "-"}</p>
                    <p className="whitespace-pre-wrap">신청 내용: {request.content}</p>
                    {request.attachmentUrl && (
                      <p className="flex flex-wrap items-center gap-2">
                        <Paperclip className="h-4 w-4 text-[#1B5E20]" />
                        <a
                          href={request.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1B5E20] underline-offset-2 hover:underline"
                        >
                          {request.attachmentName || "첨부파일"}
                        </a>
                        <span className="text-xs text-gray-400">
                          {formatFileSize(request.attachmentSize)} · {request.attachmentMime || "파일"}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <select
                  className={`${fieldClass} shrink-0`}
                  value={request.status}
                  onChange={(event) =>
                    updateSubtitle.mutate({
                      id: request.id,
                      status: event.target.value as "new" | "reviewed" | "completed" | "archived",
                      adminMemo: subtitleMemos[request.id] ?? request.adminMemo ?? undefined,
                    })
                  }
                >
                  {Object.entries(subtitleStatusLabels).map(([value, label]) => (
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
                value={subtitleMemos[request.id] ?? request.adminMemo ?? ""}
                onChange={(event) =>
                  setSubtitleMemos((prev) => ({ ...prev, [request.id]: event.target.value }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  updateSubtitle.mutate({
                    id: request.id,
                    status: request.status,
                    adminMemo: subtitleMemos[request.id] ?? request.adminMemo ?? undefined,
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
  );
}

function VisitRequestSection() {
  const utils = trpc.useUtils();
  const [visitMemos, setVisitMemos] = useState<Record<number, string>>({});
  const { data: visits = [], isLoading } = trpc.cms.supportRequests.listVisits.useQuery();

  const updateVisit = trpc.cms.supportRequests.updateVisitStatus.useMutation({
    onSuccess: () => {
      toast.success("탐방신청 상태가 저장되었습니다.");
      utils.cms.supportRequests.listVisits.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-bold text-gray-800">탐방신청</h4>
          <p className="text-xs text-gray-400 mt-0.5">외부 교회/기관/성도 방문 신청 최근 100건</p>
        </div>
        <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
          {visits.length}건
        </span>
      </div>

      {isLoading ? (
        <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
      ) : visits.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">아직 접수된 탐방신청이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {visits.map((request) => (
            <div key={request.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">
                    {request.organizationName} · {request.applicantName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(request.createdAt)} · {visitStatusLabels[request.status] ?? request.status}
                  </p>
                  <div className="text-sm text-gray-600 leading-relaxed mt-3 space-y-1">
                    <p>연락처: {request.phone}</p>
                    <p>이메일: {request.email || "-"}</p>
                    <p>방문희망: {request.visitDate}{request.visitTime ? ` ${request.visitTime}` : ""}</p>
                    <p>인원/구분: {request.headcount}명 · {visitorTypeLabels[request.visitorType] ?? request.visitorType}</p>
                    <p>목적: {request.purpose}</p>
                    {request.message && <p className="whitespace-pre-wrap">요청사항: {request.message}</p>}
                  </div>
                </div>
                <select
                  className={`${fieldClass} shrink-0`}
                  value={request.status}
                  onChange={(event) =>
                    updateVisit.mutate({
                      id: request.id,
                      status: event.target.value as "new" | "contacted" | "scheduled" | "completed" | "archived",
                      adminMemo: visitMemos[request.id] ?? request.adminMemo ?? undefined,
                    })
                  }
                >
                  {Object.entries(visitStatusLabels).map(([value, label]) => (
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
                value={visitMemos[request.id] ?? request.adminMemo ?? ""}
                onChange={(event) =>
                  setVisitMemos((prev) => ({ ...prev, [request.id]: event.target.value }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  updateVisit.mutate({
                    id: request.id,
                    status: request.status,
                    adminMemo: visitMemos[request.id] ?? request.adminMemo ?? undefined,
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
  );
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
          홈페이지에서 접수된 기도 요청, 새가족 등록 문의, 탐방신청, 자막 신청을 확인합니다.
        </p>
      </div>

      <SubtitleRequestSection />

      <VisitRequestSection />

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
