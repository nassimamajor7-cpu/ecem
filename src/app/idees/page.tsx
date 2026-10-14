"use client";
// Boîte à idées : idées signées, réponse visible par l'auteur.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";
import { formatDate, type Idea } from "@/lib/types";

const STATUT = {
  en_attente: "En attente de réponse",
  acceptee: "Acceptée ✔",
  refusee: "Refusée ✘",
};

function Contenu() {
  const { profile } = useAuth();
  const [texte, setTexte] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("author_id", profile.id)
      .order("created_at", { ascending: false });
    setIdeas((data ?? []) as Idea[]);
  }, [profile]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase
      .from("ideas")
      .insert({ author_id: profile.id, body: texte.trim() });
    if (error) {
      setMsg({
        kind: "error",
        text: "Impossible d'envoyer l'idée. Tu es peut-être bloqué par les délégués.",
      });
    } else {
      setMsg({ kind: "ok", text: "Idée envoyée aux délégués !" });
      setTexte("");
      await charger();
    }
    setBusy(false);
  }

  return (
    <>
      <Card>
        <Title>Boîte à idées</Title>
        {profile?.bloque_idees ? (
          <Notice kind="error">
            Les délégués ont bloqué l&apos;envoi d&apos;idées pour ton compte pour le moment.
          </Notice>
        ) : (
          <form onSubmit={envoyer} className="space-y-4">
            <Field label="Ton idée (elle sera signée de ton prénom)">
              <textarea
                className={`${inputClass} min-h-40 py-3`}
                dir="auto"
                maxLength={500}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                required
              />
            </Field>
            {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
            <Button type="submit" disabled={busy || !texte.trim()} className="w-full">
              Envoyer l&apos;idée
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <Title>Mes idées</Title>
        {ideas.length === 0 && <p className="text-lg">Tu n&apos;as pas encore envoyé d&apos;idée.</p>}
        <ul className="divide-y-2 divide-slate-300">
          {ideas.map((i) => (
            <li key={i.id} className="py-3">
              <p className="text-lg" dir="auto">{i.body}</p>
              <p className="text-lg font-bold mt-1">{STATUT[i.status]}</p>
              {i.response && (
                <p className="text-lg bg-slate-100 rounded-xl p-3 mt-1" dir="auto">
                  Réponse : {i.response}
                </p>
              )}
              <p className="text-base text-slate-700">{formatDate(i.created_at)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function Idees() {
  return (
    <Gate roles={["eleve", "suppleant"]}>
      <Contenu />
    </Gate>
  );
}
