import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
  year: string;
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
  year: "",
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
      a.id - b.id
  );
}

function sortItems(items: HistoryItem[]) {
  return [...items].sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      a.year - b.year ||
      a.month - b.month ||
      a.id - b.id
  );
}

function parseNumber(value: string) {
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) {
    return NaN;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function optionalSortOrder(value: string) {
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDecadeTitle(yearText: string, year: number) {
  const normalizedText = yearText.trim();
  return normalizedText || `${year}년`;
}

function formatMonth(month: number) {
  return String(month).padStart(2, "0");
}

function groupItemsByYear(items: HistoryItem[]) {
  const groups = new Map<number, HistoryItem[]>();

  for (const item of items) {
    const group = groups.get(item.year) ?? [];
    group.push(item);
    groups.set(item.year, group);
  }

  return Array.from(groups.entries());
}

function SortableDecadeTab({
  decade,
  isSelected,
  onSelect,
}: {
  decade: Decade;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: decade.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onSelect}
      className={`inline-flex items-center gap-2 rounded-none border px-4 py-3 text-sm font-semibold transition ${
        isSelected
          ? "border-green-700 bg-green-700 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-green-300"
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        title="드래그하여 연도 순서 변경"
        className={`-ml-1 flex h-6 w-6 touch-none cursor-grab items-center justify-center rounded active:cursor-grabbing ${
          isSelected
            ? "text-white/80 hover:bg-white/10"
            : "text-gray-300 hover:bg-gray-50 hover:text-gray-500"
        }`}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span>{decade.title}</span>
      {!decade.isVisible && (
        <span className="ml-1 text-xs opacity-70">숨김</span>
      )}
    </button>
  );
}

function SortableHistoryItemCard({
  item,
  itemIndex,
  onEdit,
  onDelete,
}: {
  item: HistoryItem;
  itemIndex: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:grid-cols-[auto_70px_1fr_auto]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="드래그하여 순서 변경"
        className="-ml-1 flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-lg text-gray-300 hover:bg-gray-50 hover:text-gray-500 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="text-lg font-semibold text-blue-300">
        {formatMonth(item.month)}
      </div>
      <div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {item.content}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <span>정렬 {item.sortOrder || itemIndex + 1}</span>
          {!item.isVisible && (
            <span className="rounded bg-gray-100 px-2 py-0.5">숨김</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          수정
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export default function AdminChurchHistoryTab() {
  const utils = trpc.useUtils();
  const decadesQuery = trpc.cms.history.decades.useQuery();
  const itemsQuery = trpc.cms.history.items.useQuery();

  const decades = useMemo(
    () => sortDecades((decadesQuery.data ?? []) as Decade[]),
    [decadesQuery.data]
  );
  const items = useMemo(
    () => sortItems((itemsQuery.data ?? []) as HistoryItem[]),
    [itemsQuery.data]
  );

  const [selectedDecadeId, setSelectedDecadeId] = useState("");
  const [decadeForm, setDecadeForm] = useState<DecadeForm>(emptyDecadeForm);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [isDecadeFormOpen, setIsDecadeFormOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const selectedDecade = useMemo(() => {
    const id = Number(selectedDecadeId);
    return Number.isFinite(id)
      ? decades.find(decade => decade.id === id)
      : undefined;
  }, [decades, selectedDecadeId]);

  const selectedItems = useMemo(() => {
    const id = Number(selectedDecadeId);
    return Number.isFinite(id)
      ? items.filter(item => item.decadeId === id)
      : [];
  }, [items, selectedDecadeId]);

  const groupedItems = useMemo(
    () => groupItemsByYear(selectedItems),
    [selectedItems]
  );

  const refreshHistory = () => {
    void utils.cms.history.decades.invalidate();
    void utils.cms.history.items.invalidate();
    void utils.home.history.invalidate();
  };

  useEffect(() => {
    if (!selectedDecadeId && decades[0]) {
      const id = String(decades[0].id);
      setSelectedDecadeId(id);
      setItemForm(current => ({
        ...current,
        decadeId: current.decadeId || id,
      }));
    }
  }, [decades, selectedDecadeId]);

  const createDecade = trpc.cms.history.createDecade.useMutation({
    onSuccess: () => {
      setDecadeForm(emptyDecadeForm);
      setIsDecadeFormOpen(false);
      refreshHistory();
    },
  });

  const updateDecade = trpc.cms.history.updateDecade.useMutation({
    onSuccess: () => {
      setDecadeForm(emptyDecadeForm);
      setIsDecadeFormOpen(false);
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
      setItemForm({
        ...emptyItemForm,
        decadeId: selectedDecadeId,
        sortOrder: String(selectedItems.length + 2),
      });
      setIsItemFormOpen(false);
      refreshHistory();
    },
  });

  const updateItem = trpc.cms.history.updateItem.useMutation({
    onSuccess: () => {
      setItemForm({ ...emptyItemForm, decadeId: selectedDecadeId });
      setIsItemFormOpen(false);
      refreshHistory();
    },
  });

  const deleteItem = trpc.cms.history.deleteItem.useMutation({
    onSuccess: refreshHistory,
  });

  const reorderItems = trpc.cms.history.reorderItems.useMutation({
    onSuccess: refreshHistory,
  });

  const startNewDecade = () => {
    setDecadeForm({
      ...emptyDecadeForm,
      sortOrder: String(decades.length + 1),
    });
    setIsDecadeFormOpen(true);
  };

  const startEditDecade = (decade: Decade) => {
    setDecadeForm({
      id: decade.id,
      year: String(decade.startYear),
      sortOrder: String(decade.sortOrder || ""),
      isVisible: decade.isVisible,
    });
    setIsDecadeFormOpen(true);
  };

  const startNewItem = (year?: number) => {
    if (!selectedDecade) {
      alert("연도를 먼저 추가하거나 선택해주세요.");
      return;
    }

    setItemForm({
      ...emptyItemForm,
      decadeId: String(selectedDecade.id),
      year: year ? String(year) : String(selectedDecade.startYear),
      sortOrder: String(selectedItems.length + 1),
    });
    setIsItemFormOpen(true);
  };

  const startEditItem = (item: HistoryItem) => {
    setSelectedDecadeId(String(item.decadeId));
    setItemForm({
      id: item.id,
      decadeId: String(item.decadeId),
      year: String(item.year),
      month: String(item.month),
      content: item.content,
      sortOrder: String(item.sortOrder || ""),
      isVisible: item.isVisible,
    });
    setIsItemFormOpen(true);
  };

  const handleDecadeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const year = parseNumber(decadeForm.year);

    if (!Number.isInteger(year)) {
      alert("연도를 숫자로 입력해주세요.");
      return;
    }

    const previousDecade = decadeForm.id
      ? decades.find(decade => decade.id === decadeForm.id)
      : undefined;
    const title =
      previousDecade && previousDecade.startYear === year
        ? previousDecade.title
        : resolveDecadeTitle(decadeForm.year, year);

    const payload = {
      title,
      startYear: year,
      endYear: year,
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
      alert("연도를 먼저 선택해주세요.");
      return;
    }
    if (!Number.isInteger(year)) {
      alert("연도를 숫자로 입력해주세요.");
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

  const handleDecadeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const oldIndex = decades.findIndex(decade => decade.id === activeId);
    const newIndex = decades.findIndex(decade => decade.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(decades, oldIndex, newIndex);
    reorderDecades.mutate({ ids: next.map(decade => decade.id) });
  };

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const oldIndex = selectedItems.findIndex(item => item.id === activeId);
    const newIndex = selectedItems.findIndex(item => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(selectedItems, oldIndex, newIndex);
    reorderItems.mutate({ ids: next.map(item => item.id) });
  };

  const isLoading = decadesQuery.isLoading || itemsQuery.isLoading;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              콘텐츠/노출 관리
            </p>
            <h2 className="mt-3 font-serif text-2xl font-bold text-gray-950">
              교회연혁 관리
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              연도 탭을 만들고, 선택한 연도 아래에 연혁을 한 줄씩 추가합니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
            전체 <strong className="text-green-700">{decades.length}</strong>개
            연도
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-950">
              연도 탭
            </h3>
            <p className="text-sm text-gray-500">
              사용자 화면의 상단 탭 순서와 동일하게 관리됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewDecade}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
          >
            + 연도 추가
          </button>
        </div>

        <DndContext
          sensors={dragSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDecadeDragEnd}
        >
          <SortableContext
            items={decades.map(decade => decade.id)}
            strategy={rectSortingStrategy}
          >
            <div className="mt-4 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
              {decades.map(decade => (
                <SortableDecadeTab
                  key={decade.id}
                  decade={decade}
                  isSelected={String(decade.id) === selectedDecadeId}
                  onSelect={() => {
                    setSelectedDecadeId(String(decade.id));
                    setItemForm(current => ({
                      ...current,
                      decadeId: String(decade.id),
                    }));
                  }}
                />
              ))}
              {!decades.length && (
                <p className="rounded-xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500">
                  아직 등록된 연도가 없습니다. 먼저 연도를 추가해주세요.
                </p>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {isDecadeFormOpen && (
          <form
            onSubmit={handleDecadeSubmit}
            className="mt-4 rounded-xl border border-green-100 bg-green-50/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-gray-950">
                {decadeForm.id ? "연도 수정" : "새 연도 추가"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setDecadeForm(emptyDecadeForm);
                  setIsDecadeFormOpen(false);
                }}
                className="text-sm text-gray-500"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.7fr_auto]">
              <label className="block text-sm font-semibold text-gray-700">
                연도
                <input
                  value={decadeForm.year}
                  onChange={event =>
                    setDecadeForm(current => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 2026"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                정렬 순서
                <input
                  value={decadeForm.sortOrder}
                  onChange={event =>
                    setDecadeForm(current => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="자동"
                  inputMode="numeric"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={decadeForm.isVisible}
                  onChange={event =>
                    setDecadeForm(current => ({
                      ...current,
                      isVisible: event.target.checked,
                    }))
                  }
                />
                노출
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDecadeForm(emptyDecadeForm);
                  setIsDecadeFormOpen(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                {decadeForm.id ? "수정 저장" : "추가"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-bold text-gray-950">
              {selectedDecade ? selectedDecade.title : "연혁 내용"}
            </h3>
            <p className="text-sm text-gray-500">
              {selectedDecade
                ? `${selectedDecade.title} 아래에 연혁을 한 줄씩 추가하고 드래그로 순서를 바꿀 수 있습니다.`
                : "연도를 선택하면 연혁을 추가할 수 있습니다."}
            </p>
          </div>
          {selectedDecade && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startEditDecade(selectedDecade)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                연도 수정
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("선택한 연도와 포함된 연혁 내용을 삭제할까요?")) {
                    deleteDecade.mutate({ id: selectedDecade.id });
                  }
                }}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
              >
                연도 삭제
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            연혁을 불러오는 중입니다.
          </div>
        )}

        {!isLoading && selectedDecade && (
          <div className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleItemDragEnd}
            >
              <SortableContext
                items={selectedItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {groupedItems.map(([year, yearItems]) => (
                  <div
                    key={year}
                    className="grid gap-4 py-5 md:grid-cols-[140px_1fr]"
                  >
                    <div className="text-3xl font-semibold text-blue-950">
                      {year}
                    </div>
                    <div className="space-y-3">
                      {yearItems.map(item => {
                        const itemIndex = selectedItems.findIndex(
                          candidate => candidate.id === item.id
                        );
                        return (
                          <SortableHistoryItemCard
                            key={item.id}
                            item={item}
                            itemIndex={itemIndex}
                            onEdit={() => startEditItem(item)}
                            onDelete={() => {
                              if (confirm("이 연혁 내용을 삭제할까요?")) {
                                deleteItem.mutate({ id: item.id });
                              }
                            }}
                          />
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => startNewItem(year)}
                        className="rounded-lg border border-dashed border-green-300 px-4 py-2 text-sm font-semibold text-green-700"
                      >
                        + {year}년에 연혁 추가
                      </button>
                    </div>
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            {!selectedItems.length && (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                선택한 연도에 등록된 연혁 내용이 없습니다.
              </div>
            )}
          </div>
        )}

        {!isLoading && !selectedDecade && (
          <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            먼저 연도를 추가해주세요.
          </div>
        )}

        {selectedDecade && (
          <div className="mt-5">
            {!isItemFormOpen && (
              <button
                type="button"
                onClick={() => startNewItem()}
                className="w-full rounded-xl border border-dashed border-green-300 bg-green-50 px-4 py-4 text-sm font-semibold text-green-700"
              >
                + 연혁 내용 추가
              </button>
            )}

            {isItemFormOpen && (
              <form
                onSubmit={handleItemSubmit}
                className="rounded-xl border border-green-100 bg-green-50/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-gray-950">
                    {itemForm.id ? "연혁 내용 수정" : "새 연혁 내용 추가"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setItemForm({
                        ...emptyItemForm,
                        decadeId: selectedDecadeId,
                      });
                      setIsItemFormOpen(false);
                    }}
                    className="text-sm text-gray-500"
                  >
                    닫기
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_0.6fr_0.7fr_auto]">
                  <label className="block text-sm font-semibold text-gray-700">
                    연도
                    <input
                      value={itemForm.year}
                      onChange={event =>
                        setItemForm(current => ({
                          ...current,
                          year: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="1980"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-gray-700">
                    월
                    <input
                      value={itemForm.month}
                      onChange={event =>
                        setItemForm(current => ({
                          ...current,
                          month: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="04"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-gray-700">
                    정렬 순서
                    <input
                      value={itemForm.sortOrder}
                      onChange={event =>
                        setItemForm(current => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="자동"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={itemForm.isVisible}
                      onChange={event =>
                        setItemForm(current => ({
                          ...current,
                          isVisible: event.target.checked,
                        }))
                      }
                    />
                    노출
                  </label>
                </div>

                <label className="mt-3 block text-sm font-semibold text-gray-700">
                  내용
                  <textarea
                    value={itemForm.content}
                    onChange={event =>
                      setItemForm(current => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-32 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="연혁 내용을 입력해주세요."
                  />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemForm({
                        ...emptyItemForm,
                        decadeId: selectedDecadeId,
                      });
                      setIsItemFormOpen(false);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {itemForm.id ? "수정 저장" : "추가"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
