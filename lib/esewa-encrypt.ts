import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const PREFIX = "esewa_enc_v1:";

function getKey(): Buffer | null {
  const raw =
    process.env.ESEWA_ID_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
  if (!raw?.trim()) return null;
  return crypto.createHash("sha256").update(raw.trim()).digest();
}

/**
 * Encrypt plaintext eSewa ID for storage. Returns prefixed base64 string.
 * If no key is set, returns plaintext (no encryption).
 */
export function encryptEsewaId(plaintext: string): string {
  const key = getKey();
  if (!key || !plaintext) return plaintext;

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, enc]);
  return PREFIX + combined.toString("base64");
}

/**
 * Decrypt stored eSewa ID. If value has encryption prefix, decrypt; otherwise return as-is (legacy).
 */
export function decryptEsewaId(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  if (!value.startsWith(PREFIX)) return value;

  const key = getKey();
  if (!key) return value;

  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return value;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return value;
  }
}
