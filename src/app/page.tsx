"use client";
// Tableau de bord : solde + historique (gagné, reçu, envoyé, dépensé).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Card, Notice, Title } from "@/components/ui";
import { formatDate, type Tx } from "@/lib/types";

const FILTRES = [
  { id: "tout", label: "Tout", types: null },
  { id: "gagne", label: "Gagnés", types: ["gain", "remboursement"] },
  { id: "recu", label: "Reçus", types: ["reception"] },
  { id: "envoye", label: "Envoyés", types: ["envoi"] },
  { id: "depense", label: "Dépensés", types: ["depense"] },
] as const;

export default function Accueil() {
  const { profile, balance, nameOf, refresh } = useAuth();
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [filtre, setFiltre] = useState<string>("tout");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    refresh();
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTxs(data as Tx[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function libelle(t: Tx): string {
    switch (t.type) {
      case "gain":
        return `Points gagnés (évaluation ${t.eval_type})`;
      case "envoi":
        return `Envoyés à ${nameOf(t.counterparty)}`;
      case "reception":
        return `Reçus de ${nameOf(t.counterparty)}`;
      case "depense":
        return "Dépensés : cadeau commandé";
      case "remboursement":
        return "Remboursement d'une commande";
      case "annulation":
        return "Échange annulé par un délégué";
    }
  }

  const actif = FILTRES.find((f) => f.id === filtre)!;
  const liste = (txs ?? []).filter((t) => !actif.types || (actif.types as readonly string[]).includes(t.type));

  return (
    <>
      <Card className="text-center">
        <p className="text-xl font-bold">Mon solde</p>
        <p className="text-6xl font-extrabold my-2">{balance}</p>
        <p className="text-xl">point{balance > 1 ? "s" : ""}</p>
      </Card>

      <Card>
        <Title>Mon historique</Title>
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTRES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`min-h-12 px-4 rounded-xl border-2 border-slate-900 text-lg font-bold ${
                filtre === f.id ? "bg-slate-900 text-white" : "bg-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        {txs === null && !error && <p className="text-lg">Chargement…</p>}
        {txs !== null && liste.length === 0 && <p className="text-lg">Rien à afficher pour le moment.</p>}
        <ul className="divide-y-2 divide-slate-300">
          {liste.map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{libelle(t)}</p>
                <p className="text-base text-slate-700">{formatDate(t.created_at)}</p>
              </div>
              <p className={`text-3xl font-extrabold ${t.amount > 0 ? "text-green-800" : "text-red-800"}`}>
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
