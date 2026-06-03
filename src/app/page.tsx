import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ADAPTERS,
  GROUPS,
  readiness,
  type Readiness,
} from "@/lib/channels/registry";

export const dynamic = "force-dynamic";

const READINESS_LABEL: Record<Readiness, string> = {
  auto: "Auto",
  assisted: "Asistido",
  planned: "Próximamente",
};

const READINESS_STYLE: Record<Readiness, string> = {
  auto: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400",
  assisted: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400",
  planned: "bg-zinc-500/15 text-zinc-500 ring-zinc-500/30 dark:text-zinc-400",
};

export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  const counts = {
    auto: ADAPTERS.filter((a) => readiness(a) === "auto").length,
    assisted: ADAPTERS.filter((a) => readiness(a) === "assisted").length,
    planned: ADAPTERS.filter((a) => readiness(a) === "planned").length,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <section className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Centro de difusión</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Redacta una vez, publica en todas tus comunidades y lleva el registro de
          cada post.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Proyectos" value={projects.length} />
          <Stat label="Canales auto" value={counts.auto} tone="emerald" />
          <Stat label="Asistidos" value={counts.assisted} tone="amber" />
          <Stat label="Próximamente" value={counts.planned} tone="zinc" />
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Proyectos
          </h2>
          <Link
            href="/compose"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Componer →
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No hay proyectos. Ejecuta <code>npm run db:seed</code> para cargarlos.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color ?? "#a1a1aa" }}
                  />
                  <h3 className="font-medium">{p.name}</h3>
                </div>
                {p.description && (
                  <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {p.description}
                  </p>
                )}
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-indigo-500 hover:underline"
                  >
                    {prettyUrl(p.url)}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Canales ({ADAPTERS.length})
        </h2>
        <div className="space-y-7">
          {GROUPS.map((g) => {
            const items = ADAPTERS.filter((a) => a.group === g.id);
            if (items.length === 0) return null;
            return (
              <div key={g.id}>
                <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {g.label}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => {
                    const r = readiness(a);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <span className="text-xl leading-none">{a.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{a.name}</div>
                          {a.maxLength ? (
                            <div className="text-xs text-zinc-500">
                              {a.maxLength} caracteres
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${READINESS_STYLE[r]}`}
                        >
                          {READINESS_LABEL[r]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "indigo",
}: {
  label: string;
  value: number;
  tone?: "indigo" | "emerald" | "amber" | "zinc";
}) {
  const toneStyle: Record<string, string> = {
    indigo: "text-indigo-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    zinc: "text-zinc-500",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`text-2xl font-semibold ${toneStyle[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function prettyUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
