import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    name: "Lookspan",
    slug: "lookspan",
    url: "https://www.npmjs.com/package/lookspan",
    color: "#6366f1",
    description: "Observabilidad y replay para apps con LLMs.",
    npmPackage: "lookspan",
    pypiPackage: "lookspan",
    notes: [
      { kind: "message", body: "Mensaje clave: observabilidad y replay local-first para apps con LLMs, MCP-native. Capturas spans/prompts/respuestas y los reproduces." },
      { kind: "decision", body: "En npm v0.4.0 — Datasets & experiments: defines un test set, lanzas un batch, juzgas con LLM-as-judge y ves agregados. Historial: 0.2 multiagente · 0.3 replay/diff+judge · 0.4 datasets." },
      { kind: "todo", body: "Para difundir: GIF demo + lanzar en foros (Show HN, r/LLMDevs, dev.to). Landing bilingüe ES/EN lista. Ojo: revocar token npm expuesto antes." },
    ],
  },
  {
    name: "Regenta",
    slug: "regenta",
    url: "https://jonimartin27.github.io/regenta",
    color: "#0ea5e9",
    description: "Orquestación de flotas de agentes de IA (AGENT-OS).",
    githubRepo: "JoniMartin27/regenta",
    notes: [
      { kind: "message", body: "Command center que orquesta una flota de 18 agentes IA persistentes (CEO→Coordinador→Directores→Leads→Especialistas)." },
      { kind: "decision", body: "Rebrand de AGENT-OS a 'Regenta' aplicado. Repo producto: regenta-app (privado). Landing pública: jonimartin27.github.io/regenta." },
      { kind: "todo", body: "Release público ON HOLD pendiente de auditoría de seguridad — no difundir el producto hasta cerrar eso." },
    ],
  },
  {
    name: "Prompt Tycoon",
    slug: "prompt-tycoon",
    color: "#f59e0b",
    description: "Juego idle tycoon HTML5 sobre IA.",
    notes: [
      { kind: "message", body: "Idle tycoon sobre la historia de la IA. Primer juego de la 'game factory' monetizada con ads." },
      { kind: "decision", body: "Vanilla JS + Capacitor 6 para Android. Diseño mobile-first (~390px)." },
    ],
  },
  {
    name: "Pato Patrick",
    slug: "pato-patrick",
    color: "#22c55e",
    description: "Juego casual de la game factory.",
    notes: [
      { kind: "message", body: "Juego casual (Phaser 3 + Capacitor 7), segundo título de la game factory." },
    ],
  },
  {
    name: "inferbench",
    slug: "inferbench",
    color: "#ef4444",
    description: "Benchmark de inferencia y catálogo de modelos.",
    notes: [
      { kind: "message", body: "Desktop app para descargar, lanzar y benchmarkear motores de inferencia LLM locales (llama.cpp, etc.). 124 modelos en catálogo." },
      { kind: "decision", body: "React+Electron + backend FastAPI :7777. Regla dura: no datos simulados fuera de tests." },
    ],
  },
];

async function main() {
  for (const p of projects) {
    const { notes, ...data } = p;
    const project = await prisma.project.upsert({
      where: { slug: data.slug },
      update: {
        npmPackage: data.npmPackage,
        pypiPackage: data.pypiPackage,
        githubRepo: data.githubRepo,
      },
      create: data,
    });
    const existing = await prisma.projectNote.count({ where: { projectId: project.id } });
    if (existing === 0 && notes.length) {
      await prisma.projectNote.createMany({
        data: notes.map((n) => ({ ...n, projectId: project.id })),
      });
    }
  }
  console.log(`Seed OK: ${projects.length} proyectos + notas + tracción (npm/GitHub)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
