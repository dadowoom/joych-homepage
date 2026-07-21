import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type CourseRoom = { label: string; href: string };

export default function CourseRoomPermissionManager({ rooms }: { rooms: CourseRoom[] }) {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedRoomHref, setSelectedRoomHref] = useState(rooms[0]?.href ?? "");
  const { data: members = [] } = trpc.cms.courses.roomManagerMembers.useQuery();
  const { data: grants = [] } = trpc.cms.courses.roomManagers.useQuery();

  useEffect(() => {
    if (!rooms.some(room => room.href === selectedRoomHref)) {
      setSelectedRoomHref(rooms[0]?.href ?? "");
    }
  }, [rooms, selectedRoomHref]);

  const refresh = () => {
    utils.cms.courses.roomManagers.invalidate();
    utils.courseManagement.access.invalidate();
  };
  const grant = trpc.cms.courses.createRoomManager.useMutation({
    onSuccess: () => { refresh(); setSelectedMemberId(null); toast.success("강좌방 담당 권한을 부여했습니다."); },
    onError: error => toast.error(error.message || "권한 부여에 실패했습니다."),
  });
  const revoke = trpc.cms.courses.updateRoomManager.useMutation({
    onSuccess: () => { refresh(); toast.success("강좌방 담당 권한을 해제했습니다."); },
    onError: error => toast.error(error.message || "권한 해제에 실패했습니다."),
  });

  const approvedMembers = useMemo(() => members.filter(member => member.status === "approved"), [members]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return approvedMembers.slice(0, 8);
    return approvedMembers.filter(member => [member.name, member.email, member.phone, member.position, member.department]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(term))).slice(0, 8);
  }, [approvedMembers, query]);
  const roomLabel = (href: string) => rooms.find(room => room.href === href)?.label ?? href;
  const selectedMember = approvedMembers.find(member => member.id === selectedMemberId);

  return (
    <section className="rounded-xl border border-green-100 bg-green-50/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#1B5E20]"><ShieldCheck className="h-4 w-4" />강좌방 담당자 권한</div>
          <p className="mt-1 text-xs text-gray-500">성도를 검색해 특정 강좌방의 등록, 수정, 삭제와 신청 승인 권한을 부여합니다.</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500">활성 권한 {grants.length}건</span>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={event => { setQuery(event.target.value); setSelectedMemberId(null); }} placeholder="성도 이름, 이메일, 연락처 검색" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm" />
          {(query || selectedMemberId) && (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {results.length === 0 ? <p className="px-3 py-3 text-xs text-gray-400">승인된 성도를 찾지 못했습니다.</p> : results.map(member => (
                <button key={member.id} type="button" onClick={() => { setSelectedMemberId(member.id); setQuery(member.name); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-green-50">
                  <UserRound className="h-4 w-4 shrink-0 text-green-700" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">{member.name} {member.position ? `· ${member.position}` : ""}</span><span className="truncate text-xs text-gray-400">{member.phone || member.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={selectedRoomHref} onChange={event => setSelectedRoomHref(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          {rooms.map(room => <option key={room.href} value={room.href}>{room.label}</option>)}
        </select>
        <button type="button" disabled={!selectedMember || !selectedRoomHref || grant.isPending} onClick={() => selectedMemberId && grant.mutate({ memberId: selectedMemberId, pageHref: selectedRoomHref })} className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">권한 부여</button>
      </div>

      {grants.length > 0 && <div className="mt-4 grid gap-2 lg:grid-cols-2">{grants.map(grantItem => (
        <div key={grantItem.id} className="flex items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-2.5">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-gray-700">{grantItem.memberName || `성도 #${grantItem.memberId}`} <span className="font-normal text-gray-400">· {roomLabel(grantItem.pageHref)}</span></p><p className="truncate text-xs text-gray-400">{grantItem.memberPosition || grantItem.memberPhone || "담당 강좌방"}</p></div>
          <button
            type="button"
            disabled={revoke.isPending && revoke.variables?.id === grantItem.id}
            onClick={() => {
              if (!window.confirm(`${grantItem.memberName || "선택한 성도"}님의 ${roomLabel(grantItem.pageHref)} 담당 권한을 해제하시겠습니까?`)) return;
              revoke.mutate({ id: grantItem.id, canManage: false });
            }}
            className="shrink-0 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
          >
            {revoke.isPending && revoke.variables?.id === grantItem.id ? "해제 중" : "권한 해제"}
          </button>
        </div>
      ))}</div>}
      {grants.length === 0 && <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-green-100 bg-white/60 py-4 text-sm text-gray-400"><Users className="h-4 w-4" />부여된 강좌방 담당 권한이 없습니다.</div>}
    </section>
  );
}
