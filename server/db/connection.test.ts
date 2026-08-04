import { describe, expect, it } from "vitest";
import { getSafeDatabaseErrorMetadata } from "./connection";

describe("database connection error logging", () => {
  it("keeps only a conventional error name and database error code", () => {
    const error = Object.assign(new Error("mysql://user:secret@db.example/church"), {
      code: "ER_ACCESS_DENIED_ERROR",
    });

    expect(getSafeDatabaseErrorMetadata(error)).toEqual({
      name: "Error",
      code: "ER_ACCESS_DENIED_ERROR",
    });
  });

  it("rejects arbitrary metadata that could contain connection details", () => {
    const error = {
      name: "mysql://user:secret@db.example/church",
      code: "mysql://user:secret@db.example/church",
      message: "DATABASE_URL=mysql://user:secret@db.example/church",
    };

    const metadata = getSafeDatabaseErrorMetadata(error);
    expect(metadata).toEqual({ name: "Error", code: "UNKNOWN" });
    expect(JSON.stringify(metadata)).not.toContain("secret");
    expect(JSON.stringify(metadata)).not.toContain("mysql://");
  });
});
