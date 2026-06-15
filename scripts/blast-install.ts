// Blast "pruébalo / instala" para Lookspan + inferbench.
// - Publica AUTO en los canales con cuenta conectada (vía adapters reales).
// - Para el resto (asistidos / sin cuenta) genera el compose URL listo para pegar.
// Uso: npx tsx scripts/blast-install.ts
import { prisma } from "../src/lib/db";
import { ADAPTERS, getAdapter, readiness } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

type Job = {
  slug: string;
  body: string;
  link: string;
  title: string;
  tags: string[];
};

const JOBS: Job[] = [
  {
    slug: "lookspan",
    title: "Lookspan — local-first observability for AI agents",
    body:
      "Flying blind when your AI agents misbehave? Lookspan is a local-first, MCP-native observability dashboard for AI agents. Spans, traces, replay & diff, LLM-as-judge — zero infra.\n\nOne command, no Docker, no cloud, no signup:\n\n  npx lookspan",
    link: "https://github.com/JoniMartin27/lookspan",
    tags: ["llm", "observability", "ai", "agents"],
  },
  {
    slug: "inferbench",
    title: "inferbench — download, run & benchmark local LLMs",
    body:
      "Run and benchmark local LLMs without the setup pain. inferbench is a desktop app that downloads, launches and benchmarks local inference engines (llama.cpp & co) — no Python, no Node. Engine binaries auto-fetched, CUDA auto-detected.\n\nGrab the installer for Windows / macOS / Linux 👇",
    link: "https://github.com/JoniMartin27/inferbench/releases",
    tags: ["llm", "localllm", "inference", "benchmark"],
  },
];

// Canales que reservamos a artículo largo (no blast corto auto).
const EXCLUDE_AUTO = new Set(["devto", "hashnode"]);

async function main() {
  const accounts = await prisma.account.findMany({ where: { status: "active" } });

  for (const job of JOBS) {
    console.log(`\n=============== ${job.slug.toUpperCase()} ===============`);
    const project = await prisma.project.findUnique({ where: { slug: job.slug } });
    if (!project) {
      console.log(`(!) no existe el proyecto ${job.slug} en Pregón, lo salto`);
      continue;
    }

    const myAccounts = accounts.filter(
      (a) => !EXCLUDE_AUTO.has(a.channel) && getAdapter(a.channel)?.publish,
    );

    // 1) Crear el Post + publicaciones auto (las que tienen cuenta).
    const post = await prisma.post.create({
      data: {
        projectId: project.id,
        kind: "post",
        title: job.title,
        body: job.body,
        link: job.link,
        tags: JSON.stringify(job.tags),
        status: myAccounts.length ? "publishing" : "draft",
        publications: {
          create: myAccounts.map((a) => ({
            channel: a.channel,
            status: "pending",
            accountId: a.id,
          })),
        },
      },
      include: { publications: true },
    });
    const content = buildContent(post);

    // 2) Publicar AUTO.
    console.log("— AUTO (publico yo) —");
    if (myAccounts.length === 0) console.log("  (sin cuentas conectadas para este proyecto)");
    for (const pub of post.publications) {
      const account = myAccounts.find((a) => a.id === pub.accountId);
      const adapter = getAdapter(pub.channel);
      if (!account || !adapter?.publish) continue;
      try {
        const creds = decryptJson(account.credentials);
        const meta = account.meta ? (JSON.parse(account.meta) as Record<string, string>) : undefined;
        const result = await adapter.publish({ content, credentials: creds, meta, kind: "post" });
        await prisma.publication.update({
          where: { id: pub.id },
          data: {
            status: "published",
            externalUrl: result.externalUrl ?? null,
            externalId: result.externalId ?? null,
            publishedAt: new Date(),
          },
        });
        console.log(`  ✅ ${pub.channel}: ${result.externalUrl ?? "(publicado)"}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.publication.update({
          where: { id: pub.id },
          data: { status: "failed", error: msg },
        });
        console.log(`  ❌ ${pub.channel}: ${msg}`);
      }
    }

    // 3) Generar enlaces LISTOS para los canales asistidos.
    console.log("— LISTO PARA TI (compositor pre-cargado) —");
    const assisted = ADAPTERS.filter(
      (a) => readiness(a) === "assisted" && typeof a.composeUrl === "function",
    );
    for (const a of assisted) {
      try {
        const url = a.composeUrl!(content);
        console.log(`  ${a.emoji ?? "•"} ${a.name}: ${url}`);
      } catch (e) {
        console.log(`  • ${a.name}: (no se pudo generar) ${e instanceof Error ? e.message : e}`);
      }
    }

    // 4) Estado final del post.
    const pubs = await prisma.publication.findMany({ where: { postId: post.id } });
    const allPub = pubs.length > 0 && pubs.every((p) => p.status === "published");
    const anyPub = pubs.some((p) => p.status === "published");
    await prisma.post.update({
      where: { id: post.id },
      data: { status: pubs.length === 0 ? "draft" : allPub ? "published" : anyPub ? "partial" : "failed" },
    });
    console.log(`  → estado del post: ${pubs.length === 0 ? "draft" : allPub ? "published" : anyPub ? "partial" : "failed"}`);
  }
}

main().finally(() => prisma.$disconnect());
