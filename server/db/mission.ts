/**
 * 선교보고 DB 함수 (server/db/mission.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 공개 선교보고/선교사 조회
 *   - 작성자 권한 조회/부여/회수
 *   - 선교보고 생성/수정/승인/거절
 */

import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  churchMembers,
  type InsertMissionReport,
  type InsertMissionReportAuthor,
  type InsertMissionReportFile,
  type InsertMissionReportImage,
  type InsertMissionReportPrayerTopic,
  type InsertMissionary,
  type MissionReport,
  missionReportAuthors,
  missionReportFiles,
  missionReportImages,
  missionReportPrayerTopics,
  missionReports,
  missionaries,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type MissionReportStatus = "draft" | "pending" | "published" | "rejected";

export type MissionaryRow = typeof missionaries.$inferSelect;

export type MissionReportListRow = MissionReport & {
  missionary: MissionaryRow;
  images: string[];
  files: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
  }>;
  prayerTopics: string[];
};

export type MissionReportDetail = MissionReportListRow & {
  authorName: string | null;
};

async function hydrateReports(rows: MissionReport[]): Promise<MissionReportListRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const result: MissionReportListRow[] = [];
  for (const report of rows) {
    const [missionary] = await db.select().from(missionaries).where(eq(missionaries.id, report.missionaryId)).limit(1);
    if (!missionary) continue;
    const images = await db.select().from(missionReportImages)
      .where(eq(missionReportImages.reportId, report.id))
      .orderBy(asc(missionReportImages.sortOrder), asc(missionReportImages.id));
    const topics = await db.select().from(missionReportPrayerTopics)
      .where(eq(missionReportPrayerTopics.reportId, report.id))
      .orderBy(asc(missionReportPrayerTopics.sortOrder), asc(missionReportPrayerTopics.id));
    const files = await db.select().from(missionReportFiles)
      .where(eq(missionReportFiles.reportId, report.id))
      .orderBy(asc(missionReportFiles.sortOrder), asc(missionReportFiles.id));
    result.push({
      ...report,
      missionary,
      images: images.map(img => img.imageUrl),
      files: files.map(file => ({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      })),
      prayerTopics: topics.map(topic => topic.content),
    });
  }
  return result;
}

export async function getVisibleMissionaries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(missionaries)
    .where(eq(missionaries.isActive, true))
    .orderBy(asc(missionaries.sortOrder), asc(missionaries.id));
}

export async function getAllMissionaries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(missionaries)
    .orderBy(asc(missionaries.sortOrder), asc(missionaries.id));
}

export async function getMissionaryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(missionaries).where(eq(missionaries.id, id)).limit(1);
  return row ?? null;
}

export async function createMissionary(data: InsertMissionary) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(missionaries).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateMissionary(id: number, data: Partial<InsertMissionary>) {
  const db = await getDb();
  if (!db) return;
  await db.update(missionaries).set(data).where(eq(missionaries.id, id));
}

export async function reorderMissionaries(items: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db || items.length === 0) return;

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(missionaries).set({ sortOrder: item.sortOrder }).where(eq(missionaries.id, item.id));
    }
  });
}

export async function deleteMissionary(id: number) {
  const db = await getDb();
  if (!db) {
    return { deleted: false, reason: "데이터베이스 연결을 확인할 수 없습니다." };
  }

  const [linkedReport] = await db
    .select({ id: missionReports.id })
    .from(missionReports)
    .where(eq(missionReports.missionaryId, id))
    .limit(1);

  if (linkedReport) {
    return {
      deleted: false,
      reason: "등록된 선교보고가 있어 삭제할 수 없습니다. 먼저 해당 보고서를 다른 사역지로 변경하거나 삭제해주세요.",
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(missionReportAuthors).where(eq(missionReportAuthors.missionaryId, id));
    await tx.delete(missionaries).where(eq(missionaries.id, id));
  });

  return { deleted: true };
}

export async function getPublishedMissionReports(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(missionReports)
    .where(eq(missionReports.status, "published"))
    .orderBy(desc(missionReports.reportDate), desc(missionReports.id))
    .limit(limit);
  return hydrateReports(rows);
}

export async function getAllMissionReports() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(missionReports)
    .orderBy(desc(missionReports.createdAt), desc(missionReports.id));
  return hydrateReports(rows);
}

export async function getMissionReportById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [report] = await db.select().from(missionReports).where(eq(missionReports.id, id)).limit(1);
  if (!report) return null;
  const [hydrated] = await hydrateReports([report]);
  if (!hydrated) return null;
  const [author] = report.authorMemberId
    ? await db.select({ name: churchMembers.name }).from(churchMembers).where(eq(churchMembers.id, report.authorMemberId)).limit(1)
    : [];
  return { ...hydrated, authorName: author?.name ?? null } satisfies MissionReportDetail;
}

export async function getPublishedMissionReportById(id: number) {
  const report = await getMissionReportById(id);
  if (!report || report.status !== "published") return null;
  return report;
}

export async function getOtherPublishedReportsByMissionary(missionaryId: number, reportId: number, limit = 2) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(missionReports)
    .where(and(
      eq(missionReports.missionaryId, missionaryId),
      eq(missionReports.status, "published"),
      ne(missionReports.id, reportId),
    ))
    .orderBy(desc(missionReports.reportDate), desc(missionReports.id))
    .limit(limit);
  return hydrateReports(rows);
}

export async function getMissionAuthorGrants() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: missionReportAuthors.id,
    memberId: missionReportAuthors.memberId,
    missionaryId: missionReportAuthors.missionaryId,
    canWrite: missionReportAuthors.canWrite,
    createdBy: missionReportAuthors.createdBy,
    createdAt: missionReportAuthors.createdAt,
    updatedAt: missionReportAuthors.updatedAt,
    memberName: churchMembers.name,
    memberEmail: churchMembers.email,
    missionaryName: missionaries.name,
    missionaryRegion: missionaries.region,
  })
    .from(missionReportAuthors)
    .leftJoin(churchMembers, eq(missionReportAuthors.memberId, churchMembers.id))
    .leftJoin(missionaries, eq(missionReportAuthors.missionaryId, missionaries.id))
    .orderBy(desc(missionReportAuthors.createdAt));
}

export async function getMissionAuthorGrantsForMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: missionReportAuthors.id,
    memberId: missionReportAuthors.memberId,
    missionaryId: missionReportAuthors.missionaryId,
    canWrite: missionReportAuthors.canWrite,
    missionaryName: missionaries.name,
    missionaryRegion: missionaries.region,
    missionaryContinent: missionaries.continent,
  })
    .from(missionReportAuthors)
    .leftJoin(missionaries, eq(missionReportAuthors.missionaryId, missionaries.id))
    .where(and(
      eq(missionReportAuthors.memberId, memberId),
      eq(missionReportAuthors.canWrite, true),
      eq(missionaries.isActive, true),
    ))
    .orderBy(asc(missionaries.sortOrder), asc(missionaries.id));
}

export async function hasMissionWriteAccess(memberId: number, missionaryId: number) {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: missionReportAuthors.id })
    .from(missionReportAuthors)
    .where(and(
      eq(missionReportAuthors.memberId, memberId),
      eq(missionReportAuthors.missionaryId, missionaryId),
      eq(missionReportAuthors.canWrite, true),
    ))
    .limit(1);
  return Boolean(row);
}

export async function createMissionAuthorGrant(data: InsertMissionReportAuthor) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(missionReportAuthors)
    .where(and(
      eq(missionReportAuthors.memberId, data.memberId),
      eq(missionReportAuthors.missionaryId, data.missionaryId),
    ))
    .limit(1);
  if (existing[0]) {
    await db.update(missionReportAuthors)
      .set({ canWrite: true, createdBy: data.createdBy })
      .where(eq(missionReportAuthors.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(missionReportAuthors).values(data).$returningId();
  return result?.id ?? null;
}

export async function createMissionAuthorGrants(data: {
  memberId: number;
  missionaryIds: number[];
  createdBy: number;
}) {
  const db = await getDb();
  const missionaryIds = Array.from(new Set(data.missionaryIds));
  if (!db || missionaryIds.length === 0) return { grantedCount: 0 };

  await db.transaction(async (tx) => {
    for (const missionaryId of missionaryIds) {
      const [existing] = await tx.select({ id: missionReportAuthors.id })
        .from(missionReportAuthors)
        .where(and(
          eq(missionReportAuthors.memberId, data.memberId),
          eq(missionReportAuthors.missionaryId, missionaryId),
        ))
        .limit(1);

      if (existing) {
        await tx.update(missionReportAuthors)
          .set({ canWrite: true, createdBy: data.createdBy })
          .where(eq(missionReportAuthors.id, existing.id));
        continue;
      }

      await tx.insert(missionReportAuthors).values({
        memberId: data.memberId,
        missionaryId,
        canWrite: true,
        createdBy: data.createdBy,
      });
    }
  });

  return { grantedCount: missionaryIds.length };
}

export async function updateMissionAuthorGrant(id: number, data: Partial<InsertMissionReportAuthor>) {
  const db = await getDb();
  if (!db) return;
  await db.update(missionReportAuthors).set(data).where(eq(missionReportAuthors.id, id));
}

export async function deleteMissionAuthorGrant(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(missionReportAuthors).where(eq(missionReportAuthors.id, id));
}

export async function getMissionReportsByAuthor(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(missionReports)
    .where(eq(missionReports.authorMemberId, memberId))
    .orderBy(desc(missionReports.createdAt), desc(missionReports.id));
  return hydrateReports(rows);
}

export async function createMissionReportWithDetails(
  data: InsertMissionReport,
  images: Array<Omit<InsertMissionReportImage, "reportId">>,
  files: Array<Omit<InsertMissionReportFile, "reportId">>,
  prayerTopics: Array<Omit<InsertMissionReportPrayerTopic, "reportId">>,
) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const [result] = await tx.insert(missionReports).values(data).$returningId();
    const reportId = result?.id;
    if (!reportId) return null;
    if (images.length > 0) {
      await tx.insert(missionReportImages).values(images.map(img => ({ ...img, reportId })));
    }
    if (files.length > 0) {
      await tx.insert(missionReportFiles).values(files.map(file => ({ ...file, reportId })));
    }
    if (prayerTopics.length > 0) {
      await tx.insert(missionReportPrayerTopics).values(prayerTopics.map(topic => ({ ...topic, reportId })));
    }
    return reportId;
  });
}

export async function updateMissionReportWithDetails(
  id: number,
  data: Partial<InsertMissionReport>,
  images: Array<Omit<InsertMissionReportImage, "reportId">>,
  files: Array<Omit<InsertMissionReportFile, "reportId">>,
  prayerTopics: Array<Omit<InsertMissionReportPrayerTopic, "reportId">>,
) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.update(missionReports).set(data).where(eq(missionReports.id, id));
    await tx.delete(missionReportImages).where(eq(missionReportImages.reportId, id));
    await tx.delete(missionReportFiles).where(eq(missionReportFiles.reportId, id));
    await tx.delete(missionReportPrayerTopics).where(eq(missionReportPrayerTopics.reportId, id));
    if (images.length > 0) {
      await tx.insert(missionReportImages).values(images.map(img => ({ ...img, reportId: id })));
    }
    if (files.length > 0) {
      await tx.insert(missionReportFiles).values(files.map(file => ({ ...file, reportId: id })));
    }
    if (prayerTopics.length > 0) {
      await tx.insert(missionReportPrayerTopics).values(prayerTopics.map(topic => ({ ...topic, reportId: id })));
    }
  });
}

export async function deleteMissionReport(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.delete(missionReportImages).where(eq(missionReportImages.reportId, id));
    await tx.delete(missionReportFiles).where(eq(missionReportFiles.reportId, id));
    await tx.delete(missionReportPrayerTopics).where(eq(missionReportPrayerTopics.reportId, id));
    await tx.delete(missionReports).where(eq(missionReports.id, id));
  });
}

export async function updateMissionReportStatus(
  id: number,
  status: MissionReportStatus,
  reviewerId?: number,
  reviewComment?: string,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(missionReports)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewedAt: reviewerId ? new Date() : undefined,
      reviewComment,
      publishedAt: status === "published" ? new Date() : undefined,
    })
    .where(eq(missionReports.id, id));
}

export async function getMissionReportReviewerName(report: MissionReport) {
  const db = await getDb();
  if (!db || !report.reviewedBy) return null;
  const [reviewer] = await db.select({ name: users.name }).from(users).where(eq(users.id, report.reviewedBy)).limit(1);
  return reviewer?.name ?? null;
}
