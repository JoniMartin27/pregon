import type { ChannelAdapter, ChannelGroup, Capability } from "../types";

// Canales en el catálogo pero aún sin wiring (publish/composeUrl). Se muestran
// como "próximamente" para reflejar el alcance completo de la herramienta.

function stub(p: {
  id: string;
  name: string;
  group: ChannelGroup;
  emoji: string;
  capability: Capability;
  note?: string;
}): ChannelAdapter {
  return {
    id: p.id,
    name: p.name,
    group: p.group,
    emoji: p.emoji,
    capability: p.capability,
    credentialFields: [],
    assistHint: p.note,
  };
}

export const plannedAdapters: ChannelAdapter[] = [
  stub({ id: "hashnode", name: "Hashnode", group: "dev", emoji: "🔷", capability: "auto", note: "API GraphQL — auto (próximamente)." }),
  stub({ id: "producthunt", name: "Product Hunt", group: "launch", emoji: "😺", capability: "assisted", note: "El lanzamiento es manual; la API solo lee métricas." }),
  stub({ id: "betalist", name: "BetaList", group: "launch", emoji: "📋", capability: "assisted", note: "Envío manual de startups." }),
  stub({ id: "peerlist", name: "Peerlist", group: "launch", emoji: "🟩", capability: "assisted", note: "Envío manual." }),
  stub({ id: "whatsapp", name: "WhatsApp", group: "chat", emoji: "💚", capability: "assisted", note: "Grupos no soportados por API; difícil de automatizar." }),
];
