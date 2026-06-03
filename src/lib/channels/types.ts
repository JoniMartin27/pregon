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
}

export interface MetricSnapshot {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  score?: number;
  raw?: string;
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
  /** ASISTIDO: construye una URL pre-cargada para abrir en el navegador. */
  composeUrl?: (content: PublishContent) => string;
  assistHint?: string;
  /** Trae métricas de engagement (opcional). */
  fetchMetrics?: (args: FetchMetricsArgs) => Promise<MetricSnapshot>;
}
