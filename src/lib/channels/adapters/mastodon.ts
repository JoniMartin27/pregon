import type { ChannelAdapter } from "../types";
import { adaptContent } from "../adapt";

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
  async publish({ content, credentials }) {
    const instance = credentials.instanceUrl.replace(/\/+$/, "");
    const a = adaptContent(content, "mastodon");
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({ status: a.text }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Mastodon error ${res.status}`);
    return {
      externalId: json.id ? String(json.id) : undefined,
      externalUrl: json.url,
    };
  },
};
