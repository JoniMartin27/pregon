import { describe, it, expect, vi, afterEach } from "vitest";
import { npmDownloads, pypiDownloads, githubStats } from "./traction";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_TOKEN;
});

function stubFetch(impl: (url: string, init?: RequestInit) => { ok?: boolean; status?: number; json: unknown }) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const r = impl(url, init);
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json } as Response;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("npmDownloads", () => {
  it("devuelve las descargas semanales", async () => {
    const mock = stubFetch((url) => {
      expect(url).toContain("/last-week/pregon");
      return { json: { downloads: 1234 } };
    });
    expect(await npmDownloads("pregon")).toEqual({ weekly: 1234 });
    expect(mock).toHaveBeenCalledOnce();
  });

  it("codifica nombres de paquete con scope", async () => {
    const mock = stubFetch(() => ({ json: { downloads: 1 } }));
    await npmDownloads("@scope/pkg");
    expect(mock.mock.calls[0][0]).toContain(encodeURIComponent("@scope/pkg"));
  });

  it("devuelve null en respuesta no-ok", async () => {
    stubFetch(() => ({ ok: false, status: 404, json: {} }));
    expect(await npmDownloads("no-existe")).toBeNull();
  });

  it("devuelve null si el shape no trae downloads numérico", async () => {
    stubFetch(() => ({ json: { downloads: "muchas" } }));
    expect(await npmDownloads("raro")).toBeNull();
  });

  it("devuelve null si fetch lanza (red caída)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    expect(await npmDownloads("pregon")).toBeNull();
  });

  it("con fresh=true pide no-store (sin caché)", async () => {
    const mock = stubFetch(() => ({ json: { downloads: 5 } }));
    await npmDownloads("pregon", true);
    expect(mock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
});

describe("pypiDownloads", () => {
  it("lee data.last_week y pasa el paquete en minúsculas", async () => {
    const mock = stubFetch((url) => {
      expect(url).toContain("/inferbench/recent");
      return { json: { data: { last_week: 99 } } };
    });
    expect(await pypiDownloads("InferBench")).toEqual({ weekly: 99 });
    expect(mock.mock.calls[0][1]).toMatchObject({ headers: { "user-agent": "pregon" } });
  });

  it("devuelve null si falta last_week", async () => {
    stubFetch(() => ({ json: { data: {} } }));
    expect(await pypiDownloads("x")).toBeNull();
  });

  it("devuelve null en error de red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    expect(await pypiDownloads("x")).toBeNull();
  });
});

describe("githubStats", () => {
  it("mapea stars/forks/issues", async () => {
    stubFetch((url) => {
      expect(url).toContain("/repos/JoniMartin27/pregon");
      return { json: { stargazers_count: 10, forks_count: 3, open_issues_count: 2 } };
    });
    expect(await githubStats("JoniMartin27/pregon")).toEqual({ stars: 10, forks: 3, issues: 2 });
  });

  it("rellena con 0 los campos ausentes", async () => {
    stubFetch(() => ({ json: {} }));
    expect(await githubStats("a/b")).toEqual({ stars: 0, forks: 0, issues: 0 });
  });

  it("añade Authorization: Bearer cuando hay GITHUB_TOKEN", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret";
    const mock = stubFetch(() => ({ json: { stargazers_count: 1 } }));
    await githubStats("a/b");
    const headers = mock.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer ghp_secret");
  });

  it("no añade Authorization sin token", async () => {
    const mock = stubFetch(() => ({ json: {} }));
    await githubStats("a/b");
    const headers = mock.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("devuelve null en 403 (rate limit)", async () => {
    stubFetch(() => ({ ok: false, status: 403, json: {} }));
    expect(await githubStats("a/b")).toBeNull();
  });
});
