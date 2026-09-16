import type { ChannelAdapter, Credentials } from "../types";
import { adaptContent } from "../adapt";

const PDS = "https://bsky.social";

type StrongRef = { uri: string; cid: string };
type ReplyRefs = { root: StrongRef; parent: StrongRef; author?: string };

/** Parsea una URL pública de bsky.app (`/profile/<handle|did>/post/<rkey>`). */
export function parseBlueskyPostUrl(url: string): { actor: string; rkey: string } | null {
  const m = url
    .trim()
    .match(/^https?:\/\/(?:www\.)?bsky\.app\/profile\/([^/?#]+)\/post\/([A-Za-z0-9._~-]+)\/?(?:[?#].*)?$/i);
  return m ? { actor: m[1], rkey: m[2] } : null;
}

async function login(credentials: Credentials) {
  const sessRes = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: credentials.identifier,
      password: credentials.appPassword,
    }),
  });
  const sess = await sessRes.json().catch(() => ({}));
  if (!sessRes.ok) throw new Error(sess.message ?? `Bluesky login error ${sessRes.status}`);
  return sess as { accessJwt: string; did: string; handle?: string };
}

async function getJson(url: string, jwt: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${jwt}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Bluesky error ${res.status}`);
  return json;
}

/**
 * Resuelve el hilo destino de un comentario: parent = el post de la URL,
 * root = la raíz de su hilo (o él mismo si ya es raíz).
 */
async function resolveReplyRefs(targetUrl: string, jwt: string): Promise<ReplyRefs> {
  const parsed = parseBlueskyPostUrl(targetUrl);
  if (!parsed) throw new Error(`URL de Bluesky no reconocida: ${targetUrl}`);

  let did = parsed.actor;
  if (!did.startsWith("did:")) {
    const r = await getJson(
      `${PDS}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(did)}`,
      jwt,
    );
    if (typeof r.did !== "string") throw new Error(`Bluesky no resolvió el handle ${did}`);
    did = r.did;
  }

  const uri = `at://${did}/app.bsky.feed.post/${parsed.rkey}`;
  const r = await getJson(`${PDS}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, jwt);
  const post = r.posts?.[0];
  if (!post?.cid) throw new Error(`No existe el post de Bluesky ${uri}`);

  const parent: StrongRef = { uri: post.uri ?? uri, cid: post.cid };
  const root = post.record?.reply?.root;
  return {
    root: root?.uri && root?.cid ? { uri: root.uri, cid: root.cid } : parent,
    parent,
    author: post.author?.handle,
  };
}

export const bluesky: ChannelAdapter = {
  id: "bluesky",
  name: "Bluesky",
  group: "social",
  capability: "auto",
  emoji: "🦋",
  maxLength: 300,
  supportsImages: true,
  credentialFields: [
    {
      key: "identifier",
      label: "Handle o email",
      type: "text",
      required: true,
      help: "Tu handle, ej. joni.bsky.social",
    },
    {
      key: "appPassword",
      label: "App password",
      type: "password",
      required: true,
      help: "Ajustes → App passwords → crea una contraseña de app (no tu contraseña real).",
    },
  ],
  async resolveTarget({ targetUrl, credentials }) {
    if (!parseBlueskyPostUrl(targetUrl)) {
      throw new Error(`URL de Bluesky no reconocida: ${targetUrl}`);
    }
    const sess = await login(credentials);
    const refs = await resolveReplyRefs(targetUrl, sess.accessJwt);
    return { id: refs.parent.uri, author: refs.author };
  },
  async publish({ content, credentials, kind, targetUrl }) {
    // Fail-fast: una URL de hilo inválida no debe ni abrir sesión.
    if (kind === "comment" && (!targetUrl || !parseBlueskyPostUrl(targetUrl))) {
      throw new Error(`URL de Bluesky no reconocida: ${targetUrl ?? "(vacía)"}`);
    }

    const sess = await login(credentials);

    const a = adaptContent(content, "bluesky");
    const record: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text: a.text,
      createdAt: new Date().toISOString(),
    };
    if (kind === "comment" && targetUrl) {
      const refs = await resolveReplyRefs(targetUrl, sess.accessJwt);
      record.reply = { root: refs.root, parent: refs.parent };
    }

    const recRes = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sess.accessJwt}`,
      },
      body: JSON.stringify({
        repo: sess.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });
    const rec = await recRes.json().catch(() => ({}));
    if (!recRes.ok) throw new Error(rec.message ?? `Bluesky post error ${recRes.status}`);

    const rkey = typeof rec.uri === "string" ? rec.uri.split("/").pop() : undefined;
    const handle = sess.handle ?? credentials.identifier;
    return {
      externalId: rec.uri,
      externalUrl: rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : undefined,
    };
  },
};
