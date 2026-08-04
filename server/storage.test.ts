import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoragePublicUrlBase, storagePut } from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
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

  it("writes uploaded files with asynchronous filesystem operations", async () => {
    const mkdir = vi.spyOn(fs.promises, "mkdir").mockImplementation(async () => undefined);
    const writeFile = vi.spyOn(fs.promises, "writeFile").mockImplementation(async () => undefined);

    await expect(storagePut("tests/sample.txt", "hello", "text/plain")).resolves.toMatchObject({
      key: "tests/sample.txt",
    });

    expect(mkdir).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]uploads[\\/]tests[\\/]sample\.txt$/),
      "hello",
      "utf-8"
    );
  });
});
