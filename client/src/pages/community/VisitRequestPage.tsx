import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminSupportRequestsTab from "@/components/AdminSupportRequestsTab";
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
import {
  findVisitManagementToken,
  getVisitManagementTokens,
  removeVisitManagementToken,
  saveVisitManagementToken,
} from "@/lib/supportRequestOwnership";
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
  MySupportRequestsPanel,
  SupportBoardIntro,
} from "./_shared";

export default function VisitRequestPage() {
  return <VisitRequestBoardPage />;
}

const VISITOR_TYPE_LABELS: Record<string, string> = {
  church: "교회",
  institution: "기관 / 단체",
  individual: "개인",
  other: "기타",
};

const VISIT_STATUS_LABELS: Record<string, string> = {
  new: "신규",
  contacted: "보류",
  scheduled: "보류",
  completed: "처리완료",
  archived: "보류",
};


function VisitRequestBoardPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const href = "/support/tour";
  const { data: requests = [], isLoading } = trpc.support.listVisits.useQuery();
  const [managementTokens, setManagementTokens] = useState(getVisitManagementTokens);
  const { data: myVisitRequests = [] } = trpc.support.myVisits.useQuery({
    manageTokens: managementTokens,
  });
  const { data: menuItem } = trpc.home.menuItemByHref.useQuery({ href });
  const { data: subItem } = trpc.home.menuSubItemByHref.useQuery({ href });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("organization");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [form, setForm] = useState(getEmptyVisitForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const defaultViewMode = useMemo(
    () => subItem?.defaultViewMode ?? menuItem?.defaultViewMode ?? "list",
    [menuItem?.defaultViewMode, subItem?.defaultViewMode],
  );
  const canManageVisits =
    hasContentPermission(user, SUPPORT_REQUEST_ROOT_PERMISSION_KEY) ||
    hasContentPermission(user, SUPPORT_REQUEST_PERMISSION_KEYS.visits);

  useEffect(() => {
    if (defaultViewMode === "grid" || defaultViewMode === "list") {
      setViewMode(defaultViewMode);
    }
  }, [defaultViewMode]);

  const resetForm = () => {
    setForm(getEmptyVisitForm());
    setEditingId(null);
    setShowForm(false);
  };

  const submitVisit = trpc.support.submitVisit.useMutation({
    onSuccess: (result) => {
      setManagementTokens(saveVisitManagementToken(result.requestId, result.manageToken));
      toast.success("탐방신청이 접수되었습니다.");
      setSubmitted(true);
      resetForm();
      setPage(1);
      utils.support.listVisits.invalidate();
      utils.support.myVisits.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateVisit = trpc.support.updateMyVisit.useMutation({
    onSuccess: () => {
      toast.success("탐방신청이 수정되었습니다.");
      resetForm();
      utils.support.listVisits.invalidate();
      utils.support.myVisits.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteVisit = trpc.support.deleteMyVisit.useMutation({
    onSuccess: (_result, variables) => {
      setManagementTokens(removeVisitManagementToken(variables.id));
      toast.success("탐방신청이 삭제되었습니다.");
      resetForm();
      utils.support.listVisits.invalidate();
      utils.support.myVisits.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pageSize = 15;
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredRequests = normalizedKeyword
    ? requests.filter((request) => {
        const organizationText = request.organizationName.toLowerCase();
        const applicantText = request.applicantName.toLowerCase();
        if (searchField === "organization") return organizationText.includes(normalizedKeyword);
        if (searchField === "applicant") return applicantText.includes(normalizedKeyword);
        return (request.region ?? "").toLowerCase().includes(normalizedKeyword);
      })
    : requests;
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleRequests = filteredRequests.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newRequestCount = filteredRequests.filter((request) => isToday(request.createdAt)).length;

  const handleWriteClick = () => {
    setSubmitted(false);
    setShowForm((value) => !value);
  };

  const handleEdit = (id: number) => {
    const request = myVisitRequests.find((item) => item.id === id);
    if (!request) return;
    setEditingId(request.id);
    setForm({
      organizationName: request.organizationName,
      applicantName: request.applicantName,
      phone: request.phone,
      region: request.region ?? "",
      denomination: request.denomination ?? "",
      email: request.email ?? "",
      visitDate: request.visitDate,
      visitTime: request.visitTime ?? "",
      headcount: String(request.headcount),
      visitorType: request.visitorType,
      purpose: request.purpose,
      message: request.message ?? "",
      agreePrivacy: true,
    });
    setSubmitted(false);
    setShowForm(true);
    requestAnimationFrame(() => document.getElementById("visit-request-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("이 탐방신청을 삭제하시겠습니까?")) return;
    deleteVisit.mutate({
      id,
      manageToken: findVisitManagementToken(managementTokens, id),
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.agreePrivacy) {
      toast.error("개인정보 수집 및 이용에 동의해 주세요.");
      return;
    }

    const payload = {
      organizationName: form.organizationName,
      applicantName: form.applicantName,
      phone: form.phone,
      region: form.region,
      denomination: form.visitorType === "church" ? form.denomination : undefined,
      email: form.email,
      visitDate: form.visitDate,
      visitTime: form.visitTime || undefined,
      headcount: Math.max(1, Number(form.headcount) || 1),
      visitorType: form.visitorType as "church" | "institution" | "individual" | "other",
      purpose: form.purpose,
      message: form.message,
    };
    if (editingId) {
      updateVisit.mutate({
        id: editingId,
        manageToken: findVisitManagementToken(managementTokens, editingId),
        ...payload,
      });
      return;
    }
    submitVisit.mutate(payload);
  };

  return (
    <SupportPageWrapper title="탐방 신청" activeHref="/support/tour">
      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                총 <span className="font-semibold text-[#1B5E20]">{requests.length}</span>개의 신청
                {searchKeyword && <span className="ml-2 text-gray-400">검색 결과 {filteredRequests.length}개</span>}
              </p>
              <SupportBoardIntro kind="visits" canManage={canManageVisits} />
            </div>
            <button
              type="button"
              onClick={handleWriteClick}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]"
            >
              {showForm ? "작성 닫기" : "탐방신청서 작성"}
            </button>
          </div>
        </div>

        {submitted && (
          <div className="border border-[#d8f3dc] bg-[#f1f8f3] px-5 py-4 text-sm text-[#1B5E20]">
            탐방신청이 접수되었습니다. 담당자가 신청 내용을 확인한 뒤 일정 가능 여부와 안내 사항을 연락드리겠습니다.
          </div>
        )}

        <MySupportRequestsPanel
          items={myVisitRequests.map((request) => ({
            id: request.id,
            title: request.organizationName,
            summary: `방문 희망일 ${request.visitDate}`,
            status: request.status,
            createdAt: request.createdAt,
          }))}
          onEdit={handleEdit}
          onDelete={handleDelete}
          busyId={deleteVisit.isPending ? deleteVisit.variables?.id : null}
        />

        {canManageVisits && (
          <AdminSupportRequestsTab
            initialKind="visits"
            allowedKinds={["visits"]}
            hideKindCards
            title="탐방신청 관리"
            description="이 페이지에서 바로 탐방신청 접수 내용을 확인하고 내부 메모와 처리 상태를 저장합니다."
          />
        )}

        {showForm && (
          <div id="visit-request-form" className="scroll-mt-24 border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  <MapPin className="h-5 w-5 text-[#1B5E20]" /> {editingId ? "탐방신청서 수정" : "탐방신청서"}
                </h2>
                <p className="mt-1 text-xs text-gray-400">연락처, 이메일, 탐방 목적과 요청사항은 담당자와 관리자만 확인합니다.</p>
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
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">교회명 / 단체명 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                    placeholder="예: ○○교회, ○○기관"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청자 이름 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.applicantName}
                    onChange={(event) => setForm({ ...form, applicantName: event.target.value })}
                    placeholder="담당자 이름"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">연락처 <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">지역 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.region}
                    onChange={(event) => setForm({ ...form, region: event.target.value })}
                    placeholder="예: 포항시 북구, 서울특별시"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">신청 구분</label>
                  <select
                    value={form.visitorType}
                    onChange={(event) => setForm({ ...form, visitorType: event.target.value })}
                    className="w-full border border-gray-200 bg-white px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  >
                    <option value="church">교회</option>
                    <option value="institution">기관 / 단체</option>
                    <option value="individual">개인</option>
                    <option value="other">기타</option>
                  </select>
                </div>
                {form.visitorType === "church" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">소속 교단 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.denomination}
                      onChange={(event) => setForm({ ...form, denomination: event.target.value })}
                      placeholder="예: 대한예수교장로회"
                      className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">이메일 <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="name@example.com"
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 희망일 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={editingId ? undefined : getTodayKstDateKey()}
                    value={form.visitDate}
                    onChange={(event) => setForm({ ...form, visitDate: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 희망 시간</label>
                  <input
                    type="time"
                    value={form.visitTime}
                    onChange={(event) => setForm({ ...form, visitTime: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">방문 인원</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={form.headcount}
                    onChange={(event) => setForm({ ...form, headcount: event.target.value })}
                    className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">탐방 목적</label>
                <input
                  type="text"
                  required
                  value={form.purpose}
                  onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                  placeholder="예: 교회 시설 탐방, 사역 운영 사례 견학, 예배 방문"
                  className="w-full border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">탐방 내용 / 요청사항</label>
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  rows={5}
                  placeholder="탐방하고 싶은 내용, 관심 사역, 안내가 필요한 내용을 자유롭게 적어 주세요."
                  className="w-full resize-none border border-gray-200 px-4 py-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                />
              </div>

              <label className="flex items-start gap-3 border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.agreePrivacy}
                  onChange={(event) => setForm({ ...form, agreePrivacy: event.target.checked })}
                  className="mt-1"
                />
                <span>
                  탐방 신청 접수 및 연락을 위해 입력한 개인정보를 수집·이용하는 데 동의합니다.
                  <span className="text-red-500"> *</span>
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
                <button type="button" onClick={resetForm} className="border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitVisit.isPending || updateVisit.isPending}
                  className="bg-[#1B5E20] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitVisit.isPending || updateVisit.isPending
                    ? "저장 중..."
                    : editingId ? "수정 저장" : "신청"}
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
              <option value="organization">단체명</option>
              <option value="applicant">작성자</option>
              <option value="region">지역</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button type="submit" className="inline-flex h-8 items-center justify-center border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]" aria-label="검색">
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">등록된 탐방신청이 없습니다.</p>
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
                  <col className="w-32" />
                </colgroup>
                <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">교회 / 단체</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">방문일</th>
                    <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRequests.map((request, index) => {
                    const requestNumber = filteredRequests.length - (pageStart + index);
                    const isExpanded = expandedId === request.id;
                    return (
                      <Fragment key={request.id}>
                        <tr className="transition-colors hover:bg-gray-50">
                          <td className="px-3 py-3 text-center text-gray-500">{requestNumber}</td>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => setExpandedId(isExpanded ? null : request.id)} className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]" aria-expanded={isExpanded}>
                              {request.organizationName}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">{request.applicantName}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{request.visitDate}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatSupportDate(request.createdAt)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={5} className="px-8 py-5">
                              <div className="mb-3 text-xs text-gray-400">
                                {request.region || "지역 미입력"}
                                <span className="mx-2 text-gray-300">|</span>
                                {VISITOR_TYPE_LABELS[request.visitorType] ?? request.visitorType}
                                <span className="mx-2 text-gray-300">|</span>
                                방문 {request.visitDate}{request.visitTime ? ` ${request.visitTime}` : ""}
                                <span className="mx-2 text-gray-300">|</span>
                                {request.headcount}명
                                <span className="mx-2 text-gray-300">|</span>
                                상태 {VISIT_STATUS_LABELS[request.status] ?? "접수"}
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
                return (
                  <article key={request.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                      <span>번호 {requestNumber}</span>
                      <span>{formatSupportDate(request.createdAt)}</span>
                    </div>
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : request.id)} className="block w-full text-left text-base font-bold text-gray-900" aria-expanded={isExpanded}>
                      {request.organizationName}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-[#1B5E20]">{request.applicantName}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">{request.visitDate}</span>
                    </div>
                    {isExpanded && (
                      <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                        <p className="mb-2 text-xs text-gray-400">
                          {request.region || "지역 미입력"} · {VISITOR_TYPE_LABELS[request.visitorType] ?? request.visitorType} · {request.headcount}명
                        </p>
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
