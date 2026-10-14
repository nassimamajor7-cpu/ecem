"use client";
// Saisie d'une note par un délégué. La note n'est JAMAIS stockée : seuls les points le sont.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";

function Contenu() {
  const { profile, profiles } = useAuth();
  const [student, setStudent] = useState("");
  const [type, setType] = useState<"sommative" | "formative">("sommative");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Un délégué ne peut pas saisir sa propre note : on retire son nom de la liste
  const cibles = profiles.filter((p) => p.id !== profile?.id);
  const max = type === "sommative" ? 20 : 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = Number(note.replace(",", "."));
    if (!student) return setMsg({ kind: "error", text: "Choisis un élève." });
    if (Number.isNaN(n) || n < 0 || n > max) {
      return setMsg({ kind: "error", text: `La note doit être entre 0 et ${max}.` });
    }
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("enter_grade", {
      p_student: student,
      p_eval_type: type,
      p_note: n,
    });
    setNote(""); // la note est oubliée aussitôt
    if (error) setMsg({ kind: "error", text: error.message });
    else {
      const nom = profiles.find((p) => p.id === student)?.display_name ?? "";
      const pts = data as number;
      setMsg(
        pts > 0
          ? { kind: "ok", text: `${nom} gagne ${pts} point${pts > 1 ? "s" : ""} !` }
          : { kind: "info", text: `${nom} ne gagne aucun point pour cette note.` },
      );
    }
    setBusy(false);
  }

  return (
    <Card>
      <Title>Saisir une note</Title>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Élève">
          <select className={inputClass} value={student} onChange={(e) => setStudent(e.target.value)} required>
            <option value="">— Choisis —</option>
            {cibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type d'évaluation">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as "sommative" | "formative")}>
            <option value="sommative">Sommative (sur 20)</option>
            <option value="formative">Formative (sur 10)</option>
          </select>
        </Field>
        <Field label={`Note (sur ${max})`}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex. 18,5"
            required
          />
        </Field>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Calcul…" : "Valider"}
        </Button>
      </form>
    </Card>
  );
}

export default function Notes() {
  return (
    <Gate roles={["delegue"]}>
      <Contenu />
    </Gate>
  );
}
