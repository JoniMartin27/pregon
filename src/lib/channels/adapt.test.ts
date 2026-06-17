import { describe, it, expect } from "vitest";
import { adaptContent, profileFor } from "./adapt";
import type { PublishContent } from "./types";

const base: PublishContent = {
  title: "Lanzamiento de Pregón",
  body: "Cross-poster centralizado para indie hackers.",
  link: "https://pregon.dev",
  tags: ["indie", "open source"],
};

describe("profileFor", () => {
  it("devuelve el perfil del canal conocido", () => {
    expect(profileFor("x").limit).toBe(280);
    expect(profileFor("reddit").titleMode).toBe("separate");
  });

  it("cae al perfil por defecto para canales desconocidos", () => {
    const p = profileFor("canal-inexistente");
    expect(p).toEqual({ titleMode: "inline", linkMode: "inline", hashtags: "append" });
  });
});

describe("adaptContent — título", () => {
  it("inline: el título va dentro del cuerpo (X)", () => {
    const a = adaptContent(base, "x");
    expect(a.title).toBeUndefined();
    expect(a.text.startsWith("Lanzamiento de Pregón")).toBe(true);
  });

  it("separate: el título sale en su propio campo (reddit)", () => {
    const a = adaptContent(base, "reddit");
    expect(a.title).toBe("Lanzamiento de Pregón");
    // y no se repite dentro del cuerpo
    expect(a.text).not.toContain("Lanzamiento de Pregón");
  });

  it("recorta espacios del título", () => {
    const a = adaptContent({ ...base, title: "  Hola  " }, "reddit");
    expect(a.title).toBe("Hola");
  });
});

describe("adaptContent — enlace", () => {
  it("inline (mastodon): el enlace se concatena al cuerpo", () => {
    const a = adaptContent(base, "mastodon");
    expect(a.link).toBeUndefined();
    expect(a.text).toContain("https://pregon.dev");
  });

  it("separate (reddit): el enlace sale en su propio campo, no en el cuerpo", () => {
    const a = adaptContent(base, "reddit");
    expect(a.link).toBe("https://pregon.dev");
    expect(a.text).not.toContain("https://pregon.dev");
    expect(a.notes).toContain("enlace en campo aparte");
  });
});

describe("adaptContent — hashtags", () => {
  it("append (mastodon): tags → #hashtags pegados al final, sin espacios internos", () => {
    const a = adaptContent(base, "mastodon");
    expect(a.text).toContain("#indie");
    expect(a.text).toContain("#opensource"); // "open source" → "opensource"
    expect(a.tags).toBeUndefined();
    expect(a.notes).toContain("tags → hashtags");
  });

  it("tagsField (devto): tags → campo, en minúsculas y alfanumérico, máx 4", () => {
    const a = adaptContent(
      { ...base, tags: ["AI", "Dev Tools", "Open-Source", "Cross Posting", "extra"] },
      "devto",
    );
    expect(a.tags).toEqual(["ai", "devtools", "opensource", "crossposting"]);
    expect(a.tags).toHaveLength(4); // "extra" se descarta por el slice(0,4)
    expect(a.notes).toContain("tags → campo de tags");
  });

  it("none (telegram): los tags se omiten", () => {
    const a = adaptContent(base, "telegram");
    expect(a.text).not.toContain("#indie");
    expect(a.tags).toBeUndefined();
    expect(a.notes).toContain("tags omitidos aquí");
  });
});

describe("adaptContent — longitud y recorte", () => {
  it("cuenta un enlace como 23 chars en X (peso t.co), no su longitud real", () => {
    // En X el enlace va en campo aparte (linkMode separate) y pesa urlWeight+1.
    const longUrl = "https://example.com/" + "a".repeat(100);
    const a = adaptContent({ body: "Hola", link: longUrl }, "x");
    expect(a.link).toBe(longUrl); // campo separado, no en el cuerpo
    expect(a.text).toBe("Hola");
    // "Hola" (4) + coste del enlace (23 + 1) = 28, sin importar su longitud real
    expect(a.length).toBe(28);
    expect(a.overLimit).toBe(false);
  });

  it("recorta el cuerpo cuando excede el límite del canal", () => {
    const a = adaptContent({ body: "x".repeat(400) }, "x");
    expect(a.length).toBeLessThanOrEqual(280);
    expect(a.text.endsWith("…")).toBe(true);
    expect(a.notes.some((n) => n.includes("recortado"))).toBe(true);
  });

  it("reserva presupuesto para los hashtags al recortar", () => {
    const a = adaptContent({ body: "y".repeat(400), tags: ["lanzamiento"] }, "x");
    expect(a.length).toBeLessThanOrEqual(280);
    expect(a.text).toContain("#lanzamiento"); // el hashtag sobrevive al recorte
  });

  it("no recorta el cuerpo en canales con título separado (devto sin límite)", () => {
    const a = adaptContent({ title: "T", body: "z".repeat(5000) }, "devto");
    expect(a.text).toHaveLength(5000);
    expect(a.overLimit).toBe(false);
    expect(a.limit).toBeUndefined();
  });

  it("marca overLimit solo cuando el cuerpo supera el límite efectivo", () => {
    const a = adaptContent({ body: "corto" }, "bluesky");
    expect(a.overLimit).toBe(false);
    expect(a.limit).toBe(300);
  });
});

describe("adaptContent — casos límite", () => {
  it("sin nada relevante produce texto vacío y no peta", () => {
    const a = adaptContent({ body: "" }, "x");
    expect(a.text).toBe("");
    expect(a.length).toBe(0);
    expect(a.overLimit).toBe(false);
  });

  it("solo tags (append) produce únicamente los hashtags", () => {
    const a = adaptContent({ body: "", tags: ["solo"] }, "mastodon");
    expect(a.text).toBe("#solo");
  });

  it("filtra tags vacíos", () => {
    const a = adaptContent({ body: "hola", tags: ["  ", "real"] }, "mastodon");
    expect(a.text).toContain("#real");
    expect(a.text).not.toContain("# ");
  });

  it("título separado que excede el límite añade nota de aviso", () => {
    const a = adaptContent({ title: "T".repeat(90), body: "b" }, "hackernews");
    expect(a.notes.some((n) => n.includes("título excede"))).toBe(true);
  });
});
