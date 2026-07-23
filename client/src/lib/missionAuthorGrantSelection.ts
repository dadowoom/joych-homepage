export type MissionaryGrantSelection = number | "all" | "";

export function resolveMissionaryGrantIds(
  selection: MissionaryGrantSelection,
  missionaries: ReadonlyArray<{ id: number }>,
): number[] {
  if (selection === "") return [];
  if (selection !== "all") return [selection];

  return Array.from(new Set(missionaries.map(missionary => missionary.id)));
}
