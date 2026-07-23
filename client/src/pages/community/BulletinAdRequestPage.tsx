import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasContentPermission } from "@/lib/contentPermissions";
import { SUPPORT_REQUEST_PERMISSION_KEYS, SUPPORT_REQUEST_ROOT_PERMISSION_KEY } from "@shared/adminPermissions";
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
  getTodayKstDateKey,
  SupportBoardIntro,
  SupportRequestOwnerActions,
} from "./_shared";

function getProcessingStatusLabel(status: string) {
  if (status === "new") return "신규";
  if (status === "completed") return "처리완료";
  return "보류";
}

export default function BulletinAdRequestPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const href = "/support/bulletin-ad";
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: requests = [], isLoading } = trpc.support.listBulletinAds.useQuery();
  const { data: myBulletinAdRequests = [] } = trpc.support.myBulletinAds.useQuery(undefined, {
    enabled: Boolean(memberMe),
  });
  const { data: menuItem } = trpc.home.menuItemByHref.useQuery({ href });
  const { data: subItem } = trpc.home.menuSubItemByHref.useQuery({ href });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [form, setForm] = useState({
    title: "",
    requestedDate: "",
    content: "",
  });
  const defaultViewMode = useMemo(
    () => subItem?.defaultViewMode ?? menuItem?.defaultViewMode ?? "list",
    [menuItem?.defaultViewMode, subItem?.defaultViewMode],
  );
  const myBulletinAdRequestIds = useMemo(
    () => new Set(myBulletinAdRequests.map((request) => request.id)),
    [myBulletinAdRequests],
  );
  const canManageBulletinAds =
    hasContentPermission(user, SUPPORT_REQUEST_ROOT_PERMISSION_KEY) ||
    hasContentPermission(user, SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds);

  useEffect(() => {
    if (defaultViewMode === "grid" || defaultViewMode === "list") {
      setViewMode(defaultViewMode);
    }
  }, [defaultViewMode]);

  const resetForm = () => {
    setForm({
      title: "",
      requestedDate: "",
      content: "",
    });
    setSelectedFile(null);
    setEditingId(null);
    setExistingAttachmentName(null);
    setRemoveExistingAttachment(false);
    setShowForm(false);
  };

  const submitBulletinAd = trpc.support.submitBulletinAd.useMutation({
    onSuccess: () => {
      toast.success("주보 광고신청이 접수되었습니다.");
      resetForm();
      setPage(1);
      utils.support.listBulletinAds.invalidate();
      utils.support.myBulletinAds.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateBulletinAd = trpc.support.updateMyBulletinAd.useMutation({
    onSuccess: () => {
      toast.success("주보 광고신청이 수정되었습니다.");
      resetForm();
      utils.support.listBulletinAds.invalidate();
      utils.support.myBulletinAds.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteBulletinAd = trpc.support.deleteMyBulletinAd.useMutation({
    onSuccess: () => {
      toast.success("주보 광고신청이 삭제되었습니다.");
      resetForm();
      utils.support.listBulletinAds.invalidate();
      utils.support.myBulletinAds.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pageSize = 15;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredRequests = normalizedKeyword
    ? requests.filter((request) => {
        const titleText = request.title.toLowerCase();
        const authorText = request.authorName.toLowerCase();
        const contentText = request.content.toLowerCase();
        if (searchField === "author") return authorText.includes(normalizedKeyword);
        if (searchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : requests;
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleRequests = filteredRequests.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newRequestCount = filteredRequests.filter((request) => isToday(request.createdAt)).length;

  const handleWriteClick = () => {
    if (!memberLoading && !memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/bulletin-ad")}`;
      return;
    }
    setShowForm((value) => !value);
  };

  const handleEdit = (id: number) => {
    const request = myBulletinAdRequests.find((item) => item.id === id);
    if (!request) return;
    setEditingId(request.id);
    setForm({
      title: request.title,
      requestedDate: request.requestedDate ?? "",
      content: request.content,
    });
    setSelectedFile(null);
    setExistingAttachmentName(request.attachmentName ?? null);
    setRemoveExistingAttachment(false);
    setShowForm(true);
    requestAnimationFrame(() => document.getElementById("bulletin-ad-request-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("이 주보 광고신청을 삭제하시겠습니까?")) return;
    deleteBulletinAd.mutate({ id });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberMe) {
      window.location.href = `/member/login?next=${encodeURIComponent("/support/bulletin-ad")}`;
      return;
    }

    let attachment: { fileName: string; mimeType: string; base64: string } | undefined;
    if (selectedFile) {
      if (selectedFile.size > 1 * 1024 * 1024) {
        toast.error("첨부파일은 최대 1MB까지 업로드할 수 있습니다.");
        return;
      }
      try {
        attachment = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          base64: await fileToBase64(selectedFile),
        };
      } catch {
        toast.error("첨부파일을 읽는 중 문제가 발생했습니다.");
        return;
      }
    }

    const payload = {
      ...form,
      requestedDate: form.requestedDate || undefined,
      attachment,
    };
    if (editingId) {
      updateBulletinAd.mutate({
        id: editingId,
        ...payload,
        removeAttachment: removeExistingAttachment,
      });
      return;
    }
    submitBulletinAd.mutate(payload);
  };

  const isSaving = submitBulletinAd.isPending || updateBulletinAd.isPending;

  return (
    <SupportPageWrapper title="주보 광고신청" activeHref="/support/bulletin-ad">
      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                총 <span className="font-semibold text-[#1B5E20]">{requests.length}</span>개의 신청
                {searchKeyword && (
                  <span className="ml-2 text-gray-400">검색 결과 {filteredRequests.length}개</span>
                )}
              </p>
              <SupportBoardIntro kind="bulletinAds" canManage={canManageBulletinAds} />
            </div>
            <button
              type="button"
              onClick={handleWriteClick}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
            >
              {showForm ? "작성 닫기" : "주보 광고신청서 작성"}
            </button>
          </div>
        </div>

        {showForm && memberMe && (
          <div id="bulletin-ad-request-form" className="scroll-mt-24 border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {editingId ? "주보 광고신청서 수정" : "주보 광고신청서"}
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  작성자: {memberMe.name} · 연락처 {memberMe.phone || "미등록"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="작성 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="예: 6월 14일 주보 광고 요청"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">게재 희망일</label>
                  <input
                    type="date"
                    min={editingId ? undefined : getTodayKstDateKey()}
                    value={form.requestedDate}
                    onChange={(event) => setForm({ ...form, requestedDate: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">작성자</label>
                  <input
                    type="text"
                    readOnly
                    value={memberMe.name ?? ""}
                    className="w-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청 내용</label>
                  <textarea
                    required
                    rows={7}
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="주보에 실릴 문구, 게재 희망 주차, 담당 부서, 참고사항 등을 적어 주세요."
                    className="w-full resize-y border border-gray-200 px-4 py-3 text-sm leading-6 focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">첨부파일</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#1B5E20]/30 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]">
                      <Paperclip className="h-4 w-4" />
                      파일 선택
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && file.size > 1 * 1024 * 1024) {
                            toast.error("첨부파일은 최대 1MB까지 업로드할 수 있습니다.");
                            event.currentTarget.value = "";
                            return;
                          }
                          setSelectedFile(file);
                        }}
                      />
                    </label>
                    <span className="min-w-0 truncate text-sm text-gray-500">
                      {selectedFile
                        ? selectedFile.name
                        : existingAttachmentName && !removeExistingAttachment
                          ? `기존 파일: ${existingAttachmentName}`
                          : "PDF, DOCX, HWP, TXT, JPG, PNG / 최대 1MB"}
                    </span>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        파일 제거
                      </button>
                    )}
                    {!selectedFile && existingAttachmentName && !removeExistingAttachment && (
                      <button
                        type="button"
                        onClick={() => setRemoveExistingAttachment(true)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        기존 파일 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  {isSaving ? "저장 중..." : editingId ? "수정 저장" : "신청"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <span>새 글 {newRequestCount} / {filteredRequests.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
              setPage(1);
            }}
          >
            <select
              value={searchField}
              onChange={(event) => setSearchField(event.target.value)}
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
            >
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">작성자</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
              aria-label="검색"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">등록된 주보 광고신청이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-16" />
                  <col />
                  <col className="w-28" />
                  <col className="w-32" />
                  <col className="w-20" />
                </colgroup>
                <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">첨부</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRequests.map((request, index) => {
                    const requestNumber = filteredRequests.length - (pageStart + index);
                    const isExpanded = expandedId === request.id;
                    const isOwnRequest = myBulletinAdRequestIds.has(request.id);
                    return (
                      <Fragment key={request.id}>
                        <tr className="transition-colors hover:bg-gray-50">
                          <td className="px-3 py-3 text-center text-gray-500">{requestNumber}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : request.id)}
                              className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                              aria-expanded={isExpanded}
                            >
                              {request.title}
                              {request.attachmentName && (
                                <Paperclip className="ml-2 inline h-3.5 w-3.5 text-[#0F8FB3]" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">{request.authorName}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatSupportDate(request.createdAt)}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{request.attachmentName ? "있음" : "-"}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={5} className="px-8 py-5">
                              <div className="mb-3 text-xs text-gray-400">
                                게재 희망일 {request.requestedDate || "-"}
                                <span className="mx-2 text-gray-300">|</span>
                                처리상태 {getProcessingStatusLabel(request.status)}
                              </div>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                                    {request.content}
                                  </div>
                                  {request.adminMemo && (
                                    <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-4 py-3">
                                      <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                                      <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                                    </div>
                                  )}
                                  {request.attachmentName && (
                                    <p className="mt-3 text-xs text-[#0F607A]">
                                      첨부파일은 관리자 확인용으로 접수되었습니다.
                                    </p>
                                  )}
                                </div>
                                {isOwnRequest && (
                                  <SupportRequestOwnerActions
                                    requestId={request.id}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    isBusy={deleteBulletinAd.isPending && deleteBulletinAd.variables?.id === request.id}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
              {visibleRequests.map((request, index) => {
                const requestNumber = filteredRequests.length - (pageStart + index);
                const isExpanded = expandedId === request.id;
                const isOwnRequest = myBulletinAdRequestIds.has(request.id);
                return (
                  <article key={request.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span>번호 {requestNumber}</span>
                      <span>{formatSupportDate(request.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      className="block w-full text-left text-base font-bold text-gray-900"
                      aria-expanded={isExpanded}
                    >
                      {request.title}
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#1B5E20]">{request.authorName}</span>
                      {request.attachmentName && <Paperclip className="h-3.5 w-3.5 text-[#0F8FB3]" />}
                    </div>
                    {isExpanded && (
                      <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                        <p className="mb-2 text-xs text-gray-400">게재 희망일 {request.requestedDate || "-"}</p>
                        <p className="whitespace-pre-line">{request.content}</p>
                        {isOwnRequest && (
                          <SupportRequestOwnerActions
                            requestId={request.id}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            isBusy={deleteBulletinAd.isPending && deleteBulletinAd.variables?.id === request.id}
                            className="mt-3"
                          />
                        )}
                        {request.adminMemo && (
                          <div className="mt-4 border border-[#d8f3dc] bg-[#f8fcf8] px-3 py-3">
                            <p className="mb-1 text-xs font-semibold text-[#1B5E20]">관리자 답변</p>
                            <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminMemo}</p>
                          </div>
                        )}
                        {request.attachmentName && (
                          <p className="mt-3 text-xs text-[#0F607A]">첨부파일은 관리자 확인용으로 접수되었습니다.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {filteredRequests.length > pageSize && (
              <div className="flex justify-center gap-1">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm ${
                      activePage === pageNumber
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20]"
                    }`}
                    aria-current={activePage === pageNumber ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SupportPageWrapper>
  );
}
