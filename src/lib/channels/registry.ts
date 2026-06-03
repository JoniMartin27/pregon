import type { ChannelAdapter, ChannelGroup } from "./types";
import { telegram } from "./adapters/telegram";
import { discord } from "./adapters/discord";
import { slack } from "./adapters/slack";
import { mastodon } from "./adapters/mastodon";
import { bluesky } from "./adapters/bluesky";
import { devto } from "./adapters/devto";
import {
  x,
  threads,
  linkedin,
  reddit,
  hackernews,
  lobsters,
  indiehackers,
} from "./adapters/assisted";
import { plannedAdapters } from "./adapters/planned";

export const ADAPTERS: ChannelAdapter[] = [
  // 🟢 auto (API)
  telegram, discord, slack, mastodon, bluesky, devto,
  // 🟡 asistido (URL pre-cargada)
  x, threads, reddit, hackernews, lobsters, linkedin, indiehackers,
  // 🔴 próximamente
  ...plannedAdapters,
];

const BY_ID = new Map(ADAPTERS.map((a) => [a.id, a]));

export function getAdapter(id: string): ChannelAdapter | undefined {
  return BY_ID.get(id);
}

export type Readiness = "auto" | "assisted" | "planned";

/** Estado real según lo que está implementado, no solo lo deseado. */
export function readiness(a: ChannelAdapter): Readiness {
  if (a.publish) return "auto";
  if (a.composeUrl) return "assisted";
  return "planned";
}

export const GROUPS: { id: ChannelGroup; label: string }[] = [
  { id: "social", label: "Redes sociales" },
  { id: "dev", label: "Comunidades dev" },
  { id: "chat", label: "Chat / Comunidad" },
  { id: "launch", label: "Lanzamientos" },
];
