import { describe, it, expect, vi, afterEach } from "vitest";
import { bluesky, parseBlueskyPostUrl } from "./bluesky";
import { mastodon, parseMastodonStatusUrl } from "./mastodon";
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

describe("parseBlueskyPostUrl", () => {
  it("acepta handle o DID, www, barra final y query", () => {
    expect(parseBlueskyPostUrl("https://bsky.app/profile/autor.bsky.social/post/3abc")).toEqual({
      actor: "autor.bsky.social",
      rkey: "3abc",
    });
    expect(parseBlueskyPostUrl("https://www.bsky.app/profile/did:plc:xyz/post/3abc/?ref=1")).toEqual({
      actor: "did:plc:xyz",
      rkey: "3abc",
    });
  });

  it("rechaza lo que no es un post de bsky.app", () => {
    expect(parseBlueskyPostUrl("https://bsky.app/profile/autor.bsky.social")).toBeNull();
    expect(parseBlueskyPostUrl("https://twitter.com/x/status/1")).toBeNull();
    expect(parseBlueskyPostUrl("")).toBeNull();
  });
});

describe("bluesky.publish (comentario)", () => {
  const creds = { identifier: "joni.bsky.social", appPassword: "pw" };
  const session = { accessJwt: "jwt", did: "did:plc:me", handle: "joni.bsky.social" };

  it("resuelve handle y post, y crea el record con reply root/parent", async () => {
    const target = "at://did:plc:autor/app.bsky.feed.post/abc";
    const calls = stubSequence([
      { json: session },
      { json: { did: "did:plc:autor" } },
      { json: { posts: [{ uri: target, cid: "cidabc", author: { handle: "autor.bsky.social" }, record: {} }] } },
      { json: { uri: "at://did:plc:me/app.bsky.feed.post/nuevo" } },
    ]);

    const res = await bluesky.publish!({
      content: { body: "buen apunte" },
      credentials: creds,
      kind: "comment",
      targetUrl: "https://bsky.app/profile/autor.bsky.social/post/abc",
    });

    expect(calls[1].url).toContain("com.atproto.identity.resolveHandle?handle=autor.bsky.social");
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe("Bearer jwt");
    expect(calls[2].url).toContain("app.bsky.feed.getPosts?uris=" + encodeURIComponent(target));
    expect(calls[3].url).toContain("com.atproto.repo.createRecord");
    const rec = JSON.parse(String(calls[3].init.body)).record;
    expect(rec.reply).toEqual({
      root: { uri: target, cid: "cidabc" },
      parent: { uri: target, cid: "cidabc" },
    });
    expect(rec.text).toContain("buen apunte");
    expect(res.externalUrl).toBe("https://bsky.app/profile/joni.bsky.social/post/nuevo");
  });

  it("si el destino ya es una respuesta, conserva el root del hilo", async () => {
    const raiz = { uri: "at://did:plc:otro/app.bsky.feed.post/raiz", cid: "cidraiz" };
    const hijo = "at://did:plc:autor/app.bsky.feed.post/hijo";
    const calls = stubSequence([
      { json: session },
      { json: { posts: [{ uri: hijo, cid: "cidhijo", record: { reply: { root: raiz, parent: raiz } } }] } },
      { json: { uri: "at://did:plc:me/app.bsky.feed.post/nuevo" } },
    ]);

    await bluesky.publish!({
      content: { body: "x" },
      credentials: creds,
      kind: "comment",
      targetUrl: "https://bsky.app/profile/did:plc:autor/post/hijo",
    });

    // Con DID en la URL no hay que resolver el handle: getPosts va justo tras el login.
    expect(calls[1].url).toContain("app.bsky.feed.getPosts");
    const rec = JSON.parse(String(calls[2].init.body)).record;
    expect(rec.reply.root).toEqual(raiz);
    expect(rec.reply.parent).toEqual({ uri: hijo, cid: "cidhijo" });
  });

  it("un post normal sigue sin llevar reply", async () => {
    const calls = stubSequence([{ json: session }, { json: { uri: "at://did:plc:me/app.bsky.feed.post/p" } }]);
    await bluesky.publish!({ content: { body: "post" }, credentials: creds });
    const rec = JSON.parse(String(calls[1].init.body)).record;
    expect(rec.reply).toBeUndefined();
  });

  it("con una URL de hilo inválida no abre sesión ni crea nada", async () => {
    const calls = stubSequence([{ json: session }]);
    await expect(
      bluesky.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://twitter.com/x/status/1",
      }),
    ).rejects.toThrow(/no reconocida/);
    expect(calls.length).toBe(0);
  });

  it("falla si el post destino no existe", async () => {
    stubSequence([{ json: session }, { json: { posts: [] } }]);
    await expect(
      bluesky.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://bsky.app/profile/did:plc:autor/post/nada",
      }),
    ).rejects.toThrow(/No existe el post/);
  });

  it("resolveTarget devuelve el at-uri y el autor sin publicar", async () => {
    const target = "at://did:plc:autor/app.bsky.feed.post/abc";
    const calls = stubSequence([
      { json: session },
      { json: { posts: [{ uri: target, cid: "c", author: { handle: "autor.bsky.social" }, record: {} }] } },
    ]);
    const t = await bluesky.resolveTarget!({
      targetUrl: "https://bsky.app/profile/did:plc:autor/post/abc",
      credentials: creds,
    });
    expect(t).toEqual({ id: target, author: "autor.bsky.social" });
    expect(calls.some((c) => c.url.includes("createRecord"))).toBe(false);
  });
});

describe("parseMastodonStatusUrl", () => {
  it("acepta /@user/id, /@user@remote/id y /users/user/statuses/id", () => {
    expect(parseMastodonStatusUrl("https://mastodon.social/@alguien/111")).toEqual({
      origin: "https://mastodon.social",
      id: "111",
    });
    expect(parseMastodonStatusUrl("https://Mastodon.social/@bob@otra.social/222/?x=1")).toEqual({
      origin: "https://mastodon.social",
      id: "222",
    });
    expect(parseMastodonStatusUrl("https://otra.social/users/bob/statuses/333")).toEqual({
      origin: "https://otra.social",
      id: "333",
    });
  });

  it("rechaza perfiles y URLs de otros formatos", () => {
    expect(parseMastodonStatusUrl("https://mastodon.social/@alguien")).toBeNull();
    expect(parseMastodonStatusUrl("https://pleroma.x/objects/28dad4b8-e9de")).toBeNull();
    expect(parseMastodonStatusUrl("https://bsky.app/profile/a/post/b")).toBeNull();
  });
});

describe("mastodon.publish (comentario)", () => {
  const creds = { instanceUrl: "https://mastodon.social", accessToken: "tok" };

  it("responde a un hilo de la propia instancia mencionando al autor", async () => {
    const calls = stubSequence([
      { json: { id: "111", account: { acct: "alguien" } } },
      { json: { id: 112, url: "https://mastodon.social/@joni/112" } },
    ]);

    const res = await mastodon.publish!({
      content: { body: "buen hilo" },
      credentials: creds,
      kind: "comment",
      targetUrl: "https://mastodon.social/@alguien/111",
    });

    expect(calls[0].url).toBe("https://mastodon.social/api/v1/statuses/111");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(calls[1].url).toBe("https://mastodon.social/api/v1/statuses");
    const body = JSON.parse(String(calls[1].init.body));
    expect(body.in_reply_to_id).toBe("111");
    expect(body.status).toBe("@alguien buen hilo");
    expect(res).toEqual({ externalId: "112", externalUrl: "https://mastodon.social/@joni/112" });
  });

  it("resuelve un hilo de otra instancia por búsqueda federada", async () => {
    const remoto = "https://otra.social/@bob/999";
    const calls = stubSequence([
      { json: { statuses: [{ id: "555", account: { acct: "bob@otra.social" } }] } },
      { json: { id: 556, url: "https://mastodon.social/@joni/556" } },
    ]);

    await mastodon.publish!({
      content: { body: "hola" },
      credentials: creds,
      kind: "comment",
      targetUrl: remoto,
    });

    expect(calls[0].url).toContain("https://mastodon.social/api/v2/search?");
    expect(calls[0].url).toContain("resolve=true");
    expect(calls[0].url).toContain("type=statuses");
    expect(calls[0].url).toContain(encodeURIComponent(remoto));
    const body = JSON.parse(String(calls[1].init.body));
    expect(body.in_reply_to_id).toBe("555");
    expect(body.status).toBe("@bob@otra.social hola");
  });

  it("no duplica la mención si el texto ya la lleva", async () => {
    const calls = stubSequence([
      { json: { id: "111", account: { acct: "alguien" } } },
      { json: { id: 112, url: "u" } },
    ]);
    await mastodon.publish!({
      content: { body: "gracias @alguien por el hilo" },
      credentials: creds,
      kind: "comment",
      targetUrl: "https://mastodon.social/@alguien/111",
    });
    expect(JSON.parse(String(calls[1].init.body)).status).toBe("gracias @alguien por el hilo");
  });

  it("un post normal sigue sin in_reply_to_id", async () => {
    const calls = stubSequence([{ json: { id: 1, url: "u" } }]);
    await mastodon.publish!({ content: { body: "toot" }, credentials: creds });
    expect(JSON.parse(String(calls[0].init.body)).in_reply_to_id).toBeUndefined();
  });

  it("con una URL de hilo inválida no llama a la API", async () => {
    const calls = stubSequence([{ json: {} }]);
    await expect(
      mastodon.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://mastodon.social/@alguien",
      }),
    ).rejects.toThrow(/no reconocida/);
    expect(calls.length).toBe(0);
  });

  it("si el token no puede buscar, explica la alternativa (URL local o scope read:search)", async () => {
    stubSequence([
      {
        ok: false,
        status: 401,
        json: { error: "Search queries that resolve remote resources are not supported without authentication" },
      },
    ]);
    await expect(
      mastodon.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://otra.social/@bob/1",
      }),
    ).rejects.toThrow(/read:search/);
  });

  it("falla si la búsqueda federada no encuentra el hilo", async () => {
    stubSequence([{ json: { statuses: [] } }]);
    await expect(
      mastodon.publish!({
        content: { body: "x" },
        credentials: creds,
        kind: "comment",
        targetUrl: "https://otra.social/@bob/1",
      }),
    ).rejects.toThrow(/no pudo resolver/);
  });

  it("resolveTarget devuelve id local y acct sin publicar", async () => {
    const calls = stubSequence([{ json: { id: "777", account: { acct: "bob@otra.social" } } }]);
    const t = await mastodon.resolveTarget!({
      targetUrl: "https://mastodon.social/@bob@otra.social/777",
      credentials: creds,
    });
    expect(t).toEqual({ id: "777", author: "bob@otra.social" });
    expect(calls.length).toBe(1);
    expect(calls[0].init.method).toBeUndefined();
  });
});
