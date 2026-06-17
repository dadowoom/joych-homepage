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

const adminFieldClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

export default function AdminMissionReportsTab() {
  const utils = trpc.useUtils();
  const [missionaryForm, setMissionaryForm] = useState({
    name: "",
    region: "",
    continent: "asia" as const,
    sentYear: new Date().getFullYear(),
    organization: "",
    profileImage: "",
  });
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");
  const [selectedMissionaryId, setSelectedMissionaryId] = useState<number | "">("");

  const { data: missionaries = [], isLoading: loadingMissionaries } = trpc.cms.missionReports.missionaries.useQuery();
  const { data: grants = [] } = trpc.cms.missionReports.authorGrants.useQuery();
  const { data: reports = [] } = trpc.cms.missionReports.reports.useQuery();
  const { data: members = [] } = trpc.members.adminList.useQuery();

  const approvedMembers = useMemo(() => members.filter(member => member.status === "approved"), [members]);

  const createMissionary = trpc.cms.missionReports.createMissionary.useMutation({
    onSuccess: () => {
      toast.success("선교사/사역지가 추가됐습니다.");
      setMissionaryForm({
        name: "",
        region: "",
        continent: "asia",
        sentYear: new Date().getFullYear(),
        organization: "",
        profileImage: "",
      });
      utils.cms.missionReports.missionaries.invalidate();
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
      toast.error("이름과 사역 지역을 입력해주세요.");
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
      toast.error("성도와 담당 선교사/사역지를 선택해주세요.");
      return;
    }
    createGrant.mutate({
      memberId: selectedMemberId,
      missionaryId: selectedMissionaryId,
    });
  };

  if (loadingMissionaries) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">선교보고 관리</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          선교보고 작성 권한과 제출된 보고서를 관리합니다.
        </p>
      </div>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-3">선교사/사역지 추가</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className={adminFieldClass} placeholder="이름 또는 사역명" value={missionaryForm.name} onChange={(e) => setMissionaryForm(prev => ({ ...prev, name: e.target.value }))} />
          <input className={adminFieldClass} placeholder="사역 지역" value={missionaryForm.region} onChange={(e) => setMissionaryForm(prev => ({ ...prev, region: e.target.value }))} />
          <select className={adminFieldClass} value={missionaryForm.continent} onChange={(e) => setMissionaryForm(prev => ({ ...prev, continent: e.target.value as typeof missionaryForm.continent }))}>
            {CONTINENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input className={adminFieldClass} type="number" placeholder="시작 연도" value={missionaryForm.sentYear} onChange={(e) => setMissionaryForm(prev => ({ ...prev, sentYear: Number(e.target.value) }))} />
          <input className={adminFieldClass} placeholder="소속 기관" value={missionaryForm.organization} onChange={(e) => setMissionaryForm(prev => ({ ...prev, organization: e.target.value }))} />
          <input className={adminFieldClass} placeholder="프로필 이미지 URL" value={missionaryForm.profileImage} onChange={(e) => setMissionaryForm(prev => ({ ...prev, profileImage: e.target.value }))} />
        </div>
        <button onClick={submitMissionary} disabled={createMissionary.isPending} className="mt-3 px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm hover:bg-[#2E7D32] disabled:opacity-50">
          추가
        </button>
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-3">작성자 권한 부여</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className={adminFieldClass} value={selectedMemberId} onChange={(e) => setSelectedMemberId(Number(e.target.value))}>
            <option value="">성도 선택</option>
            {approvedMembers.map(member => (
              <option key={member.id} value={member.id}>{member.name} {member.email ? `(${member.email})` : ""}</option>
            ))}
          </select>
          <select className={adminFieldClass} value={selectedMissionaryId} onChange={(e) => setSelectedMissionaryId(Number(e.target.value))}>
            <option value="">선교사/사역지 선택</option>
            {missionaries.map(missionary => (
              <option key={missionary.id} value={missionary.id}>{missionary.name} · {missionary.region}</option>
            ))}
          </select>
          <button onClick={submitGrant} disabled={createGrant.isPending} className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm hover:bg-[#2E7D32] disabled:opacity-50">
            권한 부여
          </button>
        </div>

        <div className="mt-4 divide-y divide-gray-100">
          {grants.map(grant => (
            <div key={grant.id} className="py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-gray-800">{grant.memberName ?? "성도"} → {grant.missionaryName ?? "선교사"}</p>
                <p className="text-xs text-gray-400">{grant.memberEmail ?? "-"} · {grant.missionaryRegion ?? "-"}</p>
              </div>
              <button
                onClick={() => updateGrant.mutate({ id: grant.id, canWrite: !grant.canWrite })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${grant.canWrite ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {grant.canWrite ? "활성" : "비활성"}
              </button>
            </div>
          ))}
          {grants.length === 0 && <p className="text-sm text-gray-400 py-4">아직 부여된 작성 권한이 없습니다.</p>}
        </div>
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-3">선교보고 승인</h4>
        <div className="space-y-2">
          {reports.map(report => (
            <div key={report.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-800">{report.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {report.missionary.name} · {report.reportDate} · {STATUS_LABELS[report.status] ?? report.status}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => reviewReport.mutate({ id: report.id, status: "published" })} className="px-3 py-1.5 text-xs rounded-lg bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
                  공개
                </button>
                <button onClick={() => reviewReport.mutate({ id: report.id, status: "rejected", comment: "관리자 반려" })} className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                  반려
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && <p className="text-sm text-gray-400 py-4">등록된 선교보고가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
