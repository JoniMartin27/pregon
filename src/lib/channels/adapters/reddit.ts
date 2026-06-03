import type { ChannelAdapter, PublishContent, Credentials } from "../types";
import { adaptContent } from "../adapt";

// Reddit vía API con una app tipo "script" (password grant, uso personal).
// Soporta crear posts (en un subreddit por defecto) y comentar en un hilo.
// Mantiene composeUrl como fallback asistido si no hay cuenta conectada.

function ua(creds: Credentials): string {
  return `web:pregon:0.1 (by /u/${creds.username ?? "pregon"})`;
}

async function getToken(creds: Credentials): Promise<string> {
  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": ua(creds),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: creds.username,
      password: creds.password,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ? `Reddit auth: ${json.error}` : `Reddit auth error ${res.status}`);
  }
  return json.access_token as string;
}

function fullnameFromUrl(url: string): string | null {
  const m = url.match(/comments\/([a-z0-9]+)/i);
  return m ? `t3_${m[1]}` : null;
}

export const reddit: ChannelAdapter = {
  id: "reddit",
  name: "Reddit",
  group: "dev",
  capability: "auto",
  emoji: "👽",
  credentialFields: [
    { key: "clientId", label: "Client ID", type: "text", required: true, help: "reddit.com/prefs/apps → crea una app tipo 'script' → el id está bajo el nombre." },
    { key: "clientSecret", label: "Client secret", type: "password", required: true, help: "El 'secret' de tu app script." },
    { key: "username", label: "Usuario de Reddit", type: "text", required: true },
    { key: "password", label: "Contraseña de Reddit", type: "password", required: true, help: "La app 'script' usa password grant. Se guarda cifrada (AES-256-GCM)." },
    { key: "subreddit", label: "Subreddit por defecto", type: "text", help: "Para publicar posts (ej. SideProject). Para comentar no hace falta." },
  ],
  assistHint: "Sin cuenta conectada, abre el envío de Reddit con título y enlace.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "reddit");
    const params = new URLSearchParams();
    const title = a.title ?? c.body?.slice(0, 300);
    if (title) params.set("title", title);
    if (a.link) params.set("url", a.link);
    return `https://www.reddit.com/submit?${params.toString()}`;
  },
  async publish({ content, credentials, kind, targetUrl }) {
    const at = await getToken(credentials);
    const headers = {
      authorization: `Bearer ${at}`,
      "user-agent": ua(credentials),
      "content-type": "application/x-www-form-urlencoded",
    };

    // Comentar en un hilo existente.
    if (kind === "comment") {
      if (!targetUrl) throw new Error("Falta la URL del hilo para comentar");
      const parent = fullnameFromUrl(targetUrl);
      if (!parent) throw new Error("URL de hilo de Reddit no válida");
      const res = await fetch("https://oauth.reddit.com/api/comment", {
        method: "POST",
        headers,
        body: new URLSearchParams({ api_type: "json", thing_id: parent, text: content.body }),
      });
      const json = await res.json().catch(() => ({}));
      const errs = json?.json?.errors;
      if (!res.ok || (errs && errs.length)) {
        throw new Error(errs?.[0]?.join(" ") ?? `Reddit comment error ${res.status}`);
      }
      const thing = json?.json?.data?.things?.[0]?.data;
      return {
        externalId: thing?.name,
        externalUrl: thing?.permalink ? `https://www.reddit.com${thing.permalink}` : undefined,
      };
    }

    // Crear un post en el subreddit por defecto.
    const a = adaptContent(content, "reddit");
    const sub = (credentials.subreddit ?? "").replace(/^\/?r\//i, "").trim();
    if (!sub) throw new Error("Configura un subreddit por defecto para publicar");
    const body = new URLSearchParams({
      api_type: "json",
      sr: sub,
      title: a.title ?? content.body.slice(0, 300),
    });
    if (a.link) {
      body.set("kind", "link");
      body.set("url", a.link);
    } else {
      body.set("kind", "self");
      body.set("text", a.text);
    }
    const res = await fetch("https://oauth.reddit.com/api/submit", { method: "POST", headers, body });
    const json = await res.json().catch(() => ({}));
    const errs = json?.json?.errors;
    if (!res.ok || (errs && errs.length)) {
      throw new Error(errs?.[0]?.join(" ") ?? `Reddit submit error ${res.status}`);
    }
    return { externalId: json?.json?.data?.name, externalUrl: json?.json?.data?.url };
  },
};
