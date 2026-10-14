"use client";
// Envoi de points à un autre élève (contrôle du solde fait côté serveur).
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";

export default function Envoyer() {
  const { profile, profiles, balance, refresh } = useAuth();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const autres = profiles.filter((p) => p.id !== profile?.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = Number(amount);
    if (!to) return setMsg({ kind: "error", text: "Choisis un destinataire." });
    if (!Number.isInteger(n) || n <= 0) {
      return setMsg({ kind: "error", text: "Le montant doit être un nombre entier positif." });
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("send_points", { p_to: to, p_amount: n });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: `${n} point${n > 1 ? "s" : ""} envoyé${n > 1 ? "s" : ""} !` });
      setAmount("");
      await refresh();
    }
    setBusy(false);
  }

  return (
    <Card>
      <Title>Envoyer des points</Title>
      <p className="text-lg mb-4">
        Tu as <strong>{balance}</strong> point{balance > 1 ? "s" : ""}.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="À qui ?">
          <select className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">— Choisis —</option>
            {autres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Combien de points ?">
          <input
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            required
          />
        </Field>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Envoi…" : "Envoyer"}
        </Button>
      </form>
    </Card>
  );
}
