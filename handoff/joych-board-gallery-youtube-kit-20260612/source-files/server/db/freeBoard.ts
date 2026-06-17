import { desc, eq, inArray, ne } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  churchMembers,
  freeBoardPosts,
  type FreeBoardPost,
  type InsertFreeBoardPost,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type FreeBoardPostStatus = "published" | "hidden" | "deleted";

export type FreeBoardPostRow = FreeBoardPost & {
  authorName: string | null;
  authorPosition: string | null;
};

async function hydrateFreeBoardPosts(rows: FreeBoardPost[]): Promise<FreeBoardPostRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map(post => post.authorMemberId)));
  const authors = await db.select({
    id: churchMembers.id,
    name: churchMembers.name,
    position: churchMembers.position,
  })
    .from(churchMembers)
    .where(inArray(churchMembers.id, authorIds));

  const authorsById = new Map(authors.map(author => [author.id, author]));
  return rows.map(post => {
    const author = authorsById.get(post.authorMemberId);
    return {
      ...post,
      authorName: author?.name ?? null,
      authorPosition: author?.position ?? null,
    };
  });
}

export async function getPublishedFreeBoardPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(freeBoardPosts)
    .where(eq(freeBoardPosts.status, "published"))
    .orderBy(desc(freeBoardPosts.createdAt), desc(freeBoardPosts.id))
    .limit(limit);
  return hydrateFreeBoardPosts(rows);
}

export async function getAllFreeBoardPosts() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(freeBoardPosts)
    .where(ne(freeBoardPosts.status, "deleted"))
    .orderBy(desc(freeBoardPosts.createdAt), desc(freeBoardPosts.id));
  return hydrateFreeBoardPosts(rows);
}

export async function getFreeBoardPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [post] = await db.select()
    .from(freeBoardPosts)
    .where(eq(freeBoardPosts.id, id))
    .limit(1);
  if (!post) return null;
  const [hydrated] = await hydrateFreeBoardPosts([post]);
  return hydrated ?? null;
}

export async function getFreeBoardPostsByAuthor(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(freeBoardPosts)
    .where(eq(freeBoardPosts.authorMemberId, memberId))
    .orderBy(desc(freeBoardPosts.createdAt), desc(freeBoardPosts.id));
  return hydrateFreeBoardPosts(rows.filter(post => post.status !== "deleted"));
}

export async function createFreeBoardPost(data: InsertFreeBoardPost) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(freeBoardPosts).values(data);
  return (result as ResultSetHeader).insertId;
}

export async function updateFreeBoardPost(id: number, data: Partial<InsertFreeBoardPost>) {
  const db = await getDb();
  if (!db) return;
  await db.update(freeBoardPosts).set(data).where(eq(freeBoardPosts.id, id));
}

export async function updateFreeBoardPostStatus(id: number, status: FreeBoardPostStatus) {
  const db = await getDb();
  if (!db) return;
  await db.update(freeBoardPosts).set({ status }).where(eq(freeBoardPosts.id, id));
}
