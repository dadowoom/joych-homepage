import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
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
  createHeroSlide,
  deleteHeroSlide,
  getVisibleMenus,
  getAllMenus,
  updateMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createMenu,
  deleteMenu,
  reorderMenus,
  getAllQuickMenus,
  updateQuickMenu,
  reorderQuickMenus,
  createMenuSubItem,
  updateMenuSubItem,
  deleteMenuSubItem,
  deleteMenuItemWithSubs,
} from "./db";

export const appRouter = router({
  system: systemRouter,

  // ─── 인증 ───────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    /** 관리자 전용 아이디/비밀번호 로그인 */
    adminLogin: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // 하드코딩된 관리자 자격증명 확인
        const ADMIN_USERNAME = "joyfulchurch";
        const ADMIN_PASSWORD = "joyfulchurch1!";
        const ADMIN_OPEN_ID = "admin_joyfulchurch";

        if (input.username !== ADMIN_USERNAME || input.password !== ADMIN_PASSWORD) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "아이디 또는 비밀번호가 올바르지 않습니다.",
          });
        }

        // 관리자 사용자가 DB에 없으면 생성
        let user = await db.getUserByOpenId(ADMIN_OPEN_ID);
        if (!user) {
          await db.upsertUser({
            openId: ADMIN_OPEN_ID,
            name: "기쁜의교회 관리자",
            email: null,
            loginMethod: "password",
            lastSignedIn: new Date(),
          });
          // role을 admin으로 업데이트
          await db.setUserRole(ADMIN_OPEN_ID, "admin");
          user = await db.getUserByOpenId(ADMIN_OPEN_ID);
        }

        // 마지막 로그인 시간 업데이트
        await db.upsertUser({ openId: ADMIN_OPEN_ID, lastSignedIn: new Date() });

        // 세션 토큰 발급
        const sessionToken = await sdk.signSession(
          { openId: ADMIN_OPEN_ID, appId: "admin", name: "관리자" },
          { expiresInMs: ONE_YEAR_MS }
        );

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, user };
      }),
  }),

  // ─── 홈페이지 공개 데이터 ────────────
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
    /** 상단 네비게이션 메뉴 (서브메뉴 포함) */
    menus: publicProcedure.query(() => getVisibleMenus()),
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
          videoUrl: z.string().optional(),
          posterUrl: z.string().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateHeroSlide(id, data);
        }),
      create: adminProcedure
        .input(z.object({
          videoUrl: z.string().optional(),
          posterUrl: z.string().optional(),
          yearLabel: z.string().optional(),
          mainTitle: z.string().optional(),
          subTitle: z.string().optional(),
          bibleRef: z.string().optional(),
          btn1Text: z.string().optional(),
          btn1Href: z.string().optional(),
          btn2Text: z.string().optional(),
          btn2Href: z.string().optional(),
        }))
        .mutation(({ input }) => createHeroSlide(input)),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteHeroSlide(input.id)),
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

    // 메뉴 관리
    menus: router({
      list: adminProcedure.query(() => getAllMenus()),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          label: z.string().optional(),
          href: z.string().nullable().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateMenu(id, data);
        }),
      // 서브메뉴 관리
      createItem: adminProcedure
        .input(z.object({
          menuId: z.number(),
          label: z.string(),
          href: z.string().optional(),
          sortOrder: z.number().optional(),
          pageType: z.enum(["image", "gallery", "board", "youtube", "editor"]).optional(),
          pageImageUrl: z.string().nullable().optional(),
        }))
        .mutation(({ input }) => createMenuItem(input)),
      updateItem: adminProcedure
        .input(z.object({
          id: z.number(),
          label: z.string().optional(),
          href: z.string().nullable().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
          pageType: z.enum(["image", "gallery", "board", "youtube", "editor"]).optional(),
          pageImageUrl: z.string().nullable().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateMenuItem(id, data);
        }),
      deleteItem: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteMenuItemWithSubs(input.id)),
      // 3단 메뉴 관리
      createSubItem: adminProcedure
        .input(z.object({
          menuItemId: z.number(),
          label: z.string(),
          href: z.string().optional(),
          sortOrder: z.number().optional(),
          pageType: z.enum(["image", "gallery", "board", "youtube", "editor"]).optional(),
          pageImageUrl: z.string().nullable().optional(),
        }))
        .mutation(({ input }) => createMenuSubItem(input)),
      updateSubItem: adminProcedure
        .input(z.object({
          id: z.number(),
          label: z.string().optional(),
          href: z.string().nullable().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
          pageType: z.enum(["image", "gallery", "board", "youtube", "editor"]).optional(),
          pageImageUrl: z.string().nullable().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateMenuSubItem(id, data);
        }),
      deleteSubItem: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteMenuSubItem(input.id)),
      // 상위 메뉴 생성
      create: adminProcedure
        .input(z.object({
          label: z.string().min(1),
          href: z.string().nullable().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(({ input }) => createMenu(input)),
      // 상위 메뉴 삭제
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteMenu(input.id)),
      // 순서 일괄 변경
      reorder: adminProcedure
        .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
        .mutation(({ input }) => reorderMenus(input)),
    }),

    // 퀵 메뉴 관리
    quickMenus: router({
      list: adminProcedure.query(() => getAllQuickMenus()),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          icon: z.string().optional(),
          label: z.string().optional(),
          href: z.string().nullable().optional(),
          sortOrder: z.number().optional(),
          isVisible: z.boolean().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateQuickMenu(id, data);
        }),
      reorder: adminProcedure
        .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
        .mutation(({ input }) => reorderQuickMenus(input)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
