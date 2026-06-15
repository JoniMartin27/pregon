// Helper compartido para los scripts de Reddit (radar / salud / planificador).
// Reutiliza las credenciales cifradas de la cuenta `reddit` conectada en Pregón
// y la app tipo "script" (password grant) que ya usa el adapter de publicación.
//
// NOTA ÉTICA: todo lo que hay aquí usa la API OFICIAL de Reddit para LEER
// (búsqueda, estado de hilos) y para PUBLICAR contenido tuyo de forma espaciada.
// No vota, no crea cuentas, no automatiza karma artificial: eso es manipulación
// y te gana un shadowban. El karma real es subproducto de aportar valor.
import { prisma } from "../../src/lib/db";
import { decryptJson } from "../../src/lib/crypto";

export interface RedditCreds {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  subreddit?: string;
}

export interface RedditAccount {
  id: string;
  creds: RedditCreds;
}

export function ua(username: string): string {
  return `web:pregon-radar:0.1 (by /u/${username || "pregon"})`;
}

/** Carga la cuenta `reddit` activa y descifra sus credenciales. */
export async function loadRedditAccount(): Promise<RedditAccount> {
  const account = await prisma.account.findFirst({
    where: { channel: "reddit", status: "active" },
  });
  if (!account) {
    throw new Error(
      "No hay cuenta reddit conectada. Conéctala en localhost:4040/accounts " +
        "(crea antes una app 'script' en reddit.com/prefs/apps).",
    );
  }
  return { id: account.id, creds: decryptJson<RedditCreds>(account.credentials) };
}

/** OAuth password-grant: devuelve un bearer token de la API oficial. */
export async function getToken(creds: RedditCreds): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": ua(creds.username),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: creds.username,
      password: creds.password,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ? `Reddit auth: ${json.error}` : `Reddit auth error ${res.status}`);
  }
  return json.access_token;
}

/** GET autenticado contra oauth.reddit.com. Devuelve el JSON parseado. */
export async function authedGet<T = unknown>(
  path: string,
  token: string,
  username: string,
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://oauth.reddit.com${path}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, "user-agent": ua(username) },
  });
  if (!res.ok) throw new Error(`Reddit GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Espera ms milisegundos (para respetar el rate-limit de la API: ~1 req/s). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Envía un aviso por Telegram si hay cuenta conectada; si no, lo imprime. */
export async function notify(text: string): Promise<void> {
  const tg = await prisma.account.findFirst({
    where: { channel: "telegram", status: "active" },
  });
  if (!tg) {
    console.log("\n[sin cuenta Telegram — aviso por consola]\n" + text);
    return;
  }
  const creds = decryptJson<{ botToken: string; chatId: string }>(tg.credentials);
  // Telegram limita a 4096 chars por mensaje; trocea si hace falta.
  for (let i = 0; i < text.length; i += 3900) {
    const chunk = text.slice(i, i + 3900);
    const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: creds.chatId, text: chunk, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { description?: string };
      throw new Error(j.description ?? `Telegram error ${res.status}`);
    }
    await sleep(400);
  }
}
