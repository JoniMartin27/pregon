// Publica el artículo largo de inferbench en dev.to (canal "dev", artículos
// markdown con título + tags). Registra el post + publicación en Pregón.
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const TITLE = "inferbench: download, launch & benchmark local LLM engines from one desktop app";
const LINK = "https://github.com/JoniMartin27/inferbench";
const TAGS = ["llm", "localllm", "benchmark", "ai"];
const BODY = `If you run LLMs locally, you've probably bounced between half a dozen tools: one to download a model, another to launch the engine, a third to figure out how many tokens/sec you're *actually* getting on your GPU. **inferbench** collapses that into a single desktop app.

## What it does

- **Download** models and inference engines (llama.cpp & friends) from one place.
- **Launch** an engine against a model with the right flags, no terminal archaeology.
- **Benchmark** real throughput on *your* hardware — actual tok/s, not marketing numbers. No simulated data: if an engine isn't available, you get an error, not a guess.
- **Serve & expose over MCP** — keep a model resident and expose it to any MCP client over stdio or HTTP. Works for **text and image** models (Stable Diffusion via sd.cpp).

## Why local-first

No cloud, no API keys, no per-token bill, no data leaving your machine. You see exactly what your own GPU can do — useful when you're picking a model for a real workload and need honest numbers.

In a recent smoke test, Qwen2.5-7B hit **~75 tok/s on an RTX 3070** end-to-end through inferbench.

## Stack

React + Vite + Electron on the front, Python 3.11 + FastAPI + SQLModel on the back, packaged with a PyInstaller sidecar. Cross-checked model catalog (124 models) verified against Hugging Face.

## Try it

\`\`\`
https://github.com/JoniMartin27/inferbench
\`\`\`

v0.1.1 is out now. Feedback and issues welcome — especially benchmark numbers from hardware I don't have. 🖥️`;

async function main() {
  const account = await prisma.account.findFirst({ where: { channel: "devto", status: "active" } });
  if (!account) throw new Error("no hay cuenta devto activa");

  const project = await prisma.project.findUnique({ where: { slug: "inferbench" } });
  if (!project) throw new Error("no existe el proyecto inferbench");

  const post = await prisma.post.create({
    data: {
      projectId: project.id,
      kind: "post",
      title: TITLE,
      body: BODY,
      link: LINK,
      tags: JSON.stringify(TAGS),
      status: "publishing",
      publications: { create: [{ channel: "devto", status: "pending", accountId: account.id }] },
    },
    include: { publications: true },
  });

  const content = buildContent(post);
  const adapter = getAdapter("devto");
  const pub = post.publications[0];
  try {
    const creds = decryptJson(account.credentials);
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
    console.log(`- devto: OK ${result.externalUrl ?? "(sin url)"}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "failed", error: msg } });
    await prisma.post.update({ where: { id: post.id }, data: { status: "failed" } });
    console.log(`- devto: FAIL ${msg}`);
  }
}

main().finally(() => prisma.$disconnect());
