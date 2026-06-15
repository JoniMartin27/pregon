// Blast multi-canal: difunde la novedad de Lookspan v0.4.0 a todas las cuentas
// conectadas (excepto dev.to, que ya tiene el artículo largo), vía los adapters
// reales + credenciales del usuario, registrándolo en Pregón.
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const DEVTO_URL =
  "https://dev.to/jonimatiin/building-lookspan-local-first-observability-replay-for-llm-apps-v040-441a";
const BODY =
  "Shipped Lookspan v0.4.0 \u{1F680} local-first observability + replay for LLM apps — now with datasets & experiments (test set → batch → judge → aggregates). MCP-native.";
const TAGS = ["llm", "observability", "ai"];

async function main() {
  const accounts = await prisma.account.findMany({ where: { status: "active" } });
  console.log("Cuentas activas:", accounts.map((a) => `${a.channel}(${a.label})`).join(", ") || "(ninguna)");

  const targets = accounts.filter((a) => a.channel !== "devto");
  console.log("Blast a:", targets.map((a) => a.channel).join(", ") || "(ninguna)");
  if (targets.length === 0) {
    console.log("No hay otras cuentas conectadas para el blast.");
    return;
  }

  const project = await prisma.project.findUnique({ where: { slug: "lookspan" } });
  if (!project) throw new Error("no existe el proyecto lookspan");

  const post = await prisma.post.create({
    data: {
      projectId: project.id,
      kind: "post",
      body: BODY,
      link: DEVTO_URL,
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
