"use client";

import { useState } from "react";
import { createPost } from "@/lib/actions";

type Channel = {
  id: string;
  name: string;
  emoji: string;
  group: string;
  mode: "auto" | "assisted";
  maxLength: number | null;
  connected: boolean;
};
type Group = { id: string; label: string };

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900";

export function ComposeForm({
  projects,
  channels,
  groups,
}: {
  projects: { id: string; name: string }[];
  channels: Channel[];
  groups: Group[];
}) {
  const [kind, setKind] = useState<"post" | "comment">("post");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Longitud aproximada del texto que se enviaría (título + cuerpo + enlace).
  const baseLen =
    (title ? title.length + 2 : 0) +
    body.length +
    (kind === "post" && link ? link.length + 2 : 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={createPost} className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Proyecto</span>
          <select name="projectId" required className={inputCls}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="block">
          <span className="text-sm font-medium">Tipo</span>
          <div className="mt-1 inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setKind("post")}
              className={`rounded-md px-3 py-1.5 text-sm ${kind === "post" ? "bg-indigo-600 text-white" : "text-zinc-500"}`}
            >
              Post nuevo
            </button>
            <button
              type="button"
              onClick={() => setKind("comment")}
              className={`rounded-md px-3 py-1.5 text-sm ${kind === "comment" ? "bg-indigo-600 text-white" : "text-zinc-500"}`}
            >
              Comentario
            </button>
          </div>
          <input type="hidden" name="kind" value={kind} />
        </div>
      </div>

      {kind === "post" && (
        <label className="block">
          <span className="text-sm font-medium">
            Título <span className="text-zinc-400">(opcional)</span>
          </span>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="Show HN: Lookspan — observabilidad para apps con LLMs"
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm font-medium">
          {kind === "comment" ? "Comentario" : "Mensaje"}
        </span>
        <textarea
          name="body"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={inputCls}
          placeholder={kind === "comment" ? "Tu respuesta en el hilo…" : "De qué va, por qué importa…"}
        />
      </label>

      {kind === "post" ? (
        <label className="block">
          <span className="text-sm font-medium">
            Enlace <span className="text-zinc-400">(opcional)</span>
          </span>
          <input
            name="link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
      ) : (
        <label className="block">
          <span className="text-sm font-medium">URL del hilo</span>
          <input
            name="targetUrl"
            type="url"
            required
            placeholder="https://news.ycombinator.com/item?id=…"
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Pregón abrirá este hilo para que pegues tu comentario y lo registra.
          </span>
        </label>
      )}

      <label className="block">
        <span className="text-sm font-medium">
          Tags <span className="text-zinc-400">(separados por coma, opcional)</span>
        </span>
        <input name="tags" placeholder="llm, observability, devtools" className={inputCls} />
      </label>

      <div>
        <span className="text-sm font-medium">Canales</span>
        <div className="mt-2 space-y-4">
          {groups.map((g) => {
            const items = channels.filter((c) => c.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {g.label}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((c) => {
                    const over = c.maxLength != null && baseLen > c.maxLength;
                    const isSel = selected.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                          isSel
                            ? "border-indigo-500 bg-indigo-500/5"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="channels"
                          value={c.id}
                          checked={isSel}
                          onChange={() => toggle(c.id)}
                          className="accent-indigo-600"
                        />
                        <span>{c.emoji}</span>
                        <span className="flex-1 text-sm">{c.name}</span>
                        {c.mode === "auto" ? (
                          <span className={`text-xs ${c.connected ? "text-emerald-500" : "text-zinc-400"}`}>
                            {c.connected ? "auto ✓" : "sin cuenta"}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500">asistido</span>
                        )}
                        {c.maxLength != null && (
                          <span
                            className={`text-xs tabular-nums ${over ? "font-semibold text-red-500" : "text-zinc-400"}`}
                          >
                            {baseLen}/{c.maxLength}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={selected.size === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          Crear y publicar
        </button>
        <span className="text-xs text-zinc-500">
          {selected.size} canal(es) · auto publica ya; asistido genera enlaces en Historial
        </span>
      </div>
    </form>
  );
}
