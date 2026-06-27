import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type MenuKind = "item" | "subItem";
type ViewMode = "list" | "grid";
type PageType = "board" | "gallery";

type ViewModeLeaf = {
  key: string;
  kind: MenuKind;
  id: number;
  groupLabel: string;
  path: string;
  pageType: PageType;
  isVisible: boolean;
  defaultViewMode: ViewMode;
};

function getDefaultModeForPageType(pageType: PageType): ViewMode {
  return pageType === "gallery" ? "grid" : "list";
}

function normalizeViewMode(value: string | null | undefined, pageType: PageType): ViewMode {
  if (value === "grid") return "grid";
  if (value === "list") return "list";
  return getDefaultModeForPageType(pageType);
}

function getPageTypeLabel(pageType: PageType) {
  return pageType === "gallery" ? "갤러리" : "게시판";
}

function getViewModeLabel(viewMode: ViewMode) {
  return viewMode === "grid" ? "갤러리형" : "게시판형";
}

export default function AdminViewModesTab() {
  const utils = trpc.useUtils();
  const menusQuery = trpc.cms.menus.list.useQuery();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [draftModes, setDraftModes] = useState<Record<string, ViewMode>>({});

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !(prev[groupLabel] ?? true),
    }));
  };

  const invalidateMenus = async () => {
    await Promise.all([
      utils.cms.menus.list.invalidate(),
      utils.home.menus.invalidate(),
      utils.home.menuItem.invalidate(),
      utils.home.menuSubItem.invalidate(),
      utils.home.menuItemByHref.invalidate(),
      utils.home.menuSubItemByHref.invalidate(),
    ]);
  };

  const updateItem = trpc.cms.menus.updateItem.useMutation({
    onSuccess: async () => {
      toast.success("기본 보기방식을 저장했습니다.");
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "기본 보기방식 저장에 실패했습니다.");
    },
  });

  const updateSubItem = trpc.cms.menus.updateSubItem.useMutation({
    onSuccess: async () => {
      toast.success("기본 보기방식을 저장했습니다.");
      await invalidateMenus();
    },
    onError: (error) => {
      toast.error(error.message || "기본 보기방식 저장에 실패했습니다.");
    },
  });

  const leafRows = useMemo<ViewModeLeaf[]>(() => {
    const menus = menusQuery.data ?? [];
    const rows: ViewModeLeaf[] = [];

    for (const menu of menus) {
      for (const item of menu.items ?? []) {
        if (item.pageType === "board" || item.pageType === "gallery") {
          rows.push({
            key: `item-${item.id}`,
            kind: "item",
            id: item.id,
            groupLabel: menu.label,
            path: `${menu.label} > ${item.label}`,
            pageType: item.pageType,
            isVisible: item.isVisible,
            defaultViewMode: normalizeViewMode(item.defaultViewMode, item.pageType),
          });
        }

        for (const subItem of item.subItems ?? []) {
          if (subItem.pageType !== "board" && subItem.pageType !== "gallery") continue;
          rows.push({
            key: `subItem-${subItem.id}`,
            kind: "subItem",
            id: subItem.id,
            groupLabel: menu.label,
            path: `${menu.label} > ${item.label} > ${subItem.label}`,
            pageType: subItem.pageType,
            isVisible: subItem.isVisible,
            defaultViewMode: normalizeViewMode(subItem.defaultViewMode, subItem.pageType),
          });
        }
      }
    }

    return rows;
  }, [menusQuery.data]);

  const groupedLeaves = useMemo(() => {
    const groups = new Map<string, ViewModeLeaf[]>();
    for (const leaf of leafRows) {
      const list = groups.get(leaf.groupLabel) ?? [];
      list.push(leaf);
      groups.set(leaf.groupLabel, list);
    }
    return Array.from(groups.entries());
  }, [leafRows]);

  const isSaving = updateItem.isPending || updateSubItem.isPending;

  const saveLeaf = (leaf: ViewModeLeaf) => {
    const nextMode = draftModes[leaf.key] ?? leaf.defaultViewMode;
    if (nextMode === leaf.defaultViewMode) {
      toast.message("변경된 내용이 없습니다.");
      return;
    }

    if (leaf.kind === "item") {
      updateItem.mutate({
        id: leaf.id,
        defaultViewMode: nextMode,
      });
      return;
    }

    updateSubItem.mutate({
      id: leaf.id,
      defaultViewMode: nextMode,
    });
  };

  if (menusQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        보기방식 설정 메뉴를 불러오는 중입니다.
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
            게시판/갤러리 기본 보기방식
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            게시판과 갤러리 메뉴가 처음 열릴 때 어떤 화면으로 시작할지 정합니다.
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-400">
            게시판형은 제목 목록 중심, 갤러리형은 이미지 카드 중심입니다. 사용자는 페이지에 들어간 뒤 직접 다시 바꿀 수 있습니다.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-[#E8F5E9] px-3 py-1 text-sm font-semibold text-[#1B5E20]">
          대상 메뉴 {leafRows.length}개
        </span>
      </div>

      {groupedLeaves.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          게시판형 또는 갤러리형으로 설정된 메뉴가 아직 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedLeaves.map(([groupLabel, leaves]) => {
            const isCollapsed = collapsedGroups[groupLabel] ?? true;

            return (
              <section
                key={groupLabel}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
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
                      {isCollapsed
                        ? "눌러서 하위 메뉴의 기본 보기방식을 확인하세요."
                        : "하위 메뉴별로 기본 보기방식을 설정할 수 있습니다."}
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
                  <div className="divide-y divide-gray-100 border-t border-gray-100 px-4">
                    {leaves.map((leaf) => {
                      const currentMode = draftModes[leaf.key] ?? leaf.defaultViewMode;
                      const isDirty = currentMode !== leaf.defaultViewMode;

                      return (
                        <div
                          key={leaf.key}
                          className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                {leaf.kind === "item" ? "2단 메뉴" : "3단 메뉴"}
                              </span>
                              <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-semibold text-[#1B5E20]">
                                {getPageTypeLabel(leaf.pageType)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  leaf.isVisible
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {leaf.isVisible ? "노출 중" : "숨김"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-gray-900">
                              {leaf.path}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              현재 저장값: {getViewModeLabel(leaf.defaultViewMode)}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              value={currentMode}
                              onChange={(event) =>
                                setDraftModes((prev) => ({
                                  ...prev,
                                  [leaf.key]: event.target.value as ViewMode,
                                }))
                              }
                              className="h-10 min-w-[160px] rounded-lg border border-gray-200 px-3 text-sm focus:border-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                            >
                              <option value="list">게시판형</option>
                              <option value="grid">갤러리형</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => saveLeaf(leaf)}
                              disabled={!isDirty || isSaving}
                              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B5E20] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#245c27] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
