/**
 * 관리자 선교보고 탭
 * - 선교사/사역지 등록
 * - 성도 작성 권한 부여/회수
 * - 제출된 선교보고 승인/반려
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CONTINENT_OPTIONS = [
  { value: "asia", label: "아시아" },
  { value: "africa", label: "아프리카" },
  { value: "americas", label: "아메리카" },
  { value: "europe", label: "유럽" },
  { value: "oceania", label: "오세아니아" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  pending: "검토 대기",
  published: "공개",
  rejected: "반려",
};

const adminFieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

type MissionaryFormState = {
  name: string;
  region: string;
  continent: (typeof CONTINENT_OPTIONS)[number]["value"];
  sentYear: number;
  organization: string;
  profileImage: string;
};

function getEmptyMissionaryForm(): MissionaryFormState {
  return {
    name: "",
    region: "",
    continent: "asia",
    sentYear: new Date().getFullYear(),
    organization: "",
    profileImage: "",
  };
}

export default function AdminMissionReportsTab() {
  const utils = trpc.useUtils();
  const [memberSearch, setMemberSearch] = useState("");
  const [missionaryForm, setMissionaryForm] = useState<MissionaryFormState>(getEmptyMissionaryForm);
  const [editingMissionaryId, setEditingMissionaryId] = useState<number | null>(null);
  const [editingMissionaryForm, setEditingMissionaryForm] = useState<MissionaryFormState>(getEmptyMissionaryForm);
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");
  const [selectedMissionaryId, setSelectedMissionaryId] = useState<number | "">(
    ""
  );

  const { data: missionaries = [], isLoading: loadingMissionaries } =
    trpc.cms.missionReports.missionaries.useQuery();
  const { data: grants = [] } =
    trpc.cms.missionReports.authorGrants.useQuery();
  const { data: reports = [] } = trpc.cms.missionReports.reports.useQuery();
  const { data: members = [] } = trpc.members.adminList.useQuery();

  const approvedMembers = useMemo(
    () => members.filter((member) => member.status === "approved"),
    [members]
  );
  const selectedMember = useMemo(
    () => approvedMembers.find((member) => member.id === selectedMemberId) ?? null,
    [approvedMembers, selectedMemberId]
  );
  const filteredMembers = useMemo(() => {
    const trimmedSearch = memberSearch.trim();
    const normalizedSearch = trimmedSearch.toLowerCase();
    if (!trimmedSearch) return approvedMembers;
    return approvedMembers.filter(
      (member) => {
        const haystack = [
          member.name,
          member.phone,
          member.email,
          member.position,
          member.department,
          member.district,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch) || (member.phone ?? "").includes(trimmedSearch);
      }
    );
  }, [approvedMembers, memberSearch]);
  const visibleMemberMatches = useMemo(
    () => filteredMembers.slice(0, 8),
    [filteredMembers]
  );

  const createMissionary = trpc.cms.missionReports.createMissionary.useMutation(
    {
      onSuccess: () => {
        toast.success("선교사/사역지가 추가됐습니다.");
        setMissionaryForm(getEmptyMissionaryForm());
        utils.cms.missionReports.missionaries.invalidate();
        utils.mission.missionaries.invalidate();
      },
      onError: (e) => toast.error(e.message),
    }
  );

  const updateMissionary = trpc.cms.missionReports.updateMissionary.useMutation({
    onSuccess: () => {
      toast.success("선교사/사역지가 수정됐습니다.");
      setEditingMissionaryId(null);
      utils.cms.missionReports.missionaries.invalidate();
      utils.mission.missionaries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMissionary = trpc.cms.missionReports.deleteMissionary.useMutation({
    onSuccess: () => {
      toast.success("선교사/사역지가 삭제됐습니다.");
      setEditingMissionaryId(null);
      utils.cms.missionReports.missionaries.invalidate();
      utils.cms.missionReports.authorGrants.invalidate();
      utils.mission.missionaries.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createGrant = trpc.cms.missionReports.createAuthorGrant.useMutation({
    onSuccess: () => {
      toast.success("작성 권한이 부여됐습니다.");
      utils.cms.missionReports.authorGrants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateGrant = trpc.cms.missionReports.updateAuthorGrant.useMutation({
    onSuccess: () => {
      toast.success("작성 권한이 변경됐습니다.");
      utils.cms.missionReports.authorGrants.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reviewReport = trpc.cms.missionReports.reviewReport.useMutation({
    onSuccess: () => {
      toast.success("선교보고 상태가 변경됐습니다.");
      utils.cms.missionReports.reports.invalidate();
      utils.mission.reports.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submitMissionary = () => {
    if (!missionaryForm.name.trim() || !missionaryForm.region.trim()) {
      toast.error("이름과 사역 지역을 입력해 주세요.");
      return;
    }
    createMissionary.mutate({
      ...missionaryForm,
      organization: missionaryForm.organization || undefined,
      profileImage: missionaryForm.profileImage || undefined,
      isActive: true,
      sortOrder: missionaries.length,
    });
  };

  const submitGrant = () => {
    if (!selectedMemberId || !selectedMissionaryId) {
      toast.error("성도와 해당 선교사/사역지를 선택해 주세요.");
      return;
    }
    createGrant.mutate({
      memberId: selectedMemberId,
      missionaryId: selectedMissionaryId,
    });
  };

  const startMissionaryEdit = (missionary: typeof missionaries[number]) => {
    setEditingMissionaryId(missionary.id);
    setEditingMissionaryForm({
      name: missionary.name,
      region: missionary.region,
      continent: missionary.continent,
      sentYear: missionary.sentYear,
      organization: missionary.organization ?? "",
      profileImage: missionary.profileImage ?? "",
    });
  };

  const submitMissionaryEdit = () => {
    if (!editingMissionaryId) return;
    if (!editingMissionaryForm.name.trim() || !editingMissionaryForm.region.trim()) {
      toast.error("이름과 사역 지역을 입력해 주세요.");
      return;
    }
    updateMissionary.mutate({
      id: editingMissionaryId,
      ...editingMissionaryForm,
      organization: editingMissionaryForm.organization || undefined,
      profileImage: editingMissionaryForm.profileImage || undefined,
    });
  };

  if (loadingMissionaries) {
    return <p className="py-8 text-center text-gray-500">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">선교보고 관리</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          선교보고 작성 권한과 제출된 보고서를 관리합니다.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">선교사/사역지 추가</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className={adminFieldClass}
            placeholder="이름 또는 사역명"
            value={missionaryForm.name}
            onChange={(e) =>
              setMissionaryForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <input
            className={adminFieldClass}
            placeholder="사역 지역"
            value={missionaryForm.region}
            onChange={(e) =>
              setMissionaryForm((prev) => ({ ...prev, region: e.target.value }))
            }
          />
          <select
            className={adminFieldClass}
            value={missionaryForm.continent}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                continent: e.target.value as typeof missionaryForm.continent,
              }))
            }
          >
            {CONTINENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className={adminFieldClass}
            type="number"
            placeholder="시작 연도"
            value={missionaryForm.sentYear}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                sentYear: Number(e.target.value),
              }))
            }
          />
          <input
            className={adminFieldClass}
            placeholder="소속 기관"
            value={missionaryForm.organization}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                organization: e.target.value,
              }))
            }
          />
          <input
            className={adminFieldClass}
            placeholder="프로필 이미지 URL"
            value={missionaryForm.profileImage}
            onChange={(e) =>
              setMissionaryForm((prev) => ({
                ...prev,
                profileImage: e.target.value,
              }))
            }
          />
        </div>
        <button
          onClick={submitMissionary}
          disabled={createMissionary.isPending}
          className="mt-3 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm text-white hover:bg-[#2E7D32] disabled:opacity-50"
        >
          추가
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-gray-800">등록된 선교사/사역지</h4>
            <p className="mt-0.5 text-xs text-gray-500">수정하거나, 연결된 보고서가 없는 항목은 삭제할 수 있습니다.</p>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-[#1B5E20]">
            {missionaries.length}개
          </span>
        </div>
        <div className="space-y-2">
          {missionaries.map((missionary) => {
            const isEditing = editingMissionaryId === missionary.id;
            return (
              <div key={missionary.id} className="rounded-xl border border-gray-100 bg-white p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.name}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="이름 또는 사역명"
                      />
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.region}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, region: e.target.value }))}
                        placeholder="사역 지역"
                      />
                      <select
                        className={adminFieldClass}
                        value={editingMissionaryForm.continent}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({
                          ...prev,
                          continent: e.target.value as MissionaryFormState["continent"],
                        }))}
                      >
                        {CONTINENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        className={adminFieldClass}
                        type="number"
                        value={editingMissionaryForm.sentYear}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, sentYear: Number(e.target.value) }))}
                        placeholder="시작 연도"
                      />
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.organization}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, organization: e.target.value }))}
                        placeholder="소속 기관"
                      />
                      <input
                        className={adminFieldClass}
                        value={editingMissionaryForm.profileImage}
                        onChange={(e) => setEditingMissionaryForm((prev) => ({ ...prev, profileImage: e.target.value }))}
                        placeholder="프로필 이미지 URL"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMissionaryId(null)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={submitMissionaryEdit}
                        disabled={updateMissionary.isPending}
                        className="rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs text-white hover:bg-[#2E7D32] disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">
                        {missionary.name} <span className="font-normal text-gray-400">· {missionary.region}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {CONTINENT_OPTIONS.find((option) => option.value === missionary.continent)?.label ?? missionary.continent}
                        {missionary.sentYear ? ` · ${missionary.sentYear}년` : ""}
                        {missionary.organization ? ` · ${missionary.organization}` : ""}
                        {!missionary.isActive ? " · 숨김" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startMissionaryEdit(missionary)}
                        className="rounded-lg border border-green-200 px-3 py-1.5 text-xs text-[#1B5E20] hover:bg-green-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`${missionary.name} 항목을 삭제할까요?`)) {
                            deleteMissionary.mutate({ id: missionary.id });
                          }
                        }}
                        disabled={deleteMissionary.isPending}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {missionaries.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-5 text-center text-sm text-gray-400">
              등록된 선교사/사역지가 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">작성자 권한 부여</h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-green-100 bg-green-50/60 p-3 md:col-span-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-sm font-bold text-[#1B5E20]">
                  성도 검색
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  이름을 입력한 뒤 아래 검색 결과를 클릭하면 작성자로 선택됩니다.
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#1B5E20] shadow-sm">
                {filteredMembers.length}명 검색됨
              </span>
            </div>
            <input
              type="text"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="예: 홍길동, 집사, 1구역, 010..."
              className={`${adminFieldClass} w-full border-green-200 bg-white`}
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-3">
            {selectedMember && (
              <div className="mb-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                선택됨: <span className="font-semibold">{selectedMember.name}</span>
                {selectedMember.position ? ` · ${selectedMember.position}` : ""}
                {selectedMember.department ? ` · ${selectedMember.department}` : ""}
                {selectedMember.district ? ` · ${selectedMember.district}` : ""}
              </div>
            )}
            <p className="mb-2 text-xs font-semibold text-gray-500">
              검색 결과에서 성도를 클릭하세요
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visibleMemberMatches.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setMemberSearch(member.name);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedMemberId === member.id
                      ? "border-[#1B5E20] bg-green-50 text-[#1B5E20]"
                      : "border-gray-200 bg-white text-gray-700 hover:border-green-200 hover:bg-green-50"
                  }`}
                >
                  <span className="block font-semibold">{member.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {[member.position, member.department, member.district, member.phone, member.email]
                      .filter(Boolean)
                      .join(" · ") || "추가 정보 없음"}
                  </span>
                </button>
              ))}
            </div>
            {memberSearch.trim() && filteredMembers.length === 0 && (
              <p className="mt-2 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-400">
                검색된 성도가 없습니다.
              </p>
            )}
            {filteredMembers.length > visibleMemberMatches.length && (
              <p className="mt-2 text-xs text-gray-400">
                검색 결과 {filteredMembers.length}명 중 상위 {visibleMemberMatches.length}명만 표시됩니다.
              </p>
            )}
          </div>
          <select
            className={adminFieldClass}
            value={selectedMemberId}
            onChange={(e) =>
              setSelectedMemberId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">성도 선택</option>
            {filteredMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.phone ? ` · ${member.phone}` : ""}
                {member.email ? ` (${member.email})` : ""}
              </option>
            ))}
          </select>
          <select
            className={adminFieldClass}
            value={selectedMissionaryId}
            onChange={(e) =>
              setSelectedMissionaryId(
                e.target.value ? Number(e.target.value) : ""
              )
            }
          >
            <option value="">선교사/사역지 선택</option>
            {missionaries.map((missionary) => (
              <option key={missionary.id} value={missionary.id}>
                {missionary.name} · {missionary.region}
              </option>
            ))}
          </select>
          <button
            onClick={submitGrant}
            disabled={createGrant.isPending}
            className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm text-white hover:bg-[#2E7D32] disabled:opacity-50"
          >
            권한 부여
          </button>
        </div>
        {memberSearch.trim() && (
          <p className="mt-2 text-xs text-gray-500">
            검색 결과 {filteredMembers.length}명
          </p>
        )}

        <div className="mt-4 divide-y divide-gray-100">
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="text-sm">
                <p className="font-medium text-gray-800">
                  {grant.memberName ?? "성도"} · {grant.missionaryName ?? "선교사"}
                </p>
                <p className="text-xs text-gray-400">
                  {grant.memberEmail ?? "-"} · {grant.missionaryRegion ?? "-"}
                </p>
              </div>
              <button
                onClick={() =>
                  updateGrant.mutate({ id: grant.id, canWrite: !grant.canWrite })
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  grant.canWrite
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {grant.canWrite ? "활성" : "비활성"}
              </button>
            </div>
          ))}
          {grants.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              아직 부여된 작성 권한이 없습니다.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4">
        <h4 className="mb-3 font-bold text-gray-800">선교보고 승인</h4>
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
            >
              <div>
                <p className="font-medium text-gray-800">{report.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {report.missionary.name} · {report.reportDate} ·{" "}
                  {STATUS_LABELS[report.status] ?? report.status}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() =>
                    reviewReport.mutate({ id: report.id, status: "published" })
                  }
                  className="rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs text-white hover:bg-[#2E7D32]"
                >
                  공개
                </button>
                <button
                  onClick={() =>
                    reviewReport.mutate({
                      id: report.id,
                      status: "rejected",
                      comment: "관리자 반려",
                    })
                  }
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                >
                  반려
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              등록된 선교보고가 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
