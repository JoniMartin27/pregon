// Blast parametrizado de un "what's new" de Lookspan a las cuentas sociales
// auto-conectadas (bluesky, mastodon; excluye dev.to, reservado a artículos
// largos). Pensado para invocarse por iteración desde el loop de mantenimiento:
//
//   BODY="..." LINK="https://..." TAGS="llm,observability,ai" \
//     npx tsx scripts/blast-update.ts
//
// Registra el post + publicaciones en Pregón vía los adapters reales.
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const BODY = process.env.BODY?.trim();
const LINK = process.env.LINK?.trim() || "https://github.com/JoniMartin27/lookspan";
const TAGS = (process.env.TAGS ?? "llm,observability,ai")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
// Canales a excluir del blast social (CSV). dev.to por defecto (artículos largos).
const EXCLUDE = new Set(
  (process.env.EXCLUDE ?? "devto").split(",").map((t) => t.trim()).filter(Boolean),
);
const PROJECT = process.env.PROJECT?.trim() || "lookspan";

async function main() {
  if (!BODY) {
    throw new Error("Falta BODY (texto del post). Pásalo por variable de entorno.");
  }

  const accounts = await prisma.account.findMany({ where: { status: "active" } });
  const targets = accounts.filter((a) => !EXCLUDE.has(a.channel));
  console.log("Cuentas activas:", accounts.map((a) => a.channel).join(", ") || "(ninguna)");
  console.log("Blast a:", targets.map((a) => a.channel).join(", ") || "(ninguna)");
  if (targets.length === 0) {
    console.log("No hay cuentas conectadas para el blast.");
    return;
  }

  const project = await prisma.project.findUnique({ where: { slug: PROJECT } });
  if (!project) throw new Error(`no existe el proyecto ${PROJECT}`);

  const post = await prisma.post.create({
    data: {
      projectId: project.id,
      kind: "post",
      body: BODY,
      link: LINK,
      tags: JSON.stringify(TAGS),
      status: "publishing",
      publications: {
        create: targets.map((a) => ({ channel: a.channel, status: "pending", accountId: a.id })),
      },
    },
    include: { publications: true },
  });
  const content = buildContent(post);

  for (const pub of post.publications) {
    const account = targets.find((a) => a.id === pub.accountId);
    const adapter = getAdapter(pub.channel);
    if (!account || !adapter?.publish) {
      console.log(`- ${pub.channel}: sin adapter/cuenta`);
      continue;
    }
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
      console.log(`- ${pub.channel}: OK ${result.externalUrl ?? "(sin url)"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.publication.update({
        where: { id: pub.id },
        data: { status: "failed", error: msg },
      });
      console.log(`- ${pub.channel}: FAIL ${msg}`);
    }
  }

  const pubs = await prisma.publication.findMany({ where: { postId: post.id } });
  const allPub = pubs.length > 0 && pubs.every((p) => p.status === "published");
  const anyPub = pubs.some((p) => p.status === "published");
  await prisma.post.update({
    where: { id: post.id },
    data: { status: allPub ? "published" : anyPub ? "partial" : "failed" },
  });
  console.log("Post status:", allPub ? "published" : anyPub ? "partial" : "failed");
}

main().finally(() => prisma.$disconnect());
