import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoragePublicUrlBase } from "./storage";

let uploadDir: string;

async function fileExists(filePath: string) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  uploadDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "joych-storage-"));
  vi.stubEnv("UPLOAD_DIR", uploadDir);
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.promises.rm(uploadDir, { recursive: true, force: true });
});

describe("storage public URL base", () => {
  it.each([
    "https://joych.org",
    "https://www.joych.org/",
    "https://m.joych.org",
    "https://newjoych.co.kr",
    "https://www.newjoych.co.kr/",
  ])("uses the primary www origin for a known site alias: %s", configured => {
    expect(getStoragePublicUrlBase(configured)).toBe(
      "https://www.joych.org"
    );
  });

  it("preserves a custom deployment URL", () => {
    expect(getStoragePublicUrlBase("https://church.example.com/base/")).toBe(
      "https://church.example.com/base"
    );
  });

  it("preserves the local development URL", () => {
    expect(getStoragePublicUrlBase("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    );
  });

  it("atomically writes an uploaded file and preserves its public result", async () => {
    const { storagePut } = await import("./storage");

    await expect(storagePut("tests/sample.txt", "hello", "text/plain")).resolves.toMatchObject({
      key: "tests/sample.txt",
      url: expect.stringMatching(/\/uploads\/tests\/sample\.txt$/),
    });

    const targetPath = path.join(uploadDir, "tests", "sample.txt");
    expect(await fs.promises.readFile(targetPath, "utf-8")).toBe("hello");
    expect(await fs.promises.readdir(path.dirname(targetPath))).toEqual(["sample.txt"]);
  });

  it("preserves the existing overwrite behavior without leaving a temporary file", async () => {
    const { storagePut } = await import("./storage");
    const targetPath = path.join(uploadDir, "tests", "replace.txt");

    await storagePut("tests/replace.txt", "before", "text/plain");
    await storagePut("tests/replace.txt", "after", "text/plain");

    expect(await fs.promises.readFile(targetPath, "utf-8")).toBe("after");
    expect(await fs.promises.readdir(path.dirname(targetPath))).toEqual(["replace.txt"]);
  });

  it("rejects path traversal without creating files outside the upload directory", async () => {
    const { storagePut } = await import("./storage");
    const escapedName = `escape-${randomUUID()}.txt`;
    const escapedPath = path.join(path.dirname(uploadDir), escapedName);

    await expect(storagePut(`../${escapedName}`, "nope", "text/plain")).rejects.toThrow(
      "Invalid upload path"
    );

    expect(await fileExists(escapedPath)).toBe(false);
    expect(await fs.promises.readdir(uploadDir)).toEqual([]);
  });

  it("removes a partial temporary file when writing fails", async () => {
    const { storagePut } = await import("./storage");
    const originalWriteFile = fs.promises.writeFile.bind(fs.promises);
    vi.spyOn(fs.promises, "writeFile").mockImplementation(async filePath => {
      await originalWriteFile(filePath, "partial");
      throw new Error("write failed");
    });

    const targetPath = path.join(uploadDir, "tests", "write-failure.txt");
    await expect(storagePut("tests/write-failure.txt", "hello", "text/plain")).rejects.toThrow(
      "write failed"
    );

    expect(await fileExists(targetPath)).toBe(false);
    expect(await fs.promises.readdir(path.dirname(targetPath))).toEqual([]);
  });

  it("removes the completed temporary file when the atomic rename fails", async () => {
    const { storagePut } = await import("./storage");
    vi.spyOn(fs.promises, "rename").mockRejectedValue(new Error("rename failed"));

    const targetPath = path.join(uploadDir, "tests", "rename-failure.txt");
    await expect(storagePut("tests/rename-failure.txt", "hello", "text/plain")).rejects.toThrow(
      "rename failed"
    );

    expect(await fileExists(targetPath)).toBe(false);
    expect(await fs.promises.readdir(path.dirname(targetPath))).toEqual([]);
  });
});
