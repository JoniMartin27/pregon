// RADAR DE OPORTUNIDADES — Reddit (API oficial, solo lectura).
//
// Rastrea los subreddits configurados, puntúa los hilos por relevancia a tus
// proyectos y te avisa por Telegram de los mejores para que TÚ escribas una
// respuesta genuina. No publica nada por su cuenta. El karma llega solo cuando
// tu respuesta aporta — esto solo te ahorra el rastreo manual.
//
// Uso:   npm run reddit:radar
//        npm run reddit:radar -- --dry   (no envía Telegram, solo consola)
//
// Config: scripts/reddit-radar.config.json
// Estado: scripts/.data/reddit-seen.json (hilos ya avisados, para no repetir)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/db";
import { loadRedditAccount, getToken, authedGet, sleep, notify } from "./lib/reddit-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "reddit-radar.config.json");
const SEEN_PATH = path.join(__dirname, ".data", "reddit-seen.json");

interface ProjectCfg {
  name: string;
  subreddits: string[];
  keywords: string[];
}
interface RadarCfg {
  windowHours: number;
  minScore: number;
  perProjectLimit: number;
  projects: ProjectCfg[];
}

interface RedditPost {
  data: {
    id: string;
    name: string; // fullname t3_xxx
    title: string;
    selftext: string;
    subreddit: string;
    permalink: string;
    created_utc: number;
    num_comments: number;
    score: number;
    over_18: boolean;
    link_flair_text?: string;
  };
}
interface Listing {
  data: { children: RedditPost[] };
}

interface Hit {
  project: string;
  title: string;
  subreddit: string;
  url: string;
  comments: number;
  ageHours: number;
  relevance: number;
  matched: string[];
  id: string;
}

function loadSeen(): Set<string> {
  try {
    const raw = JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")) as { ids: string[] };
    return new Set(raw.ids);
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
  // Conserva como mucho los últimos 2000 ids para que el fichero no crezca sin fin.
  const ids = [...seen].slice(-2000);
  fs.writeFileSync(SEEN_PATH, JSON.stringify({ ids }, null, 2));
}

/** Cuenta coincidencias de keywords; el título pesa x3 frente al cuerpo. */
function scorePost(p: RedditPost["data"], keywords: string[]): { score: number; matched: string[] } {
  const title = p.title.toLowerCase();
  const body = (p.selftext || "").toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    const inTitle = title.includes(k);
    const inBody = body.includes(k);
    if (inTitle) {
      score += 3;
      matched.push(kw);
    } else if (inBody) {
      score += 1;
      matched.push(kw);
    }
  }
  // Un hilo que es una PREGUNTA suele ser mejor oportunidad de aportar.
  if (/\?|how do|what.s the best|recommend|looking for|alternative to/.test(title)) score += 1;
  return { score, matched };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as RadarCfg;
  const { creds } = await loadRedditAccount();
  const token = await getToken(creds);
  const seen = loadSeen();
  const now = Date.now() / 1000;
  const windowSecs = cfg.windowHours * 3600;

  const hits: Hit[] = [];

  for (const project of cfg.projects) {
    for (const sub of project.subreddits) {
      try {
        // /new es lo más fresco; 50 posts cubre bien una ventana de 24-48h en subs medianos.
        const listing = await authedGet<Listing>(
          `/r/${sub}/new?limit=50`,
          token,
          creds.username,
        );
        for (const child of listing.data.children) {
          const p = child.data;
          if (p.over_18) continue;
          if (now - p.created_utc > windowSecs) continue;
          if (seen.has(p.id)) continue;
          const { score, matched } = scorePost(p, project.keywords);
          if (score < cfg.minScore) continue;
          hits.push({
            project: project.name,
            title: p.title,
            subreddit: p.subreddit,
            url: `https://www.reddit.com${p.permalink}`,
            comments: p.num_comments,
            ageHours: Math.round((now - p.created_utc) / 360) / 10,
            relevance: score,
            matched: [...new Set(matched)],
            id: p.id,
          });
        }
      } catch (e) {
        console.warn(`! r/${sub} (${project.name}): ${e instanceof Error ? e.message : e}`);
      }
      await sleep(1100); // respeta ~1 req/s de la API oficial
    }
  }

  // Mejores por proyecto.
  const byProject = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = byProject.get(h.project) ?? [];
    arr.push(h);
    byProject.set(h.project, arr);
  }

  const lines: string[] = ["👽 Radar de Reddit — oportunidades para responder\n"];
  let total = 0;
  for (const project of cfg.projects) {
    const arr = (byProject.get(project.name) ?? [])
      .sort((a, b) => b.relevance - a.relevance || b.comments - a.comments)
      .slice(0, cfg.perProjectLimit);
    if (!arr.length) continue;
    lines.push(`\n— ${project.name} —`);
    for (const h of arr) {
      total++;
      seen.add(h.id);
      lines.push(
        `• [r/${h.subreddit}] ${h.title}\n  ${h.url}\n  rel ${h.relevance} · ${h.comments} coments · hace ${h.ageHours}h · match: ${h.matched.join(", ")}`,
      );
    }
  }

  if (!total) {
    console.log("Sin oportunidades nuevas por encima del umbral.");
    return;
  }

  const report = lines.join("\n");
  console.log(report);
  if (!dry) {
    await notify(report);
    saveSeen(seen); // solo marca como visto si de verdad se avisó
    console.log(`\n✓ Avisadas ${total} oportunidades por Telegram.`);
  } else {
    console.log(`\n[--dry] ${total} oportunidades (no se envió Telegram ni se guardó estado).`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
