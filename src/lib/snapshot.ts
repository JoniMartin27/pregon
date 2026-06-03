import { prisma } from "@/lib/db";
import { npmDownloads, pypiDownloads, githubStats } from "@/lib/traction";

/**
 * Captura un snapshot de tracción (npm/PyPI/GitHub) para cada proyecto que
 * tenga alguna fuente configurada. Pensado para correr periódicamente (cron).
 */
export async function captureSnapshots(): Promise<{ captured: number; total: number }> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { npmPackage: { not: null } },
        { pypiPackage: { not: null } },
        { githubRepo: { not: null } },
      ],
    },
  });

  let captured = 0;
  for (const p of projects) {
    const [npm, pypi, gh] = await Promise.all([
      p.npmPackage ? npmDownloads(p.npmPackage, true) : Promise.resolve(null),
      p.pypiPackage ? pypiDownloads(p.pypiPackage, true) : Promise.resolve(null),
      p.githubRepo ? githubStats(p.githubRepo, true) : Promise.resolve(null),
    ]);
    if (!npm && !pypi && !gh) continue; // nada que guardar

    await prisma.projectSnapshot.create({
      data: {
        projectId: p.id,
        npmWeekly: npm?.weekly ?? null,
        pypiWeekly: pypi?.weekly ?? null,
        githubStars: gh?.stars ?? null,
        githubForks: gh?.forks ?? null,
      },
    });
    captured++;
  }

  return { captured, total: projects.length };
}
