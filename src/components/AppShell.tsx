"use client";
// Cadre commun : protection des pages, menu selon le rôle, réglage "texte plus gros".
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import { ROLE_LABEL, type Role } from "@/lib/types";

const TAILLES = [18, 22, 26]; // px : normal, grand, très grand

interface Lien {
  href: string;
  label: string;
  roles: Role[];
}

const LIENS: Lien[] = [
  { href: "/", label: "Mes points", roles: ["eleve", "suppleant", "delegue"] },
  { href: "/envoyer", label: "Envoyer", roles: ["eleve", "suppleant", "delegue"] },
  { href: "/boutique", label: "Boutique", roles: ["eleve", "suppleant", "delegue"] },
  { href: "/idees", label: "Mes idées", roles: ["eleve", "suppleant"] },
  { href: "/delegue/notes", label: "Notes", roles: ["delegue"] },
  { href: "/delegue/echanges", label: "Échanges", roles: ["delegue"] },
  { href: "/delegue/idees", label: "Idées reçues", roles: ["delegue"] },
  { href: "/suppleant/boutique", label: "Gérer la boutique", roles: ["suppleant"] },
  { href: "/suppleant/commandes", label: "Commandes", roles: ["suppleant"] },
  { href: "/tchat", label: "Tchat", roles: ["delegue", "suppleant"] },
];

function TexteGros() {
  const [niveau, setNiveau] = useState(0);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem("taille-texte") ?? 0);
      if (n >= 0 && n < TAILLES.length) setNiveau(n);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${TAILLES[niveau]}px`;
    try {
      localStorage.setItem("taille-texte", String(niveau));
    } catch {}
  }, [niveau]);

  return (
    <button
      type="button"
      onClick={() => setNiveau((niveau + 1) % TAILLES.length)}
      className="min-h-12 px-4 rounded-xl border-2 border-white text-lg font-bold"
      aria-label="Changer la taille du texte"
    >
      Texte plus gros ({niveau + 1}/{TAILLES.length})
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, signedIn, profile, balance } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const surLogin = pathname === "/login";
  const surMotDePasse = pathname === "/mot-de-passe";

  useEffect(() => {
    if (loading) return;
    if (!signedIn && !surLogin) router.replace("/login");
    else if (signedIn && surLogin) router.replace("/");
    else if (signedIn && profile?.must_change_password && !surMotDePasse) {
      router.replace("/mot-de-passe");
    }
  }, [loading, signedIn, profile, surLogin, surMotDePasse, router]);

  if (loading) {
    return <p className="p-6 text-2xl font-bold">Chargement…</p>;
  }

  if (signedIn && !profile) {
    return (
      <main className="mx-auto w-full max-w-xl p-4 space-y-4">
        <p className="rounded-xl border-2 border-red-800 bg-red-100 p-4 text-lg font-semibold">
          Ce compte n&apos;est pas autorisé sur le site de la classe.
        </p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="min-h-14 px-6 rounded-xl border-2 border-slate-900 text-xl font-bold"
        >
          Se déconnecter
        </button>
      </main>
    );
  }

  if (!signedIn || !profile) {
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <div className="flex justify-end mb-4 bg-slate-900 p-2 rounded-xl text-white">
          <TexteGros />
        </div>
        {children}
      </main>
    );
  }

  const liens = LIENS.filter((l) => l.roles.includes(profile.role));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="bg-slate-900 text-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xl font-bold">
            {profile.display_name}{" "}
            <span className="text-base font-normal">({ROLE_LABEL[profile.role]})</span>
          </p>
          <p className="text-2xl font-extrabold" aria-label={`Solde : ${balance} points`}>
            {balance} pts
          </p>
        </div>
        {!profile.must_change_password && (
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Menu principal">
            {liens.map((l) => {
              const actif = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`min-h-12 px-4 flex items-center rounded-xl border-2 text-lg font-bold ${
                    actif ? "bg-white text-slate-900 border-white" : "border-white text-white"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <TexteGros />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="min-h-12 px-4 rounded-xl border-2 border-white text-lg font-bold"
          >
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="p-4 space-y-4">{children}</main>
    </div>
  );
}

// Protège une page : n'affiche le contenu que pour les rôles autorisés
export function Gate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!roles.includes(profile.role)) {
    return (
      <p className="rounded-xl border-2 border-red-800 bg-red-100 p-4 text-lg font-semibold">
        Cette page n&apos;est pas accessible avec ton rôle.
      </p>
    );
  }
  return <>{children}</>;
}
