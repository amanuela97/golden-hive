import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

/** Plain bank details (never log or expose in full) */
export interface BankDetailsPlain {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
}

function getKey(): Buffer | null {
  const hex = process.env.BANK_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Encrypt bank details for storage. Uses AES-256-GCM.
 * Key: BANK_ENCRYPTION_KEY (32-byte hex).
 */
export function encryptBankDetails(details: BankDetailsPlain): string | null {
  const key = getKey();
  if (!key) return null;
  const payload = JSON.stringify({
    accountHolderName: details.accountHolderName.trim(),
    bankName: details.bankName.trim(),
    branchName: details.branchName.trim(),
    accountNumber: details.accountNumber.trim(),
  });
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, enc]);
  return combined.toString("hex");
}

/**
 * Decrypt bank details. Use only in admin payout flow; audit after.
 */
export function decryptBankDetails(encrypted: string | null | undefined): BankDetailsPlain | null {
  if (!encrypted?.trim()) return null;
  const key = getKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(encrypted, "hex");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const json = decipher.update(enc) + decipher.final("utf8");
    return JSON.parse(json) as BankDetailsPlain;
  } catch {
    return null;
  }
}

/** Mask account number for UI: ****6789 (last 4 visible) */
export function maskAccountNumber(accountNumber: string): string {
  const s = (accountNumber || "").trim().replace(/\D/g, "");
  if (s.length <= 4) return "****";
  return "*".repeat(Math.min(s.length - 4, 8)) + s.slice(-4);
}
