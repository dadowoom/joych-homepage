import { describe, expect, it } from "vitest";
import { buildGroupedSearchResult } from "./routers/search";
import { ADMIN_RESOURCE_CATEGORY } from "../shared/noticeCategories";

type SearchDataset = Parameters<typeof buildGroupedSearchResult>[0];

function createDataset(overrides: Partial<SearchDataset> = {}): SearchDataset {
  return {
    guestMenus: [
      {
        id: 1,
        label: "커뮤니티",
        href: null,
        items: [
          { id: 11, label: "은혜 페이지", href: "/page/grace-page", pageType: "editor", subItems: [] },
          { id: 12, label: "선교 게시판", href: "/community/mission-board", pageType: "board", subItems: [] },
          { id: 13, label: "자유게시판", href: "/community/joytalk", pageType: "board", subItems: [] },
        ],
      },
    ],
    youtubeVideos: [
      {
        id: 1,
        title: "Grace Sunday Service",
        preacher: "Pastor Kim",
        scripture: "John 3",
        sermonDate: "2026-07-06",
        description: "A message about grace.",
        isVisible: true,
        playlistTitle: "주일예배",
        menuItemHref: "/worship/tv/sunday",
        menuSubItemHref: null,
      },
      {
        id: 2,
        title: "Hidden Grace Service",
        preacher: "Pastor Kim",
        scripture: "John 3",
        sermonDate: "2026-07-05",
        description: "Should stay hidden.",
        isVisible: false,
        playlistTitle: "주일예배",
        menuItemHref: "/worship/tv/sunday",
        menuSubItemHref: null,
      },
    ],
    notices: [
      {
        id: 101,
        title: "Grace Notice",
        category: "공지사항",
        content: "Public grace notice.",
        attachmentName: null,
        createdAt: "2026-07-05",
        isPublished: true,
        isSecret: false,
      },
      {
        id: 102,
        title: "Grace Resource",
        category: ADMIN_RESOURCE_CATEGORY,
        content: "Public grace resource.",
        attachmentName: "resource.pdf",
        createdAt: "2026-07-04",
        isPublished: true,
        isSecret: false,
      },
      {
        id: 103,
        title: "Secret Grace Resource",
        category: ADMIN_RESOURCE_CATEGORY,
        content: "Hidden resource.",
        attachmentName: "secret.pdf",
        createdAt: "2026-07-03",
        isPublished: true,
        isSecret: true,
      },
    ],
    testimonyPosts: [
      {
        id: 201,
        title: "Grace Testimony",
        content: "Public testimony about grace.",
        createdAt: "2026-07-02",
        status: "published",
        isSecret: false,
      },
      {
        id: 202,
        title: "Secret Testimony",
        content: "Should not leak.",
        createdAt: "2026-07-01",
        status: "published",
        isSecret: true,
      },
    ],
    pastorBooks: [
      {
        id: 301,
        title: "Grace Book",
        summary: "Grace summary",
        contentHtml: "<p>Grace content</p>",
        publishedAt: "2026-06-30",
        externalUrl: null,
        isVisible: true,
        sortOrder: 1,
      },
      {
        id: 302,
        title: "Hidden Book",
        summary: "Hidden",
        contentHtml: "<p>Hidden</p>",
        publishedAt: "2026-06-29",
        externalUrl: null,
        isVisible: false,
        sortOrder: 2,
      },
    ],
    galleryItems: [
      {
        id: 401,
        albumKey: "grace-album",
        albumTitle: "Grace Album",
        albumDescription: "Grace retreat photos",
        caption: "Grace photo",
        createdAt: "2026-06-28",
        isVisible: true,
        albumSortOrder: 5,
      },
      {
        id: 402,
        albumKey: "hidden-album",
        albumTitle: "Hidden Album",
        albumDescription: "Hidden",
        caption: "Hidden",
        createdAt: "2026-06-27",
        isVisible: false,
        albumSortOrder: 4,
      },
    ],
    pageBlocks: [
      {
        id: 501,
        menuItemId: 11,
        menuSubItemId: null,
        blockType: "text-body",
        content: JSON.stringify({ text: "Grace editor page content" }),
        createdAt: "2026-06-26",
        isVisible: true,
      },
      {
        id: 502,
        menuItemId: 99,
        menuSubItemId: null,
        blockType: "text-body",
        content: JSON.stringify({ text: "Member only grace page" }),
        createdAt: "2026-06-25",
        isVisible: true,
      },
    ],
    dynamicBoardPosts: [
      {
        id: 601,
        boardId: 71,
        boardTitle: "선교 게시판",
        menuItemId: 12,
        menuSubItemId: null,
        title: "Grace Board Post",
        content: "Public dynamic board content",
        createdAt: "2026-06-24",
        isPublished: true,
        isSecret: false,
      },
      {
        id: 602,
        boardId: 72,
        boardTitle: "비밀 게시판",
        menuItemId: 98,
        menuSubItemId: null,
        title: "Hidden Board Post",
        content: "Should stay hidden",
        createdAt: "2026-06-23",
        isPublished: true,
        isSecret: false,
      },
    ],
    freeBoardPosts: [
      {
        id: 701,
        title: "Grace Free Board",
        content: "Public free board content",
        createdAt: "2026-06-22",
        status: "published",
        isSecret: false,
      },
      {
        id: 702,
        title: "Secret Free Board",
        content: "Should stay hidden",
        createdAt: "2026-06-21",
        status: "published",
        isSecret: true,
      },
    ],
    historyItems: [
      {
        id: 801,
        decadeTitle: "1990s",
        year: 1999,
        month: 5,
        content: "Grace chapel was opened.",
        isVisible: true,
        decadeIsVisible: true,
      },
    ],
    staffCategories: [
      { categoryKey: "associate", label: "부교역자", isVisible: true },
      { categoryKey: "office", label: "교회직원", isVisible: false },
    ],
    staffMembers: [
      {
        id: 901,
        category: "associate",
        name: "Grace Lee",
        title: "Pastor",
        department: "Youth",
        email: "secret@example.com",
        phone: "010-1234-5678",
        description: "Grace shepherd",
        profile: "Serves the youth with care.",
        isVisible: true,
      },
      {
        id: 902,
        category: "office",
        name: "Hidden Staff",
        title: "Manager",
        department: "Office",
        email: "hidden@example.com",
        phone: "010-9999-9999",
        description: "Should not appear",
        profile: "Should not appear",
        isVisible: true,
      },
    ],
    facilities: [
      {
        id: 1001,
        name: "Grace Hall",
        description: "Large grace hall",
        location: "Building A",
        building: "welfare",
        notice: "No food",
        caution: "Keep clean",
        isVisible: true,
      },
    ],
    courses: [
      {
        id: 1101,
        title: "Grace Course",
        summary: "Intro to grace",
        description: "A course for guests",
        instructor: "Grace Teacher",
        location: "Room 1",
        target: "Guests",
        fee: "Free",
        startDate: "2026-08-01",
        applyEndDate: "2026-07-31",
        status: "open",
        isVisible: true,
        audience: "all",
        pageHref: "/page/강좌-새가족반",
      },
      {
        id: 1102,
        title: "Member Course",
        summary: "Members only",
        description: "Should not appear",
        instructor: "Teacher",
        location: "Room 2",
        target: "Members",
        fee: "Free",
        startDate: "2026-08-10",
        applyEndDate: "2026-08-05",
        status: "open",
        isVisible: true,
        audience: "member",
        pageHref: "/page/강좌-회원반",
      },
    ],
    missionaries: [
      {
        id: 1201,
        name: "Grace Missionary",
        region: "Seoul",
        organization: "Hope Mission",
        description: "Serving with grace",
        sentYear: 2020,
        isActive: true,
      },
    ],
    missionReports: [
      {
        id: 1202,
        missionaryId: 1201,
        missionaryName: "Grace Missionary",
        missionaryRegion: "Seoul",
        title: "Grace Mission Report",
        summary: "Grace update",
        content: "Public grace mission content",
        reportDate: "2026-07-06",
        status: "published",
      },
      {
        id: 1203,
        missionaryId: 1201,
        missionaryName: "Grace Missionary",
        missionaryRegion: "Seoul",
        title: "Rejected Report",
        summary: "Hidden",
        content: "Hidden",
        reportDate: "2026-07-05",
        status: "rejected",
      },
    ],
    schoolDepartments: [
      {
        id: 1301,
        name: "청년부",
        category: "youth",
        ageRange: "19+",
        worshipTime: "Sunday",
        worshipPlace: "Youth Hall",
        description: "Grace community",
        educationGoals: "Grow",
        prayerTopics: "Pray",
        staffInfo: "Grace team",
        isVisible: true,
      },
    ],
    schoolPosts: [
      {
        id: 1302,
        departmentId: 1301,
        departmentName: "청년부",
        title: "Grace Retreat",
        content: "Grace weekend together",
        authorName: "Leader",
        createdAt: "2026-07-03",
        isVisible: true,
        departmentIsVisible: true,
      },
    ],
    heroSlides: [
      {
        id: 1401,
        yearLabel: "2026",
        mainTitle: "Grace for All",
        subTitle: "Summer vision",
        bibleRef: "John 1",
        btn1Text: "Learn more",
        btn1Href: "/about/history",
        btn2Text: null,
        btn2Href: null,
        buttonsJson: null,
        isVisible: true,
      },
    ],
    quickMenus: [
      {
        id: 1501,
        label: "Grace Classes",
        href: "/education/courses",
        isVisible: true,
      },
    ],
    affiliates: [
      {
        id: 1601,
        label: "Grace Partner",
        href: "https://partner.example.org",
        isVisible: true,
      },
    ],
    ...overrides,
  };
}

function groupMap(result: ReturnType<typeof buildGroupedSearchResult>) {
  return new Map(result.groups.map((group) => [group.key, group]));
}

describe("grouped backend search", () => {
  it("builds grouped results with canonical hrefs and legacy compatibility", () => {
    const result = buildGroupedSearchResult(createDataset(), "grace");
    const groups = groupMap(result);

    expect(result.keyword).toBe("grace");
    expect(groups.get("youtube")?.items[0]).toMatchObject({
      title: "Grace Sunday Service",
      href: "/worship/tv/sunday?video=1",
      linkType: "internal",
    });
    expect(groups.get("notices")?.items[0]?.href).toBe("/page/행정지원-공지사항?post=101");
    expect(groups.get("resources")?.items[0]?.href).toBe("/page/행정지원-자료실?post=102");
    expect(groups.get("gallery")?.items[0]?.href).toBe("/page/커뮤니티-최근-행사-사진?gallery=grace-album");
    expect(groups.get("courses")?.items[0]?.href).toBe("/education/courses/새가족반");
    expect(groups.get("staff")?.items[0]?.href).toBe("/about/staff/associate");
    expect(groups.get("homepage")?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Grace Partner", linkType: "external" }),
        expect.objectContaining({ title: "Grace Classes", linkType: "internal" }),
      ]),
    );

    expect(result.videos).toHaveLength(1);
    expect(result.posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "notice-101" }),
        expect.objectContaining({ id: "resource-102" }),
        expect.objectContaining({ id: "testimony-201" }),
        expect.objectContaining({ id: "pastor-book-301" }),
        expect.objectContaining({ id: "gallery-grace-album" }),
      ]),
    );
  });

  it("filters hidden, secret, unpublished, and category-hidden content", () => {
    const result = buildGroupedSearchResult(createDataset(), "grace");
    const titles = result.groups.flatMap((group) => group.items.map((item) => item.title));
    const serialized = JSON.stringify(result);

    expect(titles).not.toContain("Hidden Grace Service");
    expect(titles).not.toContain("Secret Testimony");
    expect(titles).not.toContain("Hidden Book");
    expect(titles).not.toContain("Hidden Board Post");
    expect(titles).not.toContain("Secret Free Board");
    expect(titles).not.toContain("Hidden Staff");
    expect(titles).not.toContain("Member Course");
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("010-1234-5678");
  });

  it("excludes free-board results when the guest menu is not visible", () => {
    const dataset = createDataset({
      guestMenus: [
        {
          id: 1,
          label: "커뮤니티",
          href: null,
          items: [
            { id: 11, label: "은혜 페이지", href: "/page/grace-page", pageType: "editor", subItems: [] },
            { id: 12, label: "선교 게시판", href: "/community/mission-board", pageType: "board", subItems: [] },
          ],
        },
      ],
    });

    const result = buildGroupedSearchResult(dataset, "grace");
    const groups = groupMap(result);

    expect(groups.has("free-board")).toBe(false);
  });
});
