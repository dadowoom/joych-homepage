/**
 * 관리자 접수 관리 탭
 * - 접수 유형별 목록/상세/상태/답변 관리
 */

import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasContentPermission } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Inbox, Paperclip, Save, Search } from "lucide-react";
import {
  SUPPORT_REQUEST_PERMISSION_KEYS,
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
} from "@shared/adminPermissions";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SupportOutput = RouterOutput["cms"]["supportRequests"];

type RequestKind = "bulletinAds" | "subtitles" | "visits" | "prayers" | "newMembers";

const REQUEST_KIND_ORDER: RequestKind[] = [
  "bulletinAds",
  "subtitles",
  "visits",
  "prayers",
  "newMembers",
];

type AdminRequestItem = {
  key: string;
  kind: RequestKind;
  id: number;
  title: string;
  requester: string;
  createdAt: Date | string | null;
  status: string;
  statusLabels: Record<string, string>;
  contentLabel: string;
  content: string;
  detailRows: Array<{ label: string; value: string | number | null | undefined }>;
  adminMemo?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  attachmentSize?: number | null;
  attachmentMime?: string | null;
  memoMode: "public" | "internal";
};

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

const requestStatusLabels: Record<string, string> = {
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

const kindMeta: Record<RequestKind, { title: string; description: string; empty: string }> = {
  bulletinAds: {
    title: "주보 광고신청",
    description: "성도 주보 광고 게재 요청",
    empty: "아직 접수된 주보 광고신청이 없습니다.",
  },
  subtitles: {
    title: "자막 신청",
    description: "예배 자막, 광고, 찬양 가사 요청",
    empty: "아직 접수된 자막 신청이 없습니다.",
  },
  visits: {
    title: "탐방신청",
    description: "외부 교회, 기관, 성도 방문 신청",
    empty: "아직 접수된 탐방신청이 없습니다.",
  },
  prayers: {
    title: "기도 요청",
    description: "홈페이지 기도 요청",
    empty: "아직 접수된 기도 요청이 없습니다.",
  },
  newMembers: {
    title: "새가족 등록 문의",
    description: "새가족 등록 문의",
    empty: "아직 접수된 새가족 문의가 없습니다.",
  },
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

function formatShortDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
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

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function statusBadgeClass(status: string) {
  if (status === "new") return "bg-[#E8F5E9] text-[#1B5E20]";
  if (status === "archived") return "bg-gray-100 text-gray-500";
  if (status === "completed" || status === "scheduled") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-700";
}

function makeItemKey(kind: RequestKind, id: number) {
  return `${kind}:${id}`;
}

function canManageSupportRequestKind(
  user: Parameters<typeof hasContentPermission>[0],
  kind: RequestKind,
) {
  return (
    hasContentPermission(user, SUPPORT_REQUEST_ROOT_PERMISSION_KEY) ||
    hasContentPermission(user, SUPPORT_REQUEST_PERMISSION_KEYS[kind])
  );
}

export default function AdminSupportRequestsTab() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [activeKind, setActiveKind] = useState<RequestKind>("bulletinAds");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});

  const permittedKinds = useMemo(
    () => REQUEST_KIND_ORDER.filter((kind) => canManageSupportRequestKind(user, kind)),
    [user],
  );
  const canManageBulletinAds = permittedKinds.includes("bulletinAds");
  const canManageSubtitles = permittedKinds.includes("subtitles");
  const canManageVisits = permittedKinds.includes("visits");
  const canManagePrayers = permittedKinds.includes("prayers");
  const canManageNewMembers = permittedKinds.includes("newMembers");

  useEffect(() => {
    const firstPermittedKind = permittedKinds[0];
    if (!firstPermittedKind || permittedKinds.includes(activeKind)) return;
    setActiveKind(firstPermittedKind);
    setStatusFilter("all");
    setKeyword("");
    setSelectedKey(null);
  }, [activeKind, permittedKinds]);

  const { data: bulletinAds = [], isLoading: loadingBulletinAds } =
    trpc.cms.supportRequests.listBulletinAds.useQuery(undefined, { enabled: canManageBulletinAds });
  const { data: subtitles = [], isLoading: loadingSubtitles } =
    trpc.cms.supportRequests.listSubtitles.useQuery(undefined, { enabled: canManageSubtitles });
  const { data: visits = [], isLoading: loadingVisits } =
    trpc.cms.supportRequests.listVisits.useQuery(undefined, { enabled: canManageVisits });
  const { data: prayers = [], isLoading: loadingPrayers } =
    trpc.cms.supportRequests.listPrayer.useQuery(undefined, { enabled: canManagePrayers });
  const { data: newMembers = [], isLoading: loadingNewMembers } =
    trpc.cms.supportRequests.listNewMembers.useQuery(undefined, { enabled: canManageNewMembers });

  const updateBulletinAd = trpc.cms.supportRequests.updateBulletinAdStatus.useMutation({
    onSuccess: () => {
      toast.success("주보 광고신청이 저장되었습니다.");
      utils.cms.supportRequests.listBulletinAds.invalidate();
      utils.support.listBulletinAds.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSubtitle = trpc.cms.supportRequests.updateSubtitleStatus.useMutation({
    onSuccess: () => {
      toast.success("자막 신청이 저장되었습니다.");
      utils.cms.supportRequests.listSubtitles.invalidate();
      utils.support.listSubtitles.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateVisit = trpc.cms.supportRequests.updateVisitStatus.useMutation({
    onSuccess: () => {
      toast.success("탐방신청이 저장되었습니다.");
      utils.cms.supportRequests.listVisits.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePrayer = trpc.cms.supportRequests.updatePrayerStatus.useMutation({
    onSuccess: () => {
      toast.success("기도 요청이 저장되었습니다.");
      utils.cms.supportRequests.listPrayer.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateNewMember = trpc.cms.supportRequests.updateNewMemberStatus.useMutation({
    onSuccess: () => {
      toast.success("새가족 문의가 저장되었습니다.");
      utils.cms.supportRequests.listNewMembers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const sections = useMemo(() => {
    const bulletinItems: AdminRequestItem[] = (
      bulletinAds as SupportOutput["listBulletinAds"]
    ).map((request) => ({
      key: makeItemKey("bulletinAds", request.id),
      kind: "bulletinAds",
      id: request.id,
      title: request.title,
      requester: request.authorName,
      createdAt: request.createdAt,
      status: request.status,
      statusLabels: requestStatusLabels,
      contentLabel: "신청 내용",
      content: request.content,
      detailRows: [
        { label: "연락처", value: request.phone },
        { label: "이메일", value: request.email },
        { label: "게재 희망일", value: request.requestedDate },
      ],
      adminMemo: request.adminMemo,
      attachmentName: request.attachmentName,
      attachmentUrl: request.attachmentUrl,
      attachmentSize: request.attachmentSize,
      attachmentMime: request.attachmentMime,
      memoMode: "public",
    }));

    const subtitleItems: AdminRequestItem[] = (
      subtitles as SupportOutput["listSubtitles"]
    ).map((request) => ({
      key: makeItemKey("subtitles", request.id),
      kind: "subtitles",
      id: request.id,
      title: request.title,
      requester: request.authorName,
      createdAt: request.createdAt,
      status: request.status,
      statusLabels: requestStatusLabels,
      contentLabel: "신청 내용",
      content: request.content,
      detailRows: [
        { label: "연락처", value: request.phone },
        { label: "이메일", value: request.email },
        { label: "자막 필요일", value: request.requestedDate },
      ],
      adminMemo: request.adminMemo,
      attachmentName: request.attachmentName,
      attachmentUrl: request.attachmentUrl,
      attachmentSize: request.attachmentSize,
      attachmentMime: request.attachmentMime,
      memoMode: "public",
    }));

    const visitItems: AdminRequestItem[] = (
      visits as SupportOutput["listVisits"]
    ).map((request) => ({
      key: makeItemKey("visits", request.id),
      kind: "visits",
      id: request.id,
      title: request.organizationName,
      requester: request.applicantName,
      createdAt: request.createdAt,
      status: request.status,
      statusLabels: visitStatusLabels,
      contentLabel: "요청사항",
      content: request.message || request.purpose,
      detailRows: [
        { label: "연락처", value: request.phone },
        { label: "이메일", value: request.email },
        { label: "방문희망", value: `${request.visitDate}${request.visitTime ? ` ${request.visitTime}` : ""}` },
        { label: "인원", value: `${request.headcount}명` },
        { label: "구분", value: visitorTypeLabels[request.visitorType] ?? request.visitorType },
        { label: "목적", value: request.purpose },
      ],
      adminMemo: request.adminMemo,
      memoMode: "internal",
    }));

    const prayerItems: AdminRequestItem[] = (
      prayers as SupportOutput["listPrayer"]
    ).map((request) => ({
      key: makeItemKey("prayers", request.id),
      kind: "prayers",
      id: request.id,
      title: request.category,
      requester: request.name,
      createdAt: request.createdAt,
      status: request.status,
      statusLabels: prayerStatusLabels,
      contentLabel: "기도 내용",
      content: request.content,
      detailRows: [{ label: "분류", value: request.category }],
      adminMemo: request.adminMemo,
      memoMode: "internal",
    }));

    const newMemberItems: AdminRequestItem[] = (
      newMembers as SupportOutput["listNewMembers"]
    ).map((request) => ({
      key: makeItemKey("newMembers", request.id),
      kind: "newMembers",
      id: request.id,
      title: request.name,
      requester: request.phone,
      createdAt: request.createdAt,
      status: request.status,
      statusLabels: newMemberStatusLabels,
      contentLabel: "문의 정보",
      content: request.how || "새가족 등록 문의",
      detailRows: [
        { label: "연락처", value: request.phone },
        { label: "나이", value: request.age },
        { label: "거주 지역", value: request.address },
        { label: "알게 된 경로", value: request.how },
      ],
      adminMemo: request.adminMemo,
      memoMode: "internal",
    }));

    return {
      bulletinAds: bulletinItems,
      subtitles: subtitleItems,
      visits: visitItems,
      prayers: prayerItems,
      newMembers: newMemberItems,
    };
  }, [bulletinAds, newMembers, prayers, subtitles, visits]);

  const loadingByKind: Record<RequestKind, boolean> = {
    bulletinAds: loadingBulletinAds,
    subtitles: loadingSubtitles,
    visits: loadingVisits,
    prayers: loadingPrayers,
    newMembers: loadingNewMembers,
  };

  const currentKind = permittedKinds.includes(activeKind)
    ? activeKind
    : (permittedKinds[0] ?? activeKind);
  const activeItems = permittedKinds.includes(currentKind) ? sections[currentKind] : [];
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      if (!matchesStatus) return false;
      if (!normalizedKeyword) return true;
      const target = [
        item.title,
        item.requester,
        item.content,
        item.statusLabels[item.status],
        ...item.detailRows.map((row) => formatValue(row.value)),
      ]
        .join(" ")
        .toLowerCase();
      return target.includes(normalizedKeyword);
    });
  }, [activeItems, normalizedKeyword, statusFilter]);

  const selectedItem =
    filteredItems.find((item) => item.key === selectedKey) ?? filteredItems[0] ?? null;

  const permittedSectionItems = permittedKinds.flatMap((kind) => sections[kind]);
  const totalCount = permittedSectionItems.length;
  const openCount = permittedSectionItems
    .filter((item) => item.status !== "archived" && item.status !== "completed").length;

  function changeKind(kind: RequestKind) {
    setActiveKind(kind);
    setStatusFilter("all");
    setKeyword("");
    setSelectedKey(null);
  }

  function getMemoValue(item: AdminRequestItem) {
    return memoDrafts[item.key] ?? item.adminMemo ?? "";
  }

  function setMemoValue(item: AdminRequestItem, value: string) {
    setMemoDrafts((prev) => ({ ...prev, [item.key]: value }));
  }

  function saveItem(item: AdminRequestItem, status = item.status) {
    const adminMemo = getMemoValue(item);
    if (item.kind === "bulletinAds") {
      updateBulletinAd.mutate({
        id: item.id,
        status: status as "new" | "reviewed" | "completed" | "archived",
        adminMemo,
      });
      return;
    }
    if (item.kind === "subtitles") {
      updateSubtitle.mutate({
        id: item.id,
        status: status as "new" | "reviewed" | "completed" | "archived",
        adminMemo,
      });
      return;
    }
    if (item.kind === "visits") {
      updateVisit.mutate({
        id: item.id,
        status: status as "new" | "contacted" | "scheduled" | "completed" | "archived",
        adminMemo,
      });
      return;
    }
    if (item.kind === "prayers") {
      updatePrayer.mutate({
        id: item.id,
        status: status as "new" | "reviewed" | "archived",
        adminMemo,
      });
      return;
    }
    updateNewMember.mutate({
      id: item.id,
      status: status as "new" | "contacted" | "archived",
      adminMemo,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800">접수 관리</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          접수 유형을 고른 뒤 상태, 검색어로 좁혀서 확인합니다. 주보 광고신청과 자막 신청의 답변은 신청자가 게시글에서 볼 수 있습니다.
        </p>
      </div>

      {permittedKinds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
          관리 가능한 접수 항목 권한이 없습니다. 관리자에게 접수 관리 권한을 요청해 주세요.
        </div>
      ) : null}

      {permittedKinds.length > 0 && (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {permittedKinds.map((kind) => {
          const items = sections[kind];
          const newCount = items.filter((item) => item.status === "new").length;
          const isActive = currentKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => changeKind(kind)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isActive
                  ? "border-[#1B5E20] bg-[#F1F8E9] shadow-sm"
                  : "border-gray-200 bg-white hover:border-[#1B5E20]/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">{kindMeta[kind].title}</p>
                  <p className="mt-1 text-xs text-gray-400">{kindMeta[kind].description}</p>
                </div>
                <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
                  {items.length}건
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">신규 {newCount}건</p>
            </button>
          );
        })}
      </div>
      )}

      {permittedKinds.length > 0 && (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h4 className="font-bold text-gray-900">{kindMeta[currentKind].title}</h4>
            <p className="mt-1 text-xs text-gray-400">
              전체 접수 {totalCount}건 · 미완료 {openCount}건 · 현재 분류 {activeItems.length}건
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className={`${fieldClass} bg-white`}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="상태 필터"
            >
              <option value="all">전체 상태</option>
              {Object.entries(selectedItem?.statusLabels ?? activeItems[0]?.statusLabels ?? requestStatusLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
              <input
                className={`${fieldClass} w-full pl-9 sm:w-72`}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="제목, 이름, 연락처, 내용 검색"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="max-h-[560px] overflow-auto">
              {loadingByKind[currentKind] ? (
                <div className="flex h-64 items-center justify-center text-sm text-gray-400">불러오는 중...</div>
              ) : filteredItems.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-sm text-gray-400">
                  <Inbox className="mb-2 h-8 w-8 text-gray-300" />
                  {kindMeta[currentKind].empty}
                </div>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-28" />
                    <col className="w-28" />
                    <col className="w-24" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-semibold">제목</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">접수일</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItem?.key === item.key;
                      return (
                        <tr
                          key={item.key}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-[#F1F8E9]" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedKey(item.key)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-medium text-gray-800">{item.title}</span>
                              {item.attachmentUrl && <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#0F8FB3]" />}
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-400">{item.content}</p>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">{item.requester}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatShortDate(item.createdAt)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                              {item.statusLabels[item.status] ?? item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-gray-200 p-4">
            {!selectedItem ? (
              <div className="flex h-full min-h-80 flex-col items-center justify-center text-center text-sm text-gray-400">
                <Inbox className="mb-2 h-8 w-8 text-gray-300" />
                왼쪽 목록에서 접수 건을 선택해 주세요.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900">{selectedItem.title}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedItem.requester} · {formatDate(selectedItem.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(selectedItem.status)}`}>
                    {selectedItem.statusLabels[selectedItem.status] ?? selectedItem.status}
                  </span>
                </div>

                <div className="grid gap-2 text-sm">
                  {selectedItem.detailRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[86px_1fr] gap-3 border-b border-gray-100 pb-2">
                      <span className="text-gray-400">{row.label}</span>
                      <span className="min-w-0 break-words text-gray-700">{formatValue(row.value)}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-500">{selectedItem.contentLabel}</p>
                  <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700">
                    {selectedItem.content || "-"}
                  </div>
                </div>

                {selectedItem.attachmentUrl && (
                  <a
                    href={selectedItem.attachmentUrl}
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#1B5E20]/20 px-3 py-2 text-sm text-[#1B5E20] hover:bg-[#F1F8E9]"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedItem.attachmentName || "첨부파일"}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatFileSize(selectedItem.attachmentSize)}</span>
                  </a>
                )}

                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">처리 상태</label>
                    <select
                      className={`${fieldClass} w-full bg-white`}
                      value={selectedItem.status}
                      onChange={(event) => saveItem(selectedItem, event.target.value)}
                    >
                      {Object.entries(selectedItem.statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">
                      {selectedItem.memoMode === "public" ? "공개 답변" : "관리자 메모"}
                    </label>
                    <textarea
                      className={`${fieldClass} h-24 w-full resize-none`}
                      value={getMemoValue(selectedItem)}
                      onChange={(event) => setMemoValue(selectedItem, event.target.value)}
                      placeholder={
                        selectedItem.memoMode === "public"
                          ? "신청자가 게시글에서 확인할 답변을 입력하세요."
                          : "내부 확인용 메모를 입력하세요."
                      }
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedItem.memoMode === "public"
                        ? "저장하면 해당 신청 게시글 상세에 관리자 답변으로 표시됩니다."
                        : "이 메모는 관리자 화면에서만 확인합니다."}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveItem(selectedItem)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-4 text-sm font-semibold text-white hover:bg-[#2E7D32]"
                  >
                    <Save className="h-4 w-4" />
                    저장
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      )}
    </div>
  );
}
