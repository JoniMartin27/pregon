import { prisma } from "@/lib/db";
import { ADAPTERS, GROUPS, readiness } from "@/lib/channels/registry";
import { ComposeForm } from "./ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const [projects, accounts] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { status: "active" } }),
  ]);
  const connected = new Set(accounts.map((a) => a.channel));

  // Canales utilizables: auto o asistido (excluimos 'planned').
  const channels = ADAPTERS.filter((a) => readiness(a) !== "planned").map((a) => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    group: a.group as string,
    mode: readiness(a) as "auto" | "assisted",
    maxLength: a.maxLength ?? null,
    connected: connected.has(a.id),
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Componer</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Escribe una vez y elige a dónde va. Los canales <b>auto</b> publican por API;
        los <b>asistidos</b> abren el compositor con el texto cargado (lo registras en Historial).
      </p>
      <ComposeForm
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        channels={channels}
        groups={GROUPS.map((g) => ({ id: g.id as string, label: g.label }))}
      />
    </div>
  );
}
