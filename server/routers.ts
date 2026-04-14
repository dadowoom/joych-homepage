import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import {
  getPublishedNotices,
  getVisibleAffiliates,
  getVisibleHeroSlides,
  getVisibleGalleryItems,
  getVisibleQuickMenus,
  getSiteSettings,
  getAllNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  getAllAffiliates,
  updateAffiliate,
  updateGalleryItem,
  upsertSiteSetting,
  getAllHeroSlides,
  updateHeroSlide,
} from "./db";

export const appRouter = router({
  system: systemRouter,

  // ─── 인증 ───────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── 홈페이지 공개 데이터 ────────────────────
  home: router({
    /** 히어로 슬라이드 */
    heroSlides: publicProcedure.query(() => getVisibleHeroSlides()),
    /** 퀵 메뉴 */
    quickMenus: publicProcedure.query(() => getVisibleQuickMenus()),
    /** 교회 소식 (최신 5개) */
    notices: publicProcedure.query(() => getPublishedNotices(5)),
    /** 관련 기관 */
    affiliates: publicProcedure.query(() => getVisibleAffiliates()),
    /** 갤러리 */
    gallery: publicProcedure.query(() => getVisibleGalleryItems()),
    /** 사이트 설정 (교회명, 주소 등) */
    settings: publicProcedure.query(() => getSiteSettings()),
  }),

  // ─── 관리자 전용 CMS API ─────────────────────
  cms: router({
    // 교회 소식 관리
    notices: router({
      list: adminProcedure.query(() => getAllNotices()),
      create: adminProcedure
        .input(z.object({
          category: z.string().default("공지"),
          title: z.string().min(1),
          content: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          isPublished: z.boolean().default(true),
          isPinned: z.boolean().default(false),
        }))
        .mutation(({ input, ctx }) =>
          createNotice({ ...input, authorId: ctx.user.id })
        ),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          category: z.string().optional(),
          title: z.string().optional(),
          content: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          isPublished: z.boolean().optional(),
          isPinned: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateNotice(id, data);
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteNotice(input.id)),
    }),

    // 관련 기관 관리
    affiliates: router({
      list: adminProcedure.query(() => getAllAffiliates()),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          label: z.string().optional(),
          href: z.string().optional(),
          icon: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateAffiliate(id, data);
        }),
    }),

    // 히어로 슬라이드 관리
    heroSlides: router({
      list: adminProcedure.query(() => getAllHeroSlides()),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          yearLabel: z.string().optional(),
          mainTitle: z.string().optional(),
          subTitle: z.string().optional(),
          bibleRef: z.string().optional(),
          btn1Text: z.string().optional(),
          btn1Href: z.string().optional(),
          btn2Text: z.string().optional(),
          btn2Href: z.string().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateHeroSlide(id, data);
        }),
    }),

    // 갤러리 관리
    gallery: router({
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          caption: z.string().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateGalleryItem(id, data);
        }),
    }),

    // 사이트 설정 관리
    settings: router({
      update: adminProcedure
        .input(z.object({
          key: z.string(),
          value: z.string(),
        }))
        .mutation(({ input }) => upsertSiteSetting(input.key, input.value)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
