// Pages communes : mes points, envoyer, boutique, idées.
import { supabase } from "./supabase.js";
import { state, nameOf, refreshBalance } from "./state.js";
import { h, vider, bouton, carte, champ, zoneMessage, formatDate, ORDER_LABEL } from "./ui.js";

// ---------- Mes points (solde + historique) ----------
const FILTRES = [
  { id: "tout", label: "Tout", types: null },
  { id: "gagne", label: "Gagnés", types: ["gain", "remboursement"] },
  { id: "recu", label: "Reçus", types: ["reception"] },
  { id: "envoye", label: "Envoyés", types: ["envoi"] },
  { id: "depense", label: "Dépensés", types: ["depense"] },
];

function libelle(t) {
  switch (t.type) {
    case "gain": return `Points gagnés (évaluation ${t.eval_type})`;
    case "envoi": return `Envoyés à ${nameOf(t.counterparty)}`;
    case "reception": return `Reçus de ${nameOf(t.counterparty)}`;
    case "depense": return "Dépensés : cadeau commandé";
    case "remboursement": return "Remboursement d'une commande";
    case "annulation": return "Échange annulé par un délégué";
    default: return t.type;
  }
}

export function pageAccueil(root) {
  const soldeEl = h("p", { class: "gros-solde" }, String(state.balance));
  const liste = h("ul", { class: "liste" });
  const msg = zoneMessage();
  const filtres = h("div", { class: "rangee filtres", style: "margin-bottom:1rem" });
  let txs = [];
  let filtre = "tout";

  function dessiner() {
    const f = FILTRES.find((x) => x.id === filtre);
    vider(filtres);
    FILTRES.forEach((x) =>
      filtres.append(h("button", { type: "button", class: x.id === filtre ? "actif" : "", onclick: () => { filtre = x.id; dessiner(); } }, x.label)));
    vider(liste);
    const vus = txs.filter((t) => !f.types || f.types.includes(t.type));
    if (!vus.length) liste.append(h("li", {}, "Rien à afficher pour le moment."));
    vus.forEach((t) =>
      liste.append(
        h("li", { class: "ligne-tx" },
          h("div", {}, h("p", { style: "font-weight:700" }, libelle(t)), h("p", { class: "date" }, formatDate(t.created_at))),
          h("p", { class: `montant ${t.amount > 0 ? "plus" : "moins"}` }, `${t.amount > 0 ? "+" : ""}${t.amount}`),
        )));
  }

  root.append(
    h("section", { class: "carte centre" },
      h("p", { style: "font-weight:700;font-size:1.2rem" }, "Mon solde"),
      soldeEl,
      h("p", { style: "font-size:1.2rem" }, "points"),
    ),
    carte(h("h1", {}, "Mon historique"), filtres, msg, liste),
  );

  refreshBalance().then(() => (soldeEl.textContent = String(state.balance)));
  supabase
    .from("transactions")
    .select("*")
    .eq("user_id", state.profile.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200)
    .then(({ data, error }) => {
      if (error) msg.afficher("erreur", error.message);
      txs = data ?? [];
      dessiner();
    });
  dessiner();
}

// ---------- Envoyer des points ----------
export function pageEnvoyer(root) {
  const autres = state.profiles.filter((p) => p.id !== state.profile.id);
  const dest = h("select", { required: true },
    h("option", { value: "" }, "— Choisis —"),
    autres.map((p) => h("option", { value: p.id }, p.display_name)));
  const montant = h("input", {
    inputmode: "numeric", required: true,
    oninput: (e) => (e.target.value = e.target.value.replace(/\D/g, "")),
  });
  const msg = zoneMessage();
  const btn = bouton("Envoyer", { type: "submit", large: true });
  const solde = h("p", { style: "font-size:1.15rem;margin-bottom:1rem" });
  const majSolde = () => (solde.textContent = `Tu as ${state.balance} point${state.balance > 1 ? "s" : ""}.`);
  majSolde();

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const n = Number(montant.value);
      if (!dest.value) return msg.afficher("erreur", "Choisis un destinataire.");
      if (!Number.isInteger(n) || n <= 0) return msg.afficher("erreur", "Le montant doit être un nombre entier positif.");
      btn.disabled = true;
      msg.afficher("", "");
      const { error } = await supabase.rpc("send_points", { p_to: dest.value, p_amount: n });
      if (error) msg.afficher("erreur", error.message);
      else {
        msg.afficher("ok", `${n} point${n > 1 ? "s" : ""} envoyé${n > 1 ? "s" : ""} !`);
        montant.value = "";
        await refreshBalance();
        majSolde();
      }
      btn.disabled = false;
    },
  }, champ("À qui ?", dest), champ("Combien de points ?", montant), msg, btn);

  root.append(carte(h("h1", {}, "Envoyer des points"), solde, form));
}

// ---------- Boutique ----------
export function pageBoutique(root) {
  const msg = zoneMessage();
  const listeCadeaux = h("ul", { class: "cartes" });
  const listeCommandes = h("ul", { class: "liste" });
  const solde = h("p", { style: "font-size:1.15rem;margin-bottom:1rem" });
  let occupe = false;

  async function charger() {
    solde.textContent = `Tu as ${state.balance} point${state.balance > 1 ? "s" : ""}.`;
    const [g, o] = await Promise.all([
      supabase.from("gifts").select("*").eq("active", true).order("price_points"),
      supabase.from("orders").select("*, gifts(name)").eq("student_id", state.profile.id).order("created_at", { ascending: false }),
    ]);
    vider(listeCadeaux);
    const gifts = g.data ?? [];
    if (!gifts.length) listeCadeaux.append(h("li", {}, "Aucun cadeau pour le moment."));
    gifts.forEach((c) =>
      listeCadeaux.append(
        h("li", {},
          h("p", { style: "font-size:1.4rem;font-weight:800", dir: "auto" }, c.name),
          c.description ? h("p", { dir: "auto" }, c.description) : null,
          h("div", { class: "ligne-tx" },
            h("p", { class: "prix" }, `${c.price_points} pts`),
            bouton(state.balance < c.price_points ? "Pas assez" : "Commander", {
              disabled: state.balance < c.price_points,
              onclick: () => commander(c),
            }),
          ),
        )));
    vider(listeCommandes);
    const orders = o.data ?? [];
    if (!orders.length) listeCommandes.append(h("li", {}, "Aucune commande."));
    orders.forEach((x) =>
      listeCommandes.append(
        h("li", {},
          h("p", { style: "font-weight:700", dir: "auto" }, x.gifts ? x.gifts.name : "Cadeau"),
          h("p", {}, `${ORDER_LABEL[x.status]} — ${x.price_paid} pts`),
          h("p", { class: "date" }, formatDate(x.created_at)),
        )));
  }

  async function commander(c) {
    if (occupe) return;
    if (!confirm(`Commander « ${c.name} » pour ${c.price_points} points ?`)) return;
    occupe = true;
    msg.afficher("", "");
    const { error } = await supabase.rpc("order_gift", { p_gift: c.id });
    if (error) msg.afficher("erreur", error.message);
    else {
      msg.afficher("ok", `Commande envoyée : ${c.name} !`);
      await refreshBalance();
    }
    await charger();
    occupe = false;
  }

  root.append(
    carte(h("h1", {}, "Boutique 3D"), solde, msg, listeCadeaux),
    carte(h("h1", {}, "Mes commandes"), listeCommandes),
  );
  charger();
}

// ---------- Boîte à idées (élèves et suppléants) ----------
const STATUT_IDEE = { en_attente: "En attente de réponse", acceptee: "Acceptée ✔", refusee: "Refusée ✘" };

export function pageIdees(root) {
  const liste = h("ul", { class: "liste" });
  const msg = zoneMessage();
  const texte = h("textarea", { dir: "auto", maxlength: "500", required: true });
  const btn = bouton("Envoyer l'idée", { type: "submit", large: true });

  async function charger() {
    const { data } = await supabase
      .from("ideas").select("*").eq("author_id", state.profile.id).order("created_at", { ascending: false });
    vider(liste);
    const ideas = data ?? [];
    if (!ideas.length) liste.append(h("li", {}, "Tu n'as pas encore envoyé d'idée."));
    ideas.forEach((i) =>
      liste.append(
        h("li", {},
          h("p", { dir: "auto", style: "font-size:1.15rem" }, i.body),
          h("p", { style: "font-weight:700" }, STATUT_IDEE[i.status]),
          i.response ? h("p", { class: "reponse", dir: "auto" }, `Réponse : ${i.response}`) : null,
          h("p", { class: "date" }, formatDate(i.created_at)),
        )));
  }

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!texte.value.trim()) return;
      btn.disabled = true;
      msg.afficher("", "");
      const { error } = await supabase.from("ideas").insert({ author_id: state.profile.id, body: texte.value.trim() });
      if (error) msg.afficher("erreur", "Impossible d'envoyer l'idée. Tu es peut-être bloqué par les délégués.");
      else {
        msg.afficher("ok", "Idée envoyée aux délégués !");
        texte.value = "";
        await charger();
      }
      btn.disabled = false;
    },
  }, champ("Ton idée (elle sera signée de ton prénom)", texte), msg, btn);

  root.append(
    carte(
      h("h1", {}, "Boîte à idées"),
      state.profile.bloque_idees
        ? h("p", { class: "notice erreur" }, "Les délégués ont bloqué l'envoi d'idées pour ton compte pour le moment.")
        : form,
    ),
    carte(h("h1", {}, "Mes idées"), liste),
  );
  charger();
}
