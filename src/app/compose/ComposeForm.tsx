"use client";

import { useState } from "react";
import { createPost } from "@/lib/actions";
import { adaptContent } from "@/lib/channels/adapt";
import type { PublishContent } from "@/lib/channels/types";

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
  const [tags, setTags] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const tagsArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const content: PublishContent =
    kind === "post"
      ? { title: title || undefined, body, link: link || undefined, tags: tagsArr }
      : { body };

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedChannels = channels.filter((c) => selected.has(c.id));

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
            placeholder="Show HN: Lookspan — observabilidad y replay para apps con LLMs"
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
        <>
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
          <label className="block">
            <span className="text-sm font-medium">
              Tags <span className="text-zinc-400">(separados por coma, opcional)</span>
            </span>
            <input
              name="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="llm, observability, devtools"
              className={inputCls}
            />
          </label>
        </>
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
                    const a = adaptContent(content, c.id);
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
                        {a.limit != null && (
                          <span
                            className={`text-xs tabular-nums ${a.overLimit ? "font-semibold text-red-500" : "text-zinc-400"}`}
                          >
                            {a.length}/{a.limit}
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

      {selectedChannels.length > 0 && (body.trim() || title.trim()) && (
        <div>
          <span className="text-sm font-medium">Vista previa por canal</span>
          <div className="mt-2 space-y-2">
            {selectedChannels.map((c) => {
              const a = adaptContent(content, c.id);
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {c.emoji} {c.name}
                    </span>
                    {a.limit != null && (
                      <span
                        className={`text-xs tabular-nums ${a.overLimit ? "font-semibold text-red-500" : "text-zinc-400"}`}
                      >
                        {a.length}/{a.limit}
                      </span>
                    )}
                  </div>
                  {a.title && (
                    <div className="mt-1.5 text-xs">
                      <span className="font-semibold text-zinc-500">Título:</span> {a.title}
                    </div>
                  )}
                  <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-zinc-600 dark:text-zinc-300">
                    {a.text || <span className="text-zinc-400">(sin cuerpo)</span>}
                  </pre>
                  {a.link && (
                    <div className="truncate text-xs text-indigo-500">🔗 {a.link}</div>
                  )}
                  {a.tags?.length ? (
                    <div className="text-xs text-zinc-400">tags: {a.tags.join(", ")}</div>
                  ) : null}
                  {a.notes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.notes.map((n, i) => (
                        <span
                          key={i}
                          className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-500"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={selected.size === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          Crear y publicar
        </button>
        <span className="text-xs text-zinc-500">
          {selected.size} canal(es) · cada uno se adapta a su plataforma
        </span>
      </div>
    </form>
  );
}
