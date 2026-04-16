/**
 * MemberMyPage.tsx
 * 성도 마이페이지 — 내 정보 확인 (기본 정보 + 관리자가 입력한 교회 정보)
 * + 믿음PLUS 유저 ID 수정 기능
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function MemberMyPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: me, isLoading, error } = trpc.members.me.useQuery();

  const [editingFaithPlus, setEditingFaithPlus] = useState(false);
  const [faithPlusInput, setFaithPlusInput] = useState("");

  const logoutMutation = trpc.members.logout.useMutation({
    onSuccess: () => {
      toast.success("로그아웃됐습니다.");
      navigate("/member/login");
    },
  });

  const updateInfoMutation = trpc.members.updateMyInfo.useMutation({
    onSuccess: () => {
      toast.success("믿음PLUS 유저 ID가 저장됐습니다.");
      setEditingFaithPlus(false);
      utils.members.me.invalidate();
    },
    onError: (e) => {
      toast.error(e.message || "저장에 실패했습니다.");
    },
  });

  const handleFaithPlusSave = () => {
    updateInfoMutation.mutate({ faithPlusUserId: faithPlusInput || undefined });
  };

  const handleFaithPlusEdit = () => {
    setFaithPlusInput(me?.faithPlusUserId ?? "");
    setEditingFaithPlus(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-lock text-gray-400 text-2xl"></i>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">로그인이 필요합니다</h2>
          <p className="text-sm text-gray-500 mb-6">마이페이지를 이용하려면 로그인해주세요.</p>
          <Link
            href="/member/login"
            className="inline-block px-6 py-3 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18]"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = {
    pending: { text: "승인 대기 중", color: "bg-yellow-100 text-yellow-700" },
    approved: { text: "승인 완료", color: "bg-green-100 text-green-700" },
    rejected: { text: "가입 거절", color: "bg-red-100 text-red-700" },
    withdrawn: { text: "탈퇴", color: "bg-gray-100 text-gray-500" },
  }[me.status ?? "pending"] ?? { text: "대기 중", color: "bg-gray-100 text-gray-500" };

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </Link>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 프로필 헤더 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-user text-[#1B5E20] text-2xl"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{me.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel.color}`}>
                  {statusLabel.text}
                </span>
              </div>
              {me.position && (
                <p className="text-sm text-[#1B5E20] font-medium mt-0.5">{me.position}</p>
              )}
              <p className="text-sm text-gray-500 mt-0.5">{me.email}</p>
            </div>
          </div>

          {me.status === "pending" && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-xs text-yellow-700">
                <i className="fas fa-info-circle mr-1"></i>
                회원가입 신청이 접수됐습니다. 관리자 승인 후 모든 서비스를 이용하실 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-user-circle text-[#1B5E20]"></i>
            기본 정보
          </h2>
          <div className="space-y-3">
            <InfoRow label="이름" value={me.name} />
            <InfoRow label="이메일" value={me.email} />
            <InfoRow label="연락처" value={me.phone} />
            <InfoRow label="생년월일" value={me.birthDate} />
            <InfoRow label="성별" value={me.gender} />
          </div>
        </div>

        {/* 교회 정보 (관리자가 입력) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
            <i className="fas fa-church text-[#1B5E20]"></i>
            교회 정보
          </h2>
          <p className="text-xs text-gray-400 mb-4">관리자가 입력하는 정보입니다.</p>
          <div className="space-y-3">
            <InfoRow label="직분" value={me.position} placeholder="미입력" />
            <InfoRow label="소속 부서" value={me.department} placeholder="미입력" />
            <InfoRow label="구역 / 순" value={me.district} placeholder="미입력" />
            <InfoRow label="세례 구분" value={me.baptismType} placeholder="미입력" />
            <InfoRow label="세례일" value={me.baptismDate} placeholder="미입력" />
            <InfoRow label="등록일" value={me.registeredAt} placeholder="미입력" />
            <InfoRow label="담당 교역자" value={me.pastor} placeholder="미입력" />
          </div>
        </div>

        {/* 믿음PLUS 연동 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
            <i className="fas fa-mobile-alt text-[#1B5E20]"></i>
            믿음PLUS 연동
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            믿음PLUS 앱을 사용하신다면 유저 ID를 등록해주세요. 교적부에서 프로필 연결에 사용됩니다.
          </p>

          {editingFaithPlus ? (
            <div className="space-y-3">
              <input
                type="text"
                value={faithPlusInput}
                onChange={(e) => setFaithPlusInput(e.target.value)}
                placeholder="믿음PLUS 앱에서 확인한 유저 ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleFaithPlusSave}
                  disabled={updateInfoMutation.isPending}
                  className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium hover:bg-[#154a18] disabled:opacity-50"
                >
                  {updateInfoMutation.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditingFaithPlus(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                {me.faithPlusUserId ? (
                  <div>
                    <p className="text-sm font-medium text-gray-800">유저 ID: {me.faithPlusUserId}</p>
                    <a
                      href={`https://faithplus.co.kr/search?user=${me.faithPlusUserId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#1B5E20] hover:underline mt-0.5 inline-block"
                    >
                      믿음PLUS에서 보기 →
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">등록된 유저 ID가 없습니다.</p>
                )}
              </div>
              <button
                onClick={handleFaithPlusEdit}
                className="text-xs text-[#1B5E20] border border-[#1B5E20] rounded-lg px-3 py-1.5 hover:bg-[#E8F5E9] transition-colors"
              >
                {me.faithPlusUserId ? "수정" : "등록"}
              </button>
            </div>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  placeholder = "-",
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 flex-shrink-0 w-28">{label}</span>
      <span className={`text-sm text-right flex-1 ${value ? "text-gray-800 font-medium" : "text-gray-300"}`}>
        {value || placeholder}
      </span>
    </div>
  );
}
