/**
 * 생선 간증 DB 함수
 * 승인된 성도는 자유롭게 간증과 댓글을 남기고, 관리자는 숨김/삭제 처리합니다.
 */

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
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
import {
  SECRET_POST_MASK_CONTENT,
  SECRET_POST_MASK_TITLE,
  canViewSecretPost,
  type SecretPostViewer,
} from "./secretPosts";

export type TestimonyPostStatus = "published" | "hidden" | "deleted";
export type TestimonyCommentStatus = "published" | "hidden" | "deleted";

export type TestimonyPostListRow = TestimonyPost & {
  authorName: string | null;
  authorPosition: string | null;
  authorDepartment: string | null;
  images: string[];
  commentCount: number;
  canViewSecret: boolean;
};

export type TestimonyCommentRow = TestimonyComment & {
  authorName: string | null;
  authorPosition: string | null;
};

export type TestimonyPostDetail = TestimonyPostListRow & {
  comments: TestimonyCommentRow[];
};

const testimonyPostListSelect = {
  id: testimonyPosts.id,
  authorMemberId: testimonyPosts.authorMemberId,
  title: testimonyPosts.title,
  content: testimonyPosts.content,
  thumbnailUrl: testimonyPosts.thumbnailUrl,
  status: testimonyPosts.status,
  isSecret: testimonyPosts.isSecret,
  createdAt: testimonyPosts.createdAt,
};

const testimonyPostFullSelect = {
  ...testimonyPostListSelect,
  viewCount: testimonyPosts.viewCount,
  isPinned: testimonyPosts.isPinned,
  updatedAt: testimonyPosts.updatedAt,
};

type TestimonyPostBaseRow = {
  id: number;
  authorMemberId: number;
  title: string;
  content: string;
  thumbnailUrl: string | null;
  status: TestimonyPostStatus;
  isSecret: boolean;
  createdAt: Date;
  viewCount?: number;
  isPinned?: boolean;
  updatedAt?: Date;
};

function normalizeTestimonyPost(row: TestimonyPostBaseRow): TestimonyPost {
  return {
    ...row,
    viewCount: row.viewCount ?? 0,
    isPinned: row.isPinned ?? false,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

function warnOptionalPostFieldsFallback(error: unknown) {
  console.warn(
    "[Testimony] Falling back to minimal post columns:",
    error instanceof Error ? error.message : String(error),
  );
}

async function hydratePosts(rows: TestimonyPost[]): Promise<TestimonyPostListRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const postIds = rows.map(post => post.id);
  const authorIds = Array.from(new Set(rows.map(post => post.authorMemberId)));

  const [authors, images, comments] = await Promise.all([
    db.select({
      id: churchMembers.id,
      name: churchMembers.name,
      position: churchMembers.position,
      department: churchMembers.department,
    })
      .from(churchMembers)
      .where(inArray(churchMembers.id, authorIds)),
    db.select()
      .from(testimonyPostImages)
      .where(inArray(testimonyPostImages.postId, postIds))
      .orderBy(asc(testimonyPostImages.sortOrder), asc(testimonyPostImages.id)),
    db.select({ postId: testimonyComments.postId })
      .from(testimonyComments)
      .where(and(
        inArray(testimonyComments.postId, postIds),
        eq(testimonyComments.status, "published"),
      )),
  ]);

  const authorsById = new Map(authors.map(author => [author.id, author]));
  const imagesByPostId = new Map<number, string[]>();
  for (const image of images) {
    const list = imagesByPostId.get(image.postId) ?? [];
    list.push(image.imageUrl);
    imagesByPostId.set(image.postId, list);
  }

  const commentCountsByPostId = new Map<number, number>();
  for (const comment of comments) {
    commentCountsByPostId.set(
      comment.postId,
      (commentCountsByPostId.get(comment.postId) ?? 0) + 1,
    );
  }

  return rows.map(post => {
    const author = authorsById.get(post.authorMemberId);
    return {
      ...post,
      authorName: author?.name ?? null,
      authorPosition: author?.position ?? null,
      authorDepartment: author?.department ?? null,
      images: imagesByPostId.get(post.id) ?? [],
      commentCount: commentCountsByPostId.get(post.id) ?? 0,
      canViewSecret: true,
    };
  });
}

function applyTestimonySecretAccess(
  post: TestimonyPostListRow,
  viewer?: SecretPostViewer,
): TestimonyPostListRow {
  const canView = !post.isSecret || canViewSecretPost(viewer, "content:testimonies", post.authorMemberId);
  if (canView) {
    return {
      ...post,
      canViewSecret: true,
    };
  }

  return {
    ...post,
    title: SECRET_POST_MASK_TITLE,
    content: SECRET_POST_MASK_CONTENT,
    thumbnailUrl: null,
    images: [],
    commentCount: 0,
    canViewSecret: false,
  };
}

export async function getPublishedTestimonyPosts(viewer?: SecretPostViewer, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  let rows: TestimonyPostBaseRow[];
  try {
    rows = await db.select(testimonyPostFullSelect)
      .from(testimonyPosts)
      .where(eq(testimonyPosts.status, "published"))
      .orderBy(desc(testimonyPosts.isPinned), desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
      .limit(limit);
  } catch (error) {
    warnOptionalPostFieldsFallback(error);
    rows = await db.select(testimonyPostListSelect)
      .from(testimonyPosts)
      .where(eq(testimonyPosts.status, "published"))
      .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
      .limit(limit);
  }
  return (await hydratePosts(rows.map(normalizeTestimonyPost)))
    .map((post) => applyTestimonySecretAccess(post, viewer));
}

export async function getAllTestimonyPosts() {
  const db = await getDb();
  if (!db) return [];
  let rows: TestimonyPostBaseRow[];
  try {
    rows = await db.select(testimonyPostFullSelect)
      .from(testimonyPosts)
      .where(ne(testimonyPosts.status, "deleted"))
      .orderBy(desc(testimonyPosts.isPinned), desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  } catch (error) {
    warnOptionalPostFieldsFallback(error);
    rows = await db.select(testimonyPostListSelect)
      .from(testimonyPosts)
      .where(ne(testimonyPosts.status, "deleted"))
      .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  }
  return (await hydratePosts(rows.map(normalizeTestimonyPost)))
    .map((post) => ({ ...post, canViewSecret: true }));
}

export async function getTestimonyPostsByAuthor(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  let rows: TestimonyPostBaseRow[];
  try {
    rows = await db.select(testimonyPostFullSelect)
      .from(testimonyPosts)
      .where(and(
        eq(testimonyPosts.authorMemberId, memberId),
        ne(testimonyPosts.status, "deleted"),
      ))
      .orderBy(desc(testimonyPosts.isPinned), desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  } catch (error) {
    warnOptionalPostFieldsFallback(error);
    rows = await db.select(testimonyPostListSelect)
      .from(testimonyPosts)
      .where(and(
        eq(testimonyPosts.authorMemberId, memberId),
        ne(testimonyPosts.status, "deleted"),
      ))
      .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id));
  }
  return (await hydratePosts(rows.map(normalizeTestimonyPost)))
    .map((post) => ({ ...post, canViewSecret: true }));
}

export async function getTestimonyPostById(id: number) {
  const db = await getDb();
  if (!db) return null;
  let post: TestimonyPostBaseRow | undefined;
  try {
    [post] = await db.select(testimonyPostFullSelect).from(testimonyPosts).where(eq(testimonyPosts.id, id)).limit(1);
  } catch (error) {
    warnOptionalPostFieldsFallback(error);
    [post] = await db.select(testimonyPostListSelect).from(testimonyPosts).where(eq(testimonyPosts.id, id)).limit(1);
  }
  if (!post) return null;
  const [hydrated] = await hydratePosts([normalizeTestimonyPost(post)]);
  return hydrated ?? null;
}

export async function getPublishedTestimonyPostById(id: number, viewer?: SecretPostViewer) {
  const post = await getTestimonyPostById(id);
  if (!post || post.status !== "published") return null;
  const canViewSecret = !post.isSecret || canViewSecretPost(viewer, "content:testimonies", post.authorMemberId);

  if (canViewSecret) {
    const db = await getDb();
    if (db) {
      try {
        await db.update(testimonyPosts)
          .set({ viewCount: sql`${testimonyPosts.viewCount} + 1` })
          .where(and(eq(testimonyPosts.id, id), eq(testimonyPosts.status, "published")));
      } catch (error) {
        console.warn("[Testimony] Failed to update view count:", error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (!canViewSecret) {
    return {
      ...post,
      title: SECRET_POST_MASK_TITLE,
      content: SECRET_POST_MASK_CONTENT,
      thumbnailUrl: null,
      images: [],
      commentCount: 0,
      comments: [],
      canViewSecret: false,
    } satisfies TestimonyPostDetail;
  }

  return {
    ...post,
    comments: await getPublishedTestimonyComments(id),
    canViewSecret: true,
  } satisfies TestimonyPostDetail;
}

export async function canViewPublishedTestimonyPost(id: number, viewer?: SecretPostViewer) {
  const post = await getTestimonyPostById(id);
  if (!post || post.status !== "published") return false;
  if (!post.isSecret) return true;
  return canViewSecretPost(viewer, "content:testimonies", post.authorMemberId);
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

  const postIds = Array.from(new Set(hydrated.map(comment => comment.postId)));
  const posts = postIds.length > 0
    ? await db.select({ id: testimonyPosts.id, title: testimonyPosts.title })
      .from(testimonyPosts)
      .where(inArray(testimonyPosts.id, postIds))
    : [];
  const postsById = new Map(posts.map(post => [post.id, post]));

  return hydrated.map(comment => ({
    ...comment,
    postTitle: postsById.get(comment.postId)?.title ?? null,
  }));
}

async function hydrateComments(rows: TestimonyComment[]): Promise<TestimonyCommentRow[]> {
  const db = await getDb();
  if (!db || rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map(comment => comment.authorMemberId)));
  const authors = await db.select({
    id: churchMembers.id,
      name: churchMembers.name,
      position: churchMembers.position,
    })
      .from(churchMembers)
    .where(inArray(churchMembers.id, authorIds));
  const authorsById = new Map(authors.map(author => [author.id, author]));

  return rows.map(comment => {
    const author = authorsById.get(comment.authorMemberId);
    return {
      ...comment,
      authorName: author?.name ?? null,
      authorPosition: author?.position ?? null,
    };
  });
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
