import type { ChannelAdapter, PublishContent } from "@/lib/channels/types";

/** Forma mínima de un Post que necesitamos para construir contenido. */
export type PostLike = {
  kind: string;
  title: string | null;
  body: string;
  link: string | null;
  targetUrl: string | null;
  tags: string | null;
};

/** Construye el contenido canónico a partir de un Post. */
export function buildContent(post: PostLike): PublishContent {
  let tags: string[] | undefined;
  if (post.tags) {
    try {
      const parsed = JSON.parse(post.tags);
      if (Array.isArray(parsed)) tags = parsed.map(String);
    } catch {
      tags = undefined;
    }
  }
  return {
    title: post.title ?? undefined,
    body: post.body,
    link: post.link ?? undefined,
    tags,
  };
}

/**
 * URL para el modo asistido:
 * - comentar  -> abrir el hilo destino (pegas el comentario allí).
 * - postear   -> compositor de la plataforma pre-cargado.
 * Devuelve null si el canal no soporta modo asistido.
 */
export function openUrlFor(
  adapter: ChannelAdapter,
  post: PostLike,
  content: PublishContent,
): string | null {
  if (post.kind === "comment") return post.targetUrl ?? null;
  if (adapter.composeUrl) return adapter.composeUrl(content);
  return null;
}
