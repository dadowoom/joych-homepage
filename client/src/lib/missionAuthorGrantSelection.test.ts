import { describe, expect, it } from "vitest";

import { resolveMissionaryGrantIds } from "./missionAuthorGrantSelection";

describe("resolveMissionaryGrantIds", () => {
  const missionaries = [{ id: 10 }, { id: 20 }, { id: 30 }];

  it("개별 사역지를 선택하면 해당 사역지 하나만 반환한다", () => {
    expect(resolveMissionaryGrantIds(20, missionaries)).toEqual([20]);
  });

  it("전체 선택이면 등록된 모든 사역지를 반환한다", () => {
    expect(resolveMissionaryGrantIds("all", missionaries)).toEqual([10, 20, 30]);
  });

  it("선택하지 않았거나 등록 항목이 없으면 빈 목록을 반환한다", () => {
    expect(resolveMissionaryGrantIds("", missionaries)).toEqual([]);
    expect(resolveMissionaryGrantIds("all", [])).toEqual([]);
  });

  it("중복된 사역지 ID는 한 번만 반환한다", () => {
    expect(resolveMissionaryGrantIds("all", [{ id: 10 }, { id: 10 }, { id: 20 }])).toEqual([10, 20]);
  });
});
