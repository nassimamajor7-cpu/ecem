// Petits outils d'interface.
// On construit les éléments avec h() et textContent : jamais d'innerHTML avec des
// textes saisis par les élèves (protection contre l'injection de code / XSS).

export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(el, enfants) {
  for (const e of enfants) {
    if (e === null || e === undefined || e === false) continue;
    if (Array.isArray(e)) ajouter(el, e);
    else el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

export function vider(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function bouton(texte, options = {}) {
  const { variante = "", onclick, type = "button", disabled, moyen, large } = options;
  return h(
    "button",
    {
      type,
      onclick,
      disabled,
      class: `btn ${variante} ${moyen ? "moyen" : ""} ${large ? "large" : ""}`.trim(),
    },
    texte,
  );
}

// Zone de message (erreur / ok / info) qu'on peut mettre à jour
export function zoneMessage() {
  const el = h("div", { "aria-live": "polite" });
  el.afficher = (genre, texte) => {
    vider(el);
    if (texte) el.append(h("p", { class: `notice ${genre}`, role: genre === "erreur" ? "alert" : "status" }, texte));
  };
  return el;
}

export function carte(...enfants) {
  return h("section", { class: "carte" }, ...enfants);
}

export function champ(libelle, controle) {
  return h("label", {}, h("span", {}, libelle), controle);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export const ROLE_LABEL = { eleve: "Élève", suppleant: "Suppléant", delegue: "Délégué" };
export const ORDER_LABEL = {
  en_attente: "En attente",
  en_cours: "En cours d'impression",
  donne: "Donné",
  annule: "Annulé (remboursé)",
};
