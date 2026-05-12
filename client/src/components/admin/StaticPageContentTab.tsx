import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function StaticPageContentTab() {
  const utils = trpc.useUtils();
  const { data: pages = [], isLoading } = trpc.cms.content.staticPages.list.useQuery();
  const [selectedHref, setSelectedHref] = useState("");
  const activeHref = selectedHref || pages[0]?.href || "";
  const selectedPage = useMemo(
    () => pages.find((page) => page.href === activeHref) ?? pages[0],
    [activeHref, pages],
  );
  const [editorValue, setEditorValue] = useState("");

  useEffect(() => {
    if (selectedPage) {
      setEditorValue(selectedPage.content);
    }
  }, [selectedPage?.href, selectedPage?.content]);

  const updateMutation = trpc.cms.content.staticPages.update.useMutation({
    onSuccess: () => {
      utils.cms.content.staticPages.list.invalidate();
      utils.home.staticPageContent.invalidate();
      toast.success("페이지 콘텐츠가 저장됐습니다.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetMutation = trpc.cms.content.staticPages.reset.useMutation({
    onSuccess: () => {
      utils.cms.content.staticPages.list.invalidate();
      utils.home.staticPageContent.invalidate();
      toast.success("코드 기본 콘텐츠로 복원했습니다.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;
  }

  if (!selectedPage) {
    return <p className="text-gray-500 py-8 text-center">관리할 페이지가 없습니다.</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-800">페이지 콘텐츠 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            기존 화면 디자인은 유지하고, 페이지 본문 데이터만 CMS 저장값으로 관리합니다.
          </p>
        </div>
        <span className="text-xs bg-green-50 text-[#1B5E20] px-3 py-1 rounded-full border border-green-100">
          {pages.length}개 페이지
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {pages.map((page) => (
            <button
              key={page.href}
              type="button"
              onClick={() => setSelectedHref(page.href)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                page.href === activeHref
                  ? "bg-[#1B5E20] text-white"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span className="block text-xs opacity-75">{page.group}</span>
              <span className="block text-sm font-medium mt-0.5">{page.title}</span>
              <span className="block text-xs opacity-70 mt-1">{page.href}</span>
            </button>
          ))}
        </div>

        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{selectedPage.title}</p>
              <p className="text-xs text-gray-500">
                {selectedPage.href} · {selectedPage.hasDbContent ? "CMS 저장값 사용 중" : "코드 기본값 사용 중"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditorValue(selectedPage.fallbackContent)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
              >
                기본값 불러오기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("이 페이지를 코드 기본 콘텐츠로 복원하시겠습니까?")) {
                    resetMutation.mutate({ href: selectedPage.href });
                  }
                }}
                disabled={resetMutation.isPending}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                복원
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate({ href: selectedPage.href, content: editorValue })}
                disabled={updateMutation.isPending}
                className="px-3 py-1.5 text-xs bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>

          <div className="p-4">
            <label className="block text-xs text-gray-500 mb-2">JSON 콘텐츠</label>
            <textarea
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
              spellCheck={false}
              className="w-full min-h-[520px] border border-gray-300 rounded-lg px-3 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-2">
              잘못된 JSON 또는 필수 항목 누락은 저장 시 서버에서 차단됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
