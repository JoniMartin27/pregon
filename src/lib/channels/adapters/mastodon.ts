import type { ChannelAdapter } from "../types";
import { adaptContent } from "../adapt";

/** Parsea la URL de un status (`https://inst/@user/123` o `https://inst/users/user/statuses/123`). */
export function parseMastodonStatusUrl(url: string): { origin: string; id: string } | null {
  const m = url
    .trim()
    .match(/^(https?:\/\/[^/?#]+)\/(?:@[^/?#]+|users\/[^/?#]+\/statuses)\/(\d+)\/?(?:[?#].*)?$/i);
  return m ? { origin: m[1].toLowerCase(), id: m[2] } : null;
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Mastodon error ${res.status}`);
  return json;
}

/**
 * Id LOCAL (en nuestra instancia) del status destino y acct de su autor.
 * Si el status es de la propia instancia basta leerlo; si es de otra, se
 * resuelve por búsqueda federada (`resolve=true`) para obtener su copia local.
 */
async function resolveStatus(
  instance: string,
  token: string,
  targetUrl: string,
): Promise<{ id: string; acct: string }> {
  const parsed = parseMastodonStatusUrl(targetUrl);
  if (!parsed) throw new Error(`URL de Mastodon no reconocida: ${targetUrl}`);

  if (parsed.origin === instance.toLowerCase()) {
    const st = await getJson(`${instance}/api/v1/statuses/${parsed.id}`, token);
    if (!st?.id) throw new Error(`No existe el status de Mastodon ${targetUrl}`);
    return { id: String(st.id), acct: st.account?.acct ?? "" };
  }

  const q = new URLSearchParams({ q: targetUrl, type: "statuses", resolve: "true", limit: "1" });
  let statuses: Array<{ id?: string | number; account?: { acct?: string } }> | undefined;
  try {
    statuses = (await getJson(`${instance}/api/v2/search?${q}`, token)).statuses;
  } catch (e) {
    // Típico: token sin `read:search`. Sin búsqueda no hay id local, así que se
    // explica la alternativa en vez de fallar en seco.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Mastodon no pudo resolver el hilo remoto ${targetUrl} (${msg}). ` +
        `Usa la URL del hilo tal y como se ve desde tu instancia ` +
        `(${instance}/@usuario@remoto/<id>) o amplía el token con el scope read:search.`,
    );
  }
  const st = statuses?.[0];
  if (!st?.id) throw new Error(`Mastodon no pudo resolver el hilo ${targetUrl}`);
  return { id: String(st.id), acct: st.account?.acct ?? "" };
}

export const mastodon: ChannelAdapter = {
  id: "mastodon",
  name: "Mastodon",
  group: "social",
  capability: "auto",
  emoji: "🐘",
  maxLength: 500,
  supportsImages: true,
  credentialFields: [
    {
      key: "instanceUrl",
      label: "Instancia",
      type: "url",
      required: true,
      help: "URL de tu instancia, ej. https://mastodon.social",
    },
    {
      key: "accessToken",
      label: "Access token",
      type: "password",
      required: true,
      help: "Preferencias → Desarrollo → Nueva app (scope write:statuses) → token de acceso.",
    },
  ],
  async resolveTarget({ targetUrl, credentials }) {
    const instance = credentials.instanceUrl.replace(/\/+$/, "");
    const st = await resolveStatus(instance, credentials.accessToken, targetUrl);
    return { id: st.id, author: st.acct || undefined };
  },
  async publish({ content, credentials, kind, targetUrl }) {
    // Fail-fast: una URL de hilo inválida no debe llegar a la API.
    if (kind === "comment" && (!targetUrl || !parseMastodonStatusUrl(targetUrl))) {
      throw new Error(`URL de Mastodon no reconocida: ${targetUrl ?? "(vacía)"}`);
    }

    const instance = credentials.instanceUrl.replace(/\/+$/, "");
    const a = adaptContent(content, "mastodon");
    const payload: Record<string, unknown> = { status: a.text };

    if (kind === "comment" && targetUrl) {
      const st = await resolveStatus(instance, credentials.accessToken, targetUrl);
      payload.in_reply_to_id = st.id;
      // Sin la mención el autor no recibe la respuesta (la web la añade sola; la API no).
      const mention = st.acct ? `@${st.acct}` : "";
      if (mention && !a.text.includes(mention)) payload.status = `${mention} ${a.text}`;
    }

    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Mastodon error ${res.status}`);
    return {
      externalId: json.id ? String(json.id) : undefined,
      externalUrl: json.url,
    };
  },
};
