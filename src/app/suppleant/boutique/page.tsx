"use client";
// Gestion de la boutique par les suppléants : ajouter / modifier / désactiver un cadeau.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";
import type { Gift } from "@/lib/types";

function LigneCadeau({
  gift,
  onSaved,
  onError,
}: {
  gift: Gift;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(gift.name);
  const [desc, setDesc] = useState(gift.description);
  const [price, setPrice] = useState(String(gift.price_points));
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Gift>) {
    setBusy(true);
    const { error } = await supabase.from("gifts").update(patch).eq("id", gift.id);
    if (error) onError(error.message);
    else onSaved();
    setBusy(false);
  }

  return (
    <li className={`rounded-xl border-2 border-slate-900 p-4 space-y-3 ${gift.active ? "" : "bg-slate-200"}`}>
      <Field label="Nom">
        <input className={inputClass} dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <input className={inputClass} dir="auto" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <Field label="Prix (points)">
        <input className={inputClass} inputMode="numeric" value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !name.trim() || Number(price) <= 0}
          onClick={() => save({ name: name.trim(), description: desc.trim(), price_points: Number(price) })}
        >
          Enregistrer
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => save({ active: !gift.active })}>
          {gift.active ? "Désactiver" : "Réactiver"}
        </Button>
      </div>
    </li>
  );
}

function Contenu() {
  const { profile } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("gifts").select("*").order("id", { ascending: false });
    setGifts((data ?? []) as Gift[]);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("gifts").insert({
      name: name.trim(),
      description: desc.trim(),
      price_points: Number(price),
      created_by: profile.id,
    });
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      setMsg({ kind: "ok", text: "Cadeau ajouté !" });
      setName("");
      setDesc("");
      setPrice("");
      await charger();
    }
  }

  return (
    <>
      <Card>
        <Title>Ajouter un cadeau</Title>
        <form onSubmit={ajouter} className="space-y-4">
          <Field label="Nom">
            <input className={inputClass} dir="auto" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Description">
            <input className={inputClass} dir="auto" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Prix (points)">
            <input className={inputClass} inputMode="numeric" value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} required />
          </Field>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <Button type="submit" className="w-full" disabled={Number(price) <= 0}>Ajouter</Button>
        </form>
      </Card>
      <Card>
        <Title>Les cadeaux</Title>
        {gifts.length === 0 && <p className="text-lg">Aucun cadeau.</p>}
        <ul className="space-y-4">
          {gifts.map((g) => (
            <LigneCadeau
              key={`${g.id}-${g.name}-${g.price_points}-${g.active}`}
              gift={g}
              onSaved={charger}
              onError={(m) => setMsg({ kind: "error", text: m })}
            />
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function GererBoutique() {
  return (
    <Gate roles={["suppleant"]}>
      <Contenu />
    </Gate>
  );
}
