import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/channels/registry";
import {
  addProjectNote,
  deleteProjectNote,
  updateProjectLinks,
  captureNow,
} from "@/lib/actions";
import { npmDownloads, pypiDownloads, githubStats } from "@/lib/traction";

export const dynamic = "force-dynamic";

const NOTE_KIND: Record<string, { label: string; cls: string }> = {
  message: { label: "mensaje", cls: "bg-indigo-500/15 text-indigo-500" },
  decision: { label: "decisión", cls: "bg-sky-500/15 text-sky-500" },
  idea: { label: "idea", cls: "bg-amber-500/15 text-amber-500" },
  todo: { label: "pendiente", cls: "bg-rose-500/15 text-rose-500" },
  note: { label: "nota", cls: "bg-zinc-500/15 text-zinc-400" },
};

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      posts: { orderBy: { createdAt: "desc" }, include: { publications: true } },
      snapshots: { orderBy: { capturedAt: "asc" }, take: 90 },
    },
  });
  if (!project) notFound();

  const [npm, pypi, gh] = await Promise.all([
    project.npmPackage ? npmDownloads(project.npmPackage) : Promise.resolve(null),
    project.pypiPackage ? pypiDownloads(project.pypiPackage) : Promise.resolve(null),
    project.githubRepo ? githubStats(project.githubRepo) : Promise.resolve(null),
  ]);

  const series = (key: "npmWeekly" | "pypiWeekly" | "githubStars") =>
    project.snapshots
      .map((s) => s[key])
      .filter((v): v is number => v != null);

  const allPubs = project.posts.flatMap((p) => p.publications);
  const published = allPubs.filter((p) => p.status === "published").length;
  const channelsUsed = new Set(allPubs.map((p) => p.channel)).size;
  const fmt = (n: number) => n.toLocaleString("es-ES");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/" className="text-xs text-zinc-500 hover:text-foreground">
        ← Proyectos
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: project.color ?? "#a1a1aa" }}
        />
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
      </div>
      {project.description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.description}</p>
      )}
      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-500 hover:underline"
        >
          {project.url}
        </a>
      )}

      {/* Tracción */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Tracción {project.snapshots.length > 0 && `· ${project.snapshots.length} snapshots`}
        </span>
        <form action={captureNow}>
          <input type="hidden" name="slug" value={project.slug} />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs hover:border-indigo-400 dark:border-zinc-700"
          >
            📸 Capturar ahora
          </button>
        </form>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Publicado" value={String(published)} hint={`${channelsUsed} canales`} />
        {project.npmPackage && (
          <Stat
            label="npm / sem"
            value={npm ? fmt(npm.weekly) : "—"}
            hint={npm ? "⬇ descargas" : "sin datos"}
            tone="indigo"
            series={series("npmWeekly")}
          />
        )}
        {project.pypiPackage && (
          <Stat
            label="PyPI / sem"
            value={pypi ? fmt(pypi.weekly) : "—"}
            hint={pypi ? "⬇ descargas" : "sin datos"}
            tone="indigo"
            series={series("pypiWeekly")}
          />
        )}
        {project.githubRepo && (
          <>
            <Stat
              label="GitHub"
              value={gh ? fmt(gh.stars) : "—"}
              hint={gh ? "★ stars" : "sin datos (¿privado?)"}
              tone="amber"
              series={series("githubStars")}
            />
            <Stat label="Forks" value={gh ? fmt(gh.forks) : "—"} hint="🍴" tone="zinc" />
          </>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-foreground">
          🔗 Configurar npm / PyPI / GitHub
        </summary>
        <form
          action={updateProjectLinks}
          className="mt-2 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input
            name="npmPackage"
            defaultValue={project.npmPackage ?? ""}
            placeholder="paquete npm (ej. lookspan)"
            className={inputCls}
          />
          <input
            name="pypiPackage"
            defaultValue={project.pypiPackage ?? ""}
            placeholder="paquete PyPI (ej. lookspan)"
            className={inputCls}
          />
          <input
            name="githubRepo"
            defaultValue={project.githubRepo ?? ""}
            placeholder="owner/repo en GitHub (ej. JoniMartin27/regenta)"
            className={inputCls}
          />
          <button
            type="submit"
            className="self-start rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Guardar
          </button>
        </form>
      </details>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Lo que hemos hablado
        </h2>
        <form
          action={addProjectNote}
          className="mt-3 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Mensaje clave, ángulo, idea o pendiente sobre este proyecto…"
            className={inputCls}
          />
          <div className="flex items-center gap-2">
            <select name="kind" className={`${inputCls} w-auto`} defaultValue="note">
              <option value="note">nota</option>
              <option value="message">mensaje</option>
              <option value="idea">idea</option>
              <option value="decision">decisión</option>
              <option value="todo">pendiente</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Añadir
            </button>
          </div>
        </form>

        <div className="mt-3 space-y-2">
          {project.notes.length === 0 ? (
            <Empty>Sin notas todavía.</Empty>
          ) : (
            project.notes.map((n) => {
              const k = NOTE_KIND[n.kind] ?? NOTE_KIND.note;
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] ${k.cls}`}>
                    {k.label}
                  </span>
                  <p className="flex-1 text-sm">{n.body}</p>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {n.createdAt.toLocaleDateString("es-ES")}
                  </span>
                  <form action={deleteProjectNote}>
                    <input type="hidden" name="noteId" value={n.id} />
                    <input type="hidden" name="slug" value={project.slug} />
                    <button type="submit" className="text-xs text-zinc-400 hover:text-red-500">
                      ✕
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Publicaciones
          </h2>
          <Link href="/compose" className="text-xs text-indigo-500 hover:underline">
            Componer →
          </Link>
        </div>
        {project.posts.length === 0 ? (
          <Empty>Nada publicado aún — este es el punto de partida.</Empty>
        ) : (
          <div className="mt-3 space-y-2">
            {project.posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{post.kind === "comment" ? "💬" : "📣"}</span>
                  <span>{post.createdAt.toLocaleDateString("es-ES")}</span>
                  <span className="rounded-full bg-zinc-500/10 px-1.5 py-0.5">{post.status}</span>
                </div>
                {post.title && <div className="mt-1 text-sm font-medium">{post.title}</div>}
                <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{post.body}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {post.publications.map((pub) => {
                    const a = getAdapter(pub.channel);
                    return (
                      <span
                        key={pub.id}
                        className="text-sm"
                        title={`${a?.name ?? pub.channel} · ${pub.status}`}
                      >
                        {a?.emoji ?? "•"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
  series,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "indigo" | "amber" | "zinc";
  series?: number[];
}) {
  const toneCls: Record<string, string> = {
    default: "",
    indigo: "text-indigo-500",
    amber: "text-amber-500",
    zinc: "text-zinc-500",
  };
  const toneHex: Record<string, string> = {
    default: "#71717a",
    indigo: "#6366f1",
    amber: "#f59e0b",
    zinc: "#71717a",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`text-xl font-semibold ${toneCls[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-400">{hint}</div>}
      {series && series.length > 0 && (
        <div className="mt-1.5">
          <Sparkline values={series} color={toneHex[tone]} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 96;
  const h = 24;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) =>
    values.length === 1 ? w / 2 : pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);

  if (values.length === 1) {
    return (
      <svg width={w} height={h}>
        <circle cx={w / 2} cy={h / 2} r={2.5} fill={color} />
      </svg>
    );
  }
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2} fill={color} />
    </svg>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}
