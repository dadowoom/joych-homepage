import { afterEach, describe, expect, it, vi } from "vitest";

const mysqlMocks = vi.hoisted(() => ({
  createConnection: vi.fn(),
}));

vi.mock("mysql2/promise", () => ({
  default: { createConnection: mysqlMocks.createConnection },
}));

import { withMemberRegistrationIdentityLock } from "./_core/memberRegistrationLock";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("member registration identity lock", () => {
  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    vi.clearAllMocks();
  });

  it("하이픈 유무가 다른 같은 이름·연락처 요청을 동시에 실행하지 않는다", async () => {
    const events: string[] = [];
    let releaseFirst = () => {};
    let markFirstStarted = () => {};
    const firstWait = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = withMemberRegistrationIdentityLock("동일성도", "01012345678", async () => {
      events.push("first:start");
      markFirstStarted();
      await firstWait;
      events.push("first:end");
      return 1;
    });
    const second = withMemberRegistrationIdentityLock("동일성도", "010-1234-5678", async () => {
      events.push("second:start");
      return 2;
    });

    await firstStarted;
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("운영 DB가 있으면 프로세스 간 advisory lock도 획득하고 해제한다", async () => {
    process.env.DATABASE_URL = "mysql://test:test@localhost/test";
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ locked: 1 }], []])
      .mockResolvedValueOnce([[], []]);
    const end = vi.fn().mockResolvedValue(undefined);
    mysqlMocks.createConnection.mockResolvedValue({ execute, end });

    await expect(withMemberRegistrationIdentityLock(
      "동일성도",
      "010-1234-5678",
      async () => "created",
    )).resolves.toBe("created");

    expect(execute).toHaveBeenNthCalledWith(1, "SELECT GET_LOCK(?, 10) AS locked", [
      expect.stringMatching(/^member-registration:[a-f0-9]{40}$/),
    ]);
    expect(execute).toHaveBeenNthCalledWith(2, "SELECT RELEASE_LOCK(?)", [
      expect.stringMatching(/^member-registration:[a-f0-9]{40}$/),
    ]);
    expect(end).toHaveBeenCalledOnce();
  });
});
