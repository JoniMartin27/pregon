import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, encryptJson, decryptJson } from "./crypto";
import crypto from "node:crypto";

const KEY = crypto.randomBytes(32).toString("base64");
let prev: string | undefined;

beforeEach(() => {
  prev = process.env.PREGON_MASTER_KEY;
  process.env.PREGON_MASTER_KEY = KEY;
});
afterEach(() => {
  if (prev === undefined) delete process.env.PREGON_MASTER_KEY;
  else process.env.PREGON_MASTER_KEY = prev;
});

describe("encrypt/decrypt (AES-256-GCM)", () => {
  it("hace round-trip de un texto", () => {
    const secret = "mi-contraseña-de-reddit";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produce formato iv.tag.ciphertext (3 partes base64)", () => {
    const parts = encrypt("hola").split(".");
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("usa IV aleatorio: el mismo texto cifra distinto cada vez", () => {
    const a = encrypt("repetido");
    const b = encrypt("repetido");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("falla al descifrar si el ciphertext está manipulado (tag GCM)", () => {
    const enc = encrypt("integridad");
    const [iv, tag, ct] = enc.split(".");
    // invertir el ciphertext rompe la verificación de autenticidad
    const tampered = [iv, tag, Buffer.from(ct, "base64").reverse().toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rechaza un payload con formato inválido", () => {
    expect(() => decrypt("solo-una-parte")).toThrow(/formato inválido/);
  });

  it("no descifra con otra clave", () => {
    const enc = encrypt("secreto");
    process.env.PREGON_MASTER_KEY = crypto.randomBytes(32).toString("base64");
    expect(() => decrypt(enc)).toThrow();
  });
});

describe("validación de la clave", () => {
  it("lanza si PREGON_MASTER_KEY no está definida", () => {
    delete process.env.PREGON_MASTER_KEY;
    expect(() => encrypt("x")).toThrow(/no está definida/);
  });

  it("lanza si la clave no son 32 bytes", () => {
    process.env.PREGON_MASTER_KEY = Buffer.from("corta").toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});

describe("encryptJson/decryptJson", () => {
  it("hace round-trip de un objeto de credenciales", () => {
    const creds = { username: "joni", password: "pw", clientId: "cid" };
    const enc = encryptJson(creds);
    expect(decryptJson(enc)).toEqual(creds);
  });
});
