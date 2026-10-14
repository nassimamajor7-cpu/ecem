"use client";
// Connexion : l'élève tape seulement son identifiant et son mot de passe.
import { useState } from "react";
import { supabase, loginToEmail } from "@/lib/supabase";
import { Button, Card, Field, Notice, Title, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login),
      password,
    });
    if (error) setError("Identifiant ou mot de passe incorrect.");
    setBusy(false);
  }

  return (
    <Card>
      <Title>Points de la classe</Title>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Identifiant">
          <input
            className={inputClass}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Mot de passe">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </Card>
  );
}
