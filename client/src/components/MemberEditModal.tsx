/**
 * MemberEditModal.tsx
 * 관리자: 성도 전체 정보 수정 모달
 * - 기본정보 탭: 이름, 이메일, 연락처, 생년월일, 성별, 주소, 비상연락처
 * - 교회정보 탭: 직분, 부서, 구역, 세례, 등록일, 담당교역자, 관리자메모, 승인상태, 믿음PLUS ID
 * - 계정관리 탭: 비밀번호 초기화
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Member = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  emergencyPhone?: string | null;
  position?: string | null;
  department?: string | null;
  district?: string | null;
  baptismType?: string | null;
  baptismDate?: string | null;
  registeredAt?: string | null;
  pastor?: string | null;
  adminMemo?: string | null;
  status: string;
  faithPlusUserId?: string | null;
};

type FieldOption = {
  id: number;
  fieldType: string;
  label: string;
  isActive: boolean;
};

type Props = {
  member: Member | null;
  fieldOptions: FieldOption[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type TabType = "basic" | "church" | "account";

const TAB_LABELS: { key: TabType; label: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "church", label: "교회 정보" },
  { key: "account", label: "계정 관리" },
];

export default function MemberEditModal({ member, fieldOptions, open, onClose, onSaved }: Props) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [tempPassword, setTempPassword] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    birthDate: "",
    gender: "",
    address: "",
    emergencyPhone: "",
    position: "",
    department: "",
    district: "",
    baptismType: "",
    baptismDate: "",
    registeredAt: "",
    pastor: "",
    adminMemo: "",
    status: "pending",
    faithPlusUserId: "",
  });

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name ?? "",
        email: member.email ?? "",
        phone: member.phone ?? "",
        birthDate: member.birthDate ?? "",
        gender: member.gender ?? "",
        address: member.address ?? "",
        emergencyPhone: member.emergencyPhone ?? "",
        position: member.position ?? "",
        department: member.department ?? "",
        district: member.district ?? "",
        baptismType: member.baptismType ?? "",
        baptismDate: member.baptismDate ?? "",
        registeredAt: member.registeredAt ?? "",
        pastor: member.pastor ?? "",
        adminMemo: member.adminMemo ?? "",
        status: member.status ?? "pending",
        faithPlusUserId: member.faithPlusUserId ?? "",
      });
      setActiveTab("basic");
      setTempPassword("");
    }
  }, [member]);

  const positionOptions = fieldOptions.filter(o => o.fieldType === "position" && o.isActive);
  const departmentOptions = fieldOptions.filter(o => o.fieldType === "department" && o.isActive);
  const districtOptions = fieldOptions.filter(o => o.fieldType === "district" && o.isActive);
  const baptismOptions = fieldOptions.filter(o => o.fieldType === "baptism" && o.isActive);

  const updateMutation = trpc.members.adminUpdate.useMutation({
    onSuccess: () => {
      utils.members.adminList.invalidate();
      utils.members.pendingList.invalidate();
      toast.success("성도 정보가 수정됐습니다.");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPasswordMutation = trpc.members.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(`비밀번호가 "${tempPassword}"로 초기화됐습니다. 성도에게 전달해 주세요.`);
      setTempPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!member) return;
    updateMutation.mutate({
      id: member.id,
      name: form.name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      gender: (form.gender as "남" | "여") || undefined,
      address: form.address || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      position: form.position || undefined,
      department: form.department || undefined,
      district: form.district || undefined,
      baptismType: form.baptismType || undefined,
      baptismDate: form.baptismDate || undefined,
      registeredAt: form.registeredAt || undefined,
      pastor: form.pastor || undefined,
      adminMemo: form.adminMemo || undefined,
      status: form.status as "pending" | "approved" | "rejected" | "withdrawn",
      faithPlusUserId: form.faithPlusUserId || undefined,
    });
  };

  const handleResetPassword = () => {
    if (!member || !tempPassword) return;
    resetPasswordMutation.mutate({ id: member.id, tempPassword });
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30";
  const selectCls = inputCls;

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-800">
            성도 정보 수정 — {member.name}
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {TAB_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? "border-[#1B5E20] text-[#1B5E20]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 기본 정보 탭 */}
        {activeTab === "basic" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">이름 *</Label>
              <Input value={form.name} onChange={set("name")} className={inputCls} placeholder="이름" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">이메일 (로그인 ID)</Label>
              <Input value={form.email} onChange={set("email")} className={inputCls} placeholder="이메일" type="email" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">연락처</Label>
              <Input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="010-0000-0000" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">생년월일</Label>
              <Input value={form.birthDate} onChange={set("birthDate")} className={inputCls} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">성별</Label>
              <select value={form.gender} onChange={set("gender")} className={selectCls}>
                <option value="">선택 안함</option>
                <option value="남">남</option>
                <option value="여">여</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">비상연락처</Label>
              <Input value={form.emergencyPhone} onChange={set("emergencyPhone")} className={inputCls} placeholder="010-0000-0000" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">주소</Label>
              <Input value={form.address} onChange={set("address")} className={inputCls} placeholder="주소" />
            </div>
          </div>
        )}

        {/* 교회 정보 탭 */}
        {activeTab === "church" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">승인 상태</Label>
              <select value={form.status} onChange={set("status")} className={selectCls}>
                <option value="pending">대기</option>
                <option value="approved">승인</option>
                <option value="rejected">거절</option>
                <option value="withdrawn">탈퇴</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">직분</Label>
              <select value={form.position} onChange={set("position")} className={selectCls}>
                <option value="">선택 안함</option>
                {positionOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">소속 부서</Label>
              <select value={form.department} onChange={set("department")} className={selectCls}>
                <option value="">선택 안함</option>
                {departmentOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">구역/순</Label>
              <select value={form.district} onChange={set("district")} className={selectCls}>
                <option value="">선택 안함</option>
                {districtOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">세례 구분</Label>
              <select value={form.baptismType} onChange={set("baptismType")} className={selectCls}>
                <option value="">선택 안함</option>
                {baptismOptions.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">세례일</Label>
              <Input value={form.baptismDate} onChange={set("baptismDate")} className={inputCls} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">교회 등록일</Label>
              <Input value={form.registeredAt} onChange={set("registeredAt")} className={inputCls} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">담당 교역자</Label>
              <Input value={form.pastor} onChange={set("pastor")} className={inputCls} placeholder="담당 교역자 이름" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">믿음PLUS 앱 ID</Label>
              <Input value={form.faithPlusUserId} onChange={set("faithPlusUserId")} className={inputCls} placeholder="앱 연동 ID" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">관리자 메모</Label>
              <Textarea
                value={form.adminMemo}
                onChange={set("adminMemo")}
                className={inputCls}
                placeholder="관리자만 볼 수 있는 메모"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* 계정 관리 탭 */}
        {activeTab === "account" && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ 비밀번호 초기화</p>
              <p className="text-xs text-amber-700 mb-4">
                임시 비밀번호를 설정하고 성도에게 직접 전달해 주세요. 성도가 로그인 후 비밀번호를 변경하도록 안내하세요.
              </p>
              <div className="flex gap-2">
                <Input
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className={inputCls + " flex-1"}
                  placeholder="임시 비밀번호 (6자 이상)"
                  type="text"
                />
                <Button
                  onClick={handleResetPassword}
                  disabled={!tempPassword || tempPassword.length < 6 || resetPasswordMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-4"
                >
                  {resetPasswordMutation.isPending ? "처리 중..." : "초기화"}
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium mb-2">계정 정보</p>
              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="text-gray-400 w-24 inline-block">이메일</span>{member.email ?? "미등록"}</p>
                <p><span className="text-gray-400 w-24 inline-block">가입 상태</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    member.status === "approved" ? "bg-green-100 text-green-700" :
                    member.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    member.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {{ pending: "대기", approved: "승인", rejected: "거절", withdrawn: "탈퇴" }[member.status] ?? member.status}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 하단 버튼 (계정관리 탭 제외) */}
        {activeTab !== "account" && (
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={onClose} className="text-sm">취소</Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-sm"
            >
              {updateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
