import { describe, expect, it } from "vitest";

import {
  LEGACY_ARCHIVE_CONFIGS,
  canonicalVideoUrl,
  excludeVerifiedLegacySources,
  getPraiseArchiveCatalogSummary,
  oldestFirstInsertOrder,
  parseArchiveKey,
  parseLegacyListRows,
  parseMode,
  selectEvenlySpacedVerificationSample,
  selectArchiveListRows,
  validateArchiveVideos,
  type LegacyArchiveConfig,
  type LegacyListRow,
  type LegacyVideo,
} from "../scripts/importLegacyHebronVideos";

const row = (
  date: string,
  num: string,
  title: string,
  scripture = "",
  preacher = "",
): LegacyListRow => ({ date, num, title, scripture, preacher });

describe("legacy video archive CLI", () => {
  it("keeps the historical default and --friday alias", () => {
    expect(parseArchiveKey([])).toBe("hebron");
    expect(parseArchiveKey(["--friday"])).toBe("friday");
  });

  it("accepts canonical praise keys and their short aliases", () => {
    expect(parseArchiveKey(["--archive=praise-shalom"])).toBe("praise-shalom");
    expect(parseArchiveKey(["--archive=shalom"])).toBe("praise-shalom");
    expect(parseArchiveKey(["--archive=special"])).toBe("praise-special");
  });

  it("accepts the HaYoungIn and testimony archives", () => {
    expect(parseArchiveKey(["--archive=hayoungin"])).toBe("hayoungin");
    expect(parseArchiveKey(["--archive=testimony"])).toBe("testimony");
  });

  it("rejects conflicting, empty, and unknown archive options", () => {
    expect(() => parseArchiveKey(["--archive="])).toThrow(/non-empty/);
    expect(() => parseArchiveKey(["--archive=unknown"])).toThrow(/Unknown legacy archive/);
    expect(() => parseArchiveKey(["--friday", "--archive=shalom"])).toThrow(/cannot be combined/);
    expect(() => parseArchiveKey(["--archive=shalom", "--archive=zion"])).toThrow(/only one/);
  });

  it("allows --archive while preserving mode validation", () => {
    expect(parseMode(["--archive=shalom"])).toBe("dry-run");
    expect(parseMode(["--archive=shalom", "--apply"])).toBe("apply");
    expect(() => parseMode(["--archive=shalom", "--unknown"])).toThrow(/Unknown option/);
  });
});

describe("legacy list parsing", () => {
  it("parses both compact three-column praise rows and detailed five-column rows", () => {
    const html = `
      <table>
        <tr>
          <td>2026-07-12</td>
          <td><a href="sub.html?pageCode=192&amp;num=12584">너는 &amp; 물 댄 동산</a></td>
          <td></td>
        </tr>
        <tr>
          <td>1</td>
          <td>2026-07-15</td>
          <td><a href="sub.html?pageCode=423&num=12590">교회는 하나님의 군대입니다</a></td>
          <td>출애굽기 12:41-42</td>
          <td>정원희 목사</td>
        </tr>
      </table>
    `;

    expect(parseLegacyListRows(html)).toEqual([
      row("2026-07-12", "12584", "너는 & 물 댄 동산"),
      row("2026-07-15", "12590", "교회는 하나님의 군대입니다", "출애굽기 12:41-42", "정원희 목사"),
    ]);
  });
});

describe("legacy praise archive invariants", () => {
  it("fixes the catalog at eight archives, 5,136 rows, 9 notices, and 5,127 videos", () => {
    expect(getPraiseArchiveCatalogSummary()).toEqual({
      archiveCount: 8,
      expectedListCount: 5_136,
      expectedVideoCount: 5_127,
      excludedSourceCount: 9,
      uniquePlaylistCount: 8,
      uniqueLegacySourceCount: 8,
    });
  });

  it("excludes a source only when both its fixed date and title still match", () => {
    const rows = [
      row("2017-01-01", "5622", "시스템 문제로 2017년 1월 1일 영상은 제공되지 않습니다. 양해바랍니다."),
      row("2017-01-08", "5623", "실제 영상"),
    ];
    const excluded = LEGACY_ARCHIVE_CONFIGS["praise-shalom"].excludedSources;

    expect(excludeVerifiedLegacySources(rows, excluded)).toEqual([rows[1]]);
    expect(() => excludeVerifiedLegacySources(
      [{ ...rows[0], title: "실제 영상으로 변경됨" }, rows[1]],
      excluded,
    )).toThrow(/changed/);
    expect(() => excludeVerifiedLegacySources([rows[1]], excluded)).toThrow(/missing/);
  });

  it("separates raw list count from actual video count", () => {
    const base = LEGACY_ARCHIVE_CONFIGS["praise-shalom"];
    const config: LegacyArchiveConfig = {
      ...base,
      oldestDate: "2017-01-01",
      newestDate: "2017-01-08",
      expectedListCount: 2,
      expectedVideoCount: 1,
      requiredSourceNums: ["5622", "5623"],
    };
    const rows = [
      row("2017-01-01", "5622", base.excludedSources["5622"]!.title),
      row("2017-01-08", "5623", "실제 영상"),
    ];

    expect(selectArchiveListRows(rows, config)).toEqual([rows[1]]);
  });

  it("contains the three verified legacy XML URL corrections", () => {
    expect(LEGACY_ARCHIVE_CONFIGS["praise-shalom"].videoUrlOverrides["3861"]?.replacement)
      .toContain("141130_hymn1.mp4");
    expect(LEGACY_ARCHIVE_CONFIGS["praise-hosanna"].videoUrlOverrides["4972"])
      .toBeUndefined();
    expect(LEGACY_ARCHIVE_CONFIGS["praise-joyance"].videoUrlOverrides["8918"]?.replacement)
      .toContain("210425_praise2.mp4");
    expect(LEGACY_ARCHIVE_CONFIGS["praise-disciples"].videoUrlOverrides["11716"]?.replacement)
      .toContain("250604_praise.mp4");
  });

  it("treats http and https versions of one MP4 as the same source URL", () => {
    expect(canonicalVideoUrl("http://sermon.joych.org/mp4/hymn/a.mp4"))
      .toBe(canonicalVideoUrl("https://sermon.joych.org/mp4/hymn/a.mp4"));

    const base = LEGACY_ARCHIVE_CONFIGS["praise-shalom"];
    const config: LegacyArchiveConfig = {
      ...base,
      oldestDate: "2026-07-12",
      newestDate: "2026-07-12",
      expectedListCount: 2,
      expectedVideoCount: 2,
      excludedSources: {},
    };
    const videos: LegacyVideo[] = [
      {
        pageCode: "192",
        vodType: "19",
        num: "1",
        videoUrl: "http://sermon.joych.org/mp4/hymn/a.mp4",
        title: "A",
        preacher: "",
        scripture: "",
        sermonDate: "2026-07-12",
      },
      {
        pageCode: "192",
        vodType: "19",
        num: "2",
        videoUrl: "https://sermon.joych.org/mp4/hymn/a.mp4",
        title: "B",
        preacher: "",
        scripture: "",
        sermonDate: "2026-07-12",
      },
    ];

    expect(() => validateArchiveVideos(videos, config)).toThrow(/Duplicate legacy MP4 URLs/);
  });

  it("samples long archives across the full range and always includes fixed sources", () => {
    const videos = Array.from({ length: 100 }, (_, index) => ({ num: String(index + 1) }));
    const sample = selectEvenlySpacedVerificationSample(videos, 5, ["37"]);

    expect(sample.map(video => video.num)).toEqual(["1", "26", "37", "51", "75", "100"]);
  });
});

describe("legacy HaYoungIn and testimony archive invariants", () => {
  it("fixes both requested source ranges and target playlists", () => {
    expect(LEGACY_ARCHIVE_CONFIGS.hayoungin).toMatchObject({
      pageCode: "242",
      vodType: "40",
      playlistId: 90003,
      expectedListCount: 111,
      expectedVideoCount: 111,
      newestDate: "2026-04-25",
      oldestDate: "2018-05-14",
      requiredSourceNums: ["12423", "6854"],
    });
    expect(LEGACY_ARCHIVE_CONFIGS.testimony).toMatchObject({
      pageCode: "359",
      vodType: "69",
      playlistId: 90004,
      expectedListCount: 210,
      expectedVideoCount: 210,
      newestDate: "2026-06-26",
      oldestDate: "2018-05-06",
      requiredSourceNums: ["12552", "6837"],
    });
  });

  it("only accepts the media directories used by each audited archive", () => {
    expect(
      LEGACY_ARCHIVE_CONFIGS.hayoungin.allowedMp4Url.test(
        "http://sermon.joych.org/mp4/special/180514_hyi.mp4",
      ),
    ).toBe(true);
    expect(
      LEGACY_ARCHIVE_CONFIGS.hayoungin.allowedMp4Url.test(
        "http://sermon.joych.org/mp4/etc/testi_180506.mp4",
      ),
    ).toBe(false);
    expect(
      LEGACY_ARCHIVE_CONFIGS.testimony.allowedMp4Url.test(
        "http://sermon.joych.org/mp4/etc/testi_180506.mp4",
      ),
    ).toBe(true);
    expect(
      LEGACY_ARCHIVE_CONFIGS.testimony.allowedMp4Url.test(
        "http://sermon.joych.org/mp4/special/Sequence 01.mp4",
      ),
    ).toBe(true);
  });

  it("inserts archive rows oldest-first so same-day public order stays stable", () => {
    const videos = [
      { num: "3", sermonDate: "2026-01-02" },
      { num: "2", sermonDate: "2026-01-01" },
      { num: "1", sermonDate: "2026-01-01" },
    ] as LegacyVideo[];
    expect(oldestFirstInsertOrder(videos).map(video => video.num)).toEqual(["1", "2", "3"]);
  });
});
