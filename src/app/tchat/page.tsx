"use client";
// Tchat privé en temps réel (délégués + suppléants). La sécurité est assurée par la RLS.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Gate } from "@/components/AppShell";
import { Button, Card, Notice, Title, inputClass } from "@/components/ui";
import { formatDate, type ChatMessage } from "@/lib/types";

function Contenu() {
  const { profile, nameOf } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [texte, setTexte] = useState("");
  const [error, setError] = useState("");
  const bas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let actif = true;
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (actif) setMessages(((data ?? []) as ChatMessage[]).reverse());
      });

    const canal = supabase
      .channel("tchat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    return () => {
      actif = false;
      supabase.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !texte.trim()) return;
    setError("");
    const corps = texte.trim();
    setTexte("");
    const { error } = await supabase
      .from("chat_messages")
      .insert({ author_id: profile.id, body: corps });
    if (error) {
      setError(error.message);
      setTexte(corps);
    }
  }

  return (
    <Card>
      <Title>Tchat privé</Title>
      <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && <p className="text-lg">Aucun message pour le moment.</p>}
        {messages.map((m) => {
          const moi = m.author_id === profile?.id;
          return (
            <div
              key={m.id}
              className={`rounded-xl border-2 border-slate-900 p-3 ${moi ? "bg-blue-100 ml-8" : "bg-slate-100 mr-8"}`}
            >
              <p className="text-base font-bold">
                {nameOf(m.author_id)} <span className="font-normal">— {formatDate(m.created_at)}</span>
              </p>
              <p className="text-xl whitespace-pre-wrap" dir="auto">{m.body}</p>
            </div>
          );
        })}
        <div ref={bas} />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={envoyer} className="flex gap-2 mt-2">
        <input
          className={inputClass}
          dir="auto"
          maxLength={1000}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ton message…"
        />
        <Button type="submit">Envoyer</Button>
      </form>
    </Card>
  );
}

export default function Tchat() {
  return (
    <Gate roles={["delegue", "suppleant"]}>
      <Contenu />
    </Gate>
  );
}
