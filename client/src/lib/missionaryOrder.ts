export type MissionaryOrderItem = {
  id: number;
};

export type MissionaryOrderUpdate = {
  id: number;
  sortOrder: number;
};

export function moveMissionaryOrder<T extends MissionaryOrderItem>(
  items: readonly T[],
  activeId: number,
  overId: number
): { orderedItems: T[]; updates: MissionaryOrderUpdate[] } | null {
  if (activeId === overId) return null;

  const sourceIndex = items.findIndex(item => item.id === activeId);
  const targetIndex = items.findIndex(item => item.id === overId);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  const orderedItems = [...items];
  const [movedItem] = orderedItems.splice(sourceIndex, 1);
  orderedItems.splice(targetIndex, 0, movedItem);

  return {
    orderedItems,
    updates: orderedItems.map((item, index) => ({
      id: item.id,
      sortOrder: index + 1,
    })),
  };
}
