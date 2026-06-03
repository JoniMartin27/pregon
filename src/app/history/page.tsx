import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/channels/registry";
import { buildContent, openUrlFor } from "@/lib/publish";
import { markPublished, deletePost } from "@/lib/actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-500",
  partial: "bg-amber-500/15 text-amber-500",
  pending: "bg-amber-500/15 text-amber-500",
  failed: "bg-red-500/15 text-red-500",
  skipped: "bg-zinc-500/15 text-zinc-400",
};

export default async function HistoryPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: { project: true, publications: true },
    take: 50,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <Link
          href="/compose"
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Componer →
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Aún no has publicado nada.{" "}
          <Link href="/compose" className="text-indigo-500 underline">
            Crea tu primer post
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const content = buildContent(post);
            return (
              <div
                key={post.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-500/10 px-1.5 py-0.5">{post.project.name}</span>
                      <span>{post.kind === "comment" ? "💬 comentario" : "📣 post"}</span>
                      <span>·</span>
                      <span>{post.createdAt.toLocaleString("es-ES")}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[post.status] ?? "bg-zinc-500/15 text-zinc-400"}`}
                      >
                        {post.status}
                      </span>
                    </div>
                    {post.title && <div className="mt-1 font-medium">{post.title}</div>}
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {post.body}
                    </p>
                  </div>
                  <form action={deletePost}>
                    <input type="hidden" name="postId" value={post.id} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </form>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {post.publications.map((pub) => {
                    const adapter = getAdapter(pub.channel);
                    const openUrl = adapter ? openUrlFor(adapter, post, content) : null;
                    return (
                      <div key={pub.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{adapter?.emoji ?? "•"}</span>
                        <span className="w-24 shrink-0">{adapter?.name ?? pub.channel}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[pub.status] ?? ""}`}
                        >
                          {pub.status}
                        </span>
                        {pub.externalUrl ? (
                          <a
                            href={pub.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-xs text-indigo-500 hover:underline"
                          >
                            {pub.externalUrl}
                          </a>
                        ) : pub.status === "pending" && openUrl ? (
                          <>
                            <a
                              href={openUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 hover:bg-amber-500/25"
                            >
                              Abrir y publicar ↗
                            </a>
                            <form action={markPublished} className="flex items-center gap-1">
                              <input type="hidden" name="publicationId" value={pub.id} />
                              <input
                                name="url"
                                placeholder="pega el enlace…"
                                className="w-36 rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                              />
                              <button type="submit" className="text-xs text-emerald-600 hover:underline">
                                marcar ✓
                              </button>
                            </form>
                          </>
                        ) : pub.status === "pending" ? (
                          <span className="text-xs text-zinc-400">sin cuenta — conéctala para auto</span>
                        ) : pub.error ? (
                          <span className="truncate text-xs text-red-500">{pub.error}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
