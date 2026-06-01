/**
 * 생선 간증 DB 함수
 * 승인된 성도는 자유롭게 간증과 댓글을 남기고, 관리자는 숨김/삭제 처리합니다.
 */

import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  churchMembers,
  type InsertTestimonyComment,
  type InsertTestimonyPost,
  type InsertTestimonyPostImage,
  type TestimonyComment,
  type TestimonyPost,
  testimonyComments,
  testimonyPostImages,
  testimonyPosts,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type TestimonyPostStatus = "published" | "hidden" | "deleted";
export type TestimonyCommentStatus = "published" | "hidden" | "deleted";

export type TestimonyPostListRow = TestimonyPost & {
  authorName: string | null;
  authorPosition: string | null;
  authorDepartment: string | null;
  images: string[];
  commentCount: number;
};

export type TestimonyCommentRow = TestimonyComment & {
  authorName: string | null;
  authorPosition: string | null;
};

export type TestimonyPostDetail = TestimonyPostListRow & {
  comments: TestimonyCommentRow[];
};

async function getPublishedCommentCount(postId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: testimonyComments.id })
    .from(testimonyComments)
    .where(and(
      eq(testimonyComments.postId, postId),
      eq(testimonyComments.status, "published"),
    ));
  return rows.length;
}

async function hydratePosts(rows: TestimonyPost[]): Promise<TestimonyPostListRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const result: TestimonyPostListRow[] = [];
  for (const post of rows) {
    const [author] = await db.select({
      name: churchMembers.name,
      position: churchMembers.position,
      department: churchMembers.department,
    })
      .from(churchMembers)
      .where(eq(churchMembers.id, post.authorMemberId))
      .limit(1);

    const images = await db.select()
      .from(testimonyPostImages)
      .where(eq(testimonyPostImages.postId, post.id))
      .orderBy(asc(testimonyPostImages.sortOrder), asc(testimonyPostImages.id));

    result.push({
      ...post,
      authorName: author?.name ?? null,
      authorPosition: author?.position ?? null,
      authorDepartment: author?.department ?? null,
      images: images.map(image => image.imageUrl),
      commentCount: await getPublishedCommentCount(post.id),
    });
  }
  return result;
}

export async function getPublishedTestimonyPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(testimonyPosts)
    .where(eq(testimonyPosts.status, "published"))
    .orderBy(desc(testimonyPosts.isPinned), desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
    .limit(limit);
  return hydratePosts(rows);
}

export async function getAllTestimonyPosts() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(testimonyPosts)
    .where(ne(testimonyPosts.status, "deleted"))
    .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  return hydratePosts(rows);
}

export async function getTestimonyPostsByAuthor(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(testimonyPosts)
    .where(and(
      eq(testimonyPosts.authorMemberId, memberId),
      ne(testimonyPosts.status, "deleted"),
    ))
    .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  return hydratePosts(rows);
}

export async function getTestimonyPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [post] = await db.select().from(testimonyPosts).where(eq(testimonyPosts.id, id)).limit(1);
  if (!post) return null;
  const [hydrated] = await hydratePosts([post]);
  return hydrated ?? null;
}

export async function getPublishedTestimonyPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.update(testimonyPosts)
    .set({ viewCount: sql`${testimonyPosts.viewCount} + 1` })
    .where(and(eq(testimonyPosts.id, id), eq(testimonyPosts.status, "published")));

  const post = await getTestimonyPostById(id);
  if (!post || post.status !== "published") return null;
  return {
    ...post,
    comments: await getPublishedTestimonyComments(id),
  } satisfies TestimonyPostDetail;
}

export async function getPublishedTestimonyComments(postId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(testimonyComments)
    .where(and(
      eq(testimonyComments.postId, postId),
      eq(testimonyComments.status, "published"),
    ))
    .orderBy(asc(testimonyComments.createdAt), asc(testimonyComments.id));
  return hydrateComments(rows);
}

export async function getAllTestimonyComments() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(testimonyComments)
    .where(ne(testimonyComments.status, "deleted"))
    .orderBy(desc(testimonyComments.createdAt), desc(testimonyComments.id));
  const hydrated = await hydrateComments(rows);

  const result = [];
  for (const comment of hydrated) {
    const [post] = await db.select({ title: testimonyPosts.title })
      .from(testimonyPosts)
      .where(eq(testimonyPosts.id, comment.postId))
      .limit(1);
    result.push({ ...comment, postTitle: post?.title ?? null });
  }
  return result;
}

async function hydrateComments(rows: TestimonyComment[]): Promise<TestimonyCommentRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const result: TestimonyCommentRow[] = [];
  for (const comment of rows) {
    const [author] = await db.select({
      name: churchMembers.name,
      position: churchMembers.position,
    })
      .from(churchMembers)
      .where(eq(churchMembers.id, comment.authorMemberId))
      .limit(1);
    result.push({
      ...comment,
      authorName: author?.name ?? null,
      authorPosition: author?.position ?? null,
    });
  }
  return result;
}

export async function createTestimonyPostWithImages(
  data: InsertTestimonyPost,
  images: Array<Omit<InsertTestimonyPostImage, "postId">>,
) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const [result] = await tx.insert(testimonyPosts).values(data);
    const postId = (result as ResultSetHeader).insertId;
    if (!postId) return null;
    if (images.length > 0) {
      await tx.insert(testimonyPostImages).values(images.map(image => ({ ...image, postId })));
    }
    return postId;
  });
}

export async function updateTestimonyPostWithImages(
  id: number,
  data: Partial<InsertTestimonyPost>,
  images: Array<Omit<InsertTestimonyPostImage, "postId">>,
) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.update(testimonyPosts).set(data).where(eq(testimonyPosts.id, id));
    await tx.delete(testimonyPostImages).where(eq(testimonyPostImages.postId, id));
    if (images.length > 0) {
      await tx.insert(testimonyPostImages).values(images.map(image => ({ ...image, postId: id })));
    }
  });
}

export async function updateTestimonyPostStatus(id: number, status: TestimonyPostStatus) {
  const db = await getDb();
  if (!db) return;
  await db.update(testimonyPosts).set({ status }).where(eq(testimonyPosts.id, id));
}

export async function createTestimonyComment(data: InsertTestimonyComment) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(testimonyComments).values(data);
  return (result as ResultSetHeader).insertId;
}

export async function getTestimonyCommentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [comment] = await db.select().from(testimonyComments).where(eq(testimonyComments.id, id)).limit(1);
  return comment ?? null;
}

export async function updateTestimonyComment(id: number, data: Partial<InsertTestimonyComment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(testimonyComments).set(data).where(eq(testimonyComments.id, id));
}

export async function updateTestimonyCommentStatus(id: number, status: TestimonyCommentStatus) {
  const db = await getDb();
  if (!db) return;
  await db.update(testimonyComments).set({ status }).where(eq(testimonyComments.id, id));
}
