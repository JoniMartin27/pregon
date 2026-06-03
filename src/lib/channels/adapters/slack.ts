import type { ChannelAdapter } from "../types";
import { adaptContent } from "../adapt";

export const slack: ChannelAdapter = {
  id: "slack",
  name: "Slack",
  group: "chat",
  capability: "auto",
  emoji: "🟪",
  supportsMarkdown: true,
  credentialFields: [
    {
      key: "webhookUrl",
      label: "Incoming Webhook URL",
      type: "url",
      required: true,
      help: "api.slack.com/messaging/webhooks → crea un webhook entrante y pega la URL.",
    },
  ],
  async publish({ content, credentials }) {
    const a = adaptContent(content, "slack");
    const res = await fetch(credentials.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: a.text }),
    });
    if (!res.ok) {
      throw new Error(`Slack error ${res.status}: ${await res.text()}`);
    }
    return {};
  },
};
