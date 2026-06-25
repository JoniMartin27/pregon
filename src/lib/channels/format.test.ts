import { describe, it, expect } from "vitest";
import { plainText, escapeHtml, truncate } from "./format";

describe("plainText", () => {
  it("une título, cuerpo y enlace con doble salto", () => {
    expect(plainText({ title: "T", body: "B", link: "https://x.dev" })).toBe("T\n\nB\n\nhttps://x.dev");
  });

  it("omite título y enlace ausentes", () => {
    expect(plainText({ body: "solo cuerpo" })).toBe("solo cuerpo");
  });
});

describe("escapeHtml", () => {
  it("escapa &, < y > (y en ese orden, sin doble-escapar)", () => {
    expect(escapeHtml('<a href="x">tom & jerry</a>')).toBe(
      '&lt;a href="x"&gt;tom &amp; jerry&lt;/a&gt;',
    );
  });
});

describe("truncate", () => {
  it("no toca cadenas dentro del límite", () => {
    expect(truncate("hola", 10)).toBe("hola");
  });

  it("recorta y añade elipsis respetando el máximo total", () => {
    const out = truncate("abcdefghij", 5);
    expect(out).toBe("abcd…");
    expect(out).toHaveLength(5);
  });

  it("recorta espacios sobrantes antes de la elipsis", () => {
    expect(truncate("abcd     efg", 6)).toBe("abcd…");
  });
});
