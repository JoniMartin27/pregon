import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pregón — centro de difusión · Fervon",
  description:
    "Redacta una vez, publica en todas tus comunidades y lleva el registro de cada post. Forjado al rojo vivo por Fervon.",
  openGraph: {
    title: "Pregón — centro de difusión · Fervon",
    description:
      "Redacta una vez, publica en todas tus comunidades y lleva el registro de cada post. Forjado al rojo vivo por Fervon.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Pregón — Parte de Fervon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pregón — centro de difusión · Fervon",
    description:
      "Redacta una vez, publica en todas tus comunidades y lleva el registro de cada post. Forjado al rojo vivo por Fervon.",
    images: ["/og.svg"],
  },
};

function FlameMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 104 126"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pf-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#B5300A" />
          <stop offset=".45" stopColor="#E0480F" />
          <stop offset=".75" stopColor="#FF6A00" />
          <stop offset="1" stopColor="#FFB02E" />
        </linearGradient>
        <linearGradient id="pf-spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF6A00" />
          <stop offset="1" stopColor="#FFD37A" />
        </linearGradient>
      </defs>
      <path
        d="M44 4 C30 4 22 13 22 30 L22 40 L8 40 L8 56 L22 56 L22 116 C22 119 24 121 27 121 L37 121 C40 121 42 119 42 116 L42 56 L60 56 L60 40 L42 40 L42 30 C42 23 45 20 52 20 L64 20 L64 4 Z"
        fill="url(#pf-flame)"
      />
      <path
        d="M58 40 L96 40 C92 47 86 50 78 50 L60 50 L58 56 L60 56 L78 56 C88 56 96 49 99 39 C100 36 99 33 96 33 L60 33 L58 40 Z"
        fill="url(#pf-spark)"
      />
      <circle cx="84" cy="19" r="3.2" fill="#FFD37A" />
      <circle cx="95" cy="25" r="1.9" fill="#FF6A00" />
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[rgba(14,11,10,0.86)] backdrop-blur-md backdrop-saturate-150">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight"
            >
              <FlameMark className="h-5 w-auto" />
              <span>Pregón</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-500">
              <Link href="/compose" className="hover:text-foreground">
                Componer
              </Link>
              <Link href="/history" className="hover:text-foreground">
                Historial
              </Link>
              <Link href="/accounts" className="hover:text-foreground">
                Cuentas
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-zinc-800">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-8 text-center">
            <a
              href="https://fervon.dev"
              target="_blank"
              rel="noreferrer"
              className="fervon-mark"
            >
              <FlameMark className="blogo" /> Parte de Fervon
            </a>
            <p className="text-xs text-[var(--dim)]">
              Forjado al rojo vivo · © {new Date().getFullYear()} Fervon
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
