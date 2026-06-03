// Tracción pública por proyecto: descargas de npm/PyPI y stats de GitHub.
// APIs públicas; GitHub usa GITHUB_TOKEN del .env si está (repos privados / rate limit).
// `fresh=true` salta la caché (para capturar snapshots de crecimiento).

export type NpmStats = { weekly: number };
export type GithubStats = { stars: number; forks: number; issues: number };

export async function npmDownloads(pkg: string, fresh = false): Promise<NpmStats | null> {
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`,
      fresh ? { cache: "no-store" } : { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.downloads === "number" ? { weekly: json.downloads } : null;
  } catch {
    return null;
  }
}

/** Descargas de PyPI (última semana) vía pypistats.org (fuente oficial). */
export async function pypiDownloads(pkg: string, fresh = false): Promise<NpmStats | null> {
  try {
    const res = await fetch(
      `https://pypistats.org/api/packages/${encodeURIComponent(pkg.toLowerCase())}/recent`,
      fresh
        ? { headers: { "user-agent": "pregon" }, cache: "no-store" }
        : { headers: { "user-agent": "pregon" }, next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const weekly = json?.data?.last_week;
    return typeof weekly === "number" ? { weekly } : null;
  } catch {
    return null;
  }
}

export async function githubStats(repo: string, fresh = false): Promise<GithubStats | null> {
  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "pregon",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(
      `https://api.github.com/repos/${repo}`,
      fresh ? { headers, cache: "no-store" } : { headers, next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return {
      stars: json.stargazers_count ?? 0,
      forks: json.forks_count ?? 0,
      issues: json.open_issues_count ?? 0,
    };
  } catch {
    return null;
  }
}
