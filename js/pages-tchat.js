// Tchat privé en temps réel (délégués + suppléants). La sécurité vient de la RLS.
import { supabase } from "./supabase.js";
import { state, nameOf } from "./state.js";
import { h, carte, zoneMessage, bouton, formatDate } from "./ui.js";

export function pageTchat(root) {
  const fil = h("div", { class: "tchat-liste" });
  const msg = zoneMessage();
  const champTexte = h("input", { dir: "auto", maxlength: "1000", placeholder: "Ton message…" });
  const vus = new Set();

  function ajouterMessage(m) {
    if (vus.has(m.id)) return;
    vus.add(m.id);
    const moi = m.author_id === state.profile.id;
    fil.append(
      h("div", { class: `bulle ${moi ? "moi" : ""}` },
        h("p", { class: "qui" }, `${nameOf(m.author_id)} — ${formatDate(m.created_at)}`),
        h("p", { class: "texte", dir: "auto" }, m.body),
      ));
    fil.scrollTop = fil.scrollHeight;
  }

  const form = h("form", {
    class: "tchat-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const corps = champTexte.value.trim();
      if (!corps) return;
      champTexte.value = "";
      msg.afficher("", "");
      const { error } = await supabase.from("chat_messages").insert({ author_id: state.profile.id, body: corps });
      if (error) {
        msg.afficher("erreur", error.message);
        champTexte.value = corps;
      }
    },
  }, champTexte, bouton("Envoyer", { type: "submit" }));

  root.append(carte(h("h1", {}, "Tchat privé"), fil, msg, form));

  // Historique récent
  supabase
    .from("chat_messages").select("*").order("created_at", { ascending: false }).limit(100)
    .then(({ data }) => (data ?? []).reverse().forEach(ajouterMessage));

  // Nouveaux messages en temps réel
  const canal = supabase
    .channel("tchat")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => ajouterMessage(payload.new))
    .subscribe();

  // Nettoyage quand on quitte la page
  return () => supabase.removeChannel(canal);
}
