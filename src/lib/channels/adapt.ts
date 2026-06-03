import type { PublishContent } from "./types";

// Motor de adaptación por plataforma: dado el contenido canónico y un canal,
// produce el payload óptimo para ese canal (longitud, título, hashtags, enlace).
// Pure y sin dependencias -> usable en servidor (adapters) y cliente (preview).

export type Adapted = {
  /** Cuerpo final, listo para enviar/mostrar. */
  text: string;
  /** Título si el canal tiene campo título separado. */
  title?: string;
  /** Tags si el canal tiene campo de tags. */
  tags?: string[];
  /** Enlace si el canal lo lleva en un campo aparte (url field / intent param). */
  link?: string;
  /** Longitud contada según las reglas del canal (incluye peso del enlace en X). */
  length: number;
  /** Límite efectivo del cuerpo (undefined si el límite aplica al título o no hay). */
  limit?: number;
  overLimit: boolean;
  /** Adaptaciones aplicadas, legibles para el usuario. */
  notes: string[];
};

type Profile = {
  limit?: number;
  urlWeight?: number; // un enlace cuenta como N chars (X = 23 vía t.co)
  titleMode: "separate" | "inline";
  linkMode: "separate" | "inline" | "none";
  hashtags: "append" | "tagsField" | "none";
};

const PROFILES: Record<string, Profile> = {
  x: { limit: 280, urlWeight: 23, titleMode: "inline", linkMode: "separate", hashtags: "append" },
  threads: { limit: 500, titleMode: "inline", linkMode: "inline", hashtags: "append" },
  mastodon: { limit: 500, titleMode: "inline", linkMode: "inline", hashtags: "append" },
  bluesky: { limit: 300, titleMode: "inline", linkMode: "inline", hashtags: "append" },
  linkedin: { limit: 3000, titleMode: "inline", linkMode: "inline", hashtags: "append" },
  telegram: { limit: 4096, titleMode: "inline", linkMode: "inline", hashtags: "none" },
  discord: { limit: 2000, titleMode: "inline", linkMode: "inline", hashtags: "none" },
  slack: { titleMode: "inline", linkMode: "inline", hashtags: "none" },
  devto: { titleMode: "separate", linkMode: "separate", hashtags: "tagsField" },
  hashnode: { titleMode: "separate", linkMode: "separate", hashtags: "tagsField" },
  reddit: { limit: 300, titleMode: "separate", linkMode: "separate", hashtags: "none" },
  hackernews: { limit: 80, titleMode: "separate", linkMode: "separate", hashtags: "none" },
  lobsters: { titleMode: "separate", linkMode: "separate", hashtags: "none" },
  indiehackers: { titleMode: "inline", linkMode: "inline", hashtags: "none" },
};

const DEFAULT: Profile = { titleMode: "inline", linkMode: "inline", hashtags: "append" };

export function profileFor(channelId: string): Profile {
  return PROFILES[channelId] ?? DEFAULT;
}

function countLen(text: string, p: Profile): number {
  if (p.urlWeight) {
    return text.replace(/https?:\/\/\S+/g, "u".repeat(p.urlWeight)).length;
  }
  return text.length;
}

function hashtagize(tags: string[]): string {
  return tags
    .map((t) => "#" + t.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((t) => t.length > 1)
    .join(" ");
}

function trimTo(s: string, max: number, p: Profile): string {
  if (max <= 0) return "";
  if (countLen(s, p) <= max) return s;
  let out = s;
  while (out.length > 0 && countLen(out, p) > max - 1) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

export function adaptContent(content: PublishContent, channelId: string): Adapted {
  const p = profileFor(channelId);
  const notes: string[] = [];
  const title = content.title?.trim();
  const link = content.link?.trim();
  const tags = (content.tags ?? []).map((t) => t.trim()).filter(Boolean);

  let outTitle: string | undefined;
  let outLink: string | undefined;
  let outTags: string[] | undefined;

  const parts: string[] = [];
  if (title) {
    if (p.titleMode === "separate") outTitle = title;
    else parts.push(title);
  }
  if (content.body?.trim()) parts.push(content.body.trim());

  if (link) {
    if (p.linkMode === "inline") parts.push(link);
    else if (p.linkMode === "separate") {
      outLink = link;
      notes.push("enlace en campo aparte");
    }
  }

  let hashtagSuffix = "";
  if (tags.length) {
    if (p.hashtags === "append") {
      hashtagSuffix = hashtagize(tags);
      if (hashtagSuffix) notes.push("tags → hashtags");
    } else if (p.hashtags === "tagsField") {
      outTags = tags
        .slice(0, 4)
        .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter(Boolean);
      if (outTags.length) notes.push("tags → campo de tags");
    } else {
      notes.push("tags omitidos aquí");
    }
  }

  let body = parts.join("\n\n");

  const bodyLimited = p.titleMode === "inline";
  const limit = p.limit;
  const linkCost = outLink && p.urlWeight ? p.urlWeight + 1 : 0;

  if (limit && bodyLimited) {
    const suffixLen = hashtagSuffix ? countLen("\n\n" + hashtagSuffix, p) : 0;
    const budget = limit - suffixLen - linkCost;
    if (countLen(body, p) > budget) {
      body = trimTo(body, budget, p);
      notes.push(`recortado a ${limit}`);
    }
  }

  const text = hashtagSuffix ? (body ? body + "\n\n" + hashtagSuffix : hashtagSuffix) : body;

  if (p.titleMode === "separate" && outTitle && limit && outTitle.length > limit) {
    notes.push(`título excede ${limit}`);
  }

  const length = countLen(text, p) + linkCost;
  const effLimit = bodyLimited ? limit : undefined;
  const overLimit = effLimit ? length > effLimit : false;

  return { text, title: outTitle, tags: outTags, link: outLink, length, limit: effLimit, overLimit, notes };
}
