// Publica el anuncio de lanzamiento de Fervon en Reddit como SELF-POST (texto).
// IMPORTANTE: el Post se crea SIN `link` → el adapter crea un self/text post, no
// un link-post (que en Reddit parece spam). El enlace a fervon.dev va dentro del
// cuerpo. Requiere una cuenta `reddit` conectada en Pregón con subreddit por
// defecto (ej. SideProject). Ejecutar: npx tsx scripts/blast-fervon-reddit.ts
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const TITLE =
  "I put all my side projects under one studio name — Fervon. Built with AI agent fleets.";

const BODY = `For the last few months I've been shipping a bunch of small products solo — a local-first personal-memory app, a local-LLM benchmark, a few dev tools. Having them scattered across repos and names got messy, so I finally put them under one roof: **Fervon**.

The honest part of the workflow: I build these with fleets of AI agents. I design the product and the architecture, then orchestrate agents to code, review and ship — often several projects in parallel. It's let me run far more projects than I could by hand.

What's live:

- **Trace** — local-first personal memory ("the Rewind that got killed, without recording your screen"). Paid, lifetime license.
- **inferbench** — download, launch and benchmark local LLM engines from one desktop app.
- **ClaudeScope** — local dashboard + full-text search over your Claude Code sessions.
- **Lookspan** — lightweight, local-first observability for AI agents.
- **Launchpad** — a local launcher that runs all your projects on unique ports, no collisions.
- **Pregón** — a cross-poster that adapts one update to every channel (this post was published through it).

All the dev tools are open source / free; Trace is the one paid product.

Site: https://fervon.dev · code: github.com/fervon

Not selling anything here — genuinely curious what people think of (a) the house-of-brands approach for a solo dev, and (b) whether the "agent fleet" workflow is interesting or just noise. Happy to go deep on how it's built.`;

async function main() {
  const account = await prisma.account.findFirst({ where: { channel: "reddit", status: "active" } });
  if (!account) {
    throw new Error(
      "No hay cuenta reddit conectada. Conéctala en localhost:4040/accounts (crea antes una app 'script' en reddit.com/prefs/apps).",
    );
  }

  const project = await prisma.project.findUnique({ where: { slug: "fervon" } });
  if (!project) throw new Error("No existe el proyecto fervon en la DB (corre antes el blast social).");

  const creds = decryptJson(account.credentials);
  const sub = (creds.subreddit ?? "").replace(/^\/?r\//i, "").trim();
  if (!sub) {
    throw new Error("La cuenta reddit no tiene subreddit por defecto. Edítala en /accounts (ej. SideProject).");
  }

  const post = await prisma.post.create({
    data: {
      projectId: project.id,
      kind: "post",
      title: TITLE,
      body: BODY,
      link: null, // self-post: el enlace va en el cuerpo, NO como link-post
      tags: null,
      status: "publishing",
      publications: { create: [{ channel: "reddit", status: "pending", accountId: account.id }] },
    },
    include: { publications: true },
  });

  const content = buildContent(post);
  const adapter = getAdapter("reddit");
  const pub = post.publications[0];
  try {
    const result = await adapter!.publish!({ content, credentials: creds, kind: "post" });
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
    console.log(`- reddit (r/${sub}): OK ${result.externalUrl ?? "(sin url)"}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "failed", error: msg } });
    await prisma.post.update({ where: { id: post.id }, data: { status: "failed" } });
    console.log(`- reddit: FAIL ${msg}`);
  }
}

main().finally(() => prisma.$disconnect());
