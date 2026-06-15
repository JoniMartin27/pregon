// CONECTAR CUENTA DE REDDIT (CLI) — alternativa al formulario /accounts.
//
// Lee las credenciales de variables de entorno (NUNCA las hardcodees aquí),
// las VALIDA pidiendo un token a la API oficial, y solo si funciona las guarda
// CIFRADAS (AES-256-GCM) como una Account de Pregón — exactamente igual que el
// formulario web. Así el cron y los scripts reddit:* tienen cuenta con la que
// autenticarse.
//
// Uso (PowerShell), rellenando TÚ los valores de tu app 'script':
//   $env:REDDIT_CLIENT_ID="..."; $env:REDDIT_CLIENT_SECRET="..."; `
//   $env:REDDIT_USERNAME="tu_usuario"; $env:REDDIT_PASSWORD="tu_contraseña"; `
//   $env:REDDIT_SUBREDDIT="SideProject"; npm run reddit:connect
//
// Tras ejecutarlo, limpia las variables de la sesión:
//   Remove-Item Env:REDDIT_CLIENT_ID,Env:REDDIT_CLIENT_SECRET,Env:REDDIT_USERNAME,Env:REDDIT_PASSWORD,Env:REDDIT_SUBREDDIT
import { prisma } from "../src/lib/db";
import { encryptJson } from "../src/lib/crypto";
import { getToken, type RedditCreds } from "./lib/reddit-api";

function req(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

async function main() {
  const creds: RedditCreds = {
    clientId: req("REDDIT_CLIENT_ID"),
    clientSecret: req("REDDIT_CLIENT_SECRET"),
    username: req("REDDIT_USERNAME"),
    password: req("REDDIT_PASSWORD"),
  };
  const subreddit = (process.env.REDDIT_SUBREDDIT ?? "").replace(/^\/?r\//i, "").trim();
  if (subreddit) creds.subreddit = subreddit;

  // 1) Validar contra la API oficial antes de guardar nada.
  process.stdout.write("Validando credenciales contra Reddit… ");
  await getToken(creds);
  console.log("OK ✓");

  // 2) ¿Ya hay una cuenta reddit? La reemplazamos (evita duplicados).
  const existing = await prisma.account.findFirst({ where: { channel: "reddit" } });
  const label = `Reddit · /u/${creds.username}`;
  const data = {
    channel: "reddit",
    label,
    credentials: encryptJson(creds as unknown as Record<string, string>),
    status: "active",
  };
  if (existing) {
    await prisma.account.update({ where: { id: existing.id }, data });
    console.log(`Cuenta reddit actualizada (${label}).`);
  } else {
    await prisma.account.create({ data });
    console.log(`Cuenta reddit conectada (${label}).`);
  }
  console.log("Ya puedes usar: npm run reddit:radar / reddit:health / reddit:schedule");
}

main()
  .catch((e) => {
    console.error("✗ " + (e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
