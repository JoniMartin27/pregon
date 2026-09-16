// Tipos del sistema de canales (patrón adapter).

export type Capability = "auto" | "assisted";
export type ChannelGroup = "social" | "dev" | "chat" | "launch";

/** Campo de credencial que el usuario rellena para conectar una cuenta. */
export interface CredentialField {
  key: string;
  label: string;
  help?: string;
  type?: "text" | "password" | "url";
  required?: boolean;
}

/** Contenido canónico a publicar (ya resuelto para un canal concreto). */
export interface PublishContent {
  title?: string;
  body: string;
  link?: string;
  tags?: string[];
  images?: string[];
}

export interface PublishResult {
  externalId?: string;
  externalUrl?: string;
}

export type Credentials = Record<string, string>;
export type AccountMeta = Record<string, string>;

export interface PublishArgs {
  content: PublishContent;
  credentials: Credentials;
  meta?: AccountMeta;
  /** "post" (crear) o "comment" (responder a un hilo). Por defecto "post". */
  kind?: "post" | "comment";
  /** URL del hilo destino cuando kind === "comment". */
  targetUrl?: string;
}

export interface MetricSnapshot {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  score?: number;
  raw?: string;
}

export interface ResolveTargetArgs {
  targetUrl: string;
  credentials: Credentials;
  meta?: AccountMeta;
}

export interface ResolvedTarget {
  /** Id nativo del hilo destino (at-uri en Bluesky, id local en Mastodon). */
  id: string;
  /** Autor del hilo (handle / acct), si la plataforma lo devuelve. */
  author?: string;
}

export interface FetchMetricsArgs {
  credentials: Credentials;
  meta?: AccountMeta;
  externalId: string;
}

/** Contrato común que implementa cada canal. */
export interface ChannelAdapter {
  id: string;
  name: string;
  group: ChannelGroup;
  capability: Capability;
  emoji: string;
  maxLength?: number;
  supportsMarkdown?: boolean;
  supportsImages?: boolean;
  credentialFields: CredentialField[];
  /** AUTO: publica vía API y devuelve id/permalink. */
  publish?: (args: PublishArgs) => Promise<PublishResult>;
  /**
   * AUTO + comentarios: comprueba que el hilo destino existe y devuelve su id
   * (y el autor si se conoce) SIN publicar nada. Sirve de ensayo previo.
   */
  resolveTarget?: (args: ResolveTargetArgs) => Promise<ResolvedTarget>;
  /** ASISTIDO: construye una URL pre-cargada para abrir en el navegador. */
  composeUrl?: (content: PublishContent) => string;
  assistHint?: string;
  /** Trae métricas de engagement (opcional). */
  fetchMetrics?: (args: FetchMetricsArgs) => Promise<MetricSnapshot>;
}
