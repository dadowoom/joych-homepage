/**
 * 사이트 설정 탭 컴포넌트
 * 교회 기본 정보(이름, 주소, 연락처, SNS 등)를 관리합니다.
 * Admin.tsx에서 분리되었습니다.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const SETTING_LABELS: Record<string, string> = {
  church_name: "교회 이름",
  church_name_en: "교회 영문 이름",
  church_since: "설립 연도",
  denomination: "교단",
  address: "주소",
  tel: "전화번호",
  fax: "팩스",
  youtube_url: "유튜브 채널 URL",
  facebook_url: "페이스북 URL",
  instagram_url: "인스타그램 URL",
  vision_title: "비전 제목",
  vision_desc: "비전 설명",
};

export function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.home.settings.useQuery();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const updateMutation = trpc.cms.content.settings.update.useMutation({
    onSuccess: () => {
      utils.home.settings.invalidate();
      setEditingKey(null);
      toast.success("설정이 저장됐습니다.");
    },
  });

  if (isLoading) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">교회 기본 정보 설정</h3>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {Object.entries(SETTING_LABELS).map(([key, label]) => (
          <div key={key} className="p-4 bg-white hover:bg-gray-50">
            {editingKey === key ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => updateMutation.mutate({ key, value: editValue })}
                    disabled={updateMutation.isPending}
                    className="px-3 py-1.5 text-xs bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                <span className="flex-1 text-sm text-gray-800">
                  {(settings as Record<string, string>)?.[key] || (
                    <span className="text-gray-400 italic">미설정</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setEditingKey(key);
                    setEditValue((settings as Record<string, string>)?.[key] ?? "");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 shrink-0"
                >
                  수정
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
