import { describe, it, expect } from "vitest";
import { buildContent, openUrlFor, type PostLike } from "./publish";
import { reddit } from "./channels/adapters/reddit";
import { telegram } from "./channels/adapters/telegram";

const post: PostLike = {
  kind: "post",
  title: "Mi título",
  body: "el cuerpo",
  link: "https://x.dev",
  targetUrl: null,
  tags: JSON.stringify(["ai", "tools"]),
};

describe("buildContent", () => {
  it("convierte un Post en contenido canónico", () => {
    expect(buildContent(post)).toEqual({
      title: "Mi título",
      body: "el cuerpo",
      link: "https://x.dev",
      tags: ["ai", "tools"],
    });
  });

  it("trata title/link nulos como undefined", () => {
    const c = buildContent({ ...post, title: null, link: null, tags: null });
    expect(c.title).toBeUndefined();
    expect(c.link).toBeUndefined();
    expect(c.tags).toBeUndefined();
  });

  it("ignora tags con JSON inválido sin reventar", () => {
    expect(buildContent({ ...post, tags: "{no-json" }).tags).toBeUndefined();
  });

  it("ignora tags que no son un array", () => {
    expect(buildContent({ ...post, tags: JSON.stringify({ a: 1 }) }).tags).toBeUndefined();
  });

  it("convierte elementos no-string a string", () => {
    expect(buildContent({ ...post, tags: JSON.stringify([1, 2]) }).tags).toEqual(["1", "2"]);
  });
});

describe("openUrlFor", () => {
  const content = buildContent(post);

  it("al comentar devuelve la URL del hilo destino", () => {
    const commentPost = { ...post, kind: "comment", targetUrl: "https://reddit.com/hilo" };
    expect(openUrlFor(reddit, commentPost, content)).toBe("https://reddit.com/hilo");
  });

  it("al comentar sin targetUrl devuelve null", () => {
    const commentPost = { ...post, kind: "comment", targetUrl: null };
    expect(openUrlFor(reddit, commentPost, content)).toBeNull();
  });

  it("al postear usa el composeUrl del adapter si existe", () => {
    const url = openUrlFor(reddit, post, content);
    expect(url).toContain("reddit.com/submit");
  });

  it("devuelve null si el adapter no soporta modo asistido (telegram)", () => {
    expect(telegram.composeUrl).toBeUndefined();
    expect(openUrlFor(telegram, post, content)).toBeNull();
  });
});
