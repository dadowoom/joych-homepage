import { describe, expect, it } from "vitest";

import { moveMissionaryOrder } from "./missionaryOrder";

describe("moveMissionaryOrder", () => {
  const missionaries = [
    { id: 11, name: "첫 번째" },
    { id: 22, name: "두 번째" },
    { id: 33, name: "세 번째" },
  ];

  it("드래그한 항목을 대상 위치로 옮기고 1부터 표시 순서를 다시 매긴다", () => {
    const result = moveMissionaryOrder(missionaries, 33, 11);

    expect(result?.orderedItems.map(item => item.id)).toEqual([33, 11, 22]);
    expect(result?.updates).toEqual([
      { id: 33, sortOrder: 1 },
      { id: 11, sortOrder: 2 },
      { id: 22, sortOrder: 3 },
    ]);
  });

  it("같은 항목 위에 놓거나 목록에 없는 항목이면 변경하지 않는다", () => {
    expect(moveMissionaryOrder(missionaries, 22, 22)).toBeNull();
    expect(moveMissionaryOrder(missionaries, 999, 11)).toBeNull();
    expect(moveMissionaryOrder(missionaries, 11, 999)).toBeNull();
  });

  it("기존 조회 결과 배열은 직접 변경하지 않는다", () => {
    moveMissionaryOrder(missionaries, 11, 33);

    expect(missionaries.map(item => item.id)).toEqual([11, 22, 33]);
  });
});
