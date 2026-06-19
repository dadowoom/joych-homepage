import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";

type Decade = {
  id: number;
  title: string;
  startYear: number;
  endYear: number;
  sortOrder: number;
  isVisible: boolean;
};

type HistoryItem = {
  id: number;
  decadeId: number;
  year: number;
  month: number;
  content: string;
  sortOrder: number;
  isVisible: boolean;
};

type DecadeForm = {
  id?: number;
  title: string;
  startYear: string;
  endYear: string;
  sortOrder: string;
  isVisible: boolean;
};

type ItemForm = {
  id?: number;
  decadeId: string;
  year: string;
  month: string;
  content: string;
  sortOrder: string;
  isVisible: boolean;
};

const emptyDecadeForm: DecadeForm = {
  title: "",
  startYear: "",
  endYear: "",
  sortOrder: "",
  isVisible: true,
};

const emptyItemForm: ItemForm = {
  decadeId: "",
  year: "",
  month: "",
  content: "",
  sortOrder: "",
  isVisible: true,
};

function sortDecades(decades: Decade[]) {
  return [...decades].sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      b.startYear - a.startYear ||
      a.id - b.id,
  );
}

function sortItems(items: HistoryItem[]) {
  return [...items].sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      a.year - b.year ||
      a.month - b.month ||
      a.id - b.id,
  );
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionalSortOrder(value: string) {
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatMonth(month: number) {
  return String(month).padStart(2, "0");
}

export default function AdminChurchHistoryTab() {
  const utils = trpc.useUtils();
  const decadesQuery = trpc.cms.history.decades.useQuery();
  const itemsQuery = trpc.cms.history.items.useQuery();
  const decades = useMemo(
    () => sortDecades((decadesQuery.data ?? []) as Decade[]),
    [decadesQuery.data],
  );
  const items = useMemo(
    () => sortItems((itemsQuery.data ?? []) as HistoryItem[]),
    [itemsQuery.data],
  );
  const [selectedDecadeId, setSelectedDecadeId] = useState("");
  const [decadeForm, setDecadeForm] = useState<DecadeForm>(emptyDecadeForm);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const refreshHistory = () => {
    void utils.cms.history.decades.invalidate();
    void utils.cms.history.items.invalidate();
    void utils.home.history.invalidate();
  };

  useEffect(() => {
    if (!selectedDecadeId && decades[0]) {
      const id = String(decades[0].id);
      setSelectedDecadeId(id);
      setItemForm((current) => ({ ...current, decadeId: current.decadeId || id }));
    }
  }, [decades, selectedDecadeId]);

  const createDecade = trpc.cms.history.createDecade.useMutation({
    onSuccess: () => {
      setDecadeForm(emptyDecadeForm);
      refreshHistory();
    },
  });
  const updateDecade = trpc.cms.history.updateDecade.useMutation({
    onSuccess: () => {
      setDecadeForm(emptyDecadeForm);
      refreshHistory();
    },
  });
  const deleteDecade = trpc.cms.history.deleteDecade.useMutation({
    onSuccess: () => {
      setSelectedDecadeId("");
      setItemForm(emptyItemForm);
      refreshHistory();
    },
  });
  const reorderDecades = trpc.cms.history.reorderDecades.useMutation({
    onSuccess: refreshHistory,
  });
  const createItem = trpc.cms.history.createItem.useMutation({
    onSuccess: () => {
      setItemForm({ ...emptyItemForm, decadeId: selectedDecadeId });
      refreshHistory();
    },
  });
  const updateItem = trpc.cms.history.updateItem.useMutation({
    onSuccess: () => {
      setItemForm({ ...emptyItemForm, decadeId: selectedDecadeId });
      refreshHistory();
    },
  });
  const deleteItem = trpc.cms.history.deleteItem.useMutation({
    onSuccess: refreshHistory,
  });
  const reorderItems = trpc.cms.history.reorderItems.useMutation({
    onSuccess: refreshHistory,
  });

  const selectedItems = useMemo(() => {
    const id = Number(selectedDecadeId);
    return Number.isFinite(id) ? items.filter((item) => item.decadeId === id) : [];
  }, [items, selectedDecadeId]);

  const handleDecadeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = decadeForm.title.trim();
    const startYear = parseNumber(decadeForm.startYear);
    const endYear = parseNumber(decadeForm.endYear);

    if (!title) {
      alert("년대 제목을 입력해주세요.");
      return;
    }
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
      alert("시작 연도와 종료 연도는 숫자로 입력해주세요.");
      return;
    }
    if (startYear > endYear) {
      alert("종료 연도는 시작 연도보다 작을 수 없습니다.");
      return;
    }

    const payload = {
      title,
      startYear,
      endYear,
      sortOrder: optionalSortOrder(decadeForm.sortOrder),
      isVisible: decadeForm.isVisible,
    };

    if (decadeForm.id) {
      updateDecade.mutate({ id: decadeForm.id, ...payload });
    } else {
      createDecade.mutate(payload);
    }
  };

  const handleItemSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const decadeId = parseNumber(itemForm.decadeId);
    const year = parseNumber(itemForm.year);
    const month = parseNumber(itemForm.month);
    const content = itemForm.content.trim();

    if (!Number.isInteger(decadeId)) {
      alert("년대를 선택해주세요.");
      return;
    }
    if (!Number.isInteger(year)) {
      alert("연도는 숫자로 입력해주세요.");
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      alert("월은 1부터 12 사이로 입력해주세요.");
      return;
    }
    if (!content) {
      alert("내용을 입력해주세요.");
      return;
    }

    const payload = {
      decadeId,
      year,
      month,
      content,
      sortOrder: optionalSortOrder(itemForm.sortOrder),
      isVisible: itemForm.isVisible,
    };

    if (itemForm.id) {
      updateItem.mutate({ id: itemForm.id, ...payload });
    } else {
      createItem.mutate(payload);
    }
  };

  const moveDecade = (id: number, direction: -1 | 1) => {
    const index = decades.findIndex((decade) => decade.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= decades.length) return;
    const next = [...decades];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    reorderDecades.mutate({ ids: next.map((decade) => decade.id) });
  };

  const moveItem = (id: number, direction: -1 | 1) => {
    const index = selectedItems.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedItems.length) return;
    const next = [...selectedItems];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    reorderItems.mutate({ ids: next.map((item) => item.id) });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              콘텐츠/노출 관리
            </p>
            <h2 className="mt-3 font-serif text-2xl font-bold text-gray-950">교회연혁 관리</h2>
            <p className="mt-1 text-sm text-gray-600">
              년대와 연도별 내용을 등록하면 교회연혁 화면에 바로 반영됩니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
            전체 <strong className="text-green-700">{decades.length}</strong>개 년대
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-950">년대 목록 관리</h3>
            <p className="text-sm text-gray-500">최신 년대가 앞에 보이도록 순서를 조정할 수 있습니다.</p>
          </div>

          <form onSubmit={handleDecadeSubmit} className="space-y-3 rounded-xl border border-green-100 bg-green-50/40 p-4">
            <label className="block text-sm font-semibold text-gray-700">
              년대 제목
              <input
                value={decadeForm.title}
                onChange={(event) => setDecadeForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="예: 2020년대"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-gray-700">
                시작 연도
                <input
                  value={decadeForm.startYear}
                  onChange={(event) => setDecadeForm((current) => ({ ...current, startYear: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="2020"
                  inputMode="numeric"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                종료 연도
                <input
                  value={decadeForm.endYear}
                  onChange={(event) => setDecadeForm((current) => ({ ...current, endYear: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="2029"
                  inputMode="numeric"
                />
              </label>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label className="block text-sm font-semibold text-gray-700">
                정렬 순서
                <input
                  value={decadeForm.sortOrder}
                  onChange={(event) => setDecadeForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="자동"
                  inputMode="numeric"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={decadeForm.isVisible}
                  onChange={(event) => setDecadeForm((current) => ({ ...current, isVisible: event.target.checked }))}
                />
                노출
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecadeForm(emptyDecadeForm)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                초기화
              </button>
              <button
                type="submit"
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                {decadeForm.id ? "수정" : "추가"}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {decades.map((decade, index) => (
              <div
                key={decade.id}
                className={`rounded-xl border p-3 ${String(decade.id) === selectedDecadeId ? "border-green-600 bg-green-50" : "border-gray-200"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDecadeId(String(decade.id));
                    setItemForm((current) => ({ ...current, decadeId: String(decade.id) }));
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-gray-950">{decade.title}</strong>
                    <span className={`rounded-full px-2 py-1 text-xs ${decade.isVisible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {decade.isVisible ? "노출" : "숨김"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {decade.startYear} - {decade.endYear} · 표시 순서 {decade.sortOrder || index + 1}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => moveDecade(decade.id, -1)} className="rounded border px-2 py-1 text-xs" disabled={index === 0}>위</button>
                  <button type="button" onClick={() => moveDecade(decade.id, 1)} className="rounded border px-2 py-1 text-xs" disabled={index === decades.length - 1}>아래</button>
                  <button
                    type="button"
                    onClick={() => setDecadeForm({
                      id: decade.id,
                      title: decade.title,
                      startYear: String(decade.startYear),
                      endYear: String(decade.endYear),
                      sortOrder: String(decade.sortOrder || ""),
                      isVisible: decade.isVisible,
                    })}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("이 년대와 포함된 연혁 내용을 삭제할까요?")) {
                        deleteDecade.mutate({ id: decade.id });
                      }
                    }}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {!decades.length && (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                등록된 년대가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-950">연혁 내용 관리</h3>
            <p className="text-sm text-gray-500">년대별로 연도, 월, 내용을 등록합니다.</p>
          </div>

          <form onSubmit={handleItemSubmit} className="space-y-3 rounded-xl border border-green-100 bg-green-50/40 p-4">
            <label className="block text-sm font-semibold text-gray-700">
              년대
              <select
                value={itemForm.decadeId}
                onChange={(event) => {
                  setSelectedDecadeId(event.target.value);
                  setItemForm((current) => ({ ...current, decadeId: event.target.value }));
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">년대 선택</option>
                {decades.map((decade) => (
                  <option key={decade.id} value={decade.id}>{decade.title}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold text-gray-700">
                연도
                <input
                  value={itemForm.year}
                  onChange={(event) => setItemForm((current) => ({ ...current, year: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="1980"
                  inputMode="numeric"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                월
                <input
                  value={itemForm.month}
                  onChange={(event) => setItemForm((current) => ({ ...current, month: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="04"
                  inputMode="numeric"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                정렬 순서
                <input
                  value={itemForm.sortOrder}
                  onChange={(event) => setItemForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="자동"
                  inputMode="numeric"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              내용
              <textarea
                value={itemForm.content}
                onChange={(event) => setItemForm((current) => ({ ...current, content: event.target.value }))}
                className="mt-1 min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="연혁 내용을 입력해주세요."
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={itemForm.isVisible}
                  onChange={(event) => setItemForm((current) => ({ ...current, isVisible: event.target.checked }))}
                />
                노출
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setItemForm({ ...emptyItemForm, decadeId: selectedDecadeId })}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  초기화
                </button>
                <button type="submit" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">
                  {itemForm.id ? "수정" : "추가"}
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-2">
            {selectedItems.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <strong className="text-lg text-blue-950">{item.year}</strong>
                      <span className="text-sm font-semibold text-blue-500">{formatMonth(item.month)}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${item.isVisible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {item.isVisible ? "노출" : "숨김"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{item.content}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => moveItem(item.id, -1)} className="rounded border px-2 py-1 text-xs" disabled={index === 0}>위</button>
                    <button type="button" onClick={() => moveItem(item.id, 1)} className="rounded border px-2 py-1 text-xs" disabled={index === selectedItems.length - 1}>아래</button>
                    <button
                      type="button"
                      onClick={() => setItemForm({
                        id: item.id,
                        decadeId: String(item.decadeId),
                        year: String(item.year),
                        month: formatMonth(item.month),
                        content: item.content,
                        sortOrder: String(item.sortOrder || ""),
                        isVisible: item.isVisible,
                      })}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("이 연혁 내용을 삭제할까요?")) {
                          deleteItem.mutate({ id: item.id });
                        }
                      }}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!selectedItems.length && (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                선택한 년대에 등록된 연혁 내용이 없습니다.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
