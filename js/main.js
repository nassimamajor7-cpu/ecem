// Point d'entrée : connexion, protection des pages, menu selon le rôle, routeur.
import { supabase } from "./supabase.js";
import { state, loadAll } from "./state.js";
import { h, vider, ROLE_LABEL } from "./ui.js";
import { pageLogin, pageInscription, pageMotDePasse } from "./pages-auth.js";
import { pageAccueil, pageEnvoyer, pageBoutique, pageIdees } from "./pages-eleve.js";
import { pageNotes, pageEchanges, pageIdeesRecues } from "./pages-delegue.js";
import { pageGererBoutique, pageCommandes } from "./pages-suppleant.js";
import { pageTchat } from "./pages-tchat.js";

const TOUS = ["eleve", "suppleant", "delegue"];

// Chaque page : titre du menu, rôles autorisés, fonction d'affichage
const ROUTES = {
  "/": { label: "Mes points", roles: TOUS, page: pageAccueil },
  "/envoyer": { label: "Envoyer", roles: TOUS, page: pageEnvoyer },
  "/boutique": { label: "Boutique", roles: TOUS, page: pageBoutique },
  "/idees": { label: "Mes idées", roles: ["eleve", "suppleant"], page: pageIdees },
  "/delegue/notes": { label: "Notes", roles: ["delegue"], page: pageNotes },
  "/delegue/echanges": { label: "Échanges", roles: ["delegue"], page: pageEchanges },
  "/delegue/idees": { label: "Idées reçues", roles: ["delegue"], page: pageIdeesRecues },
  "/suppleant/boutique": { label: "Gérer la boutique", roles: ["suppleant"], page: pageGererBoutique },
  "/suppleant/commandes": { label: "Commandes", roles: ["suppleant"], page: pageCommandes },
  "/tchat": { label: "Tchat", roles: ["delegue", "suppleant"], page: pageTchat },
};

const app = document.getElementById("app");
let nettoyage = null; // fonction appelée quand on quitte une page (ex. tchat)

// ----- Réglage "texte plus gros" -----
const TAILLES = [18, 22, 26];
function niveauTexte() {
  try {
    const n = Number(localStorage.getItem("taille-texte") ?? 0);
    return n >= 0 && n < TAILLES.length ? n : 0;
  } catch {
    return 0;
  }
}
function appliquerTexte(n) {
  document.documentElement.style.fontSize = `${TAILLES[n]}px`;
  try {
    localStorage.setItem("taille-texte", String(n));
  } catch {}
}
function boutonTexte() {
  const b = h("button", { type: "button", "aria-label": "Changer la taille du texte" });
  const maj = () => (b.textContent = `Texte plus gros (${niveauTexte() + 1}/${TAILLES.length})`);
  b.addEventListener("click", () => {
    appliquerTexte((niveauTexte() + 1) % TAILLES.length);
    maj();
  });
  maj();
  return b;
}
appliquerTexte(niveauTexte());

// ----- Affichage -----
function cadreInvite(contenu) {
  vider(app);
  app.append(
    h("div", { class: "petit" },
      h("div", { class: "entete", style: "border-radius:.75rem;padding:.5rem;margin-bottom:1rem;background:#0f172a;display:flex;justify-content:flex-end" }, boutonTexte()),
      contenu,
    ),
  );
}

function cadreConnecte(chemin, route) {
  const { profile } = state;
  const liens = Object.entries(ROUTES).filter(([, r]) => r.roles.includes(profile.role));
  const main = h("main");

  const menu = profile.must_change_password
    ? null
    : h("nav", { class: "menu", "aria-label": "Menu principal" },
        liens.map(([href, r]) =>
          h("a", { href: `#${href}`, class: href === chemin ? "actif" : "" }, r.label)),
      );

  vider(app);
  app.append(
    h("div", { class: "conteneur" },
      h("header", { class: "entete" },
        h("div", { class: "ligne" },
          h("p", { class: "nom" }, profile.display_name, " ", h("small", {}, `(${ROLE_LABEL[profile.role]})`)),
          h("p", { class: "solde", id: "solde" }, `${state.balance} pts`),
        ),
        menu,
        h("div", { class: "outils" },
          boutonTexte(),
          h("button", { type: "button", onclick: () => supabase.auth.signOut() }, "Se déconnecter"),
        ),
      ),
      main,
    ),
  );
  return main;
}

async function afficher() {
  if (nettoyage) {
    try { nettoyage(); } catch {}
    nettoyage = null;
  }

  // Pas connecté : page de connexion
  if (!state.session) {
    cadreInvite(h("div"));
    const zone = app.querySelector(".petit");
    zone.lastChild.replaceWith(location.hash === "#/inscription" ? pageInscription() : pageLogin());
    return;
  }

  // Connecté mais sans profil : compte non autorisé
  if (!state.profile) {
    cadreInvite(
      h("div", {},
        h("p", { class: "notice erreur" }, "Ce compte n'est pas autorisé sur le site de la classe."),
        h("button", { class: "btn secondaire", type: "button", onclick: () => supabase.auth.signOut() }, "Se déconnecter"),
      ),
    );
    return;
  }

  // Première connexion : mot de passe à changer
  if (state.profile.must_change_password) {
    const main = cadreConnecte("", null);
    main.append(pageMotDePasse(async () => {
      await loadAll();
      location.hash = "#/";
      afficher();
    }));
    return;
  }

  // Après une inscription réussie, on quitte l'adresse #/inscription
  if (location.hash === "#/inscription") history.replaceState(null, "", "#/");
  const chemin = location.hash.slice(1) || "/";
  const route = ROUTES[chemin] ?? ROUTES["/"];
  const main = cadreConnecte(ROUTES[chemin] ? chemin : "/", route);

  if (!route.roles.includes(state.profile.role)) {
    main.append(h("p", { class: "notice erreur" }, "Cette page n'est pas accessible avec ton rôle."));
    return;
  }
  const res = route.page(main);
  if (typeof res === "function") nettoyage = res;
}

// ----- Démarrage -----
// (on évite d'appeler Supabase directement dans le callback : on décale d'un tour)
supabase.auth.onAuthStateChange((event, session) => {
  const memeUtilisateur =
    !!session && !!state.session && session.user.id === state.session.user.id;
  state.session = session;
  // Même personne (retour sur l'onglet, renouvellement du jeton...) : on ne redessine pas
  if (memeUtilisateur && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
  setTimeout(async () => {
    await loadAll();
    afficher();
  }, 0);
});

window.addEventListener("hashchange", () => {
  // Visiteur : bascule connexion <-> inscription. Connecté : changement de page.
  if (!state.session || state.profile) afficher();
});
