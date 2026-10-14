"use client";
// Les délégués voient tous les échanges et peuvent les annuler.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Notice, Title } from "@/components/ui";
import { formatDate, type Tx } from "@/lib/types";

function Contenu() {
  const { nameOf, refresh } = useAuth();
  const [envois, setEnvois] = useState<Tx[]>([]);
  const [annules, setAnnules] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const charger = useCallback(async () => {
    const [e, a] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("type", "envoi")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("transactions").select("related_tx").eq("type", "annulation"),
    ]);
    setEnvois((e.data ?? []) as Tx[]);
    setAnnules(new Set((a.data ?? []).map((r) => r.related_tx as number)));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function annuler(t: Tx) {
    if (busyId !== null) return;
    if (!window.confirm(`Annuler l'envoi de ${-t.amount} pts de ${nameOf(t.user_id)} à ${nameOf(t.counterparty)} ?`)) return;
    setBusyId(t.id);
    setMsg(null);
    const { error } = await supabase.rpc("cancel_exchange", { p_envoi: t.id });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: "Échange annulé : les points sont revenus." });
      await Promise.all([charger(), refresh()]);
    }
    setBusyId(null);
  }

  return (
    <Card>
      <Title>Tous les échanges</Title>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {envois.length === 0 && <p className="text-lg">Aucun échange pour le moment.</p>}
      <ul className="divide-y-2 divide-slate-300 mt-3">
        {envois.map((t) => (
          <li key={t.id} className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold">
                {nameOf(t.user_id)} → {nameOf(t.counterparty)}
              </p>
              <p className="text-base text-slate-700">{formatDate(t.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold">{-t.amount} pts</p>
              {annules.has(t.id) ? (
                <p className="text-lg font-bold text-red-800">Annulé</p>
              ) : (
                <Button variant="danger" className="min-h-12 text-lg" disabled={busyId !== null} onClick={() => annuler(t)}>
                  Annuler
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Echanges() {
  return (
    <Gate roles={["delegue"]}>
      <Contenu />
    </Gate>
  );
}
