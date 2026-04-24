import { afterEach, describe, expect, it } from "vitest";
import { decryptJsonString, encryptJsonString } from "@/lib/security/encryption";

const previousKey = process.env.APP_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = previousKey;
  }
});

describe("security helpers", () => {
  it("encrypts and decrypts sensitive session payloads", () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

    const plain = JSON.stringify({ cookies: [{ name: "session", value: "top-secret" }] });
    const encrypted = encryptJsonString(plain);

    expect(encrypted).not.toContain("top-secret");
    expect(JSON.parse(decryptJsonString(encrypted))).toEqual(JSON.parse(plain));
  });
});
