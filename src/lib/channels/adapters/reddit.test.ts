import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reddit } from "./reddit";
import type { Credentials } from "../types";

const creds: Credentials = {
  clientId: "cid",
  clientSecret: "csecret",
  username: "joni",
  password: "pw",
  subreddit: "SideProject",
};

// Mock de fetch que responde según la URL llamada. Solo mockeamos la red.
function mockFetch(handlers: Record<string, () => { ok?: boolean; status?: number; json: unknown }>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(handlers).find((k) => url.includes(k));
    if (!key) throw new Error(`URL no esperada en el test: ${url}`);
    const r = handlers[key]();
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
    } as Response;
  });
}

const TOKEN_OK = { json: { access_token: "tok-123" } };

beforeEach(() => {
  vi.stubGlobal("fetch", undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reddit.publish — post", () => {
  it("autentica con password grant y crea un post tipo link", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      return {
        ok: true,
        status: 200,
        json: async () => ({ json: { errors: [], data: { name: "t3_abc", url: "https://redd.it/abc" } } }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await reddit.publish!({
      content: { title: "Hola", body: "cuerpo", link: "https://x.dev" },
      credentials: creds,
    });

    expect(res).toEqual({ externalId: "t3_abc", externalUrl: "https://redd.it/abc" });

    // Auth con Basic + password grant
    const auth = calls.find((c) => c.url.includes("access_token"))!;
    expect((auth.init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
    expect(String(auth.init.body)).toContain("grant_type=password");

    // Submit con Bearer + kind=link + url + sr
    const submit = calls.find((c) => c.url.includes("/api/submit"))!;
    expect((submit.init.headers as Record<string, string>).authorization).toBe("Bearer tok-123");
    const body = String(submit.init.body);
    expect(body).toContain("sr=SideProject");
    expect(body).toContain("kind=link");
    expect(body).toContain("url=https");
  });

  it("usa kind=self con texto cuando no hay enlace", async () => {
    let submitBody = "";
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      submitBody = String(init.body);
      return { ok: true, status: 200, json: async () => ({ json: { data: { name: "t3_z" } } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await reddit.publish!({ content: { title: "T", body: "el cuerpo" }, credentials: creds });
    expect(submitBody).toContain("kind=self");
    expect(submitBody).toContain("text=");
  });

  it("normaliza el subreddit con prefijo r/", async () => {
    let submitBody = "";
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      submitBody = String(init.body);
      return { ok: true, status: 200, json: async () => ({ json: { data: { name: "t3_z" } } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await reddit.publish!({
      content: { title: "T", body: "b" },
      credentials: { ...creds, subreddit: "/r/SideProject" },
    });
    expect(submitBody).toContain("sr=SideProject");
    expect(submitBody).not.toContain("r%2F"); // no quedó "r/" codificado
  });

  it("lanza si no hay subreddit configurado para postear", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      throw new Error("no debería llegar al submit");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reddit.publish!({ content: { title: "T", body: "b" }, credentials: { ...creds, subreddit: "" } }),
    ).rejects.toThrow(/subreddit/i);
  });

  it("propaga errores de la API de Reddit (errors[])", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      return {
        ok: true,
        status: 200,
        json: async () => ({ json: { errors: [["RATELIMIT", "slow down"]] } }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reddit.publish!({ content: { title: "T", body: "b" }, credentials: creds }),
    ).rejects.toThrow(/RATELIMIT slow down/);
  });

  it("lanza un error claro si la autenticación falla", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_grant" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reddit.publish!({ content: { title: "T", body: "b" }, credentials: creds }),
    ).rejects.toThrow(/Reddit auth: invalid_grant/);
  });
});

describe("reddit.publish — comment", () => {
  it("comenta en un hilo extrayendo el fullname t3_ de la URL", async () => {
    let commentBody = "";
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("access_token")) return { ok: true, status: 200, json: async () => TOKEN_OK.json } as Response;
      commentBody = String(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          json: { data: { things: [{ data: { name: "t1_xyz", permalink: "/r/x/comments/abc/_/xyz/" } }] } },
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await reddit.publish!({
      content: { body: "buen punto" },
      credentials: creds,
      kind: "comment",
      targetUrl: "https://www.reddit.com/r/x/comments/abc123/titulo/",
    });

    expect(commentBody).toContain("thing_id=t3_abc123");
    expect(commentBody).toContain("text=");
    expect(res.externalId).toBe("t1_xyz");
    expect(res.externalUrl).toBe("https://www.reddit.com/r/x/comments/abc/_/xyz/");
  });

  it("exige targetUrl al comentar", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("access_token")
        ? ({ ok: true, status: 200, json: async () => TOKEN_OK.json } as Response)
        : (() => {
            throw new Error("no debería postear");
          })(),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reddit.publish!({ content: { body: "x" }, credentials: creds, kind: "comment" }),
    ).rejects.toThrow(/URL del hilo/);
  });

  it("rechaza una URL de hilo inválida", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => TOKEN_OK.json }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reddit.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://example.com/no-es-reddit",
      }),
    ).rejects.toThrow(/no válida/);
  });
});

describe("reddit.composeUrl", () => {
  it("construye la URL de envío asistido con título y enlace", () => {
    const url = reddit.composeUrl!({ title: "Mi título", body: "b", link: "https://x.dev" });
    expect(url.startsWith("https://www.reddit.com/submit?")).toBe(true);
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("title")).toBe("Mi título");
    expect(qs.get("url")).toBe("https://x.dev");
  });
});
