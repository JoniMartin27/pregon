import type { PublishContent } from "./types";

/** Texto plano canónico: título + cuerpo + enlace. */
export function plainText(c: PublishContent): string {
  const parts: string[] = [];
  if (c.title) parts.push(c.title);
  parts.push(c.body);
  if (c.link) parts.push(c.link);
  return parts.join("\n\n");
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Recorta respetando un máximo, con elipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}
