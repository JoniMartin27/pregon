import { describe, it, expect } from "vitest";
import { ADAPTERS, getAdapter, readiness } from "./registry";

describe("getAdapter", () => {
  it("encuentra un adapter por id", () => {
    expect(getAdapter("reddit")?.name).toBe("Reddit");
  });

  it("devuelve undefined para id desconocido", () => {
    expect(getAdapter("nope")).toBeUndefined();
  });
});

describe("readiness", () => {
  it("auto si implementa publish()", () => {
    expect(readiness(getAdapter("mastodon")!)).toBe("auto");
  });

  it("assisted si solo implementa composeUrl()", () => {
    expect(readiness(getAdapter("x")!)).toBe("assisted");
  });
});

describe("invariantes del registro", () => {
  it("los ids son únicos", () => {
    const ids = ADAPTERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("los canales 'auto' declaran capability auto y tienen publish", () => {
    for (const a of ADAPTERS.filter((a) => readiness(a) === "auto")) {
      expect(a.publish, `${a.id} debería tener publish`).toBeTypeOf("function");
      expect(a.capability).toBe("auto");
    }
  });

  it("hay al menos los 8 canales auto documentados", () => {
    const auto = ADAPTERS.filter((a) => readiness(a) === "auto").map((a) => a.id);
    expect(auto).toEqual(
      expect.arrayContaining(["telegram", "discord", "slack", "mastodon", "bluesky", "devto", "reddit", "hashnode"]),
    );
    expect(auto.length).toBeGreaterThanOrEqual(8);
  });

  it("cada adapter tiene id, name, group y emoji", () => {
    for (const a of ADAPTERS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.group).toBeTruthy();
      expect(a.emoji).toBeTruthy();
    }
  });
});
