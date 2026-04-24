import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

type EncryptionEnvelope = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

function getEncryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing APP_ENCRYPTION_KEY");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

export function isAppEncryptionConfigured() {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptJsonString(plainText: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptionEnvelope = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };

  return JSON.stringify(envelope);
}

export function decryptJsonString(payload: string) {
  const parsed = JSON.parse(payload) as Partial<EncryptionEnvelope>;
  if (parsed.alg !== ENCRYPTION_ALGORITHM || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) {
    return payload;
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(parsed.data, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
