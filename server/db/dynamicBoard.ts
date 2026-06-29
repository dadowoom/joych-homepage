import { and, desc, eq, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  dynamicBoardPosts,
  dynamicBoards,
  menuItems,
  menuSubItems,
  type InsertDynamicBoardPost,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type DynamicBoardSource = {
  menuItemId?: number;
  menuSubItemId?: number;
  boardTitle?: string;
};

export type DynamicBoardPostInput = Omit<InsertDynamicBoardPost, "boardId"> & DynamicBoardSource;

function assertSingleBoardSource(source: DynamicBoardSource) {
  if (Boolean(source.menuItemId) === Boolean(source.menuSubItemId)) {
    throw new Error("menuItemId 또는 menuSubItemId 중 하나만 필요합니다.");
  }
}

async function getSourceLabel(source: DynamicBoardSource) {
  const db = await getDb();
  if (!db) return source.boardTitle ?? "게시판";

  if (source.menuSubItemId) {
    const [subItem] = await db.select({ label: menuSubItems.label })
      .from(menuSubItems)
      .where(eq(menuSubItems.id, source.menuSubItemId))
      .limit(1);
    return source.boardTitle ?? subItem?.label ?? "게시판";
  }

  const [item] = await db.select({ label: menuItems.label })
    .from(menuItems)
    .where(eq(menuItems.id, source.menuItemId!))
    .limit(1);
  return source.boardTitle ?? item?.label ?? "게시판";
}

export async function getDynamicBoard(source: DynamicBoardSource) {
  assertSingleBoardSource(source);
  const db = await getDb();
  if (!db) return null;

  const [board] = await db.select()
    .from(dynamicBoards)
    .where(source.menuSubItemId
      ? eq(dynamicBoards.menuSubItemId, source.menuSubItemId)
      : eq(dynamicBoards.menuItemId, source.menuItemId!)
    )
    .limit(1);
  return board ?? null;
}

export async function ensureDynamicBoard(source: DynamicBoardSource) {
  assertSingleBoardSource(source);
  const db = await getDb();
  if (!db) return null;

  const existing = await getDynamicBoard(source);
  if (existing) return existing;

  const title = await getSourceLabel(source);
  const [result] = await db.insert(dynamicBoards).values({
    menuItemId: source.menuItemId ?? null,
    menuSubItemId: source.menuSubItemId ?? null,
    title,
  });
  const insertId = (result as ResultSetHeader).insertId;
  if (!insertId) return getDynamicBoard(source);

  const [created] = await db.select()
    .from(dynamicBoards)
    .where(eq(dynamicBoards.id, insertId))
    .limit(1);
  return created ?? null;
}

export async function getPublishedDynamicBoardPosts(source: DynamicBoardSource, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const board = await getDynamicBoard(source);
  if (!board) return [];

  return db.select()
    .from(dynamicBoardPosts)
    .where(and(eq(dynamicBoardPosts.boardId, board.id), eq(dynamicBoardPosts.isPublished, true)))
    .orderBy(desc(dynamicBoardPosts.isPinned), desc(dynamicBoardPosts.createdAt), desc(dynamicBoardPosts.id))
    .limit(limit);
}

export async function getDynamicBoardPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [post] = await db.select()
    .from(dynamicBoardPosts)
    .where(eq(dynamicBoardPosts.id, id))
    .limit(1);
  return post ?? null;
}

export async function createDynamicBoardPost(data: DynamicBoardPostInput) {
  const db = await getDb();
  if (!db) return null;
  const board = await ensureDynamicBoard(data);
  if (!board) return null;

  const [result] = await db.insert(dynamicBoardPosts).values({
    boardId: board.id,
    title: data.title,
    content: data.content,
    thumbnailUrl: data.thumbnailUrl,
    attachmentName: data.attachmentName,
    attachmentUrl: data.attachmentUrl,
    isPublished: data.isPublished,
    isPinned: data.isPinned,
    authorId: data.authorId,
  });
  return (result as ResultSetHeader).insertId;
}

export async function updateDynamicBoardPost(id: number, data: Partial<InsertDynamicBoardPost>) {
  const db = await getDb();
  if (!db) return;
  await db.update(dynamicBoardPosts).set(data).where(eq(dynamicBoardPosts.id, id));
}

export async function deleteDynamicBoardPost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(dynamicBoardPosts).where(eq(dynamicBoardPosts.id, id));
}

export async function incrementDynamicBoardPostViewCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(dynamicBoardPosts)
    .set({ viewCount: sql`${dynamicBoardPosts.viewCount} + 1` })
    .where(and(eq(dynamicBoardPosts.id, id), eq(dynamicBoardPosts.isPublished, true)));
}
