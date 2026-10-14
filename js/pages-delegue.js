// Pages réservées aux délégués : notes, échanges, idées reçues.
import { supabase } from "./supabase.js";
import { state, nameOf, loadAll } from "./state.js";
import { h, vider, bouton, carte, champ, zoneMessage, formatDate } from "./ui.js";

// ---------- Saisie d'une note (la note n'est JAMAIS stockée) ----------
export function pageNotes(root) {
  // Un délégué ne peut pas saisir sa propre note : son nom n'est pas dans la liste
  const cibles = state.profiles.filter((p) => p.id !== state.profile.id);
  const eleve = h("select", { required: true },
    h("option", { value: "" }, "— Choisis —"),
    cibles.map((p) => h("option", { value: p.id }, p.display_name)));
  const type = h("select", {},
    h("option", { value: "sommative" }, "Sommative (sur 20)"),
    h("option", { value: "formative" }, "Formative (sur 10)"));
  const note = h("input", { inputmode: "decimal", placeholder: "ex. 18,5", required: true });
  const libelleNote = h("span", {}, "Note (sur 20)");
  const msg = zoneMessage();
  const btn = bouton("Valider", { type: "submit", large: true });

  type.addEventListener("change", () => {
    libelleNote.textContent = `Note (sur ${type.value === "sommative" ? 20 : 10})`;
  });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const max = type.value === "sommative" ? 20 : 10;
      const n = Number(note.value.replace(",", "."));
      if (!eleve.value) return msg.afficher("erreur", "Choisis un élève.");
      if (Number.isNaN(n) || n < 0 || n > max) return msg.afficher("erreur", `La note doit être entre 0 et ${max}.`);
      btn.disabled = true;
      msg.afficher("", "");
      const { data, error } = await supabase.rpc("enter_grade", {
        p_student: eleve.value, p_eval_type: type.value, p_note: n,
      });
      note.value = ""; // la note est oubliée aussitôt
      if (error) msg.afficher("erreur", error.message);
      else {
        const nom = nameOf(eleve.value);
        msg.afficher(data > 0 ? "ok" : "info",
          data > 0 ? `${nom} gagne ${data} point${data > 1 ? "s" : ""} !` : `${nom} ne gagne aucun point pour cette note.`);
      }
      btn.disabled = false;
    },
  },
    champ("Élève", eleve),
    champ("Type d'évaluation", type),
    h("label", {}, libelleNote, note),
    msg, btn,
  );

  root.append(carte(h("h1", {}, "Saisir une note"), form));
}

// ---------- Tous les échanges + annulation ----------
export function pageEchanges(root) {
  const liste = h("ul", { class: "liste" });
  const msg = zoneMessage();
  let occupe = false;

  async function charger() {
    const [e, a] = await Promise.all([
      supabase.from("transactions").select("*").eq("type", "envoi").order("created_at", { ascending: false }).limit(200),
      supabase.from("transactions").select("related_tx").eq("type", "annulation"),
    ]);
    const annules = new Set((a.data ?? []).map((r) => r.related_tx));
    vider(liste);
    const envois = e.data ?? [];
    if (!envois.length) liste.append(h("li", {}, "Aucun échange pour le moment."));
    envois.forEach((t) =>
      liste.append(
        h("li", { class: "ligne-tx" },
          h("div", {},
            h("p", { style: "font-weight:700" }, `${nameOf(t.user_id)} → ${nameOf(t.counterparty)}`),
            h("p", { class: "date" }, formatDate(t.created_at))),
          h("div", { style: "text-align:right" },
            h("p", { class: "montant" }, `${-t.amount} pts`),
            annules.has(t.id)
              ? h("p", { style: "font-weight:700;color:#b91c1c" }, "Annulé")
              : bouton("Annuler", { variante: "danger", moyen: true, onclick: () => annuler(t) })),
        )));
  }

  async function annuler(t) {
    if (occupe) return;
    if (!confirm(`Annuler l'envoi de ${-t.amount} pts de ${nameOf(t.user_id)} à ${nameOf(t.counterparty)} ?`)) return;
    occupe = true;
    msg.afficher("", "");
    const { error } = await supabase.rpc("cancel_exchange", { p_envoi: t.id });
    if (error) msg.afficher("erreur", error.message);
    else msg.afficher("ok", "Échange annulé : les points sont revenus.");
    await charger();
    occupe = false;
  }

  root.append(carte(h("h1", {}, "Tous les échanges"), msg, liste));
  charger();
}

// ---------- Idées reçues : répondre, bloquer / débloquer ----------
const STATUT = { en_attente: "En attente", acceptee: "Acceptée ✔", refusee: "Refusée ✘" };

export function pageIdeesRecues(root) {
  const liste = h("ul", { class: "cartes" });
  const msg = zoneMessage();
  let occupe = false;

  async function charger() {
    const { data } = await supabase.from("ideas").select("*").order("created_at", { ascending: false }).limit(200);
    vider(liste);
    const ideas = data ?? [];
    if (!ideas.length) liste.append(h("li", {}, "Aucune idée pour le moment."));
    ideas.forEach((i) => {
      const auteur = state.profiles.find((p) => p.id === i.author_id);
      const bloque = !!(auteur && auteur.bloque_idees);
      const reponse = h("textarea", { placeholder: "Réponse (facultatif)", dir: "auto", maxlength: "500", style: "min-height:5rem" });
      liste.append(
        h("li", {},
          h("p", { style: "font-weight:700" }, `${nameOf(i.author_id)} — ${formatDate(i.created_at)} — ${STATUT[i.status]}`),
          h("p", { style: "font-size:1.2rem", dir: "auto" }, i.body),
          i.status === "en_attente"
            ? [reponse, h("div", { class: "rangee" },
                bouton("Accepter", { onclick: () => repondre(i.id, "acceptee", reponse.value) }),
                bouton("Refuser", { variante: "secondaire", onclick: () => repondre(i.id, "refusee", reponse.value) }))]
            : i.response ? h("p", { class: "reponse", dir: "auto" }, `Réponse : ${i.response}`) : null,
          auteur && auteur.role !== "delegue"
            ? bouton(bloque ? `Débloquer ${auteur.display_name}` : `Bloquer ${auteur.display_name}`, {
                variante: bloque ? "secondaire" : "danger", moyen: true,
                onclick: () => bloquer(auteur.id, !bloque),
              })
            : null,
        ));
    });
  }

  async function repondre(id, statut, texte) {
    if (occupe) return;
    occupe = true;
    msg.afficher("", "");
    const { error } = await supabase.rpc("answer_idea", { p_idea: id, p_status: statut, p_response: texte });
    if (error) msg.afficher("erreur", error.message);
    await charger();
    occupe = false;
  }

  async function bloquer(userId, bloque) {
    if (occupe) return;
    occupe = true;
    msg.afficher("", "");
    const { error } = await supabase.rpc("set_idea_block", { p_user: userId, p_blocked: bloque });
    if (error) msg.afficher("erreur", error.message);
    else {
      msg.afficher("ok", bloque ? "Élève bloqué." : "Élève débloqué.");
      await loadAll();
    }
    await charger();
    occupe = false;
  }

  root.append(carte(h("h1", {}, "Idées reçues"), msg, liste));
  charger();
}
