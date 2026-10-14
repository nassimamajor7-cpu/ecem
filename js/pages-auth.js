// Pages de connexion et de changement de mot de passe.
import { supabase, loginToEmail } from "./supabase.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { h, vider, bouton, carte, champ, zoneMessage } from "./ui.js";

export function pageLogin() {
  const login = h("input", { autocapitalize: "none", autocorrect: "off", autocomplete: "username", required: true });
  const mdp = h("input", { type: "password", autocomplete: "current-password", required: true });
  const msg = zoneMessage();
  const btn = bouton("Se connecter", { type: "submit", large: true });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.afficher("", "");
      const { error } = await supabase.auth.signInWithPassword({
        email: loginToEmail(login.value),
        password: mdp.value,
      });
      if (error) msg.afficher("erreur", "Identifiant ou mot de passe incorrect.");
      btn.disabled = false;
    },
  }, champ("Identifiant", login), champ("Mot de passe", mdp), msg, btn);

  return carte(
    h("h1", {}, "Points de la classe"),
    form,
    h("hr", { style: "margin:1.25rem 0;border:1px solid #cbd5e1" }),
    h("p", { style: "margin-bottom:.75rem;font-weight:700" }, "Tu n'as pas encore de compte ?"),
    h("a", { href: "#/inscription", class: "btn secondaire large", style: "display:flex;align-items:center;justify-content:center;text-decoration:none" }, "Créer mon compte"),
  );
}

// ---------- Inscription : on demande le rôle, puis le code correspondant ----------
const ROLES_INSCRIPTION = {
  delegue: { titre: "Je suis délégué", libelleCode: "Code délégué" },
  suppleant: { titre: "Je suis suppléant", libelleCode: "Code suppléant" },
  eleve: { titre: "Non, je suis élève", libelleCode: "Code de la classe" },
};

export function pageInscription() {
  const conteneur = h("div");

  function etapeRole() {
    vider(conteneur);
    conteneur.append(
      h("h1", {}, "Créer mon compte"),
      h("p", { style: "font-size:1.2rem;font-weight:700;margin-bottom:1rem" }, "Es-tu délégué ou suppléant ?"),
      h("div", { style: "display:grid;gap:.75rem" },
        bouton(ROLES_INSCRIPTION.delegue.titre, { large: true, onclick: () => etapeFormulaire("delegue") }),
        bouton(ROLES_INSCRIPTION.suppleant.titre, { large: true, onclick: () => etapeFormulaire("suppleant") }),
        bouton(ROLES_INSCRIPTION.eleve.titre, { large: true, variante: "secondaire", onclick: () => etapeFormulaire("eleve") }),
      ),
      h("p", { style: "margin-top:1.25rem" },
        h("a", { href: "#/", style: "font-weight:700;font-size:1.1rem" }, "← J'ai déjà un compte")),
    );
  }

  function etapeFormulaire(role) {
    const info = ROLES_INSCRIPTION[role];
    const prenom = h("input", { autocomplete: "given-name", maxlength: "40", required: true });
    const mdp = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: "8" });
    const mdp2 = h("input", { type: "password", autocomplete: "new-password", required: true });
    const code = h("input", { autocapitalize: "characters", autocomplete: "off", required: true });
    const msg = zoneMessage();
    const btn = bouton("Créer mon compte", { type: "submit", large: true });

    const form = h("form", {
      onsubmit: async (e) => {
        e.preventDefault();
        msg.afficher("", "");
        if (mdp.value.length < 8) return msg.afficher("erreur", "Le mot de passe doit faire au moins 8 caractères.");
        if (mdp.value !== mdp2.value) return msg.afficher("erreur", "Les deux mots de passe ne sont pas identiques.");
        btn.disabled = true;
        let reponse;
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
            body: JSON.stringify({
              prenom: prenom.value, password: mdp.value, role, code: code.value.trim().toUpperCase(),
            }),
          });
          reponse = await r.json();
        } catch {
          btn.disabled = false;
          return msg.afficher("erreur", "Connexion impossible. Vérifie internet et réessaie.");
        }
        if (!reponse.ok) {
          btn.disabled = false;
          return msg.afficher("erreur", reponse.error || "Inscription impossible.");
        }
        // Compte créé : on connecte directement la personne
        const { error } = await supabase.auth.signInWithPassword({
          email: loginToEmail(prenom.value),
          password: mdp.value,
        });
        if (error) {
          btn.disabled = false;
          location.hash = "#/";
        }
      },
    },
      h("p", { class: "notice info" }, info.titre.replace("Non, je", "Je")),
      champ("Ton prénom (c'est aussi ton identifiant)", prenom),
      champ("Mot de passe (8 caractères minimum)", mdp),
      champ("Répète le mot de passe", mdp2),
      champ(info.libelleCode, code),
      msg,
      btn,
    );

    vider(conteneur);
    conteneur.append(
      h("h1", {}, "Créer mon compte"),
      form,
      h("p", { style: "margin-top:1rem" }, bouton("← Retour", { variante: "secondaire", onclick: etapeRole })),
    );
  }

  etapeRole();
  return carte(conteneur);
}

export function pageMotDePasse(apres) {
  const p1 = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: "8" });
  const p2 = h("input", { type: "password", autocomplete: "new-password", required: true });
  const msg = zoneMessage();
  const btn = bouton("Enregistrer", { type: "submit", large: true });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      msg.afficher("", "");
      if (p1.value.length < 8) return msg.afficher("erreur", "Le mot de passe doit faire au moins 8 caractères.");
      if (p1.value !== p2.value) return msg.afficher("erreur", "Les deux mots de passe ne sont pas identiques.");
      btn.disabled = true;
      const r1 = await supabase.auth.updateUser({ password: p1.value });
      if (r1.error) {
        btn.disabled = false;
        return msg.afficher("erreur", r1.error.message);
      }
      const r2 = await supabase.rpc("mark_password_changed");
      if (r2.error) {
        btn.disabled = false;
        return msg.afficher("erreur", r2.error.message);
      }
      await apres();
    },
  },
    champ("Nouveau mot de passe (8 caractères minimum)", p1),
    champ("Répète le mot de passe", p2),
    msg,
    btn,
  );

  return carte(
    h("h1", {}, "Choisis ton mot de passe"),
    h("p", { class: "notice info" }, "C'est ta première connexion : tu dois choisir ton propre mot de passe."),
    form,
  );
}
