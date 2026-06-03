import { prisma } from "@/lib/db";
import { ADAPTERS } from "@/lib/channels/registry";
import { connectAccount, disconnectAccount } from "@/lib/actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({ orderBy: { createdAt: "asc" } });

  // Solo canales con publicación por API y campos de credencial.
  const connectable = ADAPTERS.filter(
    (a) => a.publish && a.credentialFields.length > 0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
      <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
        Conecta tus cuentas para publicar automáticamente por API. Las credenciales
        se guardan <b>cifradas (AES-256-GCM)</b> en tu base local; nunca salen al repo.
      </p>

      <div className="mt-6 space-y-3">
        {connectable.map((a) => {
          const accs = accounts.filter((x) => x.channel === a.id);
          return (
            <details
              key={a.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <span className="text-xl">{a.emoji}</span>
                <span>{a.name}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                    accs.length
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-zinc-500/15 text-zinc-400"
                  }`}
                >
                  {accs.length ? `${accs.length} conectada(s)` : "sin conectar"}
                </span>
              </summary>

              {accs.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {accs.map((acc) => (
                    <li key={acc.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{acc.label}</span>
                      <form action={disconnectAccount}>
                        <input type="hidden" name="accountId" value={acc.id} />
                        <button type="submit" className="text-xs text-zinc-400 hover:text-red-500">
                          Desconectar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={connectAccount}
                className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800"
              >
                <input type="hidden" name="channel" value={a.id} />
                {a.credentialFields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-sm font-medium">
                      {f.label}
                      {f.required && <span className="text-red-400"> *</span>}
                    </span>
                    <input
                      name={f.key}
                      type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
                      required={f.required}
                      placeholder={f.help}
                      autoComplete="off"
                      className={inputCls}
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="text-sm font-medium">
                    Etiqueta <span className="text-zinc-400">(opcional)</span>
                  </span>
                  <input name="label" placeholder={a.name} className={inputCls} />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Conectar {a.name}
                </button>
              </form>
            </details>
          );
        })}
      </div>
    </div>
  );
}
