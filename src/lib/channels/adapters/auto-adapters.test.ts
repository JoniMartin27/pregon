import { describe, it, expect, vi, afterEach } from "vitest";
import { bluesky } from "./bluesky";
import { mastodon } from "./mastodon";
import { hashnode } from "./hashnode";
import { devto } from "./devto";

afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init: RequestInit };

/** Captura las llamadas a fetch y responde con respuestas en cola por orden. */
function stubSequence(responses: Array<{ ok?: boolean; status?: number; json: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("bluesky.publish", () => {
  it("crea sesión y luego el record, devolviendo URL pública", async () => {
    const calls = stubSequence([
      { json: { accessJwt: "jwt", did: "did:plc:me", handle: "joni.bsky.social" } },
      { json: { uri: "at://did:plc:me/app.bsky.feed.post/rkey123" } },
    ]);

    const res = await bluesky.publish!({
      content: { body: "hola bsky", link: "https://x.dev" },
      credentials: { identifier: "joni.bsky.social", appPassword: "app-pw" },
    });

    // 1ª llamada: createSession con las credenciales
    expect(calls[0].url).toContain("com.atproto.server.createSession");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      identifier: "joni.bsky.social",
      password: "app-pw",
    });

    // 2ª llamada: createRecord con Bearer jwt y el texto adaptado
    expect(calls[1].url).toContain("com.atproto.repo.createRecord");
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe("Bearer jwt");
    const rec = JSON.parse(String(calls[1].init.body));
    expect(rec.repo).toBe("did:plc:me");
    expect(rec.record.$type).toBe("app.bsky.feed.post");
    expect(rec.record.text).toContain("hola bsky");

    expect(res.externalId).toBe("at://did:plc:me/app.bsky.feed.post/rkey123");
    expect(res.externalUrl).toBe("https://bsky.app/profile/joni.bsky.social/post/rkey123");
  });

  it("lanza si el login falla", async () => {
    stubSequence([{ ok: false, status: 401, json: { message: "Invalid identifier or password" } }]);
    await expect(
      bluesky.publish!({ content: { body: "x" }, credentials: { identifier: "a", appPassword: "b" } }),
    ).rejects.toThrow(/Invalid identifier/);
  });
});

describe("mastodon.publish", () => {
  it("postea en la instancia normalizando la barra final", async () => {
    const calls = stubSequence([{ json: { id: 42, url: "https://mastodon.social/@joni/42" } }]);
    const res = await mastodon.publish!({
      content: { body: "toot!" },
      credentials: { instanceUrl: "https://mastodon.social/", accessToken: "tok" },
    });

    expect(calls[0].url).toBe("https://mastodon.social/api/v1/statuses");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(String(calls[0].init.body)).status).toContain("toot!");
    expect(res).toEqual({ externalId: "42", externalUrl: "https://mastodon.social/@joni/42" });
  });

  it("propaga el error de la instancia", async () => {
    stubSequence([{ ok: false, status: 422, json: { error: "Text character limit exceeded" } }]);
    await expect(
      mastodon.publish!({
        content: { body: "x" },
        credentials: { instanceUrl: "https://mastodon.social", accessToken: "t" },
      }),
    ).rejects.toThrow(/character limit/);
  });
});

describe("hashnode.publish", () => {
  it("envía la mutation GraphQL con título, markdown y publicationId", async () => {
    const calls = stubSequence([{ json: { data: { publishPost: { post: { url: "https://blog.dev/p" } } } } }]);
    const res = await hashnode.publish!({
      content: { title: "Post", body: "cuerpo md", link: "https://x.dev", tags: ["a"] },
      credentials: { token: "pat", publicationId: "pub-1" },
    });

    expect(calls[0].url).toBe("https://gql.hashnode.com/");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("pat");
    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload.query).toContain("publishPost");
    expect(payload.variables.input.title).toBe("Post");
    expect(payload.variables.input.publicationId).toBe("pub-1");
    expect(payload.variables.input.contentMarkdown).toContain("https://x.dev"); // enlace anexado al markdown
    expect(res.externalUrl).toBe("https://blog.dev/p");
  });

  it("propaga errores GraphQL", async () => {
    stubSequence([{ json: { errors: [{ message: "Unauthorized" }] } }]);
    await expect(
      hashnode.publish!({ content: { title: "T", body: "b" }, credentials: { token: "x", publicationId: "p" } }),
    ).rejects.toThrow(/Unauthorized/);
  });
});

describe("devto.publish", () => {
  it("publica el artículo con tags y canonical_url", async () => {
    const calls = stubSequence([{ json: { id: 7, url: "https://dev.to/joni/post-7" } }]);
    const res = await devto.publish!({
      content: { title: "Art", body: "md", link: "https://x.dev", tags: ["AI", "Dev Tools"] },
      credentials: { apiKey: "key" },
    });

    expect(calls[0].url).toBe("https://dev.to/api/articles");
    expect((calls[0].init.headers as Record<string, string>)["api-key"]).toBe("key");
    const art = JSON.parse(String(calls[0].init.body)).article;
    expect(art.title).toBe("Art");
    expect(art.published).toBe(true);
    expect(art.canonical_url).toBe("https://x.dev");
    expect(art.tags).toEqual(["ai", "devtools"]); // normalizados por el motor de adaptación
    expect(res).toEqual({ externalId: "7", externalUrl: "https://dev.to/joni/post-7" });
  });
});
