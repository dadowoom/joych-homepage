import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import {
  getMenuItemById,
  getMenuSubItemById,
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
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  getFacilityImages,
  addFacilityImage,
  deleteFacilityImage,
  getFacilityHours,
  upsertFacilityHour,
  getBlockedDates,
  addBlockedDate,
  deleteBlockedDate,
  getAllReservations,
  getMyReservations,
  getReservationsByDate,
  createReservation,
  updateReservationStatus,
  getReservationById,
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
    /** 2단 메뉴 단건 조회 (동적 페이지용) */
    menuItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getMenuItemById(input.id)),
    /** 3단 메뉴 단건 조회 (동적 페이지용) */
    menuSubItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getMenuSubItemById(input.id)),
    /** 시설 목록 (성도용 - 공개된 시설만) */
    facilities: publicProcedure.query(() => getFacilities(true)),
    /** 시설 단건 조회 (성도용) */
    facility: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getFacilityById(input.id)),
    /** 시설 사진 목록 (성도용) */
    facilityImages: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getFacilityImages(input.facilityId)),
    /** 시설 운영 시간 (성도용) */
    facilityHours: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getFacilityHours(input.facilityId)),
    /** 특정 날짜 차단 목록 (성도용) */
    facilityBlockedDates: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getBlockedDates(input.facilityId)),
    /** 특정 날짜 예약 목록 (시간 선택용) */
    facilityReservationsByDate: publicProcedure
      .input(z.object({ facilityId: z.number(), date: z.string() }))
      .query(({ input }) => getReservationsByDate(input.facilityId, input.date)),
    /** 예약 신청 (로그인 필요) */
    createReservation: protectedProcedure
      .input(z.object({
        facilityId: z.number(),
        reserverName: z.string(),
        reserverPhone: z.string().optional(),
        reservationDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        purpose: z.string(),
        department: z.string().optional(),
        attendees: z.number().default(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const facility = await getFacilityById(input.facilityId);
        if (!facility) throw new TRPCError({ code: 'NOT_FOUND', message: '시설을 찾을 수 없습니다.' });
        if (!facility.isReservable) throw new TRPCError({ code: 'BAD_REQUEST', message: '현재 예약이 불가능한 시설입니다.' });
        const status = facility.approvalType === 'auto' ? 'approved' : 'pending';
        const id = await createReservation({ ...input, userId: ctx.user.id, status });
        return { id, status };
      }),
    /** 내 예약 목록 (로그인 필요) */
    myReservations: protectedProcedure
      .query(({ ctx }) => getMyReservations(ctx.user.id)),
    /** 예약 취소 (본인만 가능) */
    cancelReservation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const reservation = await getReservationById(input.id);
        if (!reservation) throw new TRPCError({ code: 'NOT_FOUND', message: '예약을 찾을 수 없습니다.' });
        if (reservation.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: '본인의 예약만 취소할 수 있습니다.' });
        if (reservation.status === 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: '이미 승인된 예약은 취소할 수 없습니다. 관리자에게 문의하세요.' });
        await updateReservationStatus(input.id, 'cancelled');
        return { success: true };
      }),
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
        .mutation(async ({ input }) => {
          const result = await createMenuItem(input);
          const newId = result?.insertId;
          // href가 없으면 동적 페이지 URL 자동 설정
          if (newId && !input.href) {
            await updateMenuItem(newId, { href: `/page/item/${newId}` });
          }
          return { insertId: newId };
        }),
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
        .mutation(async ({ input }) => {
          const result = await createMenuSubItem(input);
          const newId = result?.insertId;
          // href가 없으면 동적 페이지 URL 자동 설정
          if (newId && !input.href) {
            await updateMenuSubItem(newId, { href: `/page/sub/${newId}` });
          }
          return { insertId: newId };
        }),
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

    // 파일 업로드 (영상/이미지 → S3)
    upload: router({
      /** 영상 파일 업로드 (히어로 슬라이드용) */
      video: adminProcedure
        .input(z.object({
          base64: z.string(),        // base64로 인코딩된 파일 내용
          fileName: z.string(),      // 원본 파일명 (예: church-video.mp4)
          mimeType: z.string(),      // MIME 타입 (예: video/mp4)
        }))
        .mutation(async ({ input }) => {
          const buffer = Buffer.from(input.base64, "base64");
          const ext = input.fileName.split(".").pop() || "mp4";
          const key = `hero-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { url } = await storagePut(key, buffer, input.mimeType);
          return { url };
        }),
      /** 이미지 파일 업로드 (교회 소식 썸네일용) */
      image: adminProcedure
        .input(z.object({
          base64: z.string(),        // base64로 인코딩된 파일 내용
          fileName: z.string(),      // 원본 파일명 (예: notice.jpg)
          mimeType: z.string(),      // MIME 타입 (예: image/jpeg)
        }))
        .mutation(async ({ input }) => {
          const buffer = Buffer.from(input.base64, "base64");
          const ext = input.fileName.split(".").pop() || "jpg";
          const key = `notice-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { url } = await storagePut(key, buffer, input.mimeType);
          return { url };
        }),
    }),

    // 시설 예약 관리 (관리자)
    facilities: router({
      list: adminProcedure.query(() => getFacilities(false)),
      get: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(({ input }) => getFacilityById(input.id)),
      create: adminProcedure
        .input(z.object({
          name: z.string(),
          description: z.string().optional(),
          location: z.string().optional(),
          capacity: z.number().default(10),
          pricePerHour: z.number().default(0),
          slotMinutes: z.number().default(60),
          minSlots: z.number().default(1),
          maxSlots: z.number().default(8),
          approvalType: z.enum(['auto', 'manual']).default('manual'),
          isReservable: z.boolean().default(true),
          isVisible: z.boolean().default(true),
          notice: z.string().optional(),
          caution: z.string().optional(),
          sortOrder: z.number().default(0),
        }))
        .mutation(({ input }) => createFacility(input)),
      update: adminProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          location: z.string().optional(),
          capacity: z.number().optional(),
          pricePerHour: z.number().optional(),
          slotMinutes: z.number().optional(),
          minSlots: z.number().optional(),
          maxSlots: z.number().optional(),
          approvalType: z.enum(['auto', 'manual']).optional(),
          isReservable: z.boolean().optional(),
          isVisible: z.boolean().optional(),
          notice: z.string().optional(),
          caution: z.string().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          return updateFacility(id, data);
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteFacility(input.id)),
      // 시설 사진
      images: router({
        list: publicProcedure
          .input(z.object({ facilityId: z.number() }))
          .query(({ input }) => getFacilityImages(input.facilityId)),
        upload: adminProcedure
          .input(z.object({
            facilityId: z.number(),
            base64: z.string(),
            mimeType: z.string(),
            caption: z.string().optional(),
            isThumbnail: z.boolean().default(false),
          }))
          .mutation(async ({ input }) => {
            const buffer = Buffer.from(input.base64, 'base64');
            const ext = input.mimeType.split('/')[1] ?? 'jpg';
            const key = `facility-images/${input.facilityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { url } = await storagePut(key, buffer, input.mimeType);
            const id = await addFacilityImage({
              facilityId: input.facilityId,
              imageUrl: url,
              fileKey: key,
              caption: input.caption,
              isThumbnail: input.isThumbnail,
              sortOrder: 0,
            });
            return { id, url };
          }),
        delete: adminProcedure
          .input(z.object({ id: z.number() }))
          .mutation(({ input }) => deleteFacilityImage(input.id)),
        setThumbnail: adminProcedure
          .input(z.object({ facilityId: z.number(), imageId: z.number() }))
          .mutation(async ({ input }) => {
            // 모든 이미지 isThumbnail=false로 초기화 후 선택 이미지만 true
            const { getDb } = await import('./db');
            const { facilityImages } = await import('../drizzle/schema');
            const { eq } = await import('drizzle-orm');
            const db = await getDb();
            if (!db) throw new Error('DB not available');
            await db.update(facilityImages)
              .set({ isThumbnail: false })
              .where(eq(facilityImages.facilityId, input.facilityId));
            await db.update(facilityImages)
              .set({ isThumbnail: true })
              .where(eq(facilityImages.id, input.imageId));
            return { success: true };
          }),
      }),
      // 운영 시간
      hours: router({
        list: publicProcedure
          .input(z.object({ facilityId: z.number() }))
          .query(({ input }) => getFacilityHours(input.facilityId)),
        upsert: adminProcedure
          .input(z.object({
            facilityId: z.number(),
            dayOfWeek: z.number().min(0).max(6),
            isOpen: z.boolean(),
            openTime: z.string(),
            closeTime: z.string(),
            breakStart: z.string().nullable().optional(),
            breakEnd: z.string().nullable().optional(),
          }))
          .mutation(({ input }) => upsertFacilityHour(input)),
      }),
      // 차단 날짜
      blockedDates: router({
        list: publicProcedure
          .input(z.object({ facilityId: z.number().optional() }))
          .query(({ input }) => getBlockedDates(input.facilityId)),
        add: adminProcedure
          .input(z.object({
            facilityId: z.number().nullable().optional(),
            blockedDate: z.string(),
            reason: z.string().optional(),
            isPartialBlock: z.boolean().default(false),
            blockStart: z.string().nullable().optional(),
            blockEnd: z.string().nullable().optional(),
          }))
          .mutation(({ input }) => addBlockedDate(input)),
        delete: adminProcedure
          .input(z.object({ id: z.number() }))
          .mutation(({ input }) => deleteBlockedDate(input.id)),
      }),
    }),
    // 예약 관리 (관리자)
    reservations: router({
      list: adminProcedure
        .input(z.object({ facilityId: z.number().optional() }))
        .query(({ input }) => getAllReservations(input.facilityId)),
      get: adminProcedure
        .input(z.object({ id: z.number() }))
        .query(({ input }) => getReservationById(input.id)),
      approve: adminProcedure
        .input(z.object({ id: z.number(), comment: z.string().optional() }))
        .mutation(({ input, ctx }) => updateReservationStatus(input.id, 'approved', input.comment, ctx.user.id)),
      reject: adminProcedure
        .input(z.object({ id: z.number(), comment: z.string() }))
        .mutation(({ input, ctx }) => updateReservationStatus(input.id, 'rejected', input.comment, ctx.user.id)),
    }),
    // 퀝 메뉴 관리
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
