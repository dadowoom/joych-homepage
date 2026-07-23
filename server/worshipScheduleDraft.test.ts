import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  DEFAULT_WORSHIP_SCHEDULE_DRAFT,
  WORSHIP_SCHEDULE_LIMITS,
  cloneWorshipScheduleContent,
} from "@shared/worshipSchedule";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { worshipScheduleContentSchema } from "./routers/cms/worshipSchedule";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "user" | null): TrpcContext {
  const user: AuthenticatedUser | null = role
    ? {
        id: 1,
        openId: "worship-schedule-test",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "test",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("worship schedule draft validation", () => {
  it("accepts the administrator preview defaults", () => {
    const result = worshipScheduleContentSchema.safeParse(
      DEFAULT_WORSHIP_SCHEDULE_DRAFT,
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported card theme", () => {
    const draft = cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT);
    const invalid = {
      ...draft,
      sections: [{ ...draft.sections[0], theme: "black" }],
    };
    expect(worshipScheduleContentSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects empty worship names and times", () => {
    const draft = cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT);
    draft.sections[0].entries[0].label = " ";
    draft.sections[0].entries[0].time = "";
    expect(worshipScheduleContentSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects duplicate section and entry identifiers", () => {
    const duplicateSection = cloneWorshipScheduleContent(
      DEFAULT_WORSHIP_SCHEDULE_DRAFT,
    );
    duplicateSection.sections[1].id = duplicateSection.sections[0].id;
    expect(
      worshipScheduleContentSchema.safeParse(duplicateSection).success,
    ).toBe(false);

    const duplicateEntry = cloneWorshipScheduleContent(
      DEFAULT_WORSHIP_SCHEDULE_DRAFT,
    );
    duplicateEntry.sections[0].entries[1].id =
      duplicateEntry.sections[0].entries[0].id;
    expect(worshipScheduleContentSchema.safeParse(duplicateEntry).success).toBe(
      false,
    );
  });

  it("enforces the maximum number of cards", () => {
    const draft = cloneWorshipScheduleContent(DEFAULT_WORSHIP_SCHEDULE_DRAFT);
    draft.sections = Array.from(
      { length: WORSHIP_SCHEDULE_LIMITS.sections + 1 },
      (_, index) => ({
        ...draft.sections[0],
        id: `section_${index}`,
        entries: draft.sections[0].entries.map((entry, entryIndex) => ({
          ...entry,
          id: `entry_${index}_${entryIndex}`,
        })),
      }),
    );
    expect(worshipScheduleContentSchema.safeParse(draft).success).toBe(false);
  });

  it("blocks non-administrators from reading the private draft", async () => {
    const anonymousCaller = appRouter.createCaller(createContext(null));
    await expect(
      anonymousCaller.cms.worshipSchedule.getDraft(),
    ).rejects.toBeInstanceOf(TRPCError);

    const memberCaller = appRouter.createCaller(createContext("user"));
    try {
      await memberCaller.cms.worshipSchedule.getDraft();
      expect.fail("일반 사용자는 관리자 체험 초안을 조회할 수 없어야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});
