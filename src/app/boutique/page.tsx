"use client";
// Boutique de cadeaux 3D + suivi de mes commandes.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Notice, Title } from "@/components/ui";
import { ORDER_LABEL, formatDate, type Gift, type Order } from "@/lib/types";

export default function Boutique() {
  const { profile, balance, refresh } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const charger = useCallback(async () => {
    if (!profile) return;
    const [g, o] = await Promise.all([
      supabase.from("gifts").select("*").eq("active", true).order("price_points"),
      supabase
        .from("orders")
        .select("*, gifts(name)")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);
    setGifts((g.data ?? []) as Gift[]);
    setOrders((o.data ?? []) as unknown as Order[]);
  }, [profile]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function commander(g: Gift) {
    if (busyId !== null) return;
    if (!window.confirm(`Commander « ${g.name} » pour ${g.price_points} points ?`)) return;
    setBusyId(g.id);
    setMsg(null);
    const { error } = await supabase.rpc("order_gift", { p_gift: g.id });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: `Commande envoyée : ${g.name} !` });
      await Promise.all([refresh(), charger()]);
    }
    setBusyId(null);
  }

  return (
    <>
      <Card>
        <Title>Boutique 3D</Title>
        <p className="text-lg mb-4">
          Tu as <strong>{balance}</strong> point{balance > 1 ? "s" : ""}.
        </p>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        {gifts.length === 0 && <p className="text-lg">Aucun cadeau pour le moment.</p>}
        <ul className="space-y-3 mt-3">
          {gifts.map((g) => (
            <li key={g.id} className="rounded-xl border-2 border-slate-900 p-4">
              <p className="text-2xl font-extrabold" dir="auto">{g.name}</p>
              {g.description && <p className="text-lg" dir="auto">{g.description}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-3xl font-extrabold">{g.price_points} pts</p>
                <Button
                  onClick={() => commander(g)}
                  disabled={busyId !== null || balance < g.price_points}
                >
                  {balance < g.price_points ? "Pas assez" : "Commander"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Title>Mes commandes</Title>
        {orders.length === 0 && <p className="text-lg">Aucune commande.</p>}
        <ul className="divide-y-2 divide-slate-300">
          {orders.map((o) => (
            <li key={o.id} className="py-3">
              <p className="text-lg font-bold" dir="auto">{o.gifts?.name ?? "Cadeau"}</p>
              <p className="text-lg">
                {ORDER_LABEL[o.status]} — {o.price_paid} pts
              </p>
              <p className="text-base text-slate-700">{formatDate(o.created_at)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
