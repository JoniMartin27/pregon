import crypto from "node:crypto";

// Cifrado de credenciales en reposo con AES-256-GCM.
// Formato de salida: "iv.tag.ciphertext" (todo en base64).

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.PREGON_MASTER_KEY;
  if (!b64) throw new Error("PREGON_MASTER_KEY no está definida en .env");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("PREGON_MASTER_KEY debe ser 32 bytes codificados en base64");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Credencial cifrada con formato inválido");
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJson<T = Record<string, string>>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
