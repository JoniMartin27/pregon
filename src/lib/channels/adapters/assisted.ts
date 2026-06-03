import type { ChannelAdapter, PublishContent } from "../types";
import { adaptContent } from "../adapt";

// Canales sin API de publicación abierta: abrimos el compositor con el texto
// ya adaptado a la plataforma vía URL (intent / submit). El usuario publica y
// pega el enlace para registrarlo.

export const x: ChannelAdapter = {
  id: "x",
  name: "X (Twitter)",
  group: "social",
  capability: "assisted",
  emoji: "𝕏",
  maxLength: 280,
  credentialFields: [],
  assistHint:
    "Abre el compositor de X con el texto adaptado (≤280, link como adjunto). Publica y pega el enlace.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "x");
    const params = new URLSearchParams({ text: a.text });
    if (a.link) params.set("url", a.link);
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
  assistHint: "Abre Threads con el texto adaptado cargado.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "threads");
    return `https://www.threads.net/intent/post?text=${encodeURIComponent(a.text)}`;
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
    "LinkedIn solo pre-carga el enlace; pega el texto adaptado manualmente al abrir el compositor.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "linkedin");
    if (a.link) {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(a.link)}`;
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
    "Abre el envío de Reddit con título y enlace cargados. Elige el subreddit.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "reddit");
    const params = new URLSearchParams();
    const title = a.title ?? c.body?.slice(0, 300);
    if (title) params.set("title", title);
    if (a.link) params.set("url", a.link);
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
    "Abre 'submit' de HN con título (≤80) y URL. Para Show HN antepón 'Show HN:' al título.",
  composeUrl(c: PublishContent) {
    const a = adaptContent(c, "hackernews");
    const params = new URLSearchParams();
    if (a.link) params.set("u", a.link);
    if (a.title) params.set("t", a.title);
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
    const a = adaptContent(c, "lobsters");
    const params = new URLSearchParams();
    if (a.link) params.set("url", a.link);
    if (a.title) params.set("title", a.title);
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
