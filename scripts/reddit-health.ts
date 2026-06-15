// MONITOR DE SALUD DE CUENTA — Reddit (API oficial, solo lectura).
//
// Detecta dos riesgos que matan una campaña de difusión sin que te enteres:
//   1. Posts tuyos FILTRADOS/ELIMINADOS por automod o mods (removed_by_category).
//   2. Indicio de SHADOWBAN: un post existe (lo ves logueado) pero no aparece en
//      el listado público del subreddit (lo que ve el resto del mundo).
//
// Cruza las publicaciones de Reddit que Pregón ya registró (tabla Publication)
// con su estado real en la API, y registra el score actual como Metric.
//
// Uso:  npm run reddit:health
//       npm run reddit:health -- --dry   (no envía Telegram)
import { prisma } from "../src/lib/db";
import { loadRedditAccount, getToken, authedGet, sleep, notify } from "./lib/reddit-api";

interface PostData {
  id: string;
  name: string;
  title: string;
  subreddit: string;
  permalink: string;
  score: number;
  num_comments: number;
  removed_by_category?: string | null; // "moderator" | "automod_filtered" | "deleted" | ...
  banned_by?: unknown;
  created_utc: number;
}

function idFromUrl(url: string): string | null {
  const m = url.match(/comments\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const { creds } = await loadRedditAccount();
  const token = await getToken(creds);

  // Publicaciones de Reddit que tienen permalink (posts publicados).
  const pubs = await prisma.publication.findMany({
    where: { channel: "reddit", status: "published", externalUrl: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });

  if (!pubs.length) {
    console.log("No hay publicaciones de Reddit registradas todavía.");
    return;
  }

  // Listado público reciente del usuario: lo que el mundo ve en tu perfil.
  // Si un post tuyo NO está aquí pero sí existe por id → indicio de shadowban/filtro.
  let publicIds = new Set<string>();
  try {
    const submitted = await authedGet<{ data: { children: { data: PostData }[] } }>(
      `/user/${creds.username}/submitted?limit=100`,
      token,
      creds.username,
    );
    publicIds = new Set(submitted.data.children.map((c) => c.data.id));
  } catch (e) {
    console.warn(`! No pude leer /user/${creds.username}/submitted: ${e instanceof Error ? e.message : e}`);
  }
  await sleep(1100);

  const problems: string[] = [];
  const ok: string[] = [];

  for (const pub of pubs) {
    const id = idFromUrl(pub.externalUrl ?? "");
    if (!id) continue;
    try {
      // El JSON del propio hilo trae el estado de moderación real.
      const arr = await authedGet<{ data: { children: { data: PostData }[] } }[]>(
        `/comments/${id}?limit=1`,
        token,
        creds.username,
      );
      const data = arr[0]?.data?.children?.[0]?.data;
      if (!data) {
        problems.push(`• ${pub.externalUrl}\n  ⚠️ no devuelve datos (¿borrado?).`);
        continue;
      }

      // Registra el score actual como Metric (serie temporal de engagement).
      await prisma.metric.create({
        data: {
          publicationId: pub.id,
          score: data.score,
          comments: data.num_comments,
          raw: JSON.stringify({ removed_by_category: data.removed_by_category ?? null }),
        },
      });

      const removed = data.removed_by_category;
      const ageHours = (Date.now() / 1000 - data.created_utc) / 3600;
      const invisible = !publicIds.has(id);

      if (removed && removed !== "deleted") {
        problems.push(
          `• r/${data.subreddit}: "${data.title.slice(0, 60)}"\n  🛑 FILTRADO/ELIMINADO (${removed})\n  ${pub.externalUrl}`,
        );
      } else if (invisible && ageHours > 1) {
        problems.push(
          `• r/${data.subreddit}: "${data.title.slice(0, 60)}"\n  👻 No aparece en tu perfil público (posible shadowban/filtro). score=${data.score}\n  ${pub.externalUrl}`,
        );
      } else {
        ok.push(`• r/${data.subreddit}: score ${data.score}, ${data.num_comments} coments`);
      }
    } catch (e) {
      problems.push(`• ${pub.externalUrl}\n  ⚠️ error al consultar: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(1100);
  }

  const lines: string[] = [`🩺 Salud de Reddit — /u/${creds.username}`];
  lines.push(`Revisadas ${pubs.length} publicaciones · ${problems.length} con avisos · ${ok.length} OK.`);
  if (problems.length) {
    lines.push("\n⚠️ ATENCIÓN:");
    lines.push(...problems);
  }

  const report = lines.join("\n");
  console.log(report);
  if (ok.length) console.log("\nOK:\n" + ok.join("\n"));

  // Solo molesta por Telegram si hay algo que mirar.
  if (problems.length && !dry) {
    await notify(report);
    console.log("\n✓ Avisos enviados por Telegram.");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
