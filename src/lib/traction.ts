// Tracción pública por proyecto: descargas de npm y stats de GitHub.
// APIs públicas; GitHub usa GITHUB_TOKEN del .env si está presente
// (necesario para repos privados y para subir el rate limit).

export type NpmStats = { weekly: number };
export type GithubStats = { stars: number; forks: number; issues: number };

export async function npmDownloads(pkg: string): Promise<NpmStats | null> {
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.downloads === "number" ? { weekly: json.downloads } : null;
  } catch {
    return null;
  }
}

export async function githubStats(repo: string): Promise<GithubStats | null> {
  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "pregon",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 1800 },
    });
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
