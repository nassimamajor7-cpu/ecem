"use client";
// Les délégués lisent les idées, répondent, et bloquent / débloquent les auteurs.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Notice, Title, inputClass } from "@/components/ui";
import { formatDate, type Idea } from "@/lib/types";

const STATUT = { en_attente: "En attente", acceptee: "Acceptée ✔", refusee: "Refusée ✘" };

function Contenu() {
  const { profiles, nameOf, refresh } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [reponses, setReponses] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setIdeas((data ?? []) as Idea[]);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function repondre(id: number, status: "acceptee" | "refusee") {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("answer_idea", {
      p_idea: id,
      p_status: status,
      p_response: reponses[id] ?? "",
    });
    if (error) setMsg({ kind: "error", text: error.message });
    else await charger();
    setBusy(false);
  }

  async function bloquer(userId: string, blocked: boolean) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("set_idea_block", { p_user: userId, p_blocked: blocked });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: blocked ? "Élève bloqué." : "Élève débloqué." });
      await refresh();
    }
    setBusy(false);
  }

  return (
    <Card>
      <Title>Idées reçues</Title>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {ideas.length === 0 && <p className="text-lg">Aucune idée pour le moment.</p>}
      <ul className="space-y-4 mt-3">
        {ideas.map((i) => {
          const auteur = profiles.find((p) => p.id === i.author_id);
          const bloque = !!auteur?.bloque_idees;
          return (
            <li key={i.id} className="rounded-xl border-2 border-slate-900 p-4 space-y-3">
              <p className="text-base font-bold">
                {nameOf(i.author_id)} — {formatDate(i.created_at)} — {STATUT[i.status]}
              </p>
              <p className="text-xl" dir="auto">{i.body}</p>
              {i.status === "en_attente" ? (
                <>
                  <textarea
                    className={`${inputClass} min-h-24 py-3`}
                    placeholder="Réponse (facultatif)"
                    dir="auto"
                    maxLength={500}
                    value={reponses[i.id] ?? ""}
                    onChange={(e) => setReponses({ ...reponses, [i.id]: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => repondre(i.id, "acceptee")}>Accepter</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => repondre(i.id, "refusee")}>
                      Refuser
                    </Button>
                  </div>
                </>
              ) : (
                i.response && <p className="text-lg bg-slate-100 rounded-xl p-3" dir="auto">Réponse : {i.response}</p>
              )}
              {auteur && auteur.role !== "delegue" && (
                <Button
                  variant={bloque ? "secondary" : "danger"}
                  className="min-h-12 text-lg"
                  disabled={busy}
                  onClick={() => bloquer(auteur.id, !bloque)}
                >
                  {bloque ? `Débloquer ${auteur.display_name}` : `Bloquer ${auteur.display_name}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function IdeesDelegue() {
  return (
    <Gate roles={["delegue"]}>
      <Contenu />
    </Gate>
  );
}
