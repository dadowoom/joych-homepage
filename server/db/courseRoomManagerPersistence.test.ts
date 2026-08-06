import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./connection", () => ({
  getDb: connectionMocks.getDb,
}));

import {
  createCourseRoomManager,
  deleteCourseRoomManager,
  getCourseRoomManagementPagesForMember,
} from "./course";

const CURRENT_DISCIPLE_HREF = "/page/교육신청-제자반";
const LEGACY_DISCIPLE_HREF = "/page/강좌-제자반";
const ALTERNATE_DISCIPLE_HREF = "/page/교육-신청-제자반";

describe("course room manager persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a new grant with the canonical room URL and searches every legacy alias", async () => {
    const selectWhere = vi.fn();
    const insertedValues = vi.fn();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((condition: unknown) => {
            selectWhere(condition);
            return { limit: vi.fn(async () => []) };
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertedValues(values);
          return { $returningId: vi.fn(async () => [{ id: 88 }]) };
        }),
      })),
    };
    connectionMocks.getDb.mockResolvedValue(db);

    await expect(createCourseRoomManager({
      memberId: 24,
      pageHref: LEGACY_DISCIPLE_HREF,
      canManage: true,
      createdBy: 1,
    })).resolves.toBe(88);

    expect(insertedValues).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 24,
      pageHref: CURRENT_DISCIPLE_HREF,
    }));
    const query = new MySqlDialect().sqlToQuery(selectWhere.mock.calls[0][0] as SQL);
    expect(query.params).toEqual(expect.arrayContaining([
      24,
      CURRENT_DISCIPLE_HREF,
      LEGACY_DISCIPLE_HREF,
      ALTERNATE_DISCIPLE_HREF,
    ]));
  });

  it("reactivates an existing alias grant instead of inserting a duplicate", async () => {
    const updatedValues = vi.fn();
    const insert = vi.fn();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 41,
              memberId: 24,
              pageHref: LEGACY_DISCIPLE_HREF,
              canManage: false,
            }]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: unknown) => {
          updatedValues(values);
          return { where: vi.fn(async () => undefined) };
        }),
      })),
      insert,
    };
    connectionMocks.getDb.mockResolvedValue(db);

    await expect(createCourseRoomManager({
      memberId: 24,
      pageHref: CURRENT_DISCIPLE_HREF,
      canManage: true,
      createdBy: 1,
    })).resolves.toBe(41);

    expect(updatedValues).toHaveBeenCalledWith({ canManage: true, createdBy: 1 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns one canonical management page when legacy and current rows coexist", async () => {
    const rows = [
      { pageHref: LEGACY_DISCIPLE_HREF },
      { pageHref: CURRENT_DISCIPLE_HREF },
      { pageHref: "/page/강좌-리더십반" },
    ];
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => rows),
          })),
        })),
      })),
    };
    connectionMocks.getDb.mockResolvedValue(db);

    await expect(getCourseRoomManagementPagesForMember(24)).resolves.toEqual([
      CURRENT_DISCIPLE_HREF,
      "/page/교육신청-리더십반",
    ]);
  });

  it("revokes every alias-equivalent row so an old duplicate cannot retain access", async () => {
    const deleteWhere = vi.fn();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              memberId: 24,
              pageHref: LEGACY_DISCIPLE_HREF,
            }]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async (condition: unknown) => {
          deleteWhere(condition);
        }),
      })),
    };
    connectionMocks.getDb.mockResolvedValue(db);

    await deleteCourseRoomManager(41);

    expect(deleteWhere).toHaveBeenCalledTimes(1);
    const query = new MySqlDialect().sqlToQuery(deleteWhere.mock.calls[0][0] as SQL);
    expect(query.params).toEqual(expect.arrayContaining([
      24,
      CURRENT_DISCIPLE_HREF,
      LEGACY_DISCIPLE_HREF,
      ALTERNATE_DISCIPLE_HREF,
    ]));
  });
});
