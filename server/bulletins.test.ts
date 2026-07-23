import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  archiveBulletin: vi.fn(),
  createBulletinWithImages: vi.fn(),
  listAdminBulletins: vi.fn(),
  updateBulletin: vi.fn(),
  updateBulletinWithImages: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  storageDelete: vi.fn(),
  storageDeleteByUrl: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  ...dbMocks,
}));

vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./storage")>()),
  ...storageMocks,
}));

import { bulletinsRouter } from "./routers/cms/bulletins";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    memberId: null,
    memberName: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createUser(options: {
  role?: "admin" | "user";
  contentPermissions?: string[];
} = {}): AuthenticatedUser {
  const role = options.role ?? "admin";
  return {
    id: 1,
    openId: `bulletins-${role}`,
    email: `${role}@example.com`,
    name: role,
    loginMethod: "test",
    role,
    contentPermissions: options.contentPermissions,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

const file = (fileName: string) => ({
  fileName,
  mimeType: "image/jpeg",
  base64: Buffer.from(fileName).toString("base64"),
});

describe("bulletin page editing API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.updateBulletin.mockResolvedValue(undefined);
    dbMocks.updateBulletinWithImages.mockResolvedValue({
      status: "updated",
      deletedFileUrls: [],
    });
    storageMocks.storageDelete.mockResolvedValue(true);
    storageMocks.storageDeleteByUrl.mockResolvedValue(true);
    storageMocks.storagePut.mockResolvedValue({
      key: "ignored-by-router",
      url: "https://www.joych.org/uploads/bulletins/replacement.jpg",
    });
  });

  it("keeps page editing behind the bulletin-content permission", async () => {
    const caller = bulletinsRouter.createCaller(createContext(createUser({
      role: "user",
      contentPermissions: [],
    })));

    await expect(caller.update({
      id: 42,
      images: [{ existingImageId: 1 }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateBulletinWithImages).not.toHaveBeenCalled();
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
  });

  it("sends the final mixed page order to one database mutation and deletes only removed files", async () => {
    const removedUrl = "https://www.joych.org/uploads/bulletins/old-page-3.jpg";
    dbMocks.updateBulletinWithImages.mockResolvedValue({
      status: "updated",
      deletedFileUrls: [removedUrl],
    });
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      title: "수정 주보",
      images: [
        { existingImageId: 11 },
        { existingImageId: 12 },
        { file: file("replacement-page-3.jpg") },
        { existingImageId: 14 },
      ],
    })).resolves.toEqual({ ok: true });

    expect(dbMocks.updateBulletinWithImages).toHaveBeenCalledWith(
      42,
      { title: "수정 주보" },
      [
        { existingImageId: 11 },
        { existingImageId: 12 },
        {
          image: {
            fileName: "replacement-page-3.jpg",
            fileUrl: "https://www.joych.org/uploads/bulletins/replacement.jpg",
            fileSize: Buffer.byteLength("replacement-page-3.jpg"),
            fileMime: "image/jpeg",
          },
        },
        { existingImageId: 14 },
      ],
    );
    expect(storageMocks.storageDeleteByUrl).toHaveBeenCalledWith(removedUrl);
    expect(storageMocks.storageDelete).not.toHaveBeenCalled();
  });

  it("rejects deleting every page before uploading or mutating the database", async () => {
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      images: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateBulletinWithImages).not.toHaveBeenCalled();
    expect(storageMocks.storagePut).not.toHaveBeenCalled();
  });

  it("cleans up earlier uploads when a later page upload fails", async () => {
    storageMocks.storagePut
      .mockResolvedValueOnce({
        key: "ignored-by-router",
        url: "https://www.joych.org/uploads/bulletins/first.jpg",
      })
      .mockRejectedValueOnce(new Error("disk full"));
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      images: [
        { file: file("first.jpg") },
        { file: file("second.jpg") },
      ],
    })).rejects.toThrow("disk full");

    expect(storageMocks.storageDelete).toHaveBeenCalledOnce();
    expect(storageMocks.storageDelete).toHaveBeenCalledWith(
      expect.stringMatching(/^bulletins\/.+-0-.+first\.jpg$/),
    );
    expect(dbMocks.updateBulletinWithImages).not.toHaveBeenCalled();
  });

  it("cleans up new uploads when the database transaction fails", async () => {
    dbMocks.updateBulletinWithImages.mockRejectedValue(new Error("transaction rolled back"));
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      images: [{ file: file("replacement.jpg") }],
    })).rejects.toThrow("transaction rolled back");

    expect(storageMocks.storageDelete).toHaveBeenCalledWith(
      expect.stringMatching(/^bulletins\/.+-0-.+replacement\.jpg$/),
    );
  });

  it("cleans up new uploads when existing page ownership validation fails", async () => {
    dbMocks.updateBulletinWithImages.mockResolvedValue({
      status: "invalid_image_ids",
      invalidImageIds: [999],
      deletedFileUrls: [],
    });
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      images: [
        { existingImageId: 999 },
        { file: file("replacement.jpg") },
      ],
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(storageMocks.storageDelete).toHaveBeenCalledOnce();
    expect(storageMocks.storageDeleteByUrl).not.toHaveBeenCalled();
  });

  it("does not roll back a committed edit when old-file cleanup fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMocks.updateBulletinWithImages.mockResolvedValue({
      status: "updated",
      deletedFileUrls: ["https://www.joych.org/uploads/bulletins/old.jpg"],
    });
    storageMocks.storageDeleteByUrl.mockRejectedValue(new Error("temporary unlink failure"));
    const caller = bulletinsRouter.createCaller(createContext(createUser()));

    await expect(caller.update({
      id: 42,
      images: [{ existingImageId: 1 }],
    })).resolves.toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
