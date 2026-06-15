# Pregón

![License](https://img.shields.io/github/license/JoniMartin27/pregon)

> Cross-poster centralizado + seguimiento de tracción para tus proyectos OSS.

Pregón es un panel local para **componer una vez y publicar en muchos canales**,
guardar el historial, y seguir la tracción real de cada proyecto (npm / PyPI /
GitHub) en el tiempo. Adapta automáticamente cada mensaje al formato de cada
plataforma y, cuando una plataforma no tiene API abierta, te abre el compositor
con el texto ya cargado.

Forma parte de [Fervon](https://fervon.dev) — un pequeño estudio de
herramientas de desarrollo local-first.

> ⭐ **Si Pregón te ahorra abrir cinco pestañas para publicar lo mismo, [dale una estrella](https://github.com/JoniMartin27/pregon) — es la forma más rápida de ayudar.** ¿Te falta un canal o tienes una idea? [Abre un issue](https://github.com/JoniMartin27/pregon/issues).

## Qué hace

- **Componer → publicar → historial.** Escribes un mensaje, eliges canales y
  publicas; cada publicación queda registrada con su estado y enlace. Soporta
  comentarios de seguimiento sobre publicaciones existentes.
- **Motor de adaptación por plataforma.** Cada canal tiene su propio adapter que
  ajusta longitud, tono y formato (hilos, markdown, etiquetas) y ofrece una
  vista previa por canal antes de publicar.
- **Conectar cuentas.** Al conectar una cuenta se activa la publicación
  automática para ese canal. Las credenciales se cifran en reposo con AES-256-GCM
  (`PREGON_MASTER_KEY`).
- **Hub por proyecto.** Por cada proyecto: notas / registro de "lo que hemos
  hablado", tracción real de **npm, PyPI y GitHub**, y un tracker de crecimiento
  con snapshots históricos y sparklines. `/api/snapshot` permite capturar
  snapshots desde un cron.

### Canales

| Estado | Canales |
|---|---|
| 🟢 **Auto** (API) | Telegram · Discord · Slack · Mastodon · Bluesky · Dev.to · Reddit (post + comentario) · Hashnode |
| 🟡 **Asistido** (URL pre-cargada) | X · Threads · LinkedIn · Hacker News · Lobsters · Indie Hackers |

Son **8 canales automáticos** y 6 asistidos. Los asistidos abren el compositor
de la plataforma con el texto ya rellenado (sus APIs son de pago o requieren
revisión manual).

## Stack

- **Next.js 16** (App Router) · React 19
- **Prisma 6** + **SQLite**
- **Tailwind CSS 4**
- TypeScript · ejecutables auxiliares con `tsx`

## Puesta en marcha

```bash
npm install
cp .env.example .env          # rellena PREGON_MASTER_KEY (ver abajo)
npm run db:seed               # crea + siembra la base SQLite
npm run dev                   # http://localhost:4040
```

Abre <http://localhost:4040>.

### Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | Ruta SQLite de Prisma (`file:./dev.db` por defecto) |
| `PREGON_MASTER_KEY` | sí | Clave AES-256-GCM para cifrar credenciales de cuentas en reposo. Genérala con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GITHUB_TOKEN` | opcional | PAT de solo lectura para stars/forks de repos privados y subir el rate limit. Los repos públicos funcionan sin él |

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `:4040` |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build en `:4040` |
| `npm run lint` | ESLint |
| `npm run db:seed` | Siembra la base de datos |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | Resetea las migraciones |
| `npm run reddit:connect` | Conecta una cuenta de Reddit (OAuth) |
| `npm run reddit:radar` | Radar de Reddit |
| `npm run reddit:health` | Comprueba el estado de la conexión de Reddit |
| `npm run reddit:schedule` | Programador de Reddit |

## Estructura

| Ruta | Rol |
|---|---|
| `src/app/compose` | Compositor: escribir, elegir canales, vista previa, publicar |
| `src/app/history` | Historial de publicaciones |
| `src/app/accounts` | Conectar / gestionar cuentas |
| `src/app/projects/[slug]` | Hub por proyecto (notas + tracción + crecimiento) |
| `src/app/api/snapshot` | Endpoint para capturar snapshots de tracción (cron) |
| `src/lib/channels/adapters` | Un adapter por canal (auto / asistido / planificado) |
| `src/lib/channels/registry.ts` | Registro de canales y su estado real (`auto` / `assisted` / `planned`) |
| `src/lib/traction.ts` · `snapshot.ts` | Tracción npm/PyPI/GitHub y snapshots de crecimiento |
| `src/lib/crypto.ts` | Cifrado AES-256-GCM de credenciales |
| `prisma/schema.prisma` | Modelo de datos (Project, Account, Post, Variant, Publication, Metric, ProjectNote, ProjectSnapshot) |

## Licencia

MIT

---

Part of [Fervon](https://fervon.dev) — a portfolio of local-first developer tools.
