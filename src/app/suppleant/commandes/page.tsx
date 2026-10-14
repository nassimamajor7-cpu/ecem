"use client";
// Suivi des commandes par les suppléants : en attente → en cours → donné, ou annulé (remboursé).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Notice, Title } from "@/components/ui";
import { ORDER_LABEL, formatDate, type Order } from "@/lib/types";

function Contenu() {
  const { nameOf } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, gifts(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders((data ?? []) as unknown as Order[]);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function changer(o: Order, status: string) {
    if (busy) return;
    if (status === "annule" && !window.confirm("Annuler cette commande et rembourser l'élève ?")) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("set_order_status", { p_order: o.id, p_status: status });
    if (error) setMsg({ kind: "error", text: error.message });
    else await charger();
    setBusy(false);
  }

  return (
    <Card>
      <Title>Commandes</Title>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {orders.length === 0 && <p className="text-lg">Aucune commande.</p>}
      <ul className="space-y-4 mt-3">
        {orders.map((o) => (
          <li key={o.id} className="rounded-xl border-2 border-slate-900 p-4 space-y-2">
            <p className="text-xl font-extrabold" dir="auto">{o.gifts?.name ?? "Cadeau"}</p>
            <p className="text-lg">
              Pour <strong>{nameOf(o.student_id)}</strong> — {o.price_paid} pts
            </p>
            <p className="text-lg font-bold">{ORDER_LABEL[o.status]}</p>
            <p className="text-base text-slate-700">{formatDate(o.created_at)}</p>
            {(o.status === "en_attente" || o.status === "en_cours") && (
              <div className="flex flex-wrap gap-2">
                {o.status === "en_attente" && (
                  <Button disabled={busy} onClick={() => changer(o, "en_cours")}>Lancer l&apos;impression</Button>
                )}
                {o.status === "en_cours" && (
                  <Button disabled={busy} onClick={() => changer(o, "donne")}>Marquer « donné »</Button>
                )}
                <Button variant="danger" disabled={busy} onClick={() => changer(o, "annule")}>
                  Annuler + rembourser
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Commandes() {
  return (
    <Gate roles={["suppleant"]}>
      <Contenu />
    </Gate>
  );
}
