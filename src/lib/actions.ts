"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/channels/registry";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { buildContent } from "@/lib/publish";
import { captureSnapshots } from "@/lib/snapshot";
import type { ChannelAdapter } from "@/lib/channels/types";

const CreateSchema = z.object({
  projectId: z.string().min(1, "Elige un proyecto"),
  kind: z.enum(["post", "comment"]),
  title: z.string().trim().optional(),
  body: z.string().trim().min(1, "Escribe el mensaje"),
  link: z.string().trim().url().optional().or(z.literal("")),
  targetUrl: z.string().trim().url("La URL del hilo no es válida").optional().or(z.literal("")),
  tags: z.string().trim().optional(),
  channels: z.array(z.string()).min(1, "Elige al menos un canal"),
});

/** Crea un Post + sus Publications, e intenta auto-publicar donde haya cuenta. */
export async function createPost(formData: FormData) {
  const parsed = CreateSchema.safeParse({
    projectId: formData.get("projectId"),
    kind: formData.get("kind") ?? "post",
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    link: formData.get("link") ?? "",
    targetUrl: formData.get("targetUrl") ?? "",
    tags: formData.get("tags") ?? "",
    channels: formData.getAll("channels").map(String),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
  }
  const d = parsed.data;
  if (d.kind === "comment" && !d.targetUrl) {
    throw new Error("Para comentar, indica la URL del hilo");
  }

  const tagsArr = d.tags
    ? d.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const post = await prisma.post.create({
    data: {
      projectId: d.projectId,
      kind: d.kind,
      title: d.title || null,
      body: d.body,
      link: d.kind === "post" ? d.link || null : null,
      targetUrl: d.kind === "comment" ? d.targetUrl || null : null,
      tags: tagsArr.length ? JSON.stringify(tagsArr) : null,
      status: "publishing",
      publications: {
        create: d.channels.map((channel) => ({ channel, status: "pending" })),
      },
    },
    include: { publications: true },
  });

  // Intentar auto-publicar en canales con cuenta conectada.
  const content = buildContent(post);
  for (const pub of post.publications) {
    const adapter = getAdapter(pub.channel);
    if (!adapter?.publish) continue; // asistido / sin wiring -> queda 'pending'
    const account = await prisma.account.findFirst({
      where: { channel: pub.channel, status: "active" },
    });
    if (!account) continue; // sin cuenta -> queda 'pending' (conéctala o usa asistido)
    try {
      const creds = decryptJson(account.credentials);
      const meta = account.meta
        ? (JSON.parse(account.meta) as Record<string, string>)
        : undefined;
      const result = await adapter.publish({
        content,
        credentials: creds,
        meta,
        kind: post.kind === "comment" ? "comment" : "post",
        targetUrl: post.targetUrl ?? undefined,
      });
      await prisma.publication.update({
        where: { id: pub.id },
        data: {
          accountId: account.id,
          status: "published",
          externalId: result.externalId ?? null,
          externalUrl: result.externalUrl ?? null,
          publishedAt: new Date(),
        },
      });
    } catch (e) {
      await prisma.publication.update({
        where: { id: pub.id },
        data: {
          accountId: account.id,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }

  await recomputePostStatus(post.id);
  revalidatePath("/history");
  redirect("/history");
}

/** Registra manualmente una publicación asistida como publicada (con su enlace). */
export async function markPublished(formData: FormData) {
  const id = String(formData.get("publicationId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!id) throw new Error("Falta publicationId");
  const pub = await prisma.publication.update({
    where: { id },
    data: {
      status: "published",
      externalUrl: url || null,
      publishedAt: new Date(),
    },
  });
  await recomputePostStatus(pub.postId);
  revalidatePath("/history");
}

export async function deletePost(formData: FormData) {
  const id = String(formData.get("postId") ?? "");
  if (!id) return;
  await prisma.post.delete({ where: { id } });
  revalidatePath("/history");
}

/** Conecta una cuenta en un canal: cifra y guarda sus credenciales. */
export async function connectAccount(formData: FormData) {
  const channel = String(formData.get("channel") ?? "");
  const adapter = getAdapter(channel);
  if (!adapter) throw new Error("Canal desconocido");

  const creds: Record<string, string> = {};
  for (const f of adapter.credentialFields) {
    const v = String(formData.get(f.key) ?? "").trim();
    if (f.required && !v) throw new Error(`Falta ${f.label}`);
    if (v) creds[f.key] = v;
  }

  const label = String(formData.get("label") ?? "").trim() || defaultLabel(adapter, creds);
  await prisma.account.create({
    data: { channel, label, credentials: encryptJson(creds), status: "active" },
  });
  revalidatePath("/accounts");
  revalidatePath("/compose");
}

export async function disconnectAccount(formData: FormData) {
  const id = String(formData.get("accountId") ?? "");
  if (!id) return;
  await prisma.account.delete({ where: { id } });
  revalidatePath("/accounts");
  revalidatePath("/compose");
}

/** Añade una nota al registro "lo que hemos hablado" de un proyecto. */
export async function addProjectNote(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const kind = String(formData.get("kind") ?? "note");
  if (!projectId || !body) return;
  await prisma.projectNote.create({ data: { projectId, body, kind } });
  if (slug) revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

export async function deleteProjectNote(formData: FormData) {
  const id = String(formData.get("noteId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;
  await prisma.projectNote.delete({ where: { id } });
  if (slug) revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/** Configura el paquete npm y/o el repo GitHub de un proyecto (para tracción). */
export async function updateProjectLinks(formData: FormData) {
  const id = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;
  const npmPackage = String(formData.get("npmPackage") ?? "").trim() || null;
  const pypiPackage = String(formData.get("pypiPackage") ?? "").trim() || null;
  const raw = String(formData.get("githubRepo") ?? "").trim();
  const githubRepo =
    raw
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "") || null;
  await prisma.project.update({
    where: { id },
    data: { npmPackage, pypiPackage, githubRepo },
  });
  if (slug) revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/** Captura un snapshot de tracción ahora mismo (botón manual). */
export async function captureNow(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  await captureSnapshots();
  if (slug) revalidatePath(`/projects/${slug}`);
  revalidatePath("/");
}

/** Etiqueta legible por defecto a partir de un campo NO secreto, si existe. */
function defaultLabel(adapter: ChannelAdapter, creds: Record<string, string>): string {
  const hint = creds.instanceUrl || creds.chatId || creds.identifier;
  return hint ? `${adapter.name} · ${hint}` : adapter.name;
}

/** Recalcula el estado agregado del Post según sus Publications. */
async function recomputePostStatus(postId: string) {
  const pubs = await prisma.publication.findMany({ where: { postId } });
  const total = pubs.length;
  const published = pubs.filter((p) => p.status === "published").length;
  const failed = pubs.filter((p) => p.status === "failed").length;
  let status = "pending";
  if (total > 0 && published === total) status = "published";
  else if (published > 0) status = "partial";
  else if (total > 0 && failed === total) status = "failed";
  await prisma.post.update({ where: { id: postId }, data: { status } });
}
