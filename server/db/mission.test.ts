import { beforeEach, describe, expect, it, vi } from "vitest";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./connection", () => ({
  getDb: connectionMocks.getDb,
}));

import {
  missionReportFiles,
  missionReportImages,
  missionReportPrayerTopics,
  missionReports,
  missionaries,
  type MissionReport,
  type MissionReportFile,
  type MissionReportImage,
  type MissionReportPrayerTopic,
  type Missionary,
} from "../../drizzle/schema";
import {
  getAdjacentPublishedMissionReports,
  getPublishedMissionReports,
} from "./mission";

function makeReport(id: number, missionaryId: number, reportDate: string): MissionReport {
  const timestamp = new Date("2026-08-01T00:00:00.000Z");
  return {
    id,
    missionaryId,
    authorMemberId: null,
    title: `Report ${id}`,
    summary: `Summary ${id}`,
    content: `Content ${id}`,
    thumbnailUrl: `/uploads/report-${id}.jpg`,
    reportDate,
    status: "published",
    publishedAt: timestamp,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function makeMissionary(id: number): Missionary {
  const timestamp = new Date("2026-08-01T00:00:00.000Z");
  return {
    id,
    name: `Missionary ${id}`,
    region: `Region ${id}`,
    continent: "asia",
    sentYear: 2020,
    profileImage: null,
    organization: null,
    description: null,
    isActive: true,
    sortOrder: id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function makeImage(id: number, reportId: number, sortOrder: number): MissionReportImage {
  return {
    id,
    reportId,
    imageUrl: `/uploads/report-${reportId}-${id}.jpg`,
    caption: null,
    sortOrder,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function makeFile(id: number, reportId: number, sortOrder: number): MissionReportFile {
  return {
    id,
    reportId,
    fileName: `report-${reportId}-${id}.pdf`,
    fileUrl: `/uploads/report-${reportId}-${id}.pdf`,
    fileSize: id * 100,
    mimeType: "application/pdf",
    sortOrder,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function makeTopic(id: number, reportId: number, sortOrder: number): MissionReportPrayerTopic {
  return {
    id,
    reportId,
    content: `Prayer ${reportId}-${id}`,
    sortOrder,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function createMissionDb(
  results: Array<{ table: unknown; batches: unknown[][] }>,
) {
  const queues = new Map(results.map(({ table, batches }) => [table, [...batches]]));
  const fromCalls: unknown[] = [];
  const limitCalls: Array<{ table: unknown; value: number }> = [];

  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      const rows = queues.get(table)?.shift() ?? [];
      let chain: Promise<unknown[]> & {
        where: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
      };
      chain = Object.assign(Promise.resolve(rows), {
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(async (value: number) => {
          limitCalls.push({ table, value });
          return rows.slice(0, value);
        }),
      });
      return chain;
    }),
  }));

  return {
    db: { select },
    select,
    fromCalls,
    limitCalls,
  };
}

describe("mission report database reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates a report list with one fixed query per related table", async () => {
    const newer = makeReport(20, 2, "2026-07-20");
    const older = makeReport(10, 1, "2026-07-10");
    const missingMissionary = makeReport(5, 99, "2026-07-05");
    const imageA = makeImage(101, newer.id, 0);
    const imageB = makeImage(102, newer.id, 1);
    const imageC = makeImage(103, older.id, 0);
    const fileA = makeFile(201, newer.id, 0);
    const topicA = makeTopic(301, newer.id, 0);
    const topicB = makeTopic(302, older.id, 0);
    const fake = createMissionDb([
      { table: missionReports, batches: [[newer, older, missingMissionary]] },
      { table: missionaries, batches: [[makeMissionary(1), makeMissionary(2)]] },
      { table: missionReportImages, batches: [[imageA, imageB, imageC]] },
      { table: missionReportPrayerTopics, batches: [[topicA, topicB]] },
      { table: missionReportFiles, batches: [[fileA]] },
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await getPublishedMissionReports(200);

    expect(result).toHaveLength(2);
    expect(result.map(item => item.id)).toEqual([newer.id, older.id]);
    expect(result[0]).toMatchObject({
      missionary: { id: 2, name: "Missionary 2" },
      images: [imageA.imageUrl, imageB.imageUrl],
      prayerTopics: [topicA.content],
      files: [{
        fileName: fileA.fileName,
        fileUrl: fileA.fileUrl,
        fileSize: fileA.fileSize,
        mimeType: fileA.mimeType,
      }],
    });
    expect(result[1]).toMatchObject({
      missionary: { id: 1, name: "Missionary 1" },
      images: [imageC.imageUrl],
      prayerTopics: [topicB.content],
      files: [],
    });
    expect(fake.select).toHaveBeenCalledTimes(5);
    expect(fake.fromCalls).toEqual([
      missionReports,
      missionaries,
      missionReportImages,
      missionReportPrayerTopics,
      missionReportFiles,
    ]);
    expect(fake.limitCalls).toEqual([{ table: missionReports, value: 200 }]);
  });

  it("loads only the immediate published reports on either side", async () => {
    const current = makeReport(20, 2, "2026-07-20");
    const previous = makeReport(21, 2, "2026-07-20");
    const next = makeReport(19, 1, "2026-07-19");
    const fake = createMissionDb([
      { table: missionReports, batches: [[{ total: 1 }], [previous], [next]] },
      { table: missionaries, batches: [[makeMissionary(1), makeMissionary(2)]] },
      { table: missionReportImages, batches: [[]] },
      { table: missionReportPrayerTopics, batches: [[]] },
      { table: missionReportFiles, batches: [[]] },
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await getAdjacentPublishedMissionReports(current);

    expect(result.prevReport).toMatchObject({ id: previous.id, images: [], files: [], prayerTopics: [] });
    expect(result.nextReport).toMatchObject({ id: next.id, images: [], files: [], prayerTopics: [] });
    expect(fake.select).toHaveBeenCalledTimes(7);
    expect(fake.fromCalls.filter(table => table === missionReports)).toHaveLength(3);
    expect(fake.limitCalls).toEqual([
      { table: missionReports, value: 1 },
      { table: missionReports, value: 1 },
    ]);
  });

  it("keeps the 200th published report's next link empty", async () => {
    const current = makeReport(1, 1, "2026-01-01");
    const previous = makeReport(2, 1, "2026-01-02");
    const fake = createMissionDb([
      { table: missionReports, batches: [[{ total: 199 }], [previous]] },
      { table: missionaries, batches: [[makeMissionary(1)]] },
      { table: missionReportImages, batches: [[]] },
      { table: missionReportPrayerTopics, batches: [[]] },
      { table: missionReportFiles, batches: [[]] },
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await getAdjacentPublishedMissionReports(current);

    expect(result.prevReport).toMatchObject({ id: previous.id });
    expect(result.nextReport).toBeNull();
    expect(fake.select).toHaveBeenCalledTimes(6);
    expect(fake.fromCalls.filter(table => table === missionReports)).toHaveLength(2);
    expect(fake.limitCalls).toEqual([{ table: missionReports, value: 1 }]);
  });

  it("keeps both links empty for the 201st published report", async () => {
    const current = makeReport(1, 1, "2026-01-01");
    const fake = createMissionDb([
      { table: missionReports, batches: [[{ total: 200 }]] },
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await expect(getAdjacentPublishedMissionReports(current)).resolves.toEqual({
      prevReport: null,
      nextReport: null,
    });
    expect(fake.select).toHaveBeenCalledOnce();
    expect(fake.fromCalls).toEqual([missionReports]);
    expect(fake.limitCalls).toEqual([]);
  });

  it("does not query related tables when the report list is empty", async () => {
    const fake = createMissionDb([
      { table: missionReports, batches: [[]] },
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await expect(getPublishedMissionReports()).resolves.toEqual([]);
    expect(fake.select).toHaveBeenCalledOnce();
    expect(fake.fromCalls).toEqual([missionReports]);
  });
});
