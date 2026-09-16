// Comenta en un hilo ajeno desde una cuenta conectada de Pregón y lo registra
// como Post (kind=comment) + Publication. Un canal por invocación.
//
//   CHANNEL=bluesky TARGET="https://bsky.app/profile/<handle>/post/<rkey>" \
//     BODY_FILE=comentario.txt PROJECT=lookspan npx tsx scripts/comment.ts
//
// BODY_FILE (UTF-8) evita que las tildes se rompan al pasar por el entorno de
// Windows; BODY sirve para textos ASCII. DRY=1 solo resuelve el hilo destino
// (comprueba que existe y quién es el autor) sin publicar ni tocar la DB.
import fs from "node:fs";
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const CHANNEL = process.env.CHANNEL?.trim();
const TARGET = process.env.TARGET?.trim();
const BODY = process.env.BODY_FILE
  ? fs.readFileSync(process.env.BODY_FILE, "utf8").trim()
  : process.env.BODY?.trim();
const PROJECT = process.env.PROJECT?.trim() || "lookspan";
const DRY = process.env.DRY === "1";

async function main() {
  if (!CHANNEL || !TARGET || !BODY) {
    throw new Error("Faltan CHANNEL, TARGET o BODY/BODY_FILE (variables de entorno).");
  }
  const adapter = getAdapter(CHANNEL);
  if (!adapter?.publish) throw new Error(`El canal ${CHANNEL} no publica por API`);

  const account = await prisma.account.findFirst({ where: { channel: CHANNEL, status: "active" } });
  if (!account) throw new Error(`No hay cuenta activa de ${CHANNEL}`);
  const creds = decryptJson(account.credentials);
  const meta = account.meta ? (JSON.parse(account.meta) as Record<string, string>) : undefined;

  if (DRY) {
    if (!adapter.resolveTarget) throw new Error(`${CHANNEL} no sabe resolver hilos destino`);
    const t = await adapter.resolveTarget({ targetUrl: TARGET, credentials: creds, meta });
    console.log(`[DRY] ${CHANNEL} → hilo ${t.id}${t.author ? ` de @${t.author}` : ""}`);
    console.log(`[DRY] texto (${BODY.length} chars):\n${BODY}`);
    return;
  }

  const project = await prisma.project.findUnique({ where: { slug: PROJECT } });
  if (!project) throw new Error(`no existe el proyecto ${PROJECT}`);

  const post = await prisma.post.create({
    data: {
      projectId: project.id,
      kind: "comment",
      body: BODY,
      targetUrl: TARGET,
      status: "publishing",
      publications: { create: [{ channel: CHANNEL, status: "pending", accountId: account.id }] },
    },
    include: { publications: true },
  });
  const pub = post.publications[0];

  try {
    const result = await adapter.publish({
      content: buildContent(post),
      credentials: creds,
      meta,
      kind: "comment",
      targetUrl: TARGET,
    });
    await prisma.publication.update({
      where: { id: pub.id },
      data: {
        status: "published",
        externalUrl: result.externalUrl ?? null,
        externalId: result.externalId ?? null,
        publishedAt: new Date(),
      },
    });
    await prisma.post.update({ where: { id: post.id }, data: { status: "published" } });
    console.log(`- ${CHANNEL}: OK ${result.externalUrl ?? "(sin url)"}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "failed", error: msg } });
    await prisma.post.update({ where: { id: post.id }, data: { status: "failed" } });
    console.log(`- ${CHANNEL}: FAIL ${msg}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
