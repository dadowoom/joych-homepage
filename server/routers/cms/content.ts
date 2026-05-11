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
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
  safeHrefSchema,
} from "../../_core/contentValidation";
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
  reorderGalleryItems,
  createQuickMenu,
  deleteQuickMenu,
} from "../../db";

const SETTING_KEYS = [
  "church_name",
  "church_name_en",
  "church_since",
  "denomination",
  "address",
  "tel",
  "fax",
  "youtube_url",
  "facebook_url",
  "instagram_url",
  "vision_title",
  "vision_desc",
] as const;

const iconClassSchema = z.string()
  .trim()
  .min(1, "아이콘을 선택해주세요.")
  .max(64, "아이콘 클래스는 64자 이하로 입력해주세요.")
  .regex(/^[a-z0-9 -]+$/i, "아이콘 클래스 형식이 올바르지 않습니다.");

const gridSpanSchema = z.enum([
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-2",
  "col-span-2 row-span-2",
]);
const gridSpanValueSchema = z.string().refine(
  value => gridSpanSchema.safeParse(value).success,
  "갤러리 그리드 형식이 올바르지 않습니다.",
);

const sortOrderSchema = z.number().int().min(0).max(10000).optional();

export const contentRouter = router({
  // ─── 관련기관 관리 ──────────────────────────────────────────────────────────
  affiliates: router({
    list: adminProcedure.query(() => getAllAffiliates()),
    create: adminProcedure
      .input(z.object({
        icon: iconClassSchema,
        label: requiredTextSchema(64, "이름을 입력해주세요."),
        href: safeHrefSchema.optional(),
      }))
      .mutation(({ input }) => createAffiliate(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: requiredTextSchema(64, "이름을 입력해주세요.").optional(),
        href: safeHrefSchema.optional(),
        icon: iconClassSchema.optional(),
        sortOrder: sortOrderSchema,
        isVisible: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateAffiliate(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteAffiliate(input.id)),
  }),

  // ─── 히어로 슬라이드 관리 ───────────────────────────────────────────────────
  heroSlides: router({
    list: adminProcedure.query(() => getAllHeroSlides()),
    create: adminProcedure
      .input(z.object({
        videoUrl: safeAssetUrlSchema.optional(),
        posterUrl: safeAssetUrlSchema.optional(),
        yearLabel: optionalTextSchema(64),
        mainTitle: optionalTextSchema(5000),
        subTitle: optionalTextSchema(5000),
        bibleRef: optionalTextSchema(128),
        btn1Text: optionalTextSchema(64),
        btn1Href: safeHrefSchema.optional(),
        btn2Text: optionalTextSchema(64),
        btn2Href: safeHrefSchema.optional(),
      }))
      .mutation(({ input }) => createHeroSlide(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        yearLabel: optionalTextSchema(64),
        mainTitle: optionalTextSchema(5000),
        subTitle: optionalTextSchema(5000),
        bibleRef: optionalTextSchema(128),
        btn1Text: optionalTextSchema(64),
        btn1Href: safeHrefSchema.optional(),
        btn2Text: optionalTextSchema(64),
        btn2Href: safeHrefSchema.optional(),
        videoUrl: safeAssetUrlSchema.optional(),
        posterUrl: safeAssetUrlSchema.optional(),
        isVisible: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateHeroSlide(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteHeroSlide(input.id)),
  }),

  // ─── 갤러리 관리 ────────────────────────────────────────────────────────────
  gallery: router({
    /** 갤러리 전체 목록 (관리자용, 숨김 포함) */
    list: adminProcedure.query(() => getAllGalleryItems()),
    /** 갤러리 사진 추가 */
    create: adminProcedure
      .input(z.object({
        imageUrl: safeAssetUrlSchema.refine(value => value.length > 0, "이미지를 선택해주세요."),
        caption: optionalTextSchema(128),
        gridSpan: gridSpanValueSchema.optional(),
      }))
      .mutation(({ input }) => createGalleryItem(input)),
    /** 갤러리 항목 수정 (캡션, 순서, 공개 여부, 그리드 크기) */
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        caption: optionalTextSchema(128),
        sortOrder: sortOrderSchema,
        isVisible: z.boolean().optional(),
        gridSpan: gridSpanValueSchema.optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateGalleryItem(id, data);
      }),
    /** 갤러리 항목 삭제 */
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteGalleryItem(input.id)),
    /** 갤러리 순서 일괄 변경 */
    reorder: adminProcedure
      .input(z.array(z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0).max(10000),
      })).max(500))
      .mutation(({ input }) => reorderGalleryItems(input)),
  }),

  // ─── 사이트 설정 관리 ───────────────────────────────────────────────────────
  settings: router({
    update: adminProcedure
      .input(z.object({
        key: z.string().refine(
          value => (SETTING_KEYS as readonly string[]).includes(value),
          "허용되지 않는 설정 키입니다.",
        ),
        value: z.string().trim().max(5000, "설정값은 5000자 이하로 입력해주세요."),
      }))
      .mutation(({ input }) => {
        const value = input.key.endsWith("_url")
          ? safeHrefSchema.parse(input.value)
          : input.value;
        return upsertSiteSetting(input.key, value);
      }),
  }),

  // ─── 퀵메뉴 관리 ────────────────────────────────────────────────────────────
  quickMenus: router({
    list: adminProcedure.query(() => getAllQuickMenus()),
    create: adminProcedure
      .input(z.object({
        icon: iconClassSchema,
        label: requiredTextSchema(64, "이름을 입력해주세요."),
        href: safeHrefSchema.optional(),
      }))
      .mutation(({ input }) => createQuickMenu(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        icon: iconClassSchema.optional(),
        label: requiredTextSchema(64, "이름을 입력해주세요.").optional(),
        href: safeHrefSchema.nullable().optional(),
        sortOrder: sortOrderSchema,
        isVisible: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateQuickMenu(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteQuickMenu(input.id)),
    /** 퀵메뉴 순서 일괄 변경 */
    reorder: adminProcedure
      .input(z.array(z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int().min(0).max(10000),
      })).max(500))
      .mutation(({ input }) => reorderQuickMenus(input)),
  }),
});
