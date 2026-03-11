import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  checksum: string;
}

function getMasterKeyBuffer(masterKey: string): Buffer {
  const normalized = masterKey.trim();
  const buffer = Buffer.from(normalized, "base64url");

  if (buffer.length !== 32) {
    throw new Error("Master key must be a 32-byte base64url string");
  }

  return buffer;
}

export function generateMasterKey(): string {
  return randomBytes(32).toString("base64url");
}

export function encryptText(value: string, masterKey: string): EncryptedPayload {
  return encryptBuffer(Buffer.from(value, "utf8"), masterKey);
}

export function encryptBuffer(buffer: Buffer, masterKey: string): EncryptedPayload {
  const key = getMasterKeyBuffer(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export function decryptToBuffer(payload: EncryptedPayload, masterKey: string): Buffer {
  const key = getMasterKeyBuffer(masterKey);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]);
}

export function decryptToText(payload: EncryptedPayload, masterKey: string): string {
  return decryptToBuffer(payload, masterKey).toString("utf8");
}
