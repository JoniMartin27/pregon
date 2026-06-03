import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    name: "Lookspan",
    slug: "lookspan",
    url: "https://www.npmjs.com/package/lookspan",
    color: "#6366f1",
    description: "Observabilidad y replay para apps con LLMs.",
  },
  {
    name: "Regenta",
    slug: "regenta",
    url: "https://jonimartin27.github.io/regenta",
    color: "#0ea5e9",
    description: "Orquestación de flotas de agentes de IA (AGENT-OS).",
  },
  {
    name: "Prompt Tycoon",
    slug: "prompt-tycoon",
    color: "#f59e0b",
    description: "Juego idle tycoon HTML5 sobre prompts.",
  },
  {
    name: "Pato Patrick",
    slug: "pato-patrick",
    color: "#22c55e",
    description: "Juego casual de la game factory.",
  },
  {
    name: "inferbench",
    slug: "inferbench",
    color: "#ef4444",
    description: "Benchmark de inferencia y catálogo de modelos.",
  },
];

async function main() {
  for (const p of projects) {
    await prisma.project.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
  }
  console.log(`Seed OK: ${projects.length} proyectos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
