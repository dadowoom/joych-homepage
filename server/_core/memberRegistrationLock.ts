import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { normalizeMemberPhone } from "@shared/memberPhone";

const registrationTails = new Map<string, Promise<void>>();

export class MemberRegistrationBusyError extends Error {
  constructor() {
    super("같은 가입 정보를 처리 중입니다. 잠시 후 다시 시도해주세요.");
    this.name = "MemberRegistrationBusyError";
  }
}

async function withDatabaseRegistrationLock<T>(identityKey: string, task: () => Promise<T>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return task();

  const digest = createHash("sha256").update(identityKey).digest("hex").slice(0, 40);
  const lockKey = `member-registration:${digest}`;
  const connection = await mysql.createConnection({ uri: databaseUrl, timezone: "+09:00" });
  let acquired = false;

  try {
    const [rows] = await connection.execute("SELECT GET_LOCK(?, 10) AS locked", [lockKey]);
    const firstRow = Array.isArray(rows) ? rows[0] as { locked?: number | string } | undefined : undefined;
    acquired = Number(firstRow?.locked) === 1;
    if (!acquired) throw new MemberRegistrationBusyError();
    return await task();
  } finally {
    if (acquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [lockKey]).catch(() => undefined);
    }
    await connection.end();
  }
}

/**
 * 이름+연락처가 같은 가입 요청을 서버 메모리와 DB advisory lock으로 직렬화합니다.
 * 일반가입과 간편가입, 여러 서버 프로세스가 같은 잠금 키를 사용합니다.
 */
export async function withMemberRegistrationIdentityLock<T>(
  name: string,
  phone: string,
  task: () => Promise<T>,
): Promise<T> {
  const normalizedPhone = normalizeMemberPhone(phone);
  const key = `${name.trim()}\u0000${normalizedPhone ?? phone.trim()}`;
  const previous = registrationTails.get(key) ?? Promise.resolve();

  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  registrationTails.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await withDatabaseRegistrationLock(key, task);
  } finally {
    release();
    if (registrationTails.get(key) === tail) {
      registrationTails.delete(key);
    }
  }
}
