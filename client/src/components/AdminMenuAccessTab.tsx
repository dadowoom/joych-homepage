import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type LeafKind = "menu" | "item" | "subItem";
type ReadLevel = "guest" | "member";

type MenuLeaf = {
  kind: LeafKind;
  id: number;
  groupLabel: string;
  label: string;
  path: string;
  href: string | null;
  allowGuest: boolean;
  allowMember: boolean;
};

const READ_LEVEL_OPTIONS: {
  value: ReadLevel | "hidden";
  label: string;
  description: string;
}[] = [
  {
    value: "guest",
    label: "전체공개",
    description: "비로그인 방문자와 로그인 성도 모두 볼 수 있습니다.",
  },
  {
    value: "member",
    label: "성도 공개",
    description: "로그인한 성도만 볼 수 있습니다.",
  },
  {
    value: "hidden",
    label: "숨김",
    description: "일반 방문자와 성도 화면에서 보이지 않습니다.",
  },
].filter((option): option is { value: ReadLevel; label: string; description: string } => option.value !== "hidden");

function getReadLevel(leaf: Pick<MenuLeaf, "allowGuest" | "allowMember">): ReadLevel {
  if (leaf.allowGuest) return "guest";
  return "member";
}

function getReadFlags(level: ReadLevel) {
  return {
    allowGuest: level === "guest",
    allowMember: level === "guest" || level === "member",
  };
}

function getReadLevelDescription(level: ReadLevel) {
  return READ_LEVEL_OPTIONS.find((option) => option.value === level)?.description ?? "";
}

export default function AdminMenuAccessTab() {
  const utils = trpc.useUtils();
  const menusQuery = trpc.cms.menus.accessList.useQuery();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !(prev[groupLabel] ?? true),
    }));
  };

  const invalidateMenus = async () => {
    await Promise.all([
      utils.cms.menus.accessList.invalidate(),
      utils.cms.menus.list.invalidate(),
      utils.home.menus.invalidate(),
      utils.home.menuItem.invalidate(),
      utils.home.menuSubItem.invalidate(),
      utils.home.menuItemByHref.invalidate(),
      utils.home.menuSubItemByHref.invalidate(),
      utils.home.menuAccessByHref.invalidate(),
      utils.home.menuAccessById.invalidate(),
    ]);
  };

  const updateMenu = trpc.cms.menus.updateMenuAccess.useMutation({
    onSuccess: async () => {
      toast.success("?? ?? ??? ??????.");
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "?? ?? ?? ??? ??????.");
    },
  });

  const updateItem = trpc.cms.menus.updateItemAccess.useMutation({
    onSuccess: async () => {
      toast.success("메뉴 읽기 권한을 저장했습니다.");
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "메뉴 읽기 권한 저장에 실패했습니다.");
    },
  });

  const updateSubItem = trpc.cms.menus.updateSubItemAccess.useMutation({
    onSuccess: async () => {
      toast.success("메뉴 읽기 권한을 저장했습니다.");
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "메뉴 읽기 권한 저장에 실패했습니다.");
    },
  });

  const updateAccessBatch = trpc.cms.menus.updateAccessBatch.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.count}개 메뉴 읽기 권한을 일괄 적용했습니다.`);
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "메뉴 읽기 권한 일괄 적용에 실패했습니다.");
    },
  });

  const leafRows = useMemo<MenuLeaf[]>(() => {
    const menus = menusQuery.data ?? [];
    const rows: MenuLeaf[] = [];

    for (const menu of menus) {
      if ((menu.href ?? "").trim() && (menu.items ?? []).length === 0) {
        rows.push({
          kind: "menu",
          id: menu.id,
          groupLabel: menu.label,
          label: menu.label,
          path: menu.label,
          href: menu.href,
          allowGuest: menu.allowGuest,
          allowMember: menu.allowMember,
        });
      }

      for (const item of menu.items ?? []) {
        const subItems = item.subItems ?? [];
        if (subItems.length === 0) {
          rows.push({
            kind: "item",
            id: item.id,
            groupLabel: menu.label,
            label: item.label,
            path: `${menu.label} > ${item.label}`,
            href: item.href,
            allowGuest: item.allowGuest,
            allowMember: item.allowMember,
          });
          continue;
        }

        for (const subItem of subItems) {
          rows.push({
            kind: "subItem",
            id: subItem.id,
            groupLabel: menu.label,
            label: subItem.label,
            path: `${menu.label} > ${item.label} > ${subItem.label}`,
            href: subItem.href,
            allowGuest: subItem.allowGuest,
            allowMember: subItem.allowMember,
          });
        }
      }
    }

    return rows;
  }, [menusQuery.data]);

  const groupedLeaves = useMemo(() => {
    const groups = new Map<string, MenuLeaf[]>();
    for (const leaf of leafRows) {
      const list = groups.get(leaf.groupLabel) ?? [];
      list.push(leaf);
      groups.set(leaf.groupLabel, list);
    }
    return Array.from(groups.entries());
  }, [leafRows]);

  const isSaving = updateMenu.isPending || updateItem.isPending || updateSubItem.isPending || updateAccessBatch.isPending;

  const setAccess = (leaf: MenuLeaf, level: ReadLevel) => {
    const payload = {
      id: leaf.id,
      ...getReadFlags(level),
    };

    if (leaf.kind === "menu") {
      updateMenu.mutate(payload);
      return;
    }

    if (leaf.kind === "item") {
      updateItem.mutate(payload);
      return;
    }

    updateSubItem.mutate(payload);
  };

  const setGroupAccess = (leaves: MenuLeaf[], level: ReadLevel) => {
    const flags = getReadFlags(level);
    updateAccessBatch.mutate({
      leaves: leaves.map((leaf) => ({
        kind: leaf.kind,
        id: leaf.id,
        ...flags,
      })),
    });
  };

  if (menusQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        메뉴 읽기 권한을 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            메뉴 읽기 권한
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            최하위 메뉴 기준으로 누가 볼 수 있는지 최소 읽기 권한을 정합니다. 새로 만든 메뉴도 자동으로 이 목록에 표시됩니다.
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-400">
            전체공개는 누구나 볼 수 있고, 성도 공개는 로그인한 성도만 볼 수 있습니다.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-[#E8F5E9] px-3 py-1 text-sm font-semibold text-[#1B5E20]">
          {leafRows.length}개 하위 메뉴
        </span>
      </div>

      {groupedLeaves.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          권한을 설정할 하위 메뉴가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedLeaves.map(([groupLabel, leaves]) => {
            const isCollapsed = collapsedGroups[groupLabel] ?? true;

            return (
              <section key={groupLabel} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupLabel)}
                  aria-expanded={!isCollapsed}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors ${
                    isCollapsed ? "hover:bg-gray-50" : "bg-[#F1F8F2]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-900">{groupLabel}</span>
                    <span className="mt-1 block text-xs text-gray-400">
                      {isCollapsed ? "눌러서 하위 메뉴 권한을 펼쳐보세요." : "하위 메뉴 권한을 수정할 수 있습니다."}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                      {leaves.length}개
                    </span>
                    <i
                      className={`fas fa-chevron-${isCollapsed ? "down" : "up"} text-xs text-gray-400`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-gray-100 px-4">
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold text-gray-500">
                        이 메뉴의 하위 항목을 한 번에 적용
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {READ_LEVEL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isSaving}
                            onClick={() => setGroupAccess(leaves, option.value as ReadLevel)}
                            className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-[#1B5E20] hover:text-[#1B5E20] disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {leaves.map((leaf) => {
                      const currentLevel = getReadLevel(leaf);

                      return (
                        <div
                          key={`${leaf.kind}-${leaf.id}`}
                          className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">{leaf.label}</p>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-500">{leaf.path}</p>
                            <p className="mt-1 truncate text-xs text-gray-400">
                              {leaf.href || "연결 경로 없음"}
                            </p>
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-gray-500">
                              읽기 최소 권한
                            </span>
                            <select
                              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/15 disabled:bg-gray-50 disabled:text-gray-400"
                              value={currentLevel}
                              disabled={isSaving}
                              onChange={(event) => setAccess(leaf, event.target.value as ReadLevel)}
                            >
                              {READ_LEVEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="mt-1 block text-xs leading-5 text-gray-400">
                              {getReadLevelDescription(currentLevel)}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
