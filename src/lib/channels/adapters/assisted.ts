import type { ChannelAdapter, PublishContent } from "../types";

// Canales sin API de publicación abierta: abrimos el compositor con el texto
// pre-cargado vía URL (intent / submit). El usuario publica y pega el enlace.

const enc = encodeURIComponent;

export const x: ChannelAdapter = {
  id: "x",
  name: "X (Twitter)",
  group: "social",
  capability: "assisted",
  emoji: "𝕏",
  maxLength: 280,
  credentialFields: [],
  assistHint:
    "Abre el compositor de X con el texto cargado. Publica y pega el enlace para registrarlo.",
  composeUrl(c: PublishContent) {
    const text = [c.title, c.body].filter(Boolean).join(" — ");
    const params = new URLSearchParams({ text });
    if (c.link) params.set("url", c.link);
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  },
};

export const threads: ChannelAdapter = {
  id: "threads",
  name: "Threads",
  group: "social",
  capability: "assisted",
  emoji: "🧵",
  maxLength: 500,
  credentialFields: [],
  assistHint: "Abre Threads con el texto cargado.",
  composeUrl(c: PublishContent) {
    const text = [c.title, c.body, c.link].filter(Boolean).join("\n\n");
    return `https://www.threads.net/intent/post?text=${enc(text)}`;
  },
};

export const linkedin: ChannelAdapter = {
  id: "linkedin",
  name: "LinkedIn",
  group: "social",
  capability: "assisted",
  emoji: "💼",
  credentialFields: [],
  assistHint:
    "LinkedIn solo pre-carga el enlace; pega el texto manualmente al abrir el compositor.",
  composeUrl(c: PublishContent) {
    if (c.link) {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(c.link)}`;
    }
    return "https://www.linkedin.com/feed/?shareActive=true";
  },
};

export const reddit: ChannelAdapter = {
  id: "reddit",
  name: "Reddit",
  group: "dev",
  capability: "assisted",
  emoji: "👽",
  credentialFields: [],
  assistHint:
    "Abre el formulario de envío de Reddit con título y enlace cargados. Elige el subreddit.",
  composeUrl(c: PublishContent) {
    const params = new URLSearchParams();
    if (c.title) params.set("title", c.title);
    if (c.link) params.set("url", c.link);
    return `https://www.reddit.com/submit?${params.toString()}`;
  },
};

export const hackernews: ChannelAdapter = {
  id: "hackernews",
  name: "Hacker News",
  group: "launch",
  capability: "assisted",
  emoji: "🟧",
  credentialFields: [],
  assistHint:
    "Abre 'submit' de HN con título y URL. Para Show HN antepón 'Show HN:' al título.",
  composeUrl(c: PublishContent) {
    const params = new URLSearchParams();
    if (c.link) params.set("u", c.link);
    if (c.title) params.set("t", c.title);
    return `https://news.ycombinator.com/submitlink?${params.toString()}`;
  },
};

export const lobsters: ChannelAdapter = {
  id: "lobsters",
  name: "Lobste.rs",
  group: "dev",
  capability: "assisted",
  emoji: "🦞",
  credentialFields: [],
  assistHint: "Abre el envío de Lobste.rs con la URL cargada (requiere cuenta/invitación).",
  composeUrl(c: PublishContent) {
    const params = new URLSearchParams();
    if (c.link) params.set("url", c.link);
    if (c.title) params.set("title", c.title);
    return `https://lobste.rs/stories/new?${params.toString()}`;
  },
};

export const indiehackers: ChannelAdapter = {
  id: "indiehackers",
  name: "Indie Hackers",
  group: "launch",
  capability: "assisted",
  emoji: "🧑‍💻",
  credentialFields: [],
  assistHint: "Abre el editor de Indie Hackers (no admite pre-carga: pega el texto).",
  composeUrl() {
    return "https://www.indiehackers.com/new-post";
  },
};
