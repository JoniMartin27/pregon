import type { ChannelAdapter } from "../types";
import { plainText, truncate } from "../format";

export const telegram: ChannelAdapter = {
  id: "telegram",
  name: "Telegram",
  group: "chat",
  capability: "auto",
  emoji: "✈️",
  maxLength: 4096,
  supportsMarkdown: true,
  supportsImages: true,
  credentialFields: [
    {
      key: "botToken",
      label: "Bot token",
      type: "password",
      required: true,
      help: "Crea un bot con @BotFather y pega el token.",
    },
    {
      key: "chatId",
      label: "Chat ID",
      type: "text",
      required: true,
      help: "Canal/grupo/chat destino (ej. @micanal o -100123…).",
    },
  ],
  async publish({ content, credentials, meta }) {
    const text = truncate(plainText(content), 4096);
    const res = await fetch(
      `https://api.telegram.org/bot${credentials.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: credentials.chatId, text }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.description ?? `Telegram error ${res.status}`);
    }
    const messageId = json.result?.message_id;
    const username = meta?.channelUsername;
    return {
      externalId: messageId != null ? String(messageId) : undefined,
      externalUrl:
        username && messageId ? `https://t.me/${username}/${messageId}` : undefined,
    };
  },
};
