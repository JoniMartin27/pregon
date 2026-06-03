import type { ChannelAdapter } from "../types";

export const devto: ChannelAdapter = {
  id: "devto",
  name: "dev.to",
  group: "dev",
  capability: "auto",
  emoji: "📝",
  supportsMarkdown: true,
  credentialFields: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      required: true,
      help: "dev.to → Settings → Extensions → DEV API Keys → genera una key.",
    },
  ],
  async publish({ content, credentials }) {
    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": credentials.apiKey },
      body: JSON.stringify({
        article: {
          title: content.title ?? "(sin título)",
          published: true,
          body_markdown: content.body + (content.link ? `\n\n${content.link}` : ""),
          tags: (content.tags ?? []).slice(0, 4),
          canonical_url: content.link,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `dev.to error ${res.status}`);
    return {
      externalId: json.id ? String(json.id) : undefined,
      externalUrl: json.url,
    };
  },
};
