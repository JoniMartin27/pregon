import type { ChannelAdapter } from "../types";
import { plainText, truncate } from "../format";

const PDS = "https://bsky.social";

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
  async publish({ content, credentials }) {
    // 1) Crear sesión
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

    // 2) Crear post
    const text = truncate(plainText(content), 300);
    const recRes = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sess.accessJwt}`,
      },
      body: JSON.stringify({
        repo: sess.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
        },
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
