// Pages réservées aux suppléants : gestion de la boutique et suivi des commandes.
import { supabase } from "./supabase.js";
import { state, nameOf } from "./state.js";
import { h, vider, bouton, carte, champ, zoneMessage, formatDate, ORDER_LABEL } from "./ui.js";

// ---------- Gérer la boutique ----------
export function pageGererBoutique(root) {
  const msg = zoneMessage();
  const liste = h("ul", { class: "cartes" });

  async function charger() {
    const { data } = await supabase.from("gifts").select("*").order("id", { ascending: false });
    vider(liste);
    const gifts = data ?? [];
    if (!gifts.length) liste.append(h("li", {}, "Aucun cadeau."));
    gifts.forEach((g) => liste.append(ligneCadeau(g)));
  }

  function ligneCadeau(g) {
    const nom = h("input", { dir: "auto", value: g.name });
    const desc = h("input", { dir: "auto", value: g.description });
    const prix = h("input", {
      inputmode: "numeric", value: String(g.price_points),
      oninput: (e) => (e.target.value = e.target.value.replace(/\D/g, "")),
    });
    async function sauver(patch) {
      msg.afficher("", "");
      const { error } = await supabase.from("gifts").update(patch).eq("id", g.id);
      if (error) msg.afficher("erreur", error.message);
      await charger();
    }
    return h("li", { class: g.active ? "" : "inactif" },
      champ("Nom", nom), champ("Description", desc), champ("Prix (points)", prix),
      h("div", { class: "rangee" },
        bouton("Enregistrer", {
          onclick: () => sauver({
            name: nom.value.trim(), description: desc.value.trim(), price_points: Number(prix.value),
          }),
        }),
        bouton(g.active ? "Désactiver" : "Réactiver", { variante: "secondaire", onclick: () => sauver({ active: !g.active }) }),
      ));
  }

  const nom = h("input", { dir: "auto", required: true });
  const desc = h("input", { dir: "auto" });
  const prix = h("input", {
    inputmode: "numeric", required: true,
    oninput: (e) => (e.target.value = e.target.value.replace(/\D/g, "")),
  });
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      if (Number(prix.value) <= 0) return msg.afficher("erreur", "Le prix doit être supérieur à 0.");
      const { error } = await supabase.from("gifts").insert({
        name: nom.value.trim(), description: desc.value.trim(),
        price_points: Number(prix.value), created_by: state.profile.id,
      });
      if (error) msg.afficher("erreur", error.message);
      else {
        msg.afficher("ok", "Cadeau ajouté !");
        nom.value = desc.value = prix.value = "";
        await charger();
      }
    },
  }, champ("Nom", nom), champ("Description", desc), champ("Prix (points)", prix), bouton("Ajouter", { type: "submit", large: true }));

  root.append(
    carte(h("h1", {}, "Ajouter un cadeau"), form, msg),
    carte(h("h1", {}, "Les cadeaux"), liste),
  );
  charger();
}

// ---------- Suivi des commandes ----------
export function pageCommandes(root) {
  const msg = zoneMessage();
  const liste = h("ul", { class: "cartes" });
  let occupe = false;

  async function charger() {
    const { data } = await supabase
      .from("orders").select("*, gifts(name)").order("created_at", { ascending: false }).limit(200);
    vider(liste);
    const orders = data ?? [];
    if (!orders.length) liste.append(h("li", {}, "Aucune commande."));
    orders.forEach((o) => {
      const actions = [];
      if (o.status === "en_attente") actions.push(bouton("Lancer l'impression", { onclick: () => changer(o, "en_cours") }));
      if (o.status === "en_cours") actions.push(bouton("Marquer « donné »", { onclick: () => changer(o, "donne") }));
      if (o.status === "en_attente" || o.status === "en_cours") {
        actions.push(bouton("Annuler + rembourser", { variante: "danger", onclick: () => changer(o, "annule") }));
      }
      liste.append(
        h("li", {},
          h("p", { style: "font-size:1.3rem;font-weight:800", dir: "auto" }, o.gifts ? o.gifts.name : "Cadeau"),
          h("p", {}, "Pour ", h("strong", {}, nameOf(o.student_id)), ` — ${o.price_paid} pts`),
          h("p", { style: "font-weight:700" }, ORDER_LABEL[o.status]),
          h("p", { class: "date" }, formatDate(o.created_at)),
          actions.length ? h("div", { class: "rangee" }, actions) : null,
        ));
    });
  }

  async function changer(o, statut) {
    if (occupe) return;
    if (statut === "annule" && !confirm("Annuler cette commande et rembourser l'élève ?")) return;
    occupe = true;
    msg.afficher("", "");
    const { error } = await supabase.rpc("set_order_status", { p_order: o.id, p_status: statut });
    if (error) msg.afficher("erreur", error.message);
    await charger();
    occupe = false;
  }

  root.append(carte(h("h1", {}, "Commandes"), msg, liste));
  charger();
}
