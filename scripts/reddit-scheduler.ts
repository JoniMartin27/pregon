// PLANIFICADOR — Reddit (API oficial).
//
// Publica los Posts que tengas programados para Reddit (status="scheduled",
// scheduledAt <= ahora, con una Publication de canal "reddit" pendiente),
// ESPACIÁNDOLOS para no quemar la cuenta. Reddit penaliza ráfagas de posts;
// este planificador respeta una separación mínima entre publicaciones.
//
// Pensado para correr periódicamente (cron / Programador de tareas de Windows):
//   npm run reddit:schedule
//
// Programar un post: crea un Post con status="scheduled" y scheduledAt en el
// futuro, más una Publication { channel: "reddit", status: "pending" }. La UI de
// Pregón o un blast-*.ts pueden hacerlo; aquí solo lo DISPARAMOS a su hora.
//
// MIN_GAP_MINUTES: separación mínima entre dos posts de Reddit. Si el último se
// publicó hace menos que esto, este ciclo no publica nada y reintenta al siguiente.
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { buildContent } from "../src/lib/publish";
import { loadRedditAccount, notify } from "./lib/reddit-api";

const MIN_GAP_MINUTES = Number(process.env.REDDIT_MIN_GAP_MINUTES ?? 180);

async function main() {
  const dry = process.argv.includes("--dry");
  const account = await loadRedditAccount();

  // ¿Cuándo se publicó el último post de Reddit? Para respetar la separación.
  const last = await prisma.publication.findFirst({
    where: { channel: "reddit", status: "published", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });
  if (last?.publishedAt) {
    const minsSince = (Date.now() - last.publishedAt.getTime()) / 60000;
    if (minsSince < MIN_GAP_MINUTES) {
      const wait = Math.ceil(MIN_GAP_MINUTES - minsSince);
      console.log(`Último post hace ${Math.floor(minsSince)} min; espero ${wait} min más. Nada que hacer.`);
      return;
    }
  }

  // El siguiente post programado y vencido, más antiguo primero. UNO por ciclo
  // (la separación la garantiza el cron + la comprobación de arriba).
  const post = await prisma.post.findFirst({
    where: {
      status: "scheduled",
      scheduledAt: { lte: new Date() },
      publications: { some: { channel: "reddit", status: "pending" } },
    },
    orderBy: { scheduledAt: "asc" },
    include: { publications: { where: { channel: "reddit", status: "pending" } } },
  });

  if (!post) {
    console.log("No hay posts de Reddit programados y vencidos.");
    return;
  }

  const pub = post.publications[0];
  console.log(`→ Publicando programado: "${post.title ?? post.body.slice(0, 50)}" (post ${post.id})`);

  if (dry) {
    console.log("[--dry] No publico de verdad.");
    return;
  }

  const adapter = getAdapter("reddit");
  const content = buildContent(post);
  await prisma.post.update({ where: { id: post.id }, data: { status: "publishing" } });

  try {
    const result = await adapter!.publish!({
      content,
      credentials: account.creds as unknown as Record<string, string>,
      kind: post.kind === "comment" ? "comment" : "post",
      targetUrl: post.targetUrl ?? undefined,
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
    const url = result.externalUrl ?? "(sin url)";
    console.log(`✓ Publicado: ${url}`);
    await notify(`👽 Pregón publicó en Reddit (programado):\n${post.title ?? ""}\n${url}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "failed", error: msg } });
    await prisma.post.update({ where: { id: post.id }, data: { status: "failed" } });
    console.error(`✗ Falló: ${msg}`);
    await notify(`⚠️ Pregón: falló un post programado de Reddit:\n${msg}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
