import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  DEFAULT_WORSHIP_SCHEDULE_DRAFT,
  WORSHIP_SCHEDULE_DRAFT_SETTING_KEY,
  WORSHIP_SCHEDULE_ICONS,
  WORSHIP_SCHEDULE_LIMITS,
  WORSHIP_SCHEDULE_THEMES,
  cloneWorshipScheduleContent,
} from "@shared/worshipSchedule";
import { compareAndSwapSiteSetting, getSiteSetting } from "../../db";
import { adminProcedure, router } from "../../_core/trpc";

const draftIdSchema = z
  .string()
  .trim()
  .min(1, "항목 식별자가 없습니다.")
  .max(64, "항목 식별자는 64자 이하로 입력해주세요.")
  .regex(/^[A-Za-z0-9_-]+$/, "항목 식별자 형식이 올바르지 않습니다.");

const requiredDraftText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `${max}자 이하로 입력해주세요.`);

const entrySchema = z
  .object({
    id: draftIdSchema,
    label: requiredDraftText(
      WORSHIP_SCHEDULE_LIMITS.label,
      "예배 이름을 입력해주세요.",
    ),
    time: requiredDraftText(
      WORSHIP_SCHEDULE_LIMITS.time,
      "예배 시간을 입력해주세요.",
    ),
    note: z.string().trim().max(WORSHIP_SCHEDULE_LIMITS.note),
  })
  .strict();

const sectionSchema = z
  .object({
    id: draftIdSchema,
    title: requiredDraftText(
      WORSHIP_SCHEDULE_LIMITS.title,
      "예배 블록 제목을 입력해주세요.",
    ),
    theme: z.enum(WORSHIP_SCHEDULE_THEMES),
    icon: z.enum(WORSHIP_SCHEDULE_ICONS),
    entries: z
      .array(entrySchema)
      .min(1, "예배시간을 한 개 이상 등록해주세요.")
      .max(
        WORSHIP_SCHEDULE_LIMITS.entriesPerSection,
        `한 블록에는 예배시간을 최대 ${WORSHIP_SCHEDULE_LIMITS.entriesPerSection}개까지 등록할 수 있습니다.`,
      )
      .refine(
        entries => new Set(entries.map(entry => entry.id)).size === entries.length,
        "같은 예배시간 식별자가 중복되었습니다.",
      ),
  })
  .strict();

export const worshipScheduleContentSchema = z
  .object({
    sections: z
      .array(sectionSchema)
      .min(1, "예배 블록을 한 개 이상 등록해주세요.")
      .max(
        WORSHIP_SCHEDULE_LIMITS.sections,
        `예배 블록은 최대 ${WORSHIP_SCHEDULE_LIMITS.sections}개까지 등록할 수 있습니다.`,
      )
      .refine(
        sections => new Set(sections.map(section => section.id)).size === sections.length,
        "같은 예배 블록 식별자가 중복되었습니다.",
      ),
    notice: z.string().trim().max(WORSHIP_SCHEDULE_LIMITS.notice),
  })
  .strict();

const storedDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.string().uuid(),
    updatedAt: z.string().datetime(),
    updatedBy: z.string().max(160),
    content: worshipScheduleContentSchema,
  })
  .strict();

type StoredDraft = z.infer<typeof storedDraftSchema>;

function parseStoredDraft(value: string | null | undefined): StoredDraft | null {
  if (!value) return null;
  try {
    const parsed = storedDraftSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function defaultDraftResponse() {
  return {
    content: cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT),
    revision: null,
    updatedAt: null,
    updatedBy: null,
  };
}

export const worshipScheduleRouter = router({
  /**
   * 최고관리자 체험용 초안입니다.
   * 공개 `/worship/schedule`에서는 이 값을 읽지 않으므로 저장해도 공개 화면은 바뀌지 않습니다.
   */
  getDraft: adminProcedure.query(async () => {
    const row = await getSiteSetting(WORSHIP_SCHEDULE_DRAFT_SETTING_KEY);
    if (!row) return defaultDraftResponse();
    const stored = parseStoredDraft(row.settingValue);
    if (!stored) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "저장된 예배시간 체험 초안의 형식을 확인할 수 없습니다. 기존 자료 보호를 위해 개발 담당자에게 확인해 주세요.",
      });
    }
    return {
      content: stored.content,
      revision: stored.revision,
      updatedAt: stored.updatedAt,
      updatedBy: stored.updatedBy,
    };
  }),

  saveDraft: adminProcedure
    .input(
      z.object({
        content: worshipScheduleContentSchema,
        expectedRevision: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const row = await getSiteSetting(WORSHIP_SCHEDULE_DRAFT_SETTING_KEY);
      const current = row ? parseStoredDraft(row.settingValue) : null;
      if (row && !current) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "저장된 예배시간 체험 초안의 형식을 확인할 수 없습니다. 기존 자료 보호를 위해 저장을 중단했습니다.",
        });
      }
      const currentRevision = current?.revision ?? null;

      if (currentRevision !== input.expectedRevision) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "다른 창이나 기기에서 초안이 먼저 수정되었습니다. 서버 초안을 다시 불러온 뒤 수정해주세요.",
        });
      }

      const stored: StoredDraft = {
        schemaVersion: 1,
        revision: randomUUID(),
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user.name ?? ctx.user.email ?? "관리자",
        content: input.content,
      };
      const storedValue = JSON.stringify(stored);
      if (Buffer.byteLength(storedValue, "utf8") > 60_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "예배시간 체험 초안의 전체 내용이 너무 큽니다.",
        });
      }

      const saveResult = await compareAndSwapSiteSetting(
        WORSHIP_SCHEDULE_DRAFT_SETTING_KEY,
        row?.settingValue ?? null,
        storedValue,
      );
      if (saveResult === "conflict") {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "다른 창이나 기기에서 초안이 먼저 수정되었습니다. 서버 초안을 다시 불러온 뒤 수정해 주세요.",
        });
      }
      if (saveResult === "unavailable") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "예배시간 체험 초안을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
      return {
        content: stored.content,
        revision: stored.revision,
        updatedAt: stored.updatedAt,
        updatedBy: stored.updatedBy,
      };
    }),
});
