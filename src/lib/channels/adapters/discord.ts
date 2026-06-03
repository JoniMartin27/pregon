import type { ChannelAdapter } from "../types";
import { adaptContent } from "../adapt";

export const discord: ChannelAdapter = {
  id: "discord",
  name: "Discord",
  group: "chat",
  capability: "auto",
  emoji: "💬",
  maxLength: 2000,
  supportsMarkdown: true,
  supportsImages: true,
  credentialFields: [
    {
      key: "webhookUrl",
      label: "Webhook URL",
      type: "url",
      required: true,
      help: "Ajustes del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL.",
    },
  ],
  async publish({ content, credentials }) {
    const a = adaptContent(content, "discord");
    const res = await fetch(`${credentials.webhookUrl}?wait=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: a.text }),
    });
    if (!res.ok) {
      throw new Error(`Discord error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json().catch(() => ({}));
    return { externalId: json.id ? String(json.id) : undefined };
  },
};
