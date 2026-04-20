/**
 * 콘텐츠 관리 라우터 (cms.content)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - affiliates: 관련기관 관리
 *   - heroSlides: 히어로 슬라이드 관리
 *   - gallery: 갤러리 관리
 *   - settings: 사이트 설정 관리
 *   - quickMenus: 퀵메뉴 관리
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  getAllAffiliates,
  updateAffiliate,
  getAllHeroSlides,
  updateHeroSlide,
  createHeroSlide,
  deleteHeroSlide,
  updateGalleryItem,
  upsertSiteSetting,
  getAllQuickMenus,
  updateQuickMenu,
  reorderQuickMenus,
} from "../../db";

export const contentRouter = router({
  // ─── 관련기관 관리 ──────────────────────────────────────────────────────────
  affiliates: router({
    /** 관련기관 전체 목록 */
    list: adminProcedure.query(() => getAllAffiliates()),

    /** 관련기관 정보 수정 (이름, 링크, 아이콘, 순서, 공개 여부) */
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

  // ─── 히어로 슬라이드 관리 ───────────────────────────────────────────────────
  heroSlides: router({
    /** 히어로 슬라이드 전체 목록 (숨김 포함) */
    list: adminProcedure.query(() => getAllHeroSlides()),

    /** 히어로 슬라이드 생성 */
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

    /** 히어로 슬라이드 수정 */
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

    /** 히어로 슬라이드 삭제 */
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteHeroSlide(input.id)),
  }),

  // ─── 갤러리 관리 ────────────────────────────────────────────────────────────
  gallery: router({
    /** 갤러리 항목 수정 (캡션, 순서, 공개 여부) */
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

  // ─── 사이트 설정 관리 ───────────────────────────────────────────────────────
  settings: router({
    /**
     * 사이트 설정 값 저장
     * - key: 설정 키 (예: 'church_name', 'church_address')
     * - value: 설정 값
     */
    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(({ input }) => upsertSiteSetting(input.key, input.value)),
  }),

  // ─── 퀵메뉴 관리 ────────────────────────────────────────────────────────────
  quickMenus: router({
    /** 퀵메뉴 전체 목록 */
    list: adminProcedure.query(() => getAllQuickMenus()),

    /** 퀵메뉴 수정 (아이콘, 이름, 링크, 순서, 공개 여부) */
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

    /** 퀵메뉴 순서 일괄 변경 */
    reorder: adminProcedure
      .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
      .mutation(({ input }) => reorderQuickMenus(input)),
  }),
});
