/**
 * 콘텐츠 관리 라우터 (cms.content)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - affiliates: 관련기관 관리 (목록, 추가, 수정, 삭제)
 *   - heroSlides: 히어로 슬라이드 관리
 *   - gallery: 갤러리 관리 (목록, 추가, 수정, 삭제)
 *   - settings: 사이트 설정 관리
 *   - quickMenus: 퀵메뉴 관리 (목록, 추가, 수정, 삭제, 순서변경)
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */
import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  getAllAffiliates,
  updateAffiliate,
  createAffiliate,
  deleteAffiliate,
  getAllHeroSlides,
  updateHeroSlide,
  createHeroSlide,
  deleteHeroSlide,
  getAllGalleryItems,
  updateGalleryItem,
  createGalleryItem,
  deleteGalleryItem,
  upsertSiteSetting,
  getAllQuickMenus,
  updateQuickMenu,
  reorderQuickMenus,
  createQuickMenu,
  deleteQuickMenu,
} from "../../db";

export const contentRouter = router({
  // ─── 관련기관 관리 ──────────────────────────────────────────────────────────
  affiliates: router({
    list: adminProcedure.query(() => getAllAffiliates()),
    create: adminProcedure
      .input(z.object({
        icon: z.string().min(1),
        label: z.string().min(1),
        href: z.string().optional(),
      }))
      .mutation(({ input }) => createAffiliate(input)),
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
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteAffiliate(input.id)),
  }),

  // ─── 히어로 슬라이드 관리 ───────────────────────────────────────────────────
  heroSlides: router({
    list: adminProcedure.query(() => getAllHeroSlides()),
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
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteHeroSlide(input.id)),
  }),

  // ─── 갤러리 관리 ────────────────────────────────────────────────────────────
  gallery: router({
    /** 갤러리 전체 목록 (관리자용, 숨김 포함) */
    list: adminProcedure.query(() => getAllGalleryItems()),
    /** 갤러리 사진 추가 */
    create: adminProcedure
      .input(z.object({
        imageUrl: z.string().min(1),
        caption: z.string().optional(),
        gridSpan: z.string().optional(),
      }))
      .mutation(({ input }) => createGalleryItem(input)),
    /** 갤러리 항목 수정 (캡션, 순서, 공개 여부, 그리드 크기) */
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        caption: z.string().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.boolean().optional(),
        gridSpan: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateGalleryItem(id, data);
      }),
    /** 갤러리 항목 삭제 */
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteGalleryItem(input.id)),
  }),

  // ─── 사이트 설정 관리 ───────────────────────────────────────────────────────
  settings: router({
    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(({ input }) => upsertSiteSetting(input.key, input.value)),
  }),

  // ─── 퀵메뉴 관리 ────────────────────────────────────────────────────────────
  quickMenus: router({
    list: adminProcedure.query(() => getAllQuickMenus()),
    create: adminProcedure
      .input(z.object({
        icon: z.string().min(1),
        label: z.string().min(1),
        href: z.string().optional(),
      }))
      .mutation(({ input }) => createQuickMenu(input)),
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
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteQuickMenu(input.id)),
    /** 퀵메뉴 순서 일괄 변경 */
    reorder: adminProcedure
      .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
      .mutation(({ input }) => reorderQuickMenus(input)),
  }),
});
