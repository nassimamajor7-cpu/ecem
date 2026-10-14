"use client";
// Changement de mot de passe (obligatoire à la première connexion).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";

export default function MotDePassePage() {
  const { profile, refresh } = useAuth();
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    if (pwd !== pwd2) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    const { error: e1 } = await supabase.auth.updateUser({ password: pwd });
    if (e1) {
      setBusy(false);
      return setError(e1.message);
    }
    const { error: e2 } = await supabase.rpc("mark_password_changed");
    if (e2) {
      setBusy(false);
      return setError(e2.message);
    }
    await refresh();
    router.replace("/");
  }

  return (
    <Card>
      <Title>Choisis ton mot de passe</Title>
      {profile?.must_change_password && (
        <div className="mb-4">
          <Notice kind="info">
            C&apos;est ta première connexion : tu dois choisir ton propre mot de passe.
          </Notice>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nouveau mot de passe (8 caractères minimum)">
          <input className={inputClass} type="password" value={pwd}
            onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Répète le mot de passe">
          <input className={inputClass} type="password" value={pwd2}
            onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" required />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}
