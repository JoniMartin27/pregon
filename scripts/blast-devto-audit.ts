// Publica un artículo largo en dev.to (canal "dev") sobre cómo hicimos
// "audit-ready" los exports de Lookspan y ClaudeScope. Registra el post +
// publicación en Pregón vía el adapter real.
import { prisma } from "../src/lib/db";
import { getAdapter } from "../src/lib/channels/registry";
import { decryptJson } from "../src/lib/crypto";
import { buildContent } from "../src/lib/publish";

const TITLE =
  "Making a local-first tool's CSV export audit-ready (and why charts don't belong in a CSV)";
const LINK = "https://github.com/JoniMartin27/claudescope";
const TAGS = ["opensource", "security", "ai", "webdev"];
const BODY = `"Just add a CSV export" is one of those tickets that sounds like an afternoon and turns into a week once someone says the word *audit*. I just shipped audit-grade exports across two local-first tools — [Lookspan](https://github.com/JoniMartin27/lookspan) (observability + replay for LLM apps) and [ClaudeScope](https://github.com/JoniMartin27/claudescope) (local analytics for your Claude Code sessions) — and "audit-ready" turned out to mean six concrete things in code. Here they are, with the gotchas.

## 1. CSV injection is the bug everyone forgets (CWE-1236)

A CSV is just text, so it feels safe. It isn't. If a cell value starts with \`=\`, \`+\`, \`-\`, \`@\`, a tab, or a carriage return, Excel and Google Sheets interpret it as a **formula** when the file is opened. A trace named \`=cmd|'/c calc'!A1\` becomes a live command on the reviewer's machine. This is *formula injection*, and an "audit" export that triggers it is worse than no export.

The OWASP-recommended fix is to prefix offending values with a single quote so the spreadsheet treats them as text:

\`\`\`js
function neutralize(value) {
  if (typeof value !== "string") return value;          // numbers stay numbers
  return /^[=+\\-@\\t\\r]/.test(value) ? \`'\${value}\` : value;
}
\`\`\`

Two things that bit me: only apply it to **strings** (otherwise \`-5\` as a number gets mangled), and do it *before* RFC 4180 quoting, not after.

## 2. The mojibake tax: prepend a UTF-8 BOM

Excel on Windows still assumes the system code page unless a file starts with a UTF-8 byte-order mark. Without it, \`café\` and \`niño\` arrive as garbage in exactly the audience (non-US, regulated) most likely to need an audit export. One \`\\uFEFF\` at the front fixes it. It's ugly; ship it anyway.

## 3. Provenance and integrity, or it isn't evidence

A bare table of rows proves nothing. An audit artifact needs to answer *who/when/what/how-much* and let a reviewer verify it wasn't altered. Both tools now emit:

- \`exportedAt\` (ISO 8601, UTC), the filters that were applied, the row count
- a **SHA-256 of the exact CSV bytes** (via the built-in \`node:crypto\` — no dependency)
- an explicit **truncation flag**

That last one matters more than it looks. Both tools cap exports (10k rows). The old behavior silently returned a partial file — an incomplete export that *looks* complete is the most dangerous thing you can hand an auditor. Now the response carries \`truncated\` + \`totalAvailable\`, and the report shows it in red.

## 4. Determinism

Run the export twice on the same data, get a byte-identical file. That means a stable sort, not "whatever the DB returns":

\`\`\`sql
ORDER BY started_at ASC, trace_id ASC   -- tiebreak, or ordering is non-deterministic
\`\`\`

Without the secondary key, rows with equal timestamps shuffle between runs and your SHA-256 changes for no reason.

## 5. Minimize PII by default (GDPR Art. 5)

LLM traces and CLI transcripts are full of personal data and secrets. An audit export should not casually copy raw prompt bodies into a file someone emails around. The default now ships **metadata only** — ids, timings, token counts, cost, status — and raw attributes require an explicit \`?raw=1\` / opt-in flag. ClaudeScope's audit CSV is aggregate-per-project by design; the raw bodies stay behind the existing \`--dump-sessions\` opt-in. Privacy by default isn't a feature request, it's the safe default.

## 6. "Can you put a chart in the CSV?"

This was a real ask, and the honest answer is **no**. A CSV is plain text — rows and commas, no presentation layer. Anyone who "sees charts in a CSV" is actually looking at **XLSX** (which can embed charts, but needs a library or hand-rolled OOXML) or a report.

Since both tools are zero-dependency and local-first, I went with a **self-contained HTML report**: one file, no CDN, hand-drawn inline **SVG** charts (traces/day, cost by framework, token mix), the provenance block from §3, and the data table. It opens in any browser and prints to a clean PDF for evidence. No library, no build step, and it respects the same redaction rules.

\`\`\`
GET /api/export/traces?format=html      # Lookspan
claudescope --report audit.html         # ClaudeScope
\`\`\`

## Takeaway

"Audit-ready" decomposes into boring, testable rules: neutralize formula injection, BOM for Excel, stamp provenance, hash for integrity, sort deterministically, minimize PII, and pick a real format for the visual layer instead of pretending a CSV can do it. None of it is hard — it's just the part that's easy to skip until someone asks you to prove the numbers.

Both tools are MIT, \$0, and never phone home. I just opened **GitHub Discussions** on both — if you do compliance/observability work and have opinions on what an export like this should carry, I'd genuinely like to hear them:

- Lookspan → https://github.com/JoniMartin27/lookspan/discussions
- ClaudeScope → https://github.com/JoniMartin27/claudescope/discussions`;

async function main() {
  const account = await prisma.account.findFirst({ where: { channel: "devto", status: "active" } });
  if (!account) throw new Error("no hay cuenta devto activa");

  const project = await prisma.project.findUnique({ where: { slug: "lookspan" } });
  if (!project) throw new Error("no existe el proyecto lookspan");

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
