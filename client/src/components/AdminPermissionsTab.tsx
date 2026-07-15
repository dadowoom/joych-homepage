import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type PermissionSubject = {
  memberId: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  position: string | null;
  department: string | null;
  permissionKeys: string[];
};

export default function AdminPermissionsTab() {
  const utils = trpc.useUtils();
  const [searchInput, setSearchInput] = useState("");
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [assignedSubjectsCollapsed, setAssignedSubjectsCollapsed] = useState(false);
  const permissionsQuery = trpc.cms.adminPermissions.list.useQuery({
    searchTerm: submittedSearchTerm,
  });
  const permissions = permissionsQuery.data?.permissions ?? [];
  const subjects = permissionsQuery.data?.subjects ?? [];
  const assignedSubjects = permissionsQuery.data?.assignedSubjects ?? [];

  const allSubjects = useMemo(() => {
    const subjectByMemberId = new Map<number, PermissionSubject>();
    for (const subject of [...assignedSubjects, ...subjects]) {
      subjectByMemberId.set(subject.memberId, subject);
    }
    return Array.from(subjectByMemberId.values());
  }, [assignedSubjects, subjects]);

  const selectedSubject = useMemo(
    () => allSubjects.find((subject) => subject.memberId === selectedMemberId) ?? null,
    [allSubjects, selectedMemberId],
  );

  const permissionLabelByKey = useMemo(
    () => new Map(permissions.map((permission) => [permission.key, permission.label])),
    [permissions],
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const list = groups.get(permission.group) ?? [];
      list.push(permission);
      groups.set(permission.group, list);
    }
    return Array.from(groups.entries());
  }, [permissions]);

  useEffect(() => {
    if (!selectedMemberId) return;
    if (allSubjects.some((subject) => subject.memberId === selectedMemberId)) return;
    setSelectedMemberId(null);
  }, [allSubjects, selectedMemberId]);

  useEffect(() => {
    setSelectedKeys(selectedSubject?.permissionKeys ?? []);
  }, [selectedSubject?.memberId, selectedSubject?.permissionKeys]);

  const setPermissions = trpc.cms.adminPermissions.set.useMutation({
    onSuccess: async (result) => {
      toast.success("관리 권한이 저장되었습니다.");
      setSelectedKeys(result.permissionKeys);
      await utils.cms.adminPermissions.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "관리 권한 저장에 실패했습니다.");
    },
  });

  const toggleKey = (permissionKey: string) => {
    setSelectedKeys((current) =>
      current.includes(permissionKey)
        ? current.filter((key) => key !== permissionKey)
        : [...current, permissionKey],
    );
  };

  const togglePermissionGroup = (group: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const setAllPermissionGroupsCollapsed = (collapsed: boolean) => {
    setCollapsedGroups(
      Object.fromEntries(groupedPermissions.map(([group]) => [group, collapsed])),
    );
  };

  const handleSave = () => {
    if (!selectedSubject) {
      toast.error("권한을 부여할 성도를 선택해주세요.");
      return;
    }
    setPermissions.mutate({
      memberId: selectedSubject.memberId,
      permissionKeys: selectedKeys,
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSearchTerm = searchInput.trim();
    setSelectedMemberId(null);

    if (!nextSearchTerm) {
      setSubmittedSearchTerm("");
      return;
    }

    if (nextSearchTerm === submittedSearchTerm) {
      void permissionsQuery.refetch();
      return;
    }
    setSubmittedSearchTerm(nextSearchTerm);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#D8E8DA] bg-[#F8FCF8] p-4">
        <button
          type="button"
          onClick={() => setAssignedSubjectsCollapsed((current) => !current)}
          aria-expanded={!assignedSubjectsCollapsed}
          aria-controls="assigned-admin-permission-subjects"
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-base font-bold text-gray-900">관리권한 보유 계정</span>
            <span className="mt-1 block text-xs text-gray-500">
              현재 관리권한을 부여받은 계정을 선택하면 바로 권한을 수정할 수 있습니다.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
              {assignedSubjects.length}명
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1B5E20] shadow-sm">
              {assignedSubjectsCollapsed ? "펼치기" : "접기"}
              <i
                className={`fas fa-chevron-${assignedSubjectsCollapsed ? "down" : "up"} text-[10px]`}
              ></i>
            </span>
          </span>
        </button>

        {!assignedSubjectsCollapsed && (
          <div
            id="assigned-admin-permission-subjects"
            className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
          >
            {permissionsQuery.isLoading ? (
              <p className="rounded-lg border border-dashed border-[#C8E6C9] bg-white py-6 text-center text-sm text-gray-400 sm:col-span-2 xl:col-span-3">
                권한 보유 계정을 불러오는 중입니다.
              </p>
            ) : assignedSubjects.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#C8E6C9] bg-white py-6 text-center text-sm text-gray-400 sm:col-span-2 xl:col-span-3">
                권한이 부여된 계정이 없습니다.
              </p>
            ) : (
              assignedSubjects.map((subject: PermissionSubject) => {
                const isSelected = selectedMemberId === subject.memberId;
                const permissionLabels = subject.permissionKeys.map(
                  (key) => permissionLabelByKey.get(key) ?? key,
                );

                return (
                  <button
                    key={subject.memberId}
                    type="button"
                    onClick={() => setSelectedMemberId(subject.memberId)}
                    className={`rounded-lg border bg-white px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[#1B5E20] ring-1 ring-[#A5D6A7]"
                        : "border-gray-200 hover:border-[#A5D6A7] hover:bg-[#FCFFFC]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words text-sm font-semibold text-gray-900">
                        {subject.name} ({subject.position || "직분 미등록"})
                      </span>
                      <span className="shrink-0 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-xs font-semibold text-[#1B5E20]">
                        {subject.permissionKeys.length}개
                      </span>
                    </span>
                    <span className="mt-1.5 block whitespace-normal break-words text-xs leading-5 text-gray-500">
                      {permissionLabels.join(" · ")}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </section>

      <div>
        <h3
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        >
          게시판별 관리자 권한
        </h3>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          승인된 성도 계정에 필요한 게시판, 갤러리, 영상, 접수 관리 권한만 선택해서 부여합니다.
          게시판 권한에는 글을 보이게 하거나 숨기는 관리까지 포함됩니다.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <form className="mb-3" onSubmit={handleSearchSubmit}>
            <label className="text-sm font-semibold text-gray-800">성도 선택</label>
            <div className="mt-2 flex gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="이름, 직분, 부서, 이메일, 연락처 검색"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20]"
              />
              <button
                type="submit"
                disabled={permissionsQuery.isFetching}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#1B5E20] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fas fa-search mr-1.5"></i>
                검색
              </button>
            </div>
          </form>
          <div className="space-y-2 pr-1">
            {!submittedSearchTerm ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                이름, 직분, 부서, 이메일, 연락처를 입력한 뒤 검색하세요.
              </p>
            ) : permissionsQuery.isFetching ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                성도를 검색하는 중입니다.
              </p>
            ) : subjects.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                검색 결과가 없습니다.
              </p>
            ) : (
              subjects.map((subject: PermissionSubject) => {
                const isSelected = selectedMemberId === subject.memberId;
                const permissionCount = subject.permissionKeys.length;
                const permissionLabels = permissions
                  .filter((permission) => subject.permissionKeys.includes(permission.key))
                  .map((permission) => permission.label);

                return (
                  <button
                    key={subject.memberId}
                    type="button"
                    onClick={() => setSelectedMemberId(subject.memberId)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-[#1B5E20] bg-[#F1F8F2]"
                        : "border-gray-200 hover:border-[#A5D6A7] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{subject.name}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {subject.position || subject.department || subject.email || subject.phone || "-"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-xs font-semibold text-[#1B5E20]">
                        {permissionCount}개
                      </span>
                    </div>
                    {subject.status !== "approved" && (
                      <div className="mt-2 text-xs text-amber-600">
                        승인 완료 후 권한 로그인이 가능합니다.
                      </div>
                    )}
                    <div className="mt-2 whitespace-normal break-words text-xs leading-5 text-gray-500">
                      {permissionLabels.length > 0
                        ? permissionLabels.join(" · ")
                        : "부여된 권한 없음"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">선택된 성도</p>
              <h4 className="mt-1 text-lg font-bold text-gray-900">
                {selectedSubject?.name ?? "성도를 선택해주세요"}
              </h4>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedSubject || setPermissions.isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B5E20] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="fas fa-save mr-2"></i>
              {setPermissions.isPending ? "저장 중" : "권한 저장"}
            </button>
          </div>

          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              권한 그룹을 접거나 펼쳐서 필요한 항목만 확인할 수 있습니다.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setAllPermissionGroupsCollapsed(false)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:border-[#A5D6A7] hover:text-[#1B5E20]"
              >
                전체 펼치기
              </button>
              <button
                type="button"
                onClick={() => setAllPermissionGroupsCollapsed(true)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:border-[#A5D6A7] hover:text-[#1B5E20]"
              >
                전체 접기
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {groupedPermissions.map(([group, groupPermissions]) => {
              const isCollapsed = collapsedGroups[group] ?? false;
              const selectedCount = groupPermissions.filter((permission) =>
                selectedKeys.includes(permission.key),
              ).length;

              return (
                <div key={group} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <button
                    type="button"
                    onClick={() => togglePermissionGroup(group)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="block font-semibold text-gray-900">{group}</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        선택 {selectedCount}개 / 전체 {groupPermissions.length}개
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1B5E20] shadow-sm">
                      {isCollapsed ? "펼치기" : "접기"}
                      <i
                        className={`fas fa-chevron-${isCollapsed ? "down" : "up"} text-[10px]`}
                      ></i>
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {groupPermissions.map((permission) => {
                        const checked = selectedKeys.includes(permission.key);

                        return (
                          <label
                            key={permission.key}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors ${
                              checked
                                ? "border-[#1B5E20] ring-1 ring-[#A5D6A7]"
                                : "border-gray-200 hover:border-[#A5D6A7]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleKey(permission.key)}
                              className="mt-1 h-4 w-4 accent-[#1B5E20]"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">
                                {permission.label}
                              </span>
                              {permission.description && (
                                <span className="mt-1 block text-xs text-gray-500">
                                  {permission.description}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
