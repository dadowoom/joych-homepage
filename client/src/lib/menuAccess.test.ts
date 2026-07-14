import { describe, expect, it } from "vitest";
import {
  findMenuAccessMatchByHref,
  findMenuAccessMatchById,
  isHiddenMenuNode,
  isMemberOnlyMenuNode,
  type MenuTreeForAccess,
} from "./menuAccess";

const sampleMenus: MenuTreeForAccess = [
  {
    id: 1,
    label: "커뮤니티",
    items: [
      {
        id: 10,
        label: "주보",
        href: "/worship/bulletin",
        allowGuest: false,
        allowMember: true,
      },
      {
        id: 11,
        label: "나눔",
        allowGuest: true,
        allowMember: true,
        subItems: [
          {
            id: 111,
            label: "간증",
            href: "/community/testimony",
            allowGuest: false,
            allowMember: true,
          },
        ],
      },
    ],
  },
];

describe("menuAccess", () => {
  it("detects member-only menu nodes", () => {
    expect(isMemberOnlyMenuNode({ allowGuest: false, allowMember: true })).toBe(true);
    expect(isMemberOnlyMenuNode({ allowGuest: true, allowMember: true })).toBe(false);
    expect(isMemberOnlyMenuNode({ allowGuest: false, allowMember: false })).toBe(false);
    expect(isHiddenMenuNode({ allowGuest: false, allowMember: false })).toBe(true);
    expect(isHiddenMenuNode({ allowGuest: false, allowMember: true })).toBe(false);
  });

  it("finds visible menu access matches by href", () => {
    const itemMatch = findMenuAccessMatchByHref(sampleMenus, "/worship/bulletin");
    const subItemMatch = findMenuAccessMatchByHref(sampleMenus, "/community/testimony");

    expect(itemMatch?.kind).toBe("item");
    expect(itemMatch?.node.label).toBe("주보");
    expect(subItemMatch?.kind).toBe("subItem");
    expect(subItemMatch?.node.label).toBe("간증");
  });

  it("treats both production domains as internal menu hrefs", () => {
    expect(
      findMenuAccessMatchByHref(
        sampleMenus,
        "https://joych.org/worship/bulletin"
      )?.node.label
    ).toBe("주보");
    expect(
      findMenuAccessMatchByHref(
        sampleMenus,
        "https://www.newjoych.co.kr/worship/bulletin"
      )?.node.label
    ).toBe("주보");
  });

  it("finds visible menu access matches by id", () => {
    const itemMatch = findMenuAccessMatchById(sampleMenus, "item", 10);
    const subItemMatch = findMenuAccessMatchById(sampleMenus, "subItem", 111);

    expect(itemMatch?.kind).toBe("item");
    expect(itemMatch?.node.label).toBe("주보");
    expect(subItemMatch?.kind).toBe("subItem");
    expect(subItemMatch?.node.label).toBe("간증");
  });
});
